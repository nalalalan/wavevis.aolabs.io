import type {
  ColorMode,
  DihedralMetric,
  DihedralPair,
  EdgeMetric,
  InverseSheetConfig,
  LatticeBounds,
  LatticeEdge,
  LatticeModel,
  LatticeNode,
  LatticeQuad,
  MetricsSummary,
  NodeMetric,
  QuadMetric,
  RadiusMode,
  TargetPreset,
  Vec3,
} from './inverseSheetTypes'

export const COLOR_MODES: Array<{ value: ColorMode; label: string }> = [
  { value: 'edgeStrain', label: 'Edge strain' },
  { value: 'edgeRotation', label: 'Edge rotation' },
  { value: 'nodeBend', label: 'Node bend' },
  { value: 'shear', label: 'Shear' },
  { value: 'dihedral', label: 'Dihedral' },
  { value: 'areaChange', label: 'Area change' },
  { value: 'displacement', label: 'Displacement' },
  { value: 'combinedCost', label: 'Combined cost' },
]

export const DEFAULT_INVERSE_SHEET_CONFIG: InverseSheetConfig = {
  rows: 44,
  columns: 44,
  spacing: 1,
  targetPreset: 'overhang',
  morph: 1,
  verticalDirection: 'up',
  bendAngleDeg: 172,
  supportFraction: 0.14,
  radiusMode: 'autoPreserveLength',
  bendRadius: 4,
  horizontalOffset: 7,
  smoothing: 0.86,
  widthScale: 1,
  strainWeight: 1,
  bendWeight: 0.02,
  shearWeight: 0.02,
  dihedralWeight: 0.02,
  showSurface: true,
  showRestGhost: true,
  showNodes: true,
  showEdges: true,
  showLabels: false,
  showHeatmap: true,
  colorMode: 'edgeStrain',
}

const TARGET_PRESETS: TargetPreset[] = ['overhang']
const RADIUS_MODES: RadiusMode[] = ['autoPreserveLength', 'manual']
const COLOR_MODE_VALUES = COLOR_MODES.map((mode) => mode.value)

type LooseConfig = Partial<Record<keyof InverseSheetConfig, unknown>>

export function sanitizeInverseSheetConfig(input: LooseConfig = {}): InverseSheetConfig {
  const raw: LooseConfig = { ...DEFAULT_INVERSE_SHEET_CONFIG, ...input }

  return {
    rows: readInteger(raw.rows, DEFAULT_INVERSE_SHEET_CONFIG.rows, 2, 72),
    columns: readInteger(raw.columns, DEFAULT_INVERSE_SHEET_CONFIG.columns, 2, 72),
    spacing: 1,
    targetPreset: readOneOf(raw.targetPreset, TARGET_PRESETS, DEFAULT_INVERSE_SHEET_CONFIG.targetPreset),
    morph: readNumber(raw.morph, DEFAULT_INVERSE_SHEET_CONFIG.morph, 0, 1),
    verticalDirection: 'up',
    bendAngleDeg: DEFAULT_INVERSE_SHEET_CONFIG.bendAngleDeg,
    supportFraction: DEFAULT_INVERSE_SHEET_CONFIG.supportFraction,
    radiusMode: readOneOf(raw.radiusMode, RADIUS_MODES, DEFAULT_INVERSE_SHEET_CONFIG.radiusMode),
    bendRadius: readNumber(raw.bendRadius, DEFAULT_INVERSE_SHEET_CONFIG.bendRadius, 0.1, 100),
    horizontalOffset: readNumber(raw.horizontalOffset, DEFAULT_INVERSE_SHEET_CONFIG.horizontalOffset, 0, 24),
    smoothing: readNumber(raw.smoothing, DEFAULT_INVERSE_SHEET_CONFIG.smoothing, 0, 1),
    widthScale: 1,
    strainWeight: readNumber(raw.strainWeight, DEFAULT_INVERSE_SHEET_CONFIG.strainWeight, 0, 100),
    bendWeight: readNumber(raw.bendWeight, DEFAULT_INVERSE_SHEET_CONFIG.bendWeight, 0, 100),
    shearWeight: readNumber(raw.shearWeight, DEFAULT_INVERSE_SHEET_CONFIG.shearWeight, 0, 100),
    dihedralWeight: readNumber(raw.dihedralWeight, DEFAULT_INVERSE_SHEET_CONFIG.dihedralWeight, 0, 100),
    showSurface: readBoolean(raw.showSurface, DEFAULT_INVERSE_SHEET_CONFIG.showSurface),
    showRestGhost: readBoolean(raw.showRestGhost, DEFAULT_INVERSE_SHEET_CONFIG.showRestGhost),
    showNodes: readBoolean(raw.showNodes, DEFAULT_INVERSE_SHEET_CONFIG.showNodes),
    showEdges: readBoolean(raw.showEdges, DEFAULT_INVERSE_SHEET_CONFIG.showEdges),
    showLabels: readBoolean(raw.showLabels, DEFAULT_INVERSE_SHEET_CONFIG.showLabels),
    showHeatmap: readBoolean(raw.showHeatmap, DEFAULT_INVERSE_SHEET_CONFIG.showHeatmap),
    colorMode: readOneOf(raw.colorMode, COLOR_MODE_VALUES, DEFAULT_INVERSE_SHEET_CONFIG.colorMode),
  }
}

