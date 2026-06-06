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

const DEFAULT_SHEET_ROWS = 44
const DEFAULT_SHEET_COLUMNS = 44
const DEFAULT_SHEET_SPACING = 1
const DEFAULT_SHEET_LENGTH = (DEFAULT_SHEET_COLUMNS - 1) * DEFAULT_SHEET_SPACING
const DEFAULT_SHEET_SPAN = (DEFAULT_SHEET_ROWS - 1) * DEFAULT_SHEET_SPACING
const DEFAULT_GRID_DENOMINATOR = Math.max(DEFAULT_SHEET_ROWS - 1, DEFAULT_SHEET_COLUMNS - 1)
const MAX_STEER_ANGLE_RAD = Math.PI / 4
const MAX_TERMINAL_LIP_DIP_RAD = (72 * Math.PI) / 180

export const DEFAULT_INVERSE_SHEET_CONFIG: InverseSheetConfig = {
  rows: DEFAULT_SHEET_ROWS,
  columns: DEFAULT_SHEET_COLUMNS,
  spacing: DEFAULT_SHEET_SPACING,
  targetPreset: 'overhang',
  morph: 1,
  verticalDirection: 'up',
  bendAngleDeg: 172,
  supportFraction: 0.14,
  radiusMode: 'autoPreserveLength',
  bendRadius: 4,
  horizontalOffset: 14,
  overhangPosition: 0,
  steer: 0,
  height: 7,
  overhangWidth: 32,
  overhangAngleDeg: 90,
  conicRho: 0.5,
  curlRadius: 0.65,
  smoothing: 0,
  lipSharpness: 0.28,
  wallSmoothness: 0.18,
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
  const overhangPosition = readNumber(raw.overhangPosition, DEFAULT_INVERSE_SHEET_CONFIG.overhangPosition, -1, 1)
  const steer = readNumber(raw.steer, DEFAULT_INVERSE_SHEET_CONFIG.steer, -1, 1)
  const ranges = calculateInverseSheetUsableRanges(smoothing)
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
    overhangPosition,
    steer,
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
  const smoothing = readNumber(raw.smoothing, DEFAULT_INVERSE_SHEET_CONFIG.smoothing, 0, 1)

  return calculateInverseSheetUsableRanges(smoothing)
}

function calculateInverseSheetUsableRanges(smoothing: number): InverseSheetUsableRanges {
  const profile = overhangProfileLimits(smoothing)
  const remainingLength = Math.max(DEFAULT_SHEET_LENGTH * profile.remainingU, DEFAULT_SHEET_SPACING)
  const maxHalfWidth = Math.max(DEFAULT_SHEET_SPAN * (0.5 - profile.flatRim), DEFAULT_SHEET_SPACING)

  return {
    heightMax: roundControlMax(Math.min(24, remainingLength * 0.42), 0.25),
    horizontalOffsetMax: roundControlMax(Math.min(32, remainingLength * 0.78), 0.25),
    overhangWidthMax: roundControlMax(Math.min(72, maxHalfWidth * 2), 0.5),
  }
}

function overhangProfileLimits(smoothing: number) {
  const stableGroundTransition = stableGroundTransitionValue(smoothing)
  const flatRim = Math.min(0.12, Math.max(3.4 / DEFAULT_GRID_DENOMINATOR, 0.055))
  const baseStart = Math.max(flatRim, lerpNumber(0.2, 0.06, stableGroundTransition))
  const baseEnd = Math.min(1 - flatRim, lerpNumber(0.78, 0.965, stableGroundTransition))
  const profileStart = clampNumber(baseStart, flatRim, 1 - flatRim)
  const profileEnd = clampNumber(baseEnd, profileStart + 1 / DEFAULT_GRID_DENOMINATOR, 1 - flatRim)

  return {
    flatRim,
    profileStart,
    profileEnd,
    remainingU: Math.max(profileEnd - profileStart, 1 / DEFAULT_GRID_DENOMINATOR),
  }
}

