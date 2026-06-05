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
  horizontalOffset: 14,
  height: 7,
  overhangWidth: 32,
  overhangAngleDeg: 90,
  conicRho: 0.5,
  curlRadius: 0.65,
  smoothing: 0,
  lipSharpness: 0.28,
  wallSmoothness: 0.66,
  flatContribution: 0.35,
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
const OVERHANG_ANGLE_MIN_DEG = 40
const OVERHANG_ANGLE_PARALLEL_DEG = 90
const OVERHANG_ANGLE_MAX_DEG = 120
const PARALLEL_ANGLE_CURL = 0.68
const CONIC_RHO_MIN = 0.05
const CONIC_RHO_MAX = 0.95
const CURL_RADIUS_MIN = 0.25
const CURL_RADIUS_MAX = 1.25

type LegacyConfigKey = keyof InverseSheetConfig | 'curl'
type LooseConfig = Partial<Record<LegacyConfigKey, unknown>>
export type InverseSheetUsableRanges = {
  heightMax: number
  horizontalOffsetMax: number
  overhangWidthMax: number
}

export function sanitizeInverseSheetConfig(input: LooseConfig = {}): InverseSheetConfig {
  const raw: LooseConfig = { ...DEFAULT_INVERSE_SHEET_CONFIG, ...input }
  const rows = readInteger(raw.rows, DEFAULT_INVERSE_SHEET_CONFIG.rows, 2, 72)
  const columns = readInteger(raw.columns, DEFAULT_INVERSE_SHEET_CONFIG.columns, 2, 72)
  const spacing = 1
  const smoothing = readNumber(raw.smoothing, DEFAULT_INVERSE_SHEET_CONFIG.smoothing, 0, 1)
  const ranges = calculateInverseSheetUsableRanges(rows, columns, spacing, smoothing)
  const overhangAngleDeg = readOverhangAngleDeg(input)

  return {
    rows,
    columns,
    spacing,
    targetPreset: readOneOf(raw.targetPreset, TARGET_PRESETS, DEFAULT_INVERSE_SHEET_CONFIG.targetPreset),
    morph: readNumber(raw.morph, DEFAULT_INVERSE_SHEET_CONFIG.morph, 0, 1),
    verticalDirection: 'up',
    bendAngleDeg: DEFAULT_INVERSE_SHEET_CONFIG.bendAngleDeg,
    supportFraction: DEFAULT_INVERSE_SHEET_CONFIG.supportFraction,
    radiusMode: readOneOf(raw.radiusMode, RADIUS_MODES, DEFAULT_INVERSE_SHEET_CONFIG.radiusMode),
    bendRadius: readNumber(raw.bendRadius, DEFAULT_INVERSE_SHEET_CONFIG.bendRadius, 0.1, 100),
    horizontalOffset: readNumber(raw.horizontalOffset, DEFAULT_INVERSE_SHEET_CONFIG.horizontalOffset, 0, ranges.horizontalOffsetMax),
    height: readNumber(raw.height, DEFAULT_INVERSE_SHEET_CONFIG.height, 0, ranges.heightMax),
    overhangWidth: readNumber(raw.overhangWidth, DEFAULT_INVERSE_SHEET_CONFIG.overhangWidth, 0, ranges.overhangWidthMax),
    overhangAngleDeg,
    conicRho: readNumber(raw.conicRho, DEFAULT_INVERSE_SHEET_CONFIG.conicRho, CONIC_RHO_MIN, CONIC_RHO_MAX),
    curlRadius: readNumber(raw.curlRadius, DEFAULT_INVERSE_SHEET_CONFIG.curlRadius, CURL_RADIUS_MIN, CURL_RADIUS_MAX),
    smoothing,
    lipSharpness: readNumber(raw.lipSharpness, DEFAULT_INVERSE_SHEET_CONFIG.lipSharpness, 0, 1),
    wallSmoothness: readNumber(raw.wallSmoothness, DEFAULT_INVERSE_SHEET_CONFIG.wallSmoothness, 0, 1),
    flatContribution: readNumber(raw.flatContribution, DEFAULT_INVERSE_SHEET_CONFIG.flatContribution, 0, 1),
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

export function getInverseSheetUsableRanges(input: LooseConfig = {}): InverseSheetUsableRanges {
  const raw: LooseConfig = { ...DEFAULT_INVERSE_SHEET_CONFIG, ...input }
  const rows = readInteger(raw.rows, DEFAULT_INVERSE_SHEET_CONFIG.rows, 2, 72)
  const columns = readInteger(raw.columns, DEFAULT_INVERSE_SHEET_CONFIG.columns, 2, 72)
  const spacing = 1
  const smoothing = readNumber(raw.smoothing, DEFAULT_INVERSE_SHEET_CONFIG.smoothing, 0, 1)

  return calculateInverseSheetUsableRanges(rows, columns, spacing, smoothing)
}

function calculateInverseSheetUsableRanges(rows: number, columns: number, spacing: number, smoothing: number): InverseSheetUsableRanges {
  const totalWidth = Math.max((columns - 1) * spacing, spacing)
  const totalHeight = Math.max((rows - 1) * spacing, spacing)
  const profile = overhangProfileLimits(rows, columns, spacing, smoothing)
  const remainingLength = Math.max(totalWidth * profile.remainingU, spacing)
  const maxHalfWidth = Math.max(totalHeight * (0.5 - profile.flatRim), spacing)

  return {
    heightMax: roundControlMax(Math.min(24, remainingLength * 0.42), 0.25),
    horizontalOffsetMax: roundControlMax(Math.min(32, remainingLength * 0.78), 0.25),
    overhangWidthMax: roundControlMax(Math.min(72, maxHalfWidth * 2), 0.5),
  }
}

function overhangProfileLimits(rows: number, columns: number, spacing: number, smoothing: number) {
  const rowsDenominator = Math.max(rows - 1, 1)
  const columnsDenominator = Math.max(columns - 1, 1)
  const gridDenominator = Math.max(rowsDenominator, columnsDenominator)
  const stableGroundTransition = stableGroundTransitionValue(smoothing)
  const flatRim = Math.min(0.12, Math.max(3.4 / gridDenominator, 0.055))
  const profileStart = Math.max(flatRim, lerpNumber(0.16, 0.08, stableGroundTransition))
  const profileEnd = Math.min(1 - flatRim, lerpNumber(0.84, 0.94, stableGroundTransition))

  return {
    flatRim,
    profileStart,
    profileEnd,
    remainingU: Math.max(profileEnd - profileStart, spacing / Math.max(columnsDenominator * spacing, spacing)),
  }
}

function stableGroundTransitionValue(value: number): number {
  return lerpNumber(0.86, 1, clampNumber(value, 0, 1))
}

function readOverhangAngleDeg(input: LooseConfig): number {
  if (Object.prototype.hasOwnProperty.call(input, 'overhangAngleDeg')) {
    return readNumber(
      input.overhangAngleDeg,
      DEFAULT_INVERSE_SHEET_CONFIG.overhangAngleDeg,
      OVERHANG_ANGLE_MIN_DEG,
      OVERHANG_ANGLE_MAX_DEG,
    )
  }

  if (Object.prototype.hasOwnProperty.call(input, 'curl')) {
    return curlToOverhangAngleDeg(readNumber(input.curl, PARALLEL_ANGLE_CURL, 0, 1))
  }

  return DEFAULT_INVERSE_SHEET_CONFIG.overhangAngleDeg
}

function overhangAngleDegToCurl(angleDeg: number): number {
  const angle = clampNumber(angleDeg, OVERHANG_ANGLE_MIN_DEG, OVERHANG_ANGLE_MAX_DEG)
  if (angle <= OVERHANG_ANGLE_PARALLEL_DEG) {
    return (
      ((angle - OVERHANG_ANGLE_MIN_DEG) / (OVERHANG_ANGLE_PARALLEL_DEG - OVERHANG_ANGLE_MIN_DEG)) *
      PARALLEL_ANGLE_CURL
    )
  }

  return PARALLEL_ANGLE_CURL +
    ((angle - OVERHANG_ANGLE_PARALLEL_DEG) / (OVERHANG_ANGLE_MAX_DEG - OVERHANG_ANGLE_PARALLEL_DEG)) *
      (1 - PARALLEL_ANGLE_CURL)
}

function curlToOverhangAngleDeg(curlValue: number): number {
  const curl = clampNumber(curlValue, 0, 1)
  if (curl <= PARALLEL_ANGLE_CURL) {
    return OVERHANG_ANGLE_MIN_DEG +
      (curl / PARALLEL_ANGLE_CURL) * (OVERHANG_ANGLE_PARALLEL_DEG - OVERHANG_ANGLE_MIN_DEG)
  }

  return OVERHANG_ANGLE_PARALLEL_DEG +
    ((curl - PARALLEL_ANGLE_CURL) / (1 - PARALLEL_ANGLE_CURL)) *
      (OVERHANG_ANGLE_MAX_DEG - OVERHANG_ANGLE_PARALLEL_DEG)
}

function roundControlMax(value: number, step: number): number {
  return Math.max(step, Math.floor(value / step) * step)
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
  const flatHeight = buildInverseSheetModel({ horizontalOffset: 0, height: 0 })
  const twoByTwo = buildInverseSheetModel({ rows: 2, columns: 2 })
  const defaultOverhang = buildInverseSheetModel(DEFAULT_INVERSE_SHEET_CONFIG)
  const highOverhang = buildInverseSheetModel({ horizontalOffset: 32 })
  const highAngleHighOverhang = buildInverseSheetModel({
    horizontalOffset: 32,
    overhangAngleDeg: 120,
    smoothing: 1,
    lipSharpness: 0.2,
  })
  const lowWave = buildInverseSheetModel({ horizontalOffset: 9, height: 4 })
  const tallWave = buildInverseSheetModel({ horizontalOffset: 9, height: 10 })
  const narrowWave = buildInverseSheetModel({ overhangWidth: 12 })
  const wideWave = buildInverseSheetModel({ overhangWidth: 36 })
  const lowAngle = buildInverseSheetModel({ overhangAngleDeg: 40 })
  const highAngle = buildInverseSheetModel({ overhangAngleDeg: 120 })
  const lowAngleSmallGrid = buildInverseSheetModel({
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 0,
    overhangAngleDeg: 40,
  })
  const highAngleSmallGrid = buildInverseSheetModel({
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 0,
    overhangAngleDeg: 120,
  })
  const twelveByTwelve = buildInverseSheetModel({ rows: 12, columns: 12 })
  const fortyByForty = buildInverseSheetModel({ rows: 40, columns: 40 })
  const lowGroundTransition = buildInverseSheetModel({
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 0,
    overhangAngleDeg: 90,
  })
  const highGroundTransition = buildInverseSheetModel({
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 1,
    overhangAngleDeg: 90,
  })

  if (!isSummaryNearZero(flat.summary)) failures.push('morph = 0 should produce near-zero metrics')
  if (zeroed.summary.overhangAmount !== 0) failures.push('zero horizontal offset should report no horizontal overhang')
  if (!isSummaryNearZero(flatHeight.summary)) failures.push('zero height and zero offset should keep the grid flat')
  if (twelveByTwelve.edges.length !== 12 * 11 + 12 * 11) failures.push('12x12 edge count mismatch')
  if (twelveByTwelve.quads.length !== 11 * 11) failures.push('12x12 quad count mismatch')
  if (twoByTwo.nodes.length !== 4 || twoByTwo.quads.length !== 1) failures.push('2x2 grid did not build')
  if (fortyByForty.nodes.some((node) => !isFiniteVec(node.currentPosition))) failures.push('40x40 produced invalid node positions')
  if (!boundaryNodesStayFlat(defaultOverhang)) failures.push('default overhang boundary should stay fixed and flat')
  if (!boundaryNodesStayFlat(highOverhang)) failures.push('high-overhang boundary should stay fixed and flat')
  if (!centerlineBackfoldIsBounded(highOverhang)) failures.push('high-overhang angle should stay bounded')
  if (!centerlineBackfoldIsBounded(highAngleHighOverhang)) failures.push('high-angle high-overhang shape should not self-overlap')
  if (!centerlineHasVisibleCurlReturn(highAngle)) failures.push('120 deg overhang angle should visibly return inward into a C profile')
  if (centerlineCurlReturnDepth(highAngleSmallGrid) < centerlineCurlReturnDepth(lowAngleSmallGrid) * 1.65) {
    failures.push('120 deg overhang angle should visibly curl farther inward than 40 deg on a 20x20 grid')
  }
  if (defaultOverhang.summary.overhangAmount <= 0) failures.push('default overhang should report a positive horizontal projection')
  if (Math.abs(lowWave.summary.overhangAmount - tallWave.summary.overhangAmount) > 0.000001) {
    failures.push('changing height should not change measured horizontal overhang amount')
  }
  if (tallWave.summary.maxHeight <= lowWave.summary.maxHeight + 1) failures.push('height control should change vertical wave height')
  if (Math.abs(lowAngle.summary.overhangAmount - highAngle.summary.overhangAmount) > 0.25) {
    failures.push('overhang angle should not materially change measured horizontal overhang amount')
  }
  if (Math.abs(lowAngle.summary.maxHeight - highAngle.summary.maxHeight) > 0.15) {
    failures.push('overhang angle should not materially change measured wave height')
  }
  if (!boundaryNodesStayFlat(narrowWave)) failures.push('narrow overhang boundary should stay fixed and flat')
  if (measureActiveRowCount(wideWave) <= measureActiveRowCount(narrowWave)) {
    failures.push('overhang width control should change the active wave width')
  }
  if (!groundTransitionSmoothsBottomDescent(lowGroundTransition, highGroundTransition)) {
    failures.push('ground transition should lengthen and soften the lower return into flat water')
  }

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
  const maxSegmentLength = Math.max(model.config.spacing * 5.5, model.summary.overhangAmount * 0.22)
  const collisionTolerance = model.config.spacing * 0.24

  for (let index = 0; index < centerline.length - 1; index += 1) {
    const current = centerline[index].currentPosition
    const next = centerline[index + 1].currentPosition
    const segmentLength = Math.hypot(next[0] - current[0], next[2] - current[2])
    if (segmentLength > maxSegmentLength) return false
  }

  for (let aIndex = 0; aIndex < centerline.length; aIndex += 1) {
    for (let bIndex = aIndex + 3; bIndex < centerline.length; bIndex += 1) {
      const a = centerline[aIndex].currentPosition
      const b = centerline[bIndex].currentPosition
      const distance = Math.hypot(b[0] - a[0], b[2] - a[2])
      if (distance < collisionTolerance) return false
    }
  }

  return true
}

function centerlineHasVisibleCurlReturn(model: LatticeModel): boolean {
  return centerlineCurlReturnDepth(model) >= Math.max(model.config.spacing * 2.5, model.summary.overhangAmount * 0.24)
}

function centerlineCurlReturnDepth(model: LatticeModel): number {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const liftedCenterline = centerline.filter((node) => node.currentPosition[2] > maxHeight * 0.04)
  let maxX = -Infinity
  let maxXIndex = 0

  liftedCenterline.forEach((node, index) => {
    if (node.currentPosition[0] > maxX) {
      maxX = node.currentPosition[0]
      maxXIndex = index
    }
  })

  const postCrestLiftedNodes = liftedCenterline.slice(maxXIndex + 1)
  const deepestReturnX = Math.min(...postCrestLiftedNodes.map((node) => node.currentPosition[0]))

  return Number.isFinite(deepestReturnX) ? maxX - deepestReturnX : 0
}

function groundTransitionSmoothsBottomDescent(low: LatticeModel, high: LatticeModel): boolean {
  const lowStats = centerlineDescentStats(low)
  const highStats = centerlineDescentStats(high)

  return highStats.activeEndCol > lowStats.activeEndCol && highStats.maxAdjacentDrop < lowStats.maxAdjacentDrop * 0.92
}

function centerlineDescentStats(model: LatticeModel): { activeEndCol: number; maxAdjacentDrop: number } {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const active = centerline.filter((node) => node.currentPosition[2] > maxHeight * 0.04)
  const maxAdjacentDrop = centerline.slice(1).reduce((currentMax, node, index) => {
    const previous = centerline[index]
    return Math.max(currentMax, Math.abs(node.currentPosition[2] - previous.currentPosition[2]))
  }, 0)

  return {
    activeEndCol: active[active.length - 1]?.col ?? -1,
    maxAdjacentDrop,
  }
}

function measureActiveRowCount(model: LatticeModel): number {
  const rowHasLift = new Set<number>()
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)

  model.nodes.forEach((node) => {
    if (node.currentPosition[2] >= maxHeight * 0.1) rowHasLift.add(node.row)
  })

  return rowHasLift.size
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
      const targetUncentered = overhangTargetPosition(uncenteredRest, col, config, totalWidth, totalHeight)
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
  col: number,
  config: InverseSheetConfig,
  totalWidth: number,
  totalHeight: number,
): Vec3 {
  const columnsDenominator = Math.max(config.columns - 1, 1)
  const rowsDenominator = Math.max(config.rows - 1, 1)
  const u = col / columnsDenominator
  const gridDenominator = Math.max(rowsDenominator, columnsDenominator)
  const groundTransition = clampNumber(config.smoothing, 0, 1)
  const stableGroundTransition = stableGroundTransitionValue(groundTransition)
  const wallSmoothness = clampNumber(config.wallSmoothness, 0, 1)
  const flatRim = Math.min(0.12, Math.max(3.4 / gridDenominator, 0.055))
  const blendRim = Math.min(0.46, flatRim + lerpNumber(0.1, 0.36, stableGroundTransition))
  const longitudinalBlendRim = Math.min(0.5, flatRim + lerpNumber(0.1, 0.42, stableGroundTransition))
  const rimY = transverseWaveMask(rest[1], totalHeight, config, flatRim, blendRim, wallSmoothness)
  const rimX = edgeRamp(u, flatRim, longitudinalBlendRim) * edgeRamp(1 - u, flatRim, longitudinalBlendRim)
  const maskExponent = lerpNumber(1.7, 0.68, stableGroundTransition)
  const activityMask = Math.pow(rimX * rimY, maskExponent)
  const flatMask = flatContributionMask(rest[1], totalHeight, flatRim, blendRim, rimX, activityMask, config.flatContribution)

  if (Math.abs(config.height) <= 0.000001) {
    return [rest[0], rest[1] * config.widthScale, 0]
  }

  if (activityMask <= 0.000001 && flatMask <= 0.000001) {
    return [rest[0], rest[1] * config.widthScale, 0]
  }

  const profileStart = Math.max(flatRim, lerpNumber(0.16, 0.08, stableGroundTransition))
  const profileEnd = Math.min(1 - flatRim, lerpNumber(0.84, 0.94, stableGroundTransition))
  if (u <= profileStart || u >= profileEnd) {
    return [rest[0], rest[1] * config.widthScale, 0]
  }

  const remainingU = Math.max(profileEnd - profileStart, 0.000001)
  const profileU = clampNumber((u - profileStart) / remainingU, 0, 1)
  const eased = lerpNumber(profileU, smootherStep(profileU), 0.08 + stableGroundTransition * 0.46)
  const remainingLength = Math.max(totalWidth * remainingU, config.spacing)
  const curl = overhangAngleDegToCurl(config.overhangAngleDeg)
  const overhangAmount = Math.min(config.horizontalOffset, remainingLength * 0.78)
  const heightProfile = waveHeightProfile(eased, curl, groundTransition, config.lipSharpness, config.conicRho, config.curlRadius)
  const waveHeight = Math.min(config.height, remainingLength * 0.42)
  const horizontalProjection = overhangAmount * curlProjectionProfile(
    eased,
    curl,
    groundTransition,
    config.lipSharpness,
    config.conicRho,
    config.curlRadius,
  )
  const flatProjection = horizontalProjection * flatMask
  const yCenter = totalHeight * 0.5
  const yFromCenter = rest[1] - yCenter

  return [
    rest[0] + activityMask * horizontalProjection + flatProjection,
    yCenter + yFromCenter * config.widthScale,
    activityMask * waveHeight * heightProfile,
  ]
}

function curlProjectionProfile(
  value: number,
  curl: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): number {
  const t = clampNumber(value, 0, 1)
  const raw = curlProjectionRaw(t, curl, smoothing, lipSharpness, conicRho, curlRadius)

  return raw / Math.max(sampleCurlProjectionMax(curl, smoothing, lipSharpness, conicRho, curlRadius), 0.000001)
}

function curlProjectionRaw(
  t: number,
  curl: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): number {
  const broadWave = openWaveProjection(t)
  const sharpness = clampNumber(lipSharpness, 0, 1)
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const returnStart = clampNumber(
    lerpNumber(0.82, 0.5, curl) + lerpNumber(0.04, -0.05, rho) + lerpNumber(0.06, -0.055, radius) +
      lerpNumber(-0.018, 0.014, sharpness),
    0.24,
    0.88,
  )
  const returnEnd = clampNumber(
    lerpNumber(1, 0.94, curl) + smoothing * lerpNumber(0, 0.035, curl) + lerpNumber(-0.025, 0.07, radius) +
      lerpNumber(0.012, -0.012, sharpness),
    returnStart + lerpNumber(0.14, 0.4, curl) + radius * 0.06,
    0.995,
  )
  const riseEnd = lerpNumber(0.58, 0.34, curl) + lerpNumber(0.035, -0.05, rho) + lerpNumber(-0.035, 0.055, radius) +
    lerpNumber(0.018, -0.012, sharpness)
  const tailFloor = clampNumber(
    lerpNumber(0.98, 0.018, curl) + lerpNumber(0.05, -0.055, rho) + lerpNumber(-0.055, 0.07, radius) +
      lerpNumber(0.018, -0.018, sharpness),
    0,
    0.98,
  )
  const rise = smootherStep(t / Math.max(riseEnd, 0.000001))
  const returnAmount = 1 - tailFloor
  const returnUnder = 1 - returnAmount * smootherStep((t - returnStart) / Math.max(returnEnd - returnStart, 0.000001))
  const power = clampNumber(lerpNumber(1.48, 0.72, smoothing) + lerpNumber(0.18, -0.22, rho) + lerpNumber(-0.14, 0.2, radius), 0.42, 1.8)
  const curledWave = Math.pow(Math.max(rise * returnUnder, 0), power)

  return lerpNumber(broadWave, curledWave, curl)
}

function waveHeightProfile(
  value: number,
  curl: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): number {
  const t = clampNumber(value, 0, 1)
  const base = openWaveHeight(t, smoothing, conicRho, curlRadius)
  const plateau = roundedCurlHeightProfile(t, curl, smoothing, lipSharpness, conicRho, curlRadius)
  const raw = lerpNumber(base, plateau, curl)

  return raw / Math.max(sampleWaveHeightMax(curl, smoothing, lipSharpness, conicRho, curlRadius), 0.000001)
}

function roundedCurlHeightProfile(
  t: number,
  curl: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): number {
  const sharpness = clampNumber(lipSharpness, 0, 1)
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const riseEnd = lerpNumber(0.6, 0.34, curl) + lerpNumber(0.045, -0.055, rho) + lerpNumber(-0.035, 0.055, radius) +
    lerpNumber(0.02, -0.012, sharpness)
  const fallEnd = clampNumber(
    lerpNumber(0.98, 0.99, curl) + smoothing * lerpNumber(0, 0.01, curl) + lerpNumber(-0.025, 0.055, radius) +
      lerpNumber(0.012, -0.012, sharpness),
    0.88,
    0.998,
  )
  const minimumFallSpan = lerpNumber(0.12, 0.26, radius)
  const fallStart = clampNumber(
    lerpNumber(0.72, 0.66, curl) + lerpNumber(0.05, -0.055, rho) + lerpNumber(-0.04, 0.06, radius) +
      lerpNumber(-0.018, 0.018, sharpness) - smoothing * lerpNumber(0, 0.03, curl),
    riseEnd + 0.04,
    fallEnd - minimumFallSpan,
  )
  const rise = smootherStep(t / Math.max(riseEnd, 0.000001))
  const fall = 1 - smootherStep((t - fallStart) / Math.max(fallEnd - fallStart, 0.000001))

  const power = clampNumber(lerpNumber(1.02, 0.56, smoothing) + sharpness * 0.24 + lerpNumber(0.18, -0.2, rho) +
    lerpNumber(-0.12, 0.16, radius), 0.34, 1.55)

  return Math.pow(Math.max(rise * fall, 0), power)
}

function openWaveProjection(t: number): number {
  const rise = smootherStep(t / 0.62)
  const lateReturn = 1 - smootherStep((t - 0.88) / 0.12)

  return Math.pow(Math.max(rise * lateReturn, 0), 1.12)
}

function openWaveHeight(t: number, smoothing: number, conicRho: number, curlRadius: number): number {
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const rise = smootherStep(t / 0.62)
  const fall = 1 - smootherStep((t - lerpNumber(0.78, 0.88, smoothing) + lerpNumber(-0.035, 0.035, radius)) /
    lerpNumber(0.16, 0.24, radius))

  return Math.pow(Math.max(rise * fall, 0), clampNumber(lerpNumber(1.22, 0.88, smoothing) + lerpNumber(0.16, -0.16, rho), 0.62, 1.45))
}

function sampleWaveHeightMax(
  curl: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): number {
  let max = 0
  for (let index = 0; index <= 80; index += 1) {
    const t = index / 80
    const base = openWaveHeight(t, smoothing, conicRho, curlRadius)
    const plateau = roundedCurlHeightProfile(t, curl, smoothing, lipSharpness, conicRho, curlRadius)
    max = Math.max(max, lerpNumber(base, plateau, curl))
  }
  return max
}

function sampleCurlProjectionMax(
  curl: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): number {
  let max = 0
  for (let index = 0; index <= 80; index += 1) {
    const t = index / 80
    max = Math.max(max, curlProjectionRaw(t, curl, smoothing, lipSharpness, conicRho, curlRadius))
  }
  return max
}

function normalizedConicRho(value: number): number {
  return (clampNumber(value, CONIC_RHO_MIN, CONIC_RHO_MAX) - CONIC_RHO_MIN) / (CONIC_RHO_MAX - CONIC_RHO_MIN)
}

function normalizedCurlRadius(value: number): number {
  return (clampNumber(value, CURL_RADIUS_MIN, CURL_RADIUS_MAX) - CURL_RADIUS_MIN) / (CURL_RADIUS_MAX - CURL_RADIUS_MIN)
}

function transverseWaveMask(
  y: number,
  totalHeight: number,
  config: InverseSheetConfig,
  flatRim: number,
  blendRim: number,
  wallSmoothness: number,
): number {
  const yCenter = totalHeight * 0.5
  const edgeMask = edgeRamp(y / Math.max(totalHeight, 0.000001), flatRim, blendRim) *
    edgeRamp(1 - y / Math.max(totalHeight, 0.000001), flatRim, blendRim)
  const maxHalfWidth = Math.max(totalHeight * (0.5 - flatRim), config.spacing)
  const requestedHalfWidth = Math.min(config.overhangWidth * 0.5, maxHalfWidth)

  if (requestedHalfWidth <= 0.000001) return 0

  const fadeWidth = Math.min(
    Math.max(config.spacing * 2.5, totalHeight * lerpNumber(0.035, 0.18, wallSmoothness)),
    requestedHalfWidth,
  )
  const coreHalfWidth = Math.max(requestedHalfWidth - fadeWidth, 0)
  const distanceFromCenter = Math.abs(y - yCenter)
  const widthMask = 1 - smootherStep((distanceFromCenter - coreHalfWidth) / Math.max(fadeWidth, 0.000001))

  return edgeMask * widthMask
}

function flatContributionMask(
  y: number,
  totalHeight: number,
  flatRim: number,
  blendRim: number,
  rimX: number,
  activityMask: number,
  flatContribution: number,
): number {
  const contribution = clampNumber(flatContribution, 0, 1)
  if (contribution <= 0.000001) return 0

  const yRatio = y / Math.max(totalHeight, 0.000001)
  const edgeMask = edgeRamp(yRatio, flatRim, blendRim) * edgeRamp(1 - yRatio, flatRim, blendRim)
  const broadInterior = Math.pow(Math.max(rimX * edgeMask, 0), lerpNumber(1.45, 0.55, contribution))
  const outsideActive = Math.max(broadInterior - activityMask, 0)

  return contribution * outsideActive * 0.72
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
    maxHeight: measureMaxHeight(latticeNodes),
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

  const liftedNodes = nodes.filter((node) => Math.abs(node.currentPosition[2]) >= maxLift * 0.04)
  const horizontalProjection = liftedNodes.map((node) => Math.abs(node.currentPosition[0] - node.restPosition[0]))
  return maxValue(horizontalProjection, (value) => value, 0)
}

function measureMaxHeight(nodes: LatticeNode[]): number {
  return maxValue(nodes.map((node) => node.currentPosition[2]), (value) => value, 0)
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