export function buildInverseSheetModel(input: LooseConfig = {}): LatticeModel {
  const config = sanitizeInverseSheetConfig(input)
  const nodes = buildNodes(config)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = buildEdges(config.rows, config.columns)
  const quads = buildQuads(config.rows, config.columns)
  const dihedralPairs = buildDihedralPairs(config.rows, config.columns)
  const edgeMetricsRaw = edges.map((edge) => measureEdge(edge, nodeById))
  const quadMetricsRaw = quads.map((quad) => measureQuad(quad, nodeById))
  const quadNormals = buildQuadCurrentNormals(quads, nodeById)
  const dihedralMetricsRaw = dihedralPairs.map((pair) => measureDihedral(pair, quadNormals))
  const dihedralByQuad = buildDihedralContributionByQuad(dihedralMetricsRaw)
  const nodeMetricsRaw = nodes.map((node) => measureNode(node, config, nodeById))
  const summaryBase = summarizeMetrics(edgeMetricsRaw, nodeMetricsRaw, quadMetricsRaw, dihedralMetricsRaw, nodes)
  const summary: MetricsSummary = {
    ...summaryBase,
    combinedCost:
      config.strainWeight * summaryBase.meanAbsStrain +
      config.bendWeight * summaryBase.meanBendDeg +
      config.shearWeight * summaryBase.meanShearDeg +
      config.dihedralWeight * summaryBase.meanDihedralDeg,
  }
  const edgeMetrics = addEdgeLocalCosts(edgeMetricsRaw, config)
  const nodeMetrics = addNodeLocalCosts(nodeMetricsRaw, config)
  const quadMetrics = addQuadLocalCosts(quadMetricsRaw, dihedralByQuad, config)
  const dihedralMetrics = addDihedralLocalCosts(dihedralMetricsRaw, config)

  return {
    config,
    nodes,
    edges,
    quads,
    dihedralPairs,
    edgeMetrics,
    nodeMetrics,
    quadMetrics,
    dihedralMetrics,
    summary,
    bounds: measureBounds(nodes),
  }
}