function overhangPositionOffset(overhangPosition: number, totalWidth = DEFAULT_SHEET_LENGTH): number {
  return clampNumber(overhangPosition, -1, 1) * totalWidth * 0.18
}

function steerYaw(steer: number): number {
  return clampNumber(steer, -1, 1) * MAX_STEER_ANGLE_RAD
}

function rootAnchor(config: InverseSheetConfig): Vec3 {
  const profileStart = overhangProfileLimits(config.smoothing).profileStart
  return [-DEFAULT_SHEET_LENGTH / 2 + profileStart * DEFAULT_SHEET_LENGTH, 0, 0]
}

function applyPlacementTransform(point: Vec3, config: InverseSheetConfig): Vec3 {
  const anchor = rootAnchor(config)
  const yaw = steerYaw(config.steer)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const dx = point[0] - anchor[0]
  const dy = point[1] - anchor[1]
  const x = anchor[0] + c * dx - s * dy + overhangPositionOffset(config.overhangPosition)
  const y = anchor[1] + s * dx + c * dy

  return [x, y, point[2]]
}

function undoPlacementTransform(point: Vec3, config: InverseSheetConfig): Vec3 {
  const anchor = rootAnchor(config)
  const yaw = -steerYaw(config.steer)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const translatedX = point[0] - overhangPositionOffset(config.overhangPosition)
  const dx = translatedX - anchor[0]
  const dy = point[1] - anchor[1]

  return [
    anchor[0] + c * dx - s * dy,
    anchor[1] + s * dx + c * dy,
    point[2],
  ]
}

function lipDipAmount(angleDeg: number): number {
  return clampNumber(
    (angleDeg - OVERHANG_ANGLE_PARALLEL_DEG) / (OVERHANG_ANGLE_MAX_DEG - OVERHANG_ANGLE_PARALLEL_DEG),
    0,
    1,
  )
}