export function runInverseSheetSanityChecks(): string[] {
  const failures: string[] = []
  const flat = buildInverseSheetModel({ morph: 0 })
  const zeroed = buildInverseSheetModel({ horizontalOffset: 0 })
  const twoByTwo = buildInverseSheetModel({ rows: 2, columns: 2 })
  const defaultOverhang = buildInverseSheetModel(DEFAULT_INVERSE_SHEET_CONFIG)
  const highOverhang = buildInverseSheetModel({ horizontalOffset: 24 })
  const twelveByTwelve = buildInverseSheetModel({ rows: 12, columns: 12 })
  const fortyByForty = buildInverseSheetModel({ rows: 40, columns: 40 })

  if (!isSummaryNearZero(flat.summary)) failures.push('morph = 0 should produce near-zero metrics')
  if (!isSummaryNearZero(zeroed.summary)) failures.push('zero bend and zero offset should keep the grid flat')
  if (twelveByTwelve.edges.length !== 12 * 11 + 12 * 11) failures.push('12x12 edge count mismatch')
  if (twelveByTwelve.quads.length !== 11 * 11) failures.push('12x12 quad count mismatch')
  if (twoByTwo.nodes.length !== 4 || twoByTwo.quads.length !== 1) failures.push('2x2 grid did not build')
  if (fortyByForty.nodes.some((node) => !isFiniteVec(node.currentPosition))) failures.push('40x40 produced invalid node positions')
  if (!boundaryNodesStayFlat(defaultOverhang)) failures.push('default overhang boundary should stay fixed and flat')
  if (!boundaryNodesStayFlat(highOverhang)) failures.push('high-overhang boundary should stay fixed and flat')
  if (!centerlineBackfoldIsBounded(highOverhang)) failures.push('high-overhang centerline should not fold backward globally')
  if (defaultOverhang.summary.overhangAmount <= 0) failures.push('default overhang should report a positive horizontal projection')

  return failures
}

function boundaryNodesStayFlat(model: LatticeModel): boolean {
  const tolerance = 0.000001
  return model.nodes.every((node) => {
    const onBoundary =
      node.row === 0 ||
      node.col === 0 ||
      node.row === model.config.rows - 1 ||
      node.col === model.config.columns - 1

    if (!onBoundary) return true

    return (
      Math.abs(node.currentPosition[0] - node.restPosition[0]) <= tolerance &&
      Math.abs(node.currentPosition[1] - node.restPosition[1]) <= tolerance &&
      Math.abs(node.currentPosition[2]) <= tolerance
    )
  })
}

function centerlineBackfoldIsBounded(model: LatticeModel): boolean {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const tolerance = -model.config.spacing * 0.45

  for (let index = 0; index < centerline.length - 1; index += 1) {
    const deltaX = centerline[index + 1].currentPosition[0] - centerline[index].currentPosition[0]
    if (deltaX < tolerance) return false
  }

  return true
}

function buildNodes(config: InverseSheetConfig): LatticeNode[] {
  const totalWidth = (config.columns - 1) * config.spacing
  const totalHeight = (config.rows - 1) * config.spacing
  const targetHeight = totalHeight * config.widthScale
  const nodes: LatticeNode[] = []

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.columns; col += 1) {
      const uncenteredRest: Vec3 = [col * config.spacing, row * config.spacing, 0]
      const restPosition: Vec3 = [uncenteredRest[0] - totalWidth / 2, uncenteredRest[1] - totalHeight / 2, 0]
      const targetUncentered = overhangTargetPosition(uncenteredRest, row, col, config, totalWidth, totalHeight)
      const targetPosition: Vec3 = [
        targetUncentered[0] - totalWidth / 2,
        targetUncentered[1] - targetHeight / 2,
        targetUncentered[2],
      ]
      const currentPosition = lerpVec(restPosition, targetPosition, config.morph)

      nodes.push({
        id: nodeId(row, col),
        row,
        col,
        restPosition: finiteVec(restPosition),
        targetPosition: finiteVec(targetPosition),
        currentPosition: finiteVec(currentPosition),
      })
    }
  }

  return nodes
}

function overhangTargetPosition(
  rest: Vec3,
  row: number,
  col: number,
  config: InverseSheetConfig,
  totalWidth: number,
  totalHeight: number,
): Vec3 {
  const columnsDenominator = Math.max(config.columns - 1, 1)
  const rowsDenominator = Math.max(config.rows - 1, 1)
  const u = col / columnsDenominator
  const t = row / rowsDenominator
  const gridDenominator = Math.max(rowsDenominator, columnsDenominator)
  const flatRim = Math.min(0.12, Math.max(3.4 / gridDenominator, 0.055))
  const blendRim = Math.min(0.62, flatRim + lerpNumber(0.38, 0.52, config.smoothing))
  const rimY = edgeRamp(t, flatRim, blendRim) * edgeRamp(1 - t, flatRim, blendRim)
  const rimX = edgeRamp(u, flatRim, Math.min(0.48, flatRim + 0.34)) * edgeRamp(1 - u, flatRim, Math.min(0.48, flatRim + 0.34))
  const activityMask = rimX * rimY

  if (Math.abs(config.horizontalOffset) <= 0.000001) {
    return [rest[0], rest[1] * config.widthScale, 0]
  }

  if (activityMask <= 0.000001) {
    return [rest[0], rest[1] * config.widthScale, 0]
  }

  const profileStart = Math.max(flatRim, 0.1)
  const profileEnd = Math.min(1 - flatRim, 0.9)
  if (u <= profileStart || u >= profileEnd) {
    return [rest[0], rest[1] * config.widthScale, 0]
  }

  const remainingU = Math.max(profileEnd - profileStart, 0.000001)
  const profileU = clampNumber((u - profileStart) / remainingU, 0, 1)
  const eased = lerpNumber(profileU, smootherStep(profileU), 0.18 + config.smoothing * 0.28)
  const remainingLength = Math.max(totalWidth * remainingU, config.spacing)
  const overhangAmount = Math.min(config.horizontalOffset, remainingLength * 0.58)
  const overhangRatio = overhangAmount / Math.max(totalWidth, config.spacing)
  const rise = smootherStep((profileU - 0.02) / 0.62)
  const fall = 1 - smootherStep((profileU - 0.7) / 0.3)
  const crestShelf = smoothWindow(profileU, 0.36, 0.82)
  const lipDrop = smootherStep((profileU - 0.7) / 0.24)
  const heightProfile = Math.max(0, rise * fall * (1 + crestShelf * 0.12 - lipDrop * 0.08))
  const waveHeight = Math.min(
    remainingLength * 0.3,
    Math.max(config.spacing * 2.6, totalWidth * (0.095 + overhangRatio * 0.36)),
  )
  const broadFlow = overhangAmount * 0.46 * smoothWindow(eased, 0.04, 0.98)
  const crestPush = overhangAmount * 0.58 * smootherStep((eased - 0.16) / 0.58) * (1 - smootherStep((eased - 0.86) / 0.12))
  const lipReturn = overhangAmount * 0.08 * smootherStep((eased - 0.68) / 0.2) * (1 - smootherStep((eased - 0.98) / 0.02))
  const horizontalProjection = broadFlow + crestPush - lipReturn
  const yCenter = totalHeight * 0.5
  const yFromCenter = rest[1] - yCenter

  return [
    rest[0] + activityMask * horizontalProjection,
    yCenter + yFromCenter * config.widthScale,
    activityMask * waveHeight * heightProfile,
  ]
}

function buildEdges(rows: number, columns: number): LatticeEdge[] {
  const edges: LatticeEdge[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      edges.push({
        id: `e-h-${row}-${col}`,
        nodeA: nodeId(row, col),
        nodeB: nodeId(row, col + 1),
        orientation: 'horizontal',
      })
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      edges.push({
        id: `e-v-${row}-${col}`,
        nodeA: nodeId(row, col),
        nodeB: nodeId(row + 1, col),
        orientation: 'vertical',
      })
    }
  }

  return edges
}

function buildQuads(rows: number, columns: number): LatticeQuad[] {
  const quads: LatticeQuad[] = []

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      quads.push({
        id: quadId(row, col),
        row,
        col,
        nodeIds: [nodeId(row, col), nodeId(row, col + 1), nodeId(row + 1, col), nodeId(row + 1, col + 1)],
      })
    }
  }

  return quads
}

function buildDihedralPairs(rows: number, columns: number): DihedralPair[] {
  const pairs: DihedralPair[] = []

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns - 2; col += 1) {
      pairs.push({
        id: `d-v-${row}-${col}`,
        quadA: quadId(row, col),
        quadB: quadId(row, col + 1),
        sharedEdge: `${nodeId(row, col + 1)}:${nodeId(row + 1, col + 1)}`,
      })
    }
  }

  for (let row = 0; row < rows - 2; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      pairs.push({
        id: `d-h-${row}-${col}`,
        quadA: quadId(row, col),
        quadB: quadId(row + 1, col),
        sharedEdge: `${nodeId(row + 1, col)}:${nodeId(row + 1, col + 1)}`,
      })
    }
  }

  return pairs
}