function stableGroundTransitionValue(value: number): number {
  return lerpNumber(0.72, 1, clampNumber(value, 0, 1))
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
  const neutralAngle = buildInverseSheetModel({ overhangAngleDeg: 90 })
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
  const positionBack = buildInverseSheetModel({ overhangPosition: -1 })
  const positionNeutral = buildInverseSheetModel({ overhangPosition: 0 })
  const positionFront = buildInverseSheetModel({ overhangPosition: 1 })
  const steerLeft = buildInverseSheetModel({ steer: -1, overhangPosition: 0 })
  const steerNeutral = buildInverseSheetModel({ steer: 0, overhangPosition: 0 })
  const steerRight = buildInverseSheetModel({ steer: 1, overhangPosition: 0 })
  const displayOff = buildInverseSheetModel({ showHeatmap: false, colorMode: 'edgeStrain' })
  const displayUres = buildInverseSheetModel({ showHeatmap: true, colorMode: 'displacement' })
  const resolution24 = buildInverseSheetModel({ rows: 24, columns: 24, overhangWidth: 32 })
  const resolution72 = buildInverseSheetModel({ rows: 72, columns: 72, overhangWidth: 32 })
  const fullyFlatContribution = buildInverseSheetModel({ flatContribution: 1 })
  const terminalCurl = buildInverseSheetModel({
    rows: 24,
    columns: 24,
    height: 8,
    horizontalOffset: 9,
    overhangPosition: 0,
    overhangAngleDeg: 118,
    overhangWidth: 17,
    lipSharpness: 0.28,
    smoothing: 1,
    wallSmoothness: 0.18,
    flatContribution: 0.35,
  })

  if (!isSummaryNearZero(flat.summary)) failures.push('morph = 0 should produce near-zero metrics')
  if (!isSummaryNearZero(fullyFlatContribution.summary)) failures.push('flat contribution 1 should blend predictably back to the flat reference sheet')
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
  if (!centerlineHasVisibleLipDip(highAngle)) failures.push('120 deg lip dip should visibly lower the front lip')
  if (centerlineLipDropRatio(highAngleSmallGrid) < centerlineLipDropRatio(lowAngleSmallGrid) + 0.02) {
    failures.push('120 deg lip dip should lower the front lip more than 40 deg on a 20x20 grid')
  }
  if (defaultOverhang.summary.overhangAmount <= 0) failures.push('default overhang should report a positive horizontal projection')
  if (Math.abs(lowWave.summary.overhangAmount - tallWave.summary.overhangAmount) > 0.000001) {
    failures.push('changing height should not change measured horizontal overhang amount')
  }
  if (tallWave.summary.maxHeight <= lowWave.summary.maxHeight + 1) failures.push('height control should change vertical wave height')
  if (Math.abs(neutralAngle.summary.overhangAmount - highAngle.summary.overhangAmount) > 0.75) {
    failures.push('lip dip should not materially change measured horizontal overhang amount')
  }
  if (preTerminalCenterlineProfileResidual(neutralAngle, highAngle, 0.42) > 0.000001) {
    failures.push('lip dip should not change the pre-terminal wave body')
  }
  if (!boundaryNodesStayFlat(narrowWave)) failures.push('narrow overhang boundary should stay fixed and flat')
  if (measureActiveRowCount(wideWave) <= measureActiveRowCount(narrowWave)) {
    failures.push('overhang width control should change the active wave width')
  }
  if (centerlineProfileResidual(narrowWave, wideWave) > 0.000001) {
    failures.push('overhang width should not change the x-z centerline profile')
  }
  if (centerlineProfileResidual(resolution24, defaultOverhang) > 0.12 || centerlineProfileResidual(resolution72, defaultOverhang) > 0.08) {
    failures.push('rows and columns should only resample the same physical overhang profile')
  }
  if (!groundTransitionSmoothsBottomDescent(lowGroundTransition, highGroundTransition)) {
    failures.push('ground transition should lengthen and soften the lower return into flat water')
  }
  if (!positionIsRigidTranslation(positionBack, positionNeutral) || !positionIsRigidTranslation(positionFront, positionNeutral)) {
    failures.push('overhang position should be a rigid horizontal translation only')
  }
  if (!steerIsRigidYaw(steerLeft, steerNeutral) || !steerIsRigidYaw(steerRight, steerNeutral)) {
    failures.push('steer should be a rigid horizontal yaw only')
  }
  if (!geometryAndMetricsMatch(displayOff, displayUres)) {
    failures.push('display mode should only change colors/materials, not geometry or intrinsic metrics')
  }
  if (!terminalLipCurlIsDownward(terminalCurl)) {
    failures.push('lip dip above 90 deg should locally curl the free tip downward')
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
      distanceVec(node.currentPosition, node.restPosition) <= tolerance &&
      distanceVec(node.targetPosition, node.restPosition) <= tolerance &&
      Math.abs(node.currentPosition[2]) <= tolerance
    )
  })
}

function positionIsRigidTranslation(candidate: LatticeModel, neutral: LatticeModel): boolean {
  if (candidate.nodes.length !== neutral.nodes.length) return false

  const xOffsets = candidate.nodes.map((node, index) => node.restPosition[0] - neutral.nodes[index].restPosition[0])
  const xOffset = mean(xOffsets)
  const maxResidual = candidate.nodes.reduce((currentMax, node, index) => {
    const baseline = neutral.nodes[index]
    const residual = Math.max(
      pointTranslationResidual(node.restPosition, baseline.restPosition, xOffset),
      pointTranslationResidual(node.targetPosition, baseline.targetPosition, xOffset),
      pointTranslationResidual(node.currentPosition, baseline.currentPosition, xOffset),
    )
    return Math.max(currentMax, residual)
  }, 0)
  const maxStrainResidual = candidate.edgeMetrics.reduce((currentMax, edge, index) => {
    return Math.max(currentMax, Math.abs(edge.strain - neutral.edgeMetrics[index].strain))
  }, 0)

  return maxResidual <= 0.000001 && maxStrainResidual <= 0.000001
}