function measureEdge(edge: LatticeEdge, nodes: Map<string, LatticeNode>): EdgeMetric {
  const nodeA = mustGetNode(nodes, edge.nodeA)
  const nodeB = mustGetNode(nodes, edge.nodeB)
  const restVector = subtractVec(nodeB.restPosition, nodeA.restPosition)
  const currentVector = subtractVec(nodeB.currentPosition, nodeA.currentPosition)
  const restLength = Math.max(lengthVec(restVector), 0.000001)
  const currentLength = lengthVec(currentVector)

  return {
    edgeId: edge.id,
    nodeA: edge.nodeA,
    nodeB: edge.nodeB,
    orientation: edge.orientation,
    restLength,
    currentLength,
    strain: safeFinite((currentLength - restLength) / restLength),
    edgeRotationDeg: angleDeg(restVector, currentVector),
    localCombinedCost: 0,
  }
}

function measureNode(node: LatticeNode, config: InverseSheetConfig, nodes: Map<string, LatticeNode>): NodeMetric {
  const left = node.col > 0 ? nodes.get(nodeId(node.row, node.col - 1)) : undefined
  const right = node.col < config.columns - 1 ? nodes.get(nodeId(node.row, node.col + 1)) : undefined
  const down = node.row > 0 ? nodes.get(nodeId(node.row - 1, node.col)) : undefined
  const up = node.row < config.rows - 1 ? nodes.get(nodeId(node.row + 1, node.col)) : undefined
  const rowBendDeg = left && right ? Math.abs(180 - angleDeg(subtractVec(left.currentPosition, node.currentPosition), subtractVec(right.currentPosition, node.currentPosition))) : null
  const colBendDeg = down && up ? Math.abs(180 - angleDeg(subtractVec(down.currentPosition, node.currentPosition), subtractVec(up.currentPosition, node.currentPosition))) : null
  const plusX = right ? subtractVec(right.currentPosition, node.currentPosition) : left ? subtractVec(node.currentPosition, left.currentPosition) : null
  const plusY = up ? subtractVec(up.currentPosition, node.currentPosition) : down ? subtractVec(node.currentPosition, down.currentPosition) : null
  const shearDeg = plusX && plusY ? Math.abs(90 - angleDeg(plusX, plusY)) : null

  return {
    nodeId: node.id,
    row: node.row,
    col: node.col,
    restX: node.restPosition[0],
    restY: node.restPosition[1],
    restZ: node.restPosition[2],
    currentX: node.currentPosition[0],
    currentY: node.currentPosition[1],
    currentZ: node.currentPosition[2],
    displacement: lengthVec(subtractVec(node.currentPosition, node.restPosition)),
    rowBendDeg,
    colBendDeg,
    nodeBendDeg: Math.max(rowBendDeg ?? 0, colBendDeg ?? 0),
    shearDeg,
    localCombinedCost: 0,
  }
}

function measureQuad(quad: LatticeQuad, nodes: Map<string, LatticeNode>): QuadMetric {
  const [n00, n10, n01, n11] = quad.nodeIds.map((id) => mustGetNode(nodes, id))
  const currentNormal = averagedQuadNormal(n00.currentPosition, n10.currentPosition, n01.currentPosition, n11.currentPosition)
  const restNormal = averagedQuadNormal(n00.restPosition, n10.restPosition, n01.restPosition, n11.restPosition)
  const currentArea = quadArea(n00.currentPosition, n10.currentPosition, n01.currentPosition, n11.currentPosition)
  const restArea = Math.max(quadArea(n00.restPosition, n10.restPosition, n01.restPosition, n11.restPosition), 0.000001)

  return {
    quadId: quad.id,
    row: quad.row,
    col: quad.col,
    areaRatio: safeFinite(currentArea / restArea, 1),
    areaChange: safeFinite(currentArea / restArea - 1),
    normalRotationDeg: angleDeg(restNormal, currentNormal),
    planarityError: pointPlaneDistance(n11.currentPosition, n00.currentPosition, n10.currentPosition, n01.currentPosition),
    localCombinedCost: 0,
  }
}