function steerIsRigidYaw(candidate: LatticeModel, neutral: LatticeModel): boolean {
  if (candidate.nodes.length !== neutral.nodes.length) return false

  const maxResidual = candidate.nodes.reduce((currentMax, node, index) => {
    const baseline = neutral.nodes[index]
    const residual = Math.max(
      distanceVec(undoPlacementTransform(node.restPosition, candidate.config), undoPlacementTransform(baseline.restPosition, neutral.config)),
      distanceVec(undoPlacementTransform(node.targetPosition, candidate.config), undoPlacementTransform(baseline.targetPosition, neutral.config)),
      distanceVec(undoPlacementTransform(node.currentPosition, candidate.config), undoPlacementTransform(baseline.currentPosition, neutral.config)),
    )
    return Math.max(currentMax, residual)
  }, 0)
  const maxMetricResidual = intrinsicMetricResidual(candidate, neutral)

  return maxResidual <= 0.000001 && maxMetricResidual <= 0.000005
}

function geometryAndMetricsMatch(a: LatticeModel, b: LatticeModel): boolean {
  if (a.nodes.length !== b.nodes.length) return false

  const maxPositionResidual = a.nodes.reduce((currentMax, node, index) => {
    const other = b.nodes[index]
    return Math.max(
      currentMax,
      distanceVec(node.restPosition, other.restPosition),
      distanceVec(node.targetPosition, other.targetPosition),
      distanceVec(node.currentPosition, other.currentPosition),
    )
  }, 0)

  return maxPositionResidual <= 0.000001 && intrinsicMetricResidual(a, b) <= 0.000001
}

function intrinsicMetricResidual(a: LatticeModel, b: LatticeModel): number {
  const edgeResidual = a.edgeMetrics.reduce((currentMax, edge, index) => {
    const other = b.edgeMetrics[index]
    if (!other) return Infinity
    return Math.max(
      currentMax,
      Math.abs(edge.strain - other.strain),
      Math.abs(edge.currentLength - other.currentLength),
      Math.abs(edge.edgeRotationDeg - other.edgeRotationDeg),
    )
  }, 0)
  const nodeResidual = a.nodeMetrics.reduce((currentMax, node, index) => {
    const other = b.nodeMetrics[index]
    if (!other) return Infinity
    return Math.max(currentMax, Math.abs(node.displacement - other.displacement), Math.abs(node.nodeBendDeg - other.nodeBendDeg))
  }, 0)

  return Math.max(edgeResidual, nodeResidual)
}

function centerlineProfileResidual(a: LatticeModel, b: LatticeModel): number {
  const samples = 25
  let residual = 0

  for (let index = 0; index < samples; index += 1) {
    const u = index / (samples - 1)
    const aPoint = sampleCenterlineLocalPoint(a, u)
    const bPoint = sampleCenterlineLocalPoint(b, u)
    residual = Math.max(residual, Math.hypot(aPoint[0] - bPoint[0], aPoint[2] - bPoint[2]))
  }

  return residual
}

function preTerminalCenterlineProfileResidual(a: LatticeModel, b: LatticeModel, endU: number): number {
  const samples = 16
  let residual = 0

  for (let index = 0; index < samples; index += 1) {
    const u = (index / (samples - 1)) * clampNumber(endU, 0, 1)
    const aPoint = sampleCenterlineLocalPoint(a, u)
    const bPoint = sampleCenterlineLocalPoint(b, u)
    residual = Math.max(residual, Math.hypot(aPoint[0] - bPoint[0], aPoint[2] - bPoint[2]))
  }

  return residual
}

function sampleCenterlineLocalPoint(model: LatticeModel, u: number): Vec3 {
  const row = Math.round((model.config.rows - 1) / 2)
  const scaledColumn = clampNumber(u, 0, 1) * (model.config.columns - 1)
  const leftColumn = Math.floor(scaledColumn)
  const rightColumn = Math.min(model.config.columns - 1, leftColumn + 1)
  const amount = scaledColumn - leftColumn
  const left = model.nodes.find((node) => node.row === row && node.col === leftColumn)
  const right = model.nodes.find((node) => node.row === row && node.col === rightColumn)
  const leftPoint = left ? undoPlacementTransform(left.currentPosition, model.config) : [0, 0, 0] as Vec3
  const rightPoint = right ? undoPlacementTransform(right.currentPosition, model.config) : leftPoint

  return lerpVec(leftPoint, rightPoint, amount)
}

function pointTranslationResidual(candidate: Vec3, baseline: Vec3, xOffset: number): number {
  return Math.hypot(
    candidate[0] - xOffset - baseline[0],
    candidate[1] - baseline[1],
    candidate[2] - baseline[2],
  )
}

function terminalLipCurlIsDownward(model: LatticeModel): boolean {
  const stats = terminalLipCurlStats(model)
  return stats.tipBelowLastPeak && stats.tipSlope < -0.05
}

function centerlineBackfoldIsBounded(model: LatticeModel): boolean {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const maxSegmentLength = Math.max(model.config.spacing * 5.5, model.summary.overhangAmount * 0.22)
  const collisionTolerance = model.config.spacing * 0.24
  const nearGroundZ = Math.max(model.summary.maxHeight * 0.08, model.config.spacing * 0.08)

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
      if (a[2] <= nearGroundZ && b[2] <= nearGroundZ) continue
      const distance = Math.hypot(b[0] - a[0], b[2] - a[2])
      if (distance < collisionTolerance) return false
    }
  }

  return true
}

function centerlineHasVisibleLipDip(model: LatticeModel): boolean {
  return centerlineLipDropRatio(model) >= 0.24
}

function centerlineLipDropRatio(model: LatticeModel): number {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const maxHorizontalReach = maxValue(centerline.map(horizontalDisplacement), (value) => value, 0)
  const lipCandidates = centerline.filter((node) => (
    horizontalDisplacement(node) >= maxHorizontalReach * 0.08 &&
    node.currentPosition[2] > maxHeight * 0.02
  ))
  if (!lipCandidates.length) return 0
  const frontLip = lipCandidates.reduce((best, node) => {
    const bestReach = horizontalDisplacement(best)
    const nodeReach = horizontalDisplacement(node)
    if (nodeReach > bestReach + 0.000001) return node
    if (Math.abs(nodeReach - bestReach) <= 0.000001 && node.col > best.col) return node
    return best
  }, lipCandidates[0])

  return clampNumber((maxHeight - frontLip.currentPosition[2]) / maxHeight, 0, 1)
}

function terminalLipCurlStats(model: LatticeModel): { tipBelowLastPeak: boolean; tipSlope: number; tipDx: number } {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const maxHorizontalReach = maxValue(centerline.map(horizontalDisplacement), (value) => value, 0)
  const active = centerline.filter((node) => horizontalDisplacement(node) >= maxHorizontalReach * 0.08)

  if (active.length < 3) {
    return { tipBelowLastPeak: false, tipSlope: 0, tipDx: 0 }
  }

  const tip = active.reduce((best, node) => {
    const bestReach = horizontalDisplacement(best)
    const nodeReach = horizontalDisplacement(node)
    if (nodeReach > bestReach + 0.000001) return node
    if (Math.abs(nodeReach - bestReach) <= 0.000001 && node.col > best.col) return node
    return best
  }, active[0])
  const tipCenterlineIndex = centerline.findIndex((node) => node.id === tip.id)
  const terminalStartIndex = Math.max(0, Math.floor(tipCenterlineIndex * 0.6))
  const terminal = centerline.slice(terminalStartIndex, tipCenterlineIndex + 1)
  const peakHeight = maxValue(terminal.map((node) => node.currentPosition[2]), (value) => value, 0)
  const previous = centerline[Math.max(0, tipCenterlineIndex - 1)]
  const tipPoint = undoPlacementTransform(tip.currentPosition, model.config)
  const previousPoint = undoPlacementTransform(previous.currentPosition, model.config)
  const tipDx = tipPoint[0] - previousPoint[0]
  const tipSlope = (tipPoint[2] - previousPoint[2]) / Math.max(Math.abs(tipDx), 0.000001)

  return {
    tipBelowLastPeak: tip.currentPosition[2] < peakHeight - maxHeight * 0.035,
    tipSlope,
    tipDx,
  }
}