function buildQuadCurrentNormals(quads: LatticeQuad[], nodes: Map<string, LatticeNode>): Map<string, Vec3> {
  const normals = new Map<string, Vec3>()

  quads.forEach((quad) => {
    const [n00, n10, n01, n11] = quad.nodeIds.map((id) => mustGetNode(nodes, id))
    normals.set(quad.id, averagedQuadNormal(n00.currentPosition, n10.currentPosition, n01.currentPosition, n11.currentPosition))
  })

  return normals
}

function measureDihedral(pair: DihedralPair, normals: Map<string, Vec3>): DihedralMetric {
  const normalA = normals.get(pair.quadA)
  const normalB = normals.get(pair.quadB)
  const dihedralDeg = normalA && normalB ? angleDeg(normalA, normalB) : 0

  return {
    pairId: pair.id,
    quadA: pair.quadA,
    quadB: pair.quadB,
    sharedEdge: pair.sharedEdge,
    dihedralDeg,
    localCombinedCost: 0,
  }
}

function summarizeMetrics(
  edges: EdgeMetric[],
  nodes: NodeMetric[],
  quads: QuadMetric[],
  dihedrals: DihedralMetric[],
  latticeNodes: LatticeNode[],
): MetricsSummary {
  const strains = edges.map((edge) => edge.strain)
  const rotations = edges.map((edge) => edge.edgeRotationDeg)
  const bends = nodes.map((node) => node.nodeBendDeg)
  const shears = nodes.map((node) => node.shearDeg ?? 0)
  const areaChanges = quads.map((quad) => quad.areaChange)
  const normalRotations = quads.map((quad) => quad.normalRotationDeg)
  const planarity = quads.map((quad) => quad.planarityError)
  const dihedralValues = dihedrals.map((dihedral) => dihedral.dihedralDeg)
  const displacements = nodes.map((node) => node.displacement)

  return {
    maxTensileStrain: Math.max(0, maxValue(strains, (value) => value)),
    maxCompressiveStrain: minValue(strains),
    meanAbsStrain: mean(strains.map(Math.abs)),
    rmsStrain: rms(strains),
    maxEdgeRotationDeg: maxValue(rotations),
    meanEdgeRotationDeg: mean(rotations),
    maxBendDeg: maxValue(bends),
    meanBendDeg: mean(bends),
    maxShearDeg: maxValue(shears),
    meanShearDeg: mean(shears),
    maxAreaExpansion: maxValue(areaChanges),
    maxAreaCompression: minValue(areaChanges),
    meanAbsAreaChange: mean(areaChanges.map(Math.abs)),
    maxNormalRotationDeg: maxValue(normalRotations),
    meanNormalRotationDeg: mean(normalRotations),
    maxPlanarityError: maxValue(planarity),
    overhangAmount: measureOverhangAmount(latticeNodes),
    maxDihedralDeg: maxValue(dihedralValues),
    meanDihedralDeg: mean(dihedralValues),
    maxDisplacement: maxValue(displacements),
    meanDisplacement: mean(displacements),
    combinedCost: 0,
  }
}

function measureOverhangAmount(nodes: LatticeNode[]): number {
  const maxLift = maxValue(nodes.map((node) => Math.abs(node.currentPosition[2])), (value) => value, 0)
  if (maxLift <= 0.000001) return 0

  const liftedNodes = nodes.filter((node) => Math.abs(node.currentPosition[2]) >= maxLift * 0.24)
  const horizontalProjection = liftedNodes.map((node) => Math.abs(node.currentPosition[0] - node.restPosition[0]))
  return maxValue(horizontalProjection, (value) => value, 0)
}