function groundTransitionSmoothsBottomDescent(low: LatticeModel, high: LatticeModel): boolean {
  const lowStats = centerlineDescentStats(low)
  const highStats = centerlineDescentStats(high)

  return highStats.activeEndCol >= lowStats.activeEndCol && highStats.maxAdjacentDrop < lowStats.maxAdjacentDrop * 0.92
}

function centerlineDescentStats(model: LatticeModel): { activeEndCol: number; maxAdjacentDrop: number } {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const active = centerline.filter((node) => node.currentPosition[2] > maxHeight * 0.02)
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

function horizontalDisplacement(node: LatticeNode): number {
  return Math.hypot(
    node.currentPosition[0] - node.restPosition[0],
    node.currentPosition[1] - node.restPosition[1],
  )
}

function buildNodes(config: InverseSheetConfig): LatticeNode[] {
  const columnsDenominator = Math.max(config.columns - 1, 1)
  const rowsDenominator = Math.max(config.rows - 1, 1)
  const nodes: LatticeNode[] = []

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.columns; col += 1) {
      const u = col / columnsDenominator
      const v = row / rowsDenominator
      const restLocal: Vec3 = [
        lerpNumber(-DEFAULT_SHEET_LENGTH / 2, DEFAULT_SHEET_LENGTH / 2, u),
        lerpNumber(-DEFAULT_SHEET_SPAN / 2, DEFAULT_SHEET_SPAN / 2, v),
        0,
      ]
      const targetLocal = overhangTargetPosition(u, v, restLocal, config)
      const currentLocal = lerpVec(restLocal, targetLocal, config.morph)
      const restPosition = applyPlacementTransform(restLocal, config)
      const targetPosition = applyPlacementTransform(targetLocal, config)
      const currentPosition = applyPlacementTransform(currentLocal, config)

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
  u: number,
  v: number,
  rest: Vec3,
  config: InverseSheetConfig,
): Vec3 {
  const groundTransition = clampNumber(config.smoothing, 0, 1)
  const stableGroundTransition = stableGroundTransitionValue(groundTransition)
  const wallSmoothness = clampNumber(config.wallSmoothness, 0, 1)
  const profileLimits = overhangProfileLimits(groundTransition)
  const flatRim = profileLimits.flatRim
  const blendRim = Math.min(0.46, flatRim + lerpNumber(0.1, 0.36, stableGroundTransition))
  const longitudinalBlendRim = Math.min(0.5, flatRim + lerpNumber(0.1, 0.42, stableGroundTransition))
  const profileStart = profileLimits.profileStart
  const profileEnd = profileLimits.profileEnd
  const uncenteredY = v * DEFAULT_SHEET_SPAN

  if (Math.abs(config.height) <= 0.000001) {
    return rest
  }

  if (u <= profileStart || u >= profileEnd) {
    return rest
  }

  const remainingU = Math.max(profileEnd - profileStart, 0.000001)
  const profileU = clampNumber((u - profileStart) / remainingU, 0, 1)
  const rimY = transverseWaveMask(uncenteredY, DEFAULT_SHEET_SPAN, config, flatRim, blendRim, wallSmoothness)
  const rimX = edgeRamp(u, flatRim, longitudinalBlendRim) * edgeRamp(1 - u, flatRim, longitudinalBlendRim)
  const maskExponent = lerpNumber(1.7, 0.68, stableGroundTransition)
  const activityMask = Math.pow(rimX, maskExponent) * Math.pow(rimY, lerpNumber(1.05, 0.78, wallSmoothness))

  if (activityMask <= 0.000001) {
    return rest
  }

  const eased = lerpNumber(profileU, smootherStep(profileU), 0.08 + stableGroundTransition * 0.46)
  const remainingLength = Math.max(DEFAULT_SHEET_LENGTH * remainingU, DEFAULT_SHEET_SPACING)
  const curl = PARALLEL_ANGLE_CURL
  const lipDip = lipDipAmount(config.overhangAngleDeg)
  const overhangAmount = Math.min(config.horizontalOffset, remainingLength * 0.78)
  const heightProfile = waveHeightProfile(eased, curl, groundTransition, config.lipSharpness, config.conicRho, config.curlRadius)
  const waveHeight = Math.min(config.height, remainingLength * 0.42)
  let horizontalProjection = overhangAmount * curlProjectionProfile(
    eased,
    curl,
    groundTransition,
    config.lipSharpness,
    config.conicRho,
    config.curlRadius,
  )
  let liftedHeight = waveHeight * heightProfile

  if (lipDip > 0.000001) {
    const terminalCurl = applyTerminalLipCurl(
      eased,
      horizontalProjection,
      liftedHeight,
      overhangAmount,
      waveHeight,
      lipDip,
      groundTransition,
      config.lipSharpness,
      config.conicRho,
      config.curlRadius,
    )
    horizontalProjection = terminalCurl.x
    liftedHeight = terminalCurl.z
  }

  const deformed: Vec3 = [
    rest[0] + activityMask * horizontalProjection,
    rest[1],
    activityMask * liftedHeight,
  ]

  return lerpVec(deformed, rest, clampNumber(config.flatContribution, 0, 1))
}

function applyTerminalLipCurl(
  t: number,
  x: number,
  z: number,
  overhangAmount: number,
  waveHeight: number,
  lipDip: number,
  smoothing: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): { x: number; z: number } {
  const start = terminalLipCurlStart(smoothing, lipSharpness, conicRho, curlRadius)
  const envelope = Math.pow(
    smootherStep((t - start) / Math.max(1 - start, 0.000001)),
    0.45,
  )

  if (lipDip <= 0.000001 || envelope <= 0.000001 || overhangAmount <= 0.000001 || waveHeight <= 0.000001) {
    return { x, z }
  }

  const curl = PARALLEL_ANGLE_CURL
  const hingeX = overhangAmount * curlProjectionProfile(start, curl, smoothing, lipSharpness, conicRho, curlRadius)
  const hingeZ = waveHeight * waveHeightProfile(start, curl, smoothing, lipSharpness, conicRho, curlRadius)
  const dx = x - hingeX
  const dz = z - hingeZ
  const angleRad = -MAX_TERMINAL_LIP_DIP_RAD * clampNumber(lipDip, 0, 1) * envelope
  const c = Math.cos(angleRad)
  const s = Math.sin(angleRad)
  const rotatedX = hingeX + c * dx - s * dz
  const rotatedZ = hingeZ + s * dx + c * dz

  return {
    x: rotatedX,
    z: Math.max(0, rotatedZ),
  }
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
  const parallel = curlParallelAmount(curl)
  const downDip = curlDownDipAmount(curl)
  const pointed = smootherStep(clampNumber(lipSharpness, 0, 1))
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const riseEnd = clampNumber(
    0.76 + lerpNumber(0.035, -0.03, rho) + lerpNumber(-0.035, 0.04, radius),
    0.62,
    0.84,
  )
  const returnStart = clampNumber(
    lerpNumber(0.94, 0.76, downDip) + lerpNumber(0.025, -0.02, rho) + lerpNumber(-0.035, 0.02, pointed),
    riseEnd + 0.04,
    0.96,
  )
  const rise = smootherStep(t / Math.max(riseEnd, 0.000001))
  const baseReturn = Math.max(
    0,
    (1 - pointed) * 0.14 + lerpNumber(0.03, -0.03, rho) + lerpNumber(-0.035, 0.02, radius),
  )
  const returnAmount = clampNumber(baseReturn * downDip, 0, 0.24)
  const returnUnder = 1 - returnAmount * smootherStep((t - returnStart) / Math.max(1 - returnStart, 0.000001))
  const power = clampNumber(
    lerpNumber(1.12, 0.72, smoothing) + lerpNumber(0.12, -0.12, rho) + lerpNumber(-0.08, 0.1, radius) +
      pointed * 0.12,
    0.54,
    1.4,
  )
  const curledWave = Math.pow(Math.max(rise * returnUnder, 0), power)

  return lerpNumber(broadWave, curledWave, parallel)
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
  const downDip = curlDownDipAmount(curl)
  const pointed = smootherStep(clampNumber(lipSharpness, 0, 1))
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const terminalStart = terminalLipCurlStart(smoothing, lipSharpness, conicRho, curlRadius)
  const riseEnd = clampNumber(
    lerpNumber(0.64, 0.54, downDip) + lerpNumber(0.045, -0.04, rho) + lerpNumber(-0.04, 0.05, radius),
    0.4,
    0.7,
  )
  const fallStart = clampNumber(
    lerpNumber(
      lerpNumber(0.84, 0.78, pointed) + lerpNumber(0.035, -0.035, rho) + lerpNumber(-0.035, 0.035, radius),
      terminalStart,
      downDip,
    ),
    Math.max(riseEnd + 0.055, 0.7),
    0.92,
  )
  const rise = smootherStep(t / Math.max(riseEnd, 0.000001))
  const terminal = smootherStep((t - fallStart) / Math.max(1 - fallStart, 0.000001))
  const dropDepth = clampNumber(
    downDip * lerpNumber(0.78, 0.54, pointed),
    0,
    0.88,
  )
  const terminalFall = 1 - dropDepth * terminal

  const power = clampNumber(
    lerpNumber(0.9, 0.66, smoothing) + pointed * 0.22 + lerpNumber(0.14, -0.16, rho) + lerpNumber(-0.1, 0.12, radius),
    0.44,
    1.2,
  )

  return Math.pow(Math.max(rise * terminalFall, 0), power)
}

function terminalLipCurlStart(smoothing: number, lipSharpness: number, conicRho: number, curlRadius: number): number {
  const pointed = smootherStep(clampNumber(lipSharpness, 0, 1))
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)

  return clampNumber(
    0.47 + lerpNumber(-0.045, 0.045, pointed) + lerpNumber(0.02, -0.02, rho) + lerpNumber(-0.015, 0.02, radius) -
      smoothing * 0.015,
    0.39,
    0.62,
  )
}

function curlParallelAmount(curl: number): number {
  return clampNumber(curl / PARALLEL_ANGLE_CURL, 0, 1)
}

function curlDownDipAmount(curl: number): number {
  return clampNumber((curl - PARALLEL_ANGLE_CURL) / (1 - PARALLEL_ANGLE_CURL), 0, 1)
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
  const horizontalProjection = liftedNodes.map((node) => {
    const dx = node.currentPosition[0] - node.restPosition[0]
    const dy = node.currentPosition[1] - node.restPosition[1]
    return Math.hypot(dx, dy)
  })
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

function distanceVec(a: Vec3, b: Vec3): number {
  return lengthVec(subtractVec(a, b))
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