function addEdgeLocalCosts(metrics: EdgeMetric[], config: InverseSheetConfig): EdgeMetric[] {
  const maxStrain = maxValue(metrics.map((metric) => Math.abs(metric.strain)), (value) => value, 0.000001)
  const maxRotation = maxValue(metrics.map((metric) => metric.edgeRotationDeg), (value) => value, 0.000001)

  return metrics.map((metric) => ({
    ...metric,
    localCombinedCost:
      config.strainWeight * Math.abs(metric.strain) / maxStrain +
      config.bendWeight * metric.edgeRotationDeg / maxRotation,
  }))
}

function addNodeLocalCosts(metrics: NodeMetric[], config: InverseSheetConfig): NodeMetric[] {
  const maxBend = maxValue(metrics.map((metric) => metric.nodeBendDeg), (value) => value, 0.000001)
  const maxShear = maxValue(metrics.map((metric) => metric.shearDeg ?? 0), (value) => value, 0.000001)
  const maxDisplacement = maxValue(metrics.map((metric) => metric.displacement), (value) => value, 0.000001)

  return metrics.map((metric) => ({
    ...metric,
    localCombinedCost:
      config.bendWeight * metric.nodeBendDeg / maxBend +
      config.shearWeight * (metric.shearDeg ?? 0) / maxShear +
      config.strainWeight * metric.displacement / maxDisplacement,
  }))
}

function addQuadLocalCosts(
  metrics: QuadMetric[],
  dihedralByQuad: Map<string, number>,
  config: InverseSheetConfig,
): QuadMetric[] {
  const maxArea = maxValue(metrics.map((metric) => Math.abs(metric.areaChange)), (value) => value, 0.000001)
  const maxNormal = maxValue(metrics.map((metric) => metric.normalRotationDeg), (value) => value, 0.000001)
  const maxDihedral = maxValue([...dihedralByQuad.values()], (value) => value, 0.000001)

  return metrics.map((metric) => ({
    ...metric,
    localCombinedCost:
      config.strainWeight * Math.abs(metric.areaChange) / maxArea +
      config.bendWeight * metric.normalRotationDeg / maxNormal +
      config.dihedralWeight * (dihedralByQuad.get(metric.quadId) ?? 0) / maxDihedral,
  }))
}

function addDihedralLocalCosts(metrics: DihedralMetric[], config: InverseSheetConfig): DihedralMetric[] {
  const maxDihedral = maxValue(metrics.map((metric) => metric.dihedralDeg), (value) => value, 0.000001)

  return metrics.map((metric) => ({
    ...metric,
    localCombinedCost: config.dihedralWeight * metric.dihedralDeg / maxDihedral,
  }))
}

function buildDihedralContributionByQuad(metrics: DihedralMetric[]): Map<string, number> {
  const result = new Map<string, number>()

  metrics.forEach((metric) => {
    result.set(metric.quadA, Math.max(result.get(metric.quadA) ?? 0, metric.dihedralDeg))
    result.set(metric.quadB, Math.max(result.get(metric.quadB) ?? 0, metric.dihedralDeg))
  })

  return result
}

function measureBounds(nodes: LatticeNode[]): LatticeBounds {
  const positions = nodes.flatMap((node) => [node.restPosition, node.currentPosition, node.targetPosition])
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]

  positions.forEach((position) => {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position[axis])
      max[axis] = Math.max(max[axis], position[axis])
    }
  })

  if (!positions.length) {
    return { min: [0, 0, 0], max: [1, 1, 1], center: [0.5, 0.5, 0.5], span: [1, 1, 1] }
  }

  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  const span: Vec3 = [Math.max(max[0] - min[0], 0.1), Math.max(max[1] - min[1], 0.1), Math.max(max[2] - min[2], 0.1)]

  return { min, max, center, span }
}

function nodeId(row: number, col: number): string {
  return `n-${row}-${col}`
}

function quadId(row: number, col: number): string {
  return `q-${row}-${col}`
}

function mustGetNode(nodes: Map<string, LatticeNode>, id: string): LatticeNode {
  const node = nodes.get(id)
  if (node) return node
  return {
    id,
    row: 0,
    col: 0,
    restPosition: [0, 0, 0],
    targetPosition: [0, 0, 0],
    currentPosition: [0, 0, 0],
  }
}

function averagedQuadNormal(p00: Vec3, p10: Vec3, p01: Vec3, p11: Vec3): Vec3 {
  const normalA = crossVec(subtractVec(p10, p00), subtractVec(p01, p00))
  const normalB = crossVec(subtractVec(p11, p10), subtractVec(p01, p10))
  return normalizeVec(addVec(normalA, normalB), [0, 0, 1])
}

function quadArea(p00: Vec3, p10: Vec3, p01: Vec3, p11: Vec3): number {
  return 0.5 * lengthVec(crossVec(subtractVec(p10, p00), subtractVec(p01, p00))) +
    0.5 * lengthVec(crossVec(subtractVec(p11, p10), subtractVec(p01, p10)))
}

function pointPlaneDistance(point: Vec3, planeA: Vec3, planeB: Vec3, planeC: Vec3): number {
  const normal = crossVec(subtractVec(planeB, planeA), subtractVec(planeC, planeA))
  const normalLength = lengthVec(normal)
  if (normalLength <= 0.000001) return 0
  return Math.abs(dotVec(subtractVec(point, planeA), normal) / normalLength)
}

function angleDeg(a: Vec3, b: Vec3): number {
  const lengthProduct = lengthVec(a) * lengthVec(b)
  if (lengthProduct <= 0.000001) return 0
  const cosine = clampNumber(dotVec(a, b) / lengthProduct, -1, 1)
  return safeFinite((Math.acos(cosine) * 180) / Math.PI)
}

function lerpVec(a: Vec3, b: Vec3, amount: number): Vec3 {
  return [lerpNumber(a[0], b[0], amount), lerpNumber(a[1], b[1], amount), lerpNumber(a[2], b[2], amount)]
}

function lerpNumber(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

function smootherStep(value: number): number {
  const t = clampNumber(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function smoothWindow(value: number, start: number, end: number): number {
  const center = (start + end) * 0.5
  return smootherStep((value - start) / Math.max(center - start, 0.000001)) *
    (1 - smootherStep((value - center) / Math.max(end - center, 0.000001)))
}

function edgeRamp(distanceFromEdge: number, flatRim: number, blendRim: number): number {
  return smootherStep((distanceFromEdge - flatRim) / Math.max(blendRim - flatRim, 0.000001))
}

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function crossVec(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function lengthVec(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function normalizeVec(vector: Vec3, fallback: Vec3): Vec3 {
  const length = lengthVec(vector)
  if (length <= 0.000001) return fallback
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function finiteVec(vector: Vec3): Vec3 {
  return [safeFinite(vector[0]), safeFinite(vector[1]), safeFinite(vector[2])]
}

function isFiniteVec(vector: Vec3): boolean {
  return vector.every(Number.isFinite)
}

function safeFinite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' || typeof value === 'string' ? Number(value) : fallback
  return clampNumber(Number.isFinite(numeric) ? numeric : fallback, min, max)
}

function readInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(readNumber(value, fallback, min, max))
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function readOneOf<T extends string>(value: unknown, options: T[], fallback: T): T {
  return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + safeFinite(value), 0) / values.length
}

function rms(values: number[]): number {
  if (!values.length) return 0
  return Math.sqrt(mean(values.map((value) => value ** 2)))
}

function maxValue(values: number[], project: (value: number) => number = (value) => value, fallback = 0): number {
  if (!values.length) return fallback
  return values.reduce((max, value) => Math.max(max, project(safeFinite(value))), -Infinity)
}

function minValue(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((min, value) => Math.min(min, safeFinite(value)), Infinity)
}

function isSummaryNearZero(summary: MetricsSummary): boolean {
  const tolerance = 0.0001
  return (
    Math.abs(summary.meanAbsStrain) <= tolerance &&
    Math.abs(summary.meanBendDeg) <= tolerance &&
    Math.abs(summary.meanShearDeg) <= tolerance &&
    Math.abs(summary.meanDihedralDeg) <= tolerance &&
    Math.abs(summary.meanDisplacement) <= tolerance
  )
}
