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

export type ProfileControlPoint = { x: number; z: number }

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
const DEFAULT_SHEET_COLUMNS = 112
const MIN_INVERSE_SHEET_COLUMNS = DEFAULT_SHEET_COLUMNS
const DEFAULT_SHEET_SPACING = 1
const DEFAULT_WAVE_FIELD_LENGTH = 43 * DEFAULT_SHEET_SPACING
const DEFAULT_WAVE_FIELD_SPAN = (DEFAULT_SHEET_ROWS - 1) * DEFAULT_SHEET_SPACING
const DEFAULT_SHEET_LENGTH = 80
const DEFAULT_SHEET_SPAN = 80
const DEFAULT_WAVE_FIELD_OFFSET_X = -7.5
const DEFAULT_WAVE_FIELD_MIN_X = DEFAULT_WAVE_FIELD_OFFSET_X - DEFAULT_WAVE_FIELD_LENGTH * 0.5
const DEFAULT_WAVE_FIELD_MAX_X = DEFAULT_WAVE_FIELD_OFFSET_X + DEFAULT_WAVE_FIELD_LENGTH * 0.5
const DEFAULT_GRID_DENOMINATOR = Math.max(DEFAULT_SHEET_ROWS - 1, DEFAULT_SHEET_COLUMNS - 1)
const MAX_STEER_ANGLE_RAD = Math.PI / 4
const PROFILE_LIP_SHARPNESS = 0.28
const CORE_PROFILE_SMOOTHING = 0.58
const CORE_PROFILE_START = 0.02
const CORE_PROFILE_END = 1
const CORE_OVERHANG_HEIGHT_FRACTION = 0.28
export const DEFAULT_CUSTOM_PROFILE_POINTS =
  '0,0;0.08,0;0.17,0.025;0.3,0.29;0.45,0.63;0.61,0.84;0.76,0.88;0.88,0.78;0.97,0.55;0.995,0.35;0.96,0.22;0.86,0.18;0.73,0.3;0.63,0.3;0.55,0.18;0.54,0.08;0.62,0.035;0.84,0.018;1,0'
export const DEFAULT_CUSTOM_SECTION_POINTS =
  '0,0.025;0.08,0.22;0.22,0.78;0.39,1;0.57,0.82;0.72,0.42;0.86,0.18;1,0.035'

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
  horizontalOffset: 17.5,
  overhangPosition: -0.15,
  steer: 0,
  height: 17.5,
  overhangWidth: 22,
  overhangAngleDeg: 120,
  conicRho: 0.5,
  curlRadius: 0.65,
  profileMode: 'generated',
  profilePoints: DEFAULT_CUSTOM_PROFILE_POINTS,
  sectionPoints: DEFAULT_CUSTOM_SECTION_POINTS,
  profileScale: 1.08,
  xySliceLevel: 0.33,
  smoothing: 1,
  lipSharpness: 0.28,
  wallSmoothness: 0.28,
  flatContribution: 0.35,
  widthScale: 1,
  strainWeight: 1,
  bendWeight: 0.02,
  shearWeight: 0.02,
  dihedralWeight: 0.02,
  showSurface: false,
  showRestGhost: false,
  showNodes: true,
  showEdges: true,
  showLabels: false,
  showHeatmap: false,
  colorMode: 'edgeStrain',
}

const TARGET_PRESETS: TargetPreset[] = ['overhang']
const RADIUS_MODES: RadiusMode[] = ['autoPreserveLength', 'manual']
const COLOR_MODE_VALUES = COLOR_MODES.map((mode) => mode.value)
const OVERHANG_ANGLE_MIN_DEG = 90
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
  const columns = readInteger(raw.columns, DEFAULT_INVERSE_SHEET_CONFIG.columns, MIN_INVERSE_SHEET_COLUMNS, 120)
  const spacing = 1
  const smoothing = readNumber(raw.smoothing, DEFAULT_INVERSE_SHEET_CONFIG.smoothing, 0, 1)
  const overhangPosition = readNumber(raw.overhangPosition, DEFAULT_INVERSE_SHEET_CONFIG.overhangPosition, -1, 1)
  const steer = readNumber(raw.steer, DEFAULT_INVERSE_SHEET_CONFIG.steer, -1, 1)
  const overhangAngleDeg = readOverhangAngleDeg(input)
  const ranges = calculateInverseSheetUsableRanges(smoothing, overhangPosition, overhangAngleDeg)

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
    profileMode: DEFAULT_INVERSE_SHEET_CONFIG.profileMode,
    profilePoints: serializeProfilePoints(parseProfilePoints(readString(raw.profilePoints, DEFAULT_CUSTOM_PROFILE_POINTS))),
    sectionPoints: serializeProfilePoints(parseProfilePoints(readString(raw.sectionPoints, DEFAULT_CUSTOM_SECTION_POINTS))),
    profileScale: readNumber(raw.profileScale, DEFAULT_INVERSE_SHEET_CONFIG.profileScale, 0.35, 1.55),
    xySliceLevel: readNumber(raw.xySliceLevel, DEFAULT_INVERSE_SHEET_CONFIG.xySliceLevel, 0.05, 0.95),
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
  const overhangPosition = readNumber(raw.overhangPosition, DEFAULT_INVERSE_SHEET_CONFIG.overhangPosition, -1, 1)
  const overhangAngleDeg = readOverhangAngleDeg(raw)

  return calculateInverseSheetUsableRanges(smoothing, overhangPosition, overhangAngleDeg)
}

function calculateInverseSheetUsableRanges(
  smoothing: number,
  _overhangPosition = DEFAULT_INVERSE_SHEET_CONFIG.overhangPosition,
  _overhangAngleDeg = DEFAULT_INVERSE_SHEET_CONFIG.overhangAngleDeg,
): InverseSheetUsableRanges {
  void _overhangPosition
  void _overhangAngleDeg
  const profile = overhangProfileLimits(smoothing)
  const remainingLength = Math.max(DEFAULT_WAVE_FIELD_LENGTH * profile.remainingU, DEFAULT_SHEET_SPACING)
  const maxHalfWidth = Math.max(DEFAULT_WAVE_FIELD_SPAN * 0.5, DEFAULT_SHEET_SPACING)
  const waveEndX = DEFAULT_WAVE_FIELD_MIN_X + profile.profileEnd * DEFAULT_WAVE_FIELD_LENGTH
  const placedWaveEndX = waveEndX + overhangPositionOffset(1)
  const availableForward = Math.max(
    DEFAULT_SHEET_SPACING,
    DEFAULT_SHEET_LENGTH / 2 - DEFAULT_SHEET_SPACING * 1.5 - placedWaveEndX,
  )
  const terminalReachMultiplier = 1.23
  const frontSafeHorizontalOffset = availableForward / Math.max(terminalReachMultiplier, 0.000001)

  return {
    heightMax: roundControlMax(Math.min(24, remainingLength * 0.42), 0.25),
    horizontalOffsetMax: roundControlMax(Math.min(32, remainingLength * 0.78, frontSafeHorizontalOffset), 0.25),
    overhangWidthMax: roundControlMax(Math.min(72, maxHalfWidth * 2), 0.5),
  }
}

function overhangProfileLimits(smoothing: number) {
  void smoothing
  const flatRim = 0
  const profileStart = CORE_PROFILE_START
  const profileEnd = CORE_PROFILE_END

  return {
    flatRim,
    profileStart,
    profileEnd,
    remainingU: Math.max(profileEnd - profileStart, 1 / DEFAULT_GRID_DENOMINATOR),
  }
}

function overhangPositionOffset(overhangPosition: number, totalWidth = DEFAULT_WAVE_FIELD_LENGTH): number {
  return clampNumber(overhangPosition, -1, 1) * totalWidth * 0.045
}

function steerYaw(steer: number): number {
  return clampNumber(steer, -1, 1) * MAX_STEER_ANGLE_RAD
}

function rootAnchor(config: InverseSheetConfig): Vec3 {
  const profileStart = overhangProfileLimits(config.smoothing).profileStart
  return [DEFAULT_WAVE_FIELD_MIN_X + profileStart * DEFAULT_WAVE_FIELD_LENGTH, 0, 0]
}

function canonicalFieldConfig(config: InverseSheetConfig): InverseSheetConfig {
  return {
    ...config,
    overhangPosition: 0,
    steer: 0,
  }
}

function expectedCanonicalRestPosition(row: number, col: number, config: InverseSheetConfig): Vec3 {
  const columnsDenominator = Math.max(config.columns - 1, 1)
  const rowsDenominator = Math.max(config.rows - 1, 1)
  const u = col / columnsDenominator
  const v = row / rowsDenominator

  return [
    lerpNumber(-DEFAULT_SHEET_LENGTH / 2, DEFAULT_SHEET_LENGTH / 2, u),
    lerpNumber(-DEFAULT_SHEET_SPAN / 2, DEFAULT_SHEET_SPAN / 2, v),
    0,
  ]
}

function isBoundaryNodeIndex(row: number, col: number, config: InverseSheetConfig): boolean {
  return row === 0 || col === 0 || row === config.rows - 1 || col === config.columns - 1
}

function mapSheetPointToCanonicalWaveFrame(point: Vec3, config: InverseSheetConfig): Vec3 {
  const canonicalConfig = canonicalFieldConfig(config)
  const anchor = rootAnchor(canonicalConfig)
  const yaw = steerYaw(config.steer)
  const c = Math.cos(-yaw)
  const s = Math.sin(-yaw)
  const placedAnchor: Vec3 = [
    anchor[0] + overhangPositionOffset(config.overhangPosition),
    anchor[1],
    anchor[2],
  ]
  const dx = point[0] - placedAnchor[0]
  const dy = point[1] - placedAnchor[1]

  return [
    anchor[0] + c * dx - s * dy,
    anchor[1] + s * dx + c * dy,
    point[2],
  ]
}

function rotateYawVector(vector: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)

  return [
    c * vector[0] - s * vector[1],
    s * vector[0] + c * vector[1],
    vector[2],
  ]
}

function pointInsideCanonicalSheet(point: Vec3, tolerance = 0): boolean {
  return (
    point[0] >= -DEFAULT_SHEET_LENGTH / 2 - tolerance &&
    point[0] <= DEFAULT_SHEET_LENGTH / 2 + tolerance &&
    point[1] >= -DEFAULT_SHEET_SPAN / 2 - tolerance &&
    point[1] <= DEFAULT_SHEET_SPAN / 2 + tolerance
  )
}

function pointInsideCanonicalWaveField(point: Vec3, tolerance = 0): boolean {
  return (
    point[0] >= DEFAULT_WAVE_FIELD_MIN_X - tolerance &&
    point[0] <= DEFAULT_WAVE_FIELD_MAX_X + tolerance &&
    point[1] >= -DEFAULT_WAVE_FIELD_SPAN / 2 - tolerance &&
    point[1] <= DEFAULT_WAVE_FIELD_SPAN / 2 + tolerance
  )
}

function pointInsideCanonicalSupportField(point: Vec3, config: InverseSheetConfig): boolean {
  const transition = clampNumber(config.smoothing, 0, 1)
  const flatContribution = clampNumber(config.flatContribution, 0, 1)
  const reachShare = clampNumber(config.horizontalOffset / DEFAULT_WAVE_FIELD_LENGTH, 0, 0.45)
  const maxForwardMargin = Math.max(DEFAULT_SHEET_LENGTH / 2 - DEFAULT_WAVE_FIELD_MAX_X - DEFAULT_SHEET_SPACING * 2, DEFAULT_SHEET_SPACING)
  const marginX = Math.min(
    maxForwardMargin,
    DEFAULT_WAVE_FIELD_LENGTH * (
      lerpNumber(0.1, 0.34, Math.max(transition, flatContribution)) +
      reachShare * 0.64
    ),
  )
  const marginY = DEFAULT_WAVE_FIELD_SPAN * lerpNumber(0.18, 0.62, Math.max(transition, flatContribution))

  return (
    point[0] >= DEFAULT_WAVE_FIELD_MIN_X - marginX &&
    point[0] <= DEFAULT_WAVE_FIELD_MAX_X + marginX &&
    point[1] >= -DEFAULT_WAVE_FIELD_SPAN / 2 - marginY &&
    point[1] <= DEFAULT_WAVE_FIELD_SPAN / 2 + marginY
  )
}

function waveFieldU(point: Vec3): number {
  return (point[0] - DEFAULT_WAVE_FIELD_MIN_X) / DEFAULT_WAVE_FIELD_LENGTH
}

function waveFieldV(point: Vec3): number {
  return (point[1] + DEFAULT_WAVE_FIELD_SPAN / 2) / DEFAULT_WAVE_FIELD_SPAN
}

function targetFromDeformationField(restPosition: Vec3, config: InverseSheetConfig): Vec3 {
  const canonicalSample = mapSheetPointToCanonicalWaveFrame(restPosition, config)

  if (!pointInsideCanonicalSheet(canonicalSample) || !pointInsideCanonicalSupportField(canonicalSample, config)) {
    return restPosition
  }

  const canonicalConfig = canonicalFieldConfig(config)
  const u = waveFieldU(canonicalSample)
  const v = waveFieldV(canonicalSample)
  const canonicalTarget = canonicalOverhangTargetPosition(u, v, canonicalSample, canonicalConfig)
  const localDelta = subtractVec(canonicalTarget, canonicalSample)
  const worldDelta = rotateYawVector(localDelta, steerYaw(config.steer))

  return addVec(restPosition, worldDelta)
}

function lipDipAmount(angleDeg: number): number {
  return clampNumber(
    (angleDeg - OVERHANG_ANGLE_PARALLEL_DEG) / (OVERHANG_ANGLE_MAX_DEG - OVERHANG_ANGLE_PARALLEL_DEG),
    0,
    1,
  )
}

function breakingLipStrength(lipDip: number): number {
  const curlStart = 0.56
  return smootherStep((clampNumber(lipDip, 0, 1) - curlStart) / (1 - curlStart))
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
  const dihedralPairs = buildDihedralPairs(config.rows, config.columns, new Set(quads.map((quad) => quad.id)))
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
  const generatedMode: LooseConfig = { profileMode: 'generated' }
  const flat = buildInverseSheetModel({ morph: 0 })
  const zeroed = buildInverseSheetModel({ ...generatedMode, horizontalOffset: 0 })
  const flatHeight = buildInverseSheetModel({ ...generatedMode, horizontalOffset: 0, height: 0 })
  const twoByTwo = buildInverseSheetModel({ ...generatedMode, rows: 2, columns: 2 })
  const defaultOverhang = buildInverseSheetModel(DEFAULT_INVERSE_SHEET_CONFIG)
  const customScaleLow = buildInverseSheetModel({ profileScale: 0.55 })
  const customScaleHigh = buildInverseSheetModel({ profileScale: 1.35 })
  const highOverhang = buildInverseSheetModel({ ...generatedMode, horizontalOffset: 32 })
  const highAngleHighOverhang = buildInverseSheetModel({
    ...generatedMode,
    horizontalOffset: 32,
    overhangAngleDeg: 120,
    smoothing: 1,
    lipSharpness: 0.2,
  })
  const lowWave = buildInverseSheetModel({ ...generatedMode, horizontalOffset: 9, height: 4 })
  const tallWave = buildInverseSheetModel({ ...generatedMode, horizontalOffset: 9, height: 10 })
  const narrowWave = buildInverseSheetModel({ ...generatedMode, overhangWidth: 12 })
  const wideWave = buildInverseSheetModel({ ...generatedMode, overhangWidth: 36 })
  const neutralAngle = buildInverseSheetModel({ ...generatedMode, overhangAngleDeg: 90, flatContribution: 0 })
  const highAngle = buildInverseSheetModel({ ...generatedMode, overhangAngleDeg: 120, flatContribution: 0 })
  const highAngleLip = terminalLipCurlStats(highAngle)
  const lowAngleSmallGrid = buildInverseSheetModel({
    ...generatedMode,
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 0,
    overhangAngleDeg: 90,
  })
  const highAngleSmallGrid = buildInverseSheetModel({
    ...generatedMode,
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 0,
    overhangAngleDeg: 120,
  })
  const twelveByMinimumColumns = buildInverseSheetModel({ ...generatedMode, rows: 12, columns: 12 })
  const fortyByForty = buildInverseSheetModel({ rows: 40, columns: 40 })
  const lowGroundTransition = buildInverseSheetModel({
    ...generatedMode,
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 0,
    overhangAngleDeg: 90,
  })
  const highGroundTransition = buildInverseSheetModel({
    ...generatedMode,
    rows: 20,
    columns: 20,
    height: 99,
    horizontalOffset: 99,
    overhangWidth: 99,
    smoothing: 1,
    overhangAngleDeg: 90,
  })
  const positionBack = buildInverseSheetModel({ overhangPosition: -1, flatContribution: 0 })
  const positionNeutral = buildInverseSheetModel({ overhangPosition: 0, flatContribution: 0 })
  const positionFront = buildInverseSheetModel({ overhangPosition: 1, flatContribution: 0 })
  const steerLeft = buildInverseSheetModel({ steer: -1, overhangPosition: 0, flatContribution: 0 })
  const steerNeutral = buildInverseSheetModel({ steer: 0, overhangPosition: 0, flatContribution: 0 })
  const steerRight = buildInverseSheetModel({ steer: 1, overhangPosition: 0, flatContribution: 0 })
  const displayOff = buildInverseSheetModel({ showHeatmap: false, colorMode: 'edgeStrain' })
  const displayUres = buildInverseSheetModel({ showHeatmap: true, colorMode: 'displacement' })
  const resolutionReference = buildInverseSheetModel({ ...generatedMode, rows: 44, columns: MIN_INVERSE_SHEET_COLUMNS, overhangWidth: 32 })
  const resolution24 = buildInverseSheetModel({ ...generatedMode, rows: 24, columns: 24, overhangWidth: 32 })
  const resolution72 = buildInverseSheetModel({ ...generatedMode, rows: 72, columns: MIN_INVERSE_SHEET_COLUMNS, overhangWidth: 32 })
  const flatContributionOff = buildInverseSheetModel({ ...generatedMode, flatContribution: 0 })
  const flatContributionOn = buildInverseSheetModel({ ...generatedMode, flatContribution: 1 })
  const terminalCurl = buildInverseSheetModel({
    ...generatedMode,
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
  if (customScaleHigh.summary.maxHeight <= customScaleLow.summary.maxHeight + 2) {
    failures.push('scale control should visibly change the wave height')
  }
  if (!flatContributionSharesApron(flatContributionOff, flatContributionOn)) {
    failures.push('flat contribution should preserve the main wave while adding a surrounding support apron')
  }
  if (zeroed.summary.overhangAmount !== 0) failures.push('zero horizontal offset should report no horizontal overhang')
  if (!isSummaryNearZero(flatHeight.summary)) failures.push('zero height and zero offset should keep the grid flat')
  if (twelveByMinimumColumns.config.columns !== MIN_INVERSE_SHEET_COLUMNS) {
    failures.push('inverse sheet should preserve the configured minimum column count')
  }
  if (twelveByMinimumColumns.edges.length !==
    twelveByMinimumColumns.config.rows * (twelveByMinimumColumns.config.columns - 1) +
      (twelveByMinimumColumns.config.rows - 1) * twelveByMinimumColumns.config.columns) {
    failures.push('minimum-resolution edge count mismatch')
  }
  if (twelveByMinimumColumns.quads.length !==
    (twelveByMinimumColumns.config.rows - 1) * (twelveByMinimumColumns.config.columns - 1)) {
    failures.push('minimum-resolution quad count mismatch')
  }
  if (twoByTwo.nodes.length !== twoByTwo.config.rows * twoByTwo.config.columns ||
    twoByTwo.quads.length !== (twoByTwo.config.rows - 1) * (twoByTwo.config.columns - 1)) {
    failures.push('minimum inverse-sheet grid did not build')
  }
  if (fortyByForty.nodes.some((node) => !isFiniteVec(node.currentPosition))) failures.push('40x40 produced invalid node positions')
  if (!boundaryNodesStayFlat(defaultOverhang)) failures.push('default overhang boundary should stay fixed and flat')
  if (!boundaryNodesStayFlat(highOverhang)) failures.push('high-overhang boundary should stay fixed and flat')
  if (!centerlineBackfoldIsBounded(highOverhang)) failures.push('high-overhang angle should stay bounded')
  if (!centerlineBackfoldIsBounded(highAngleHighOverhang)) failures.push('high-angle high-overhang shape should not self-overlap')
  if (!centerlineHasVisibleLipDip(highAngle)) failures.push('120 deg lip dip should visibly lower the front lip')
  if (centerlineLipDropRatio(highAngleSmallGrid) < centerlineLipDropRatio(lowAngleSmallGrid) + 0.08) {
    failures.push('120 deg lip dip should lower the front lip more than neutral 90 deg on a 20x20 grid')
  }
  if (defaultOverhang.summary.overhangAmount <= 0) failures.push('default overhang should report a positive horizontal projection')
  if (Math.abs(lowWave.summary.overhangAmount - tallWave.summary.overhangAmount) > 0.03) {
    failures.push('changing height should not change measured horizontal overhang amount')
  }
  if (tallWave.summary.maxHeight <= lowWave.summary.maxHeight + 1) failures.push('height control should change vertical wave height')
  if (
    !highAngleLip.tipForwardOfCrest ||
    !highAngleLip.hookTuckedUnderShoulder ||
    highAngleLip.tipForwardDistance < DEFAULT_SHEET_SPACING * 1.5 ||
    !highAngleLip.returnToFlat ||
    !highAngleLip.noBackfoldCavity ||
    !highAngleLip.noVisibleDimplePocket
  ) {
    failures.push('lip dip should preserve a forward shoulder, downturned nose, and no collapsed cavity')
  }
  if (preTerminalCenterlineProfileResidual(neutralAngle, highAngle, preTerminalLipCutoff()) < DEFAULT_SHEET_SPACING * 0.5) {
    failures.push('lip dip should reshape the full side profile into a curled tapered cone')
  }
  if (!noInteriorBowlPockets(highAngle) || !noInteriorBowlPockets(defaultOverhang)) {
    failures.push('curled cone surface should not contain bowl-like local minima')
  }
  if (!boundaryNodesStayFlat(narrowWave)) failures.push('narrow overhang boundary should stay fixed and flat')
  if (measureActiveRowCount(wideWave) <= measureActiveRowCount(narrowWave)) {
    failures.push('overhang width control should change the active wave width')
  }
  if (centerlineProfileResidual(narrowWave, wideWave) > 0.05) {
    failures.push('overhang width should not change the x-z centerline profile')
  }
  if (
    preTerminalCenterlineProfileResidual(resolution24, resolutionReference, 0.94) > 3.25 ||
    preTerminalCenterlineProfileResidual(resolution72, resolutionReference, 0.94) > 1.35
  ) {
    failures.push('rows and columns should only resample the same physical overhang profile')
  }
  if (!groundTransitionPreservesCoreAndBroadensSupport(lowGroundTransition, highGroundTransition)) {
    failures.push('ground transition should preserve the core lip while broadening surrounding support')
  }
  if (!positionMovesFieldInsideFixedSheet(positionBack, positionNeutral) || !positionMovesFieldInsideFixedSheet(positionFront, positionNeutral)) {
    failures.push('overhang position should move the deformation field inside a fixed square sheet')
  }
  if (!steerRotatesFieldInsideFixedSheet(steerLeft, steerNeutral) || !steerRotatesFieldInsideFixedSheet(steerRight, steerNeutral)) {
    failures.push('steer should rotate the deformation field inside a fixed square sheet')
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
    const expected = expectedCanonicalRestPosition(node.row, node.col, model.config)

    if (distanceVec(node.restPosition, expected) > tolerance) return false
    if (!isBoundaryNodeIndex(node.row, node.col, model.config)) return true

    return (
      distanceVec(node.currentPosition, expected) <= tolerance &&
      distanceVec(node.targetPosition, expected) <= tolerance &&
      Math.abs(node.currentPosition[2]) <= tolerance
    )
  })
}

function positionMovesFieldInsideFixedSheet(candidate: LatticeModel, neutral: LatticeModel): boolean {
  if (!restGridsMatch(candidate, neutral)) return false
  if (!boundaryNodesStayFlat(candidate)) return false

  const residual = transformedDisplacementFieldResidual(candidate, neutral)
  const candidateCenter = activeDisplacementCentroid(candidate)
  const neutralCenter = activeDisplacementCentroid(neutral)
  const expectedOffset = overhangPositionOffset(candidate.config.overhangPosition) - overhangPositionOffset(neutral.config.overhangPosition)
  const movedAsExpected = Math.abs((candidateCenter[0] - neutralCenter[0]) - expectedOffset) <= DEFAULT_SHEET_SPACING * 0.85

  return residual <= 10 && shapeMetricsPreserved(candidate, neutral) && movedAsExpected
}

function steerRotatesFieldInsideFixedSheet(candidate: LatticeModel, neutral: LatticeModel): boolean {
  if (!restGridsMatch(candidate, neutral)) return false
  if (!boundaryNodesStayFlat(candidate)) return false

  const residual = transformedDisplacementFieldResidual(candidate, neutral)
  const candidateCenter = activeDisplacementCentroid(candidate)
  const neutralCenter = activeDisplacementCentroid(neutral)
  const expectedDirection = Math.sign(candidate.config.steer)
  const yShift = candidateCenter[1] - neutralCenter[1]

  return residual <= 16 && shapeMetricsPreserved(candidate, neutral) && Math.sign(yShift) === expectedDirection && Math.abs(yShift) >= DEFAULT_SHEET_SPACING * 0.6
}

function shapeMetricsPreserved(candidate: LatticeModel, neutral: LatticeModel): boolean {
  const heightBase = Math.max(neutral.summary.maxHeight, 0.000001)
  const overhangBase = Math.max(neutral.summary.overhangAmount, 0.000001)
  const heightResidual = Math.abs(candidate.summary.maxHeight - neutral.summary.maxHeight) / heightBase
  const overhangResidual = Math.abs(candidate.summary.overhangAmount - neutral.summary.overhangAmount) / overhangBase
  const yawChanged = Math.abs(steerYaw(candidate.config.steer) - steerYaw(neutral.config.steer)) > 0.000001

  return heightResidual <= 0.045 && (yawChanged || overhangResidual <= 0.075)
}

function restGridsMatch(a: LatticeModel, b: LatticeModel): boolean {
  if (a.nodes.length !== b.nodes.length) return false
  const tolerance = 0.000001

  return a.nodes.every((node, index) => {
    const other = b.nodes[index]
    const expected = expectedCanonicalRestPosition(node.row, node.col, a.config)

    return distanceVec(node.restPosition, expected) <= tolerance && distanceVec(node.restPosition, other.restPosition) <= tolerance
  })
}

function transformedDisplacementFieldResidual(candidate: LatticeModel, neutral: LatticeModel): number {
  const yaw = steerYaw(candidate.config.steer)
  let residual = 0
  let samples = 0

  candidate.nodes.forEach((node) => {
    if (isBoundaryNodeIndex(node.row, node.col, candidate.config)) return

    const sample = mapSheetPointToCanonicalWaveFrame(node.restPosition, candidate.config)
    if (!pointInsideCanonicalSheet(sample, -DEFAULT_SHEET_SPACING * 1.25)) return

    const expectedLocalDelta = sampleDisplacementOnRestGrid(neutral, sample[0], sample[1])
    const expectedWorldDelta = rotateYawVector(expectedLocalDelta, yaw)
    const actualDelta = subtractVec(node.targetPosition, node.restPosition)
    residual = Math.max(residual, distanceVec(actualDelta, expectedWorldDelta))
    samples += 1
  })

  return samples > 0 ? residual : Infinity
}

function sampleDisplacementOnRestGrid(model: LatticeModel, x: number, y: number): Vec3 {
  if (!pointInsideCanonicalSheet([x, y, 0])) return [0, 0, 0]

  const u = clampNumber((x + DEFAULT_SHEET_LENGTH / 2) / DEFAULT_SHEET_LENGTH, 0, 1)
  const v = clampNumber((y + DEFAULT_SHEET_SPAN / 2) / DEFAULT_SHEET_SPAN, 0, 1)
  const scaledColumn = u * (model.config.columns - 1)
  const scaledRow = v * (model.config.rows - 1)
  const col0 = Math.floor(scaledColumn)
  const row0 = Math.floor(scaledRow)
  const col1 = Math.min(model.config.columns - 1, col0 + 1)
  const row1 = Math.min(model.config.rows - 1, row0 + 1)
  const colAmount = scaledColumn - col0
  const rowAmount = scaledRow - row0
  const d00 = nodeDisplacement(model, row0, col0)
  const d10 = nodeDisplacement(model, row0, col1)
  const d01 = nodeDisplacement(model, row1, col0)
  const d11 = nodeDisplacement(model, row1, col1)
  const top = lerpVec(d00, d10, colAmount)
  const bottom = lerpVec(d01, d11, colAmount)

  return lerpVec(top, bottom, rowAmount)
}

function nodeDisplacement(model: LatticeModel, row: number, col: number): Vec3 {
  const node = model.nodes.find((candidate) => candidate.row === row && candidate.col === col)
  if (!node) return [0, 0, 0]
  return subtractVec(node.targetPosition, node.restPosition)
}

function activeDisplacementCentroid(model: LatticeModel): Vec3 {
  let weightSum = 0
  const weighted: Vec3 = [0, 0, 0]

  model.nodes.forEach((node) => {
    const displacement = lengthVec(subtractVec(node.targetPosition, node.restPosition))
    if (displacement <= 0.0001) return
    weighted[0] += node.restPosition[0] * displacement
    weighted[1] += node.restPosition[1] * displacement
    weighted[2] += node.restPosition[2] * displacement
    weightSum += displacement
  })

  if (weightSum <= 0.000001) return [0, 0, 0]
  return [weighted[0] / weightSum, weighted[1] / weightSum, weighted[2] / weightSum]
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
  const profile = overhangProfileLimits(0)

  for (let index = 0; index < samples; index += 1) {
    const profileU = profile.profileStart + (index / (samples - 1)) * profile.remainingU
    const u = sheetUFromWaveFieldU(profileU)
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
    const profile = overhangProfileLimits(0)
    const u = profile.profileStart + (index / (samples - 1)) * clampNumber(endU, 0, 1) * profile.remainingU
    const sheetU = sheetUFromWaveFieldU(u)
    const aPoint = sampleCenterlineLocalPoint(a, sheetU)
    const bPoint = sampleCenterlineLocalPoint(b, sheetU)
    residual = Math.max(residual, Math.hypot(aPoint[0] - bPoint[0], aPoint[2] - bPoint[2]))
  }

  return residual
}

function sheetUFromWaveFieldU(u: number): number {
  const x = DEFAULT_WAVE_FIELD_MIN_X + clampNumber(u, 0, 1) * DEFAULT_WAVE_FIELD_LENGTH
  return (x + DEFAULT_SHEET_LENGTH / 2) / DEFAULT_SHEET_LENGTH
}

function sampleCenterlineLocalPoint(model: LatticeModel, u: number): Vec3 {
  const scaledRow = 0.5 * (model.config.rows - 1)
  const topRow = Math.floor(scaledRow)
  const bottomRow = Math.min(model.config.rows - 1, topRow + 1)
  const rowAmount = scaledRow - topRow
  const scaledColumn = clampNumber(u, 0, 1) * (model.config.columns - 1)
  const leftColumn = Math.floor(scaledColumn)
  const rightColumn = Math.min(model.config.columns - 1, leftColumn + 1)
  const columnAmount = scaledColumn - leftColumn
  const topLeft = model.nodes.find((node) => node.row === topRow && node.col === leftColumn)
  const topRight = model.nodes.find((node) => node.row === topRow && node.col === rightColumn)
  const bottomLeft = model.nodes.find((node) => node.row === bottomRow && node.col === leftColumn)
  const bottomRight = model.nodes.find((node) => node.row === bottomRow && node.col === rightColumn)
  const topLeftPoint = topLeft?.currentPosition ?? [0, 0, 0] as Vec3
  const topRightPoint = topRight?.currentPosition ?? topLeftPoint
  const bottomLeftPoint = bottomLeft?.currentPosition ?? topLeftPoint
  const bottomRightPoint = bottomRight?.currentPosition ?? bottomLeftPoint
  const topPoint = lerpVec(topLeftPoint, topRightPoint, columnAmount)
  const bottomPoint = lerpVec(bottomLeftPoint, bottomRightPoint, columnAmount)

  return lerpVec(topPoint, bottomPoint, rowAmount)
}

function terminalLipCurlIsDownward(model: LatticeModel): boolean {
  const stats = terminalLipCurlStats(model)
  return stats.tipBelowLastPeak &&
    stats.tipForwardOfCrest &&
    stats.hookTuckedUnderShoulder &&
    stats.returnToFlat &&
    stats.smoothTerminalReturn &&
    stats.noBackfoldCavity &&
    stats.noVisibleDimplePocket &&
    stats.tipSlope < -0.6
}

function centerlineBackfoldIsBounded(model: LatticeModel): boolean {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  const hasBreakingLip = lipDipAmount(model.config.overhangAngleDeg) > 0.000001
  const maxSegmentLength = Math.max(
    model.config.spacing * (hasBreakingLip ? 8.5 : 5.5),
    model.summary.overhangAmount * (hasBreakingLip ? 0.55 : 0.38),
  )
  const collisionTolerance = model.config.spacing * 0.24
  const nearGroundZ = Math.max(model.summary.maxHeight * 0.08, model.config.spacing * 0.08)

  for (let index = 0; index < centerline.length - 1; index += 1) {
    const current = centerline[index].currentPosition
    const next = centerline[index + 1].currentPosition
    const segmentLength = Math.hypot(next[0] - current[0], next[2] - current[2])
    if (segmentLength > maxSegmentLength) return false
  }

  if (hasBreakingLip && terminalLipCurlIsDownward(model)) {
    return true
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
  const stats = terminalLipCurlStats(model)
  return terminalLipCurlIsDownward(model) && stats.dropRatio >= 0.35
}

function centerlineLipDropRatio(model: LatticeModel): number {
  return terminalLipCurlStats(model).dropRatio
}

function centerlineBackfoldRatio(points: LatticeNode[]): number {
  if (points.length < 2) return 0
  let totalForward = 0
  let totalBackward = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const dx = points[index + 1].currentPosition[0] - points[index].currentPosition[0]
    if (dx >= 0) totalForward += dx
    else totalBackward += -dx
  }

  return totalBackward / Math.max(totalForward, DEFAULT_SHEET_SPACING)
}

function noInteriorBowlPockets(model: LatticeModel): boolean {
  const nodeByKey = new Map(model.nodes.map((node) => [`${node.row}:${node.col}`, node]))
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const bowlTolerance = Math.max(maxHeight * 0.012, model.config.spacing * 0.025)
  const activeTolerance = Math.max(maxHeight * 0.04, model.config.spacing * 0.08)

  for (let row = 1; row < model.config.rows - 1; row += 1) {
    for (let col = 1; col < model.config.columns - 1; col += 1) {
      const center = nodeByKey.get(`${row}:${col}`)
      const north = nodeByKey.get(`${row - 1}:${col}`)
      const south = nodeByKey.get(`${row + 1}:${col}`)
      const west = nodeByKey.get(`${row}:${col - 1}`)
      const east = nodeByKey.get(`${row}:${col + 1}`)
      if (!center || !north || !south || !west || !east) continue

      const centerZ = center.currentPosition[2]
      const neighborZ = [
        north.currentPosition[2],
        south.currentPosition[2],
        west.currentPosition[2],
        east.currentPosition[2],
      ]
      if (Math.max(centerZ, ...neighborZ) < activeTolerance) continue

      const risesInFourDirections = neighborZ.every((z) => z - centerZ > bowlTolerance)
      if (risesInFourDirections) return false
    }
  }

  return true
}

function terminalLipCurlStats(model: LatticeModel): {
  tipBelowLastPeak: boolean;
  tipSlope: number;
  tipDx: number;
  tipForwardOfCrest: boolean;
  hookTuckedUnderShoulder: boolean;
  openDownturnedLip: boolean;
  returnToFlat: boolean;
  smoothTerminalReturn: boolean;
  noBackfoldCavity: boolean;
  noVisibleDimplePocket: boolean;
  dropRatio: number;
  tipForwardDistance: number;
  hookTuckDistance: number;
  finalTangentAngleDeg: number;
  crestX: number;
  crestZ: number;
  shoulderX: number;
  shoulderZ: number;
  tipX: number;
  tipZ: number;
  returnX: number;
  returnZ: number;
  returnForwardDistance: number;
} {
  const row = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === row)
    .sort((a, b) => a.col - b.col)
  if (lipDipAmount(model.config.overhangAngleDeg) <= 0.000001) {
    return emptyTerminalLipCurlStats()
  }

  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const maxHorizontalReach = maxValue(centerline.map(horizontalDisplacement), (value) => value, 0)
  const active = centerline.filter((node) => (
    horizontalDisplacement(node) >= maxHorizontalReach * 0.08 ||
    node.currentPosition[2] > maxHeight * 0.02
  ))

  if (active.length < 3) {
    return emptyTerminalLipCurlStats()
  }

  const crest = active.reduce((best, node) => {
    if (node.currentPosition[2] > best.currentPosition[2] + 0.000001) return node
    if (Math.abs(node.currentPosition[2] - best.currentPosition[2]) <= 0.000001 && node.col < best.col) return node
    return best
  }, active[0])
  const postCrest = active.filter((node) => node.col > crest.col)
  if (!postCrest.length) return emptyTerminalLipCurlStats()

  const shoulderCandidates = postCrest.filter((node) => (
    node.currentPosition[2] >= maxHeight * 0.38
  ))
  const shoulderPool = shoulderCandidates.length ? shoulderCandidates : postCrest
  const shoulder = shoulderPool.reduce((best, node) => {
    const reach = node.currentPosition[0]
    const bestReach = best.currentPosition[0]
    if (reach > bestReach + 0.000001) return node
    if (Math.abs(reach - bestReach) <= 0.000001 && node.col < best.col) return node
    return best
  }, shoulderPool[0])
  const postShoulder = active.filter((node) => node.col > shoulder.col)
  if (!postShoulder.length) return emptyTerminalLipCurlStats()

  const shoulderReach = shoulder.currentPosition[0] - crest.currentPosition[0]
  const allowedTipTuck = Math.max(model.config.spacing * 0.4, shoulderReach * 0.72)
  const hookCandidates = postShoulder.filter((node) => (
    node.currentPosition[2] > maxHeight * 0.08 &&
    node.currentPosition[2] <= shoulder.currentPosition[2] - maxHeight * 0.08 &&
    node.currentPosition[0] >= shoulder.currentPosition[0] - allowedTipTuck
  ))
  const hookPool = hookCandidates.length ? hookCandidates : postShoulder
  const tip = hookPool.reduce((best, node) => {
    if (node.currentPosition[2] < best.currentPosition[2] - 0.000001) return node
    if (Math.abs(node.currentPosition[2] - best.currentPosition[2]) <= 0.000001 && node.currentPosition[0] > best.currentPosition[0]) return node
    return best
  }, hookPool[0])
  const postTip = centerline.filter((node) => node.col > tip.col)
  const activePostTip = postTip.filter((node) => (
    horizontalDisplacement(node) >= maxHorizontalReach * 0.02 ||
    node.currentPosition[2] > maxHeight * 0.005
  ))
  const flatReturnCandidates = activePostTip.filter((node) => node.currentPosition[2] <= maxHeight * 0.12)
  const flatReturn = (flatReturnCandidates.length ? flatReturnCandidates : activePostTip).reduce((best, node) => {
    if (!best) return node
    if (node.currentPosition[0] > best.currentPosition[0] + 0.000001) return node
    if (Math.abs(node.currentPosition[0] - best.currentPosition[0]) <= 0.000001 && node.col > best.col) return node
    return best
  }, undefined as LatticeNode | undefined) ?? postTip[postTip.length - 1] ?? tip
  const tipCenterlineIndex = centerline.findIndex((node) => node.id === tip.id)
  const previous = centerline[Math.max(0, tipCenterlineIndex - 1)]
  const next = centerline[Math.min(centerline.length - 1, tipCenterlineIndex + 1)]
  const tipPoint = tip.currentPosition
  const previousPoint = previous.currentPosition
  const nextPoint = next.currentPosition
  const incomingDx = tipPoint[0] - previousPoint[0]
  const outgoingDx = nextPoint[0] - tipPoint[0]
  const shoulderToTipDx = tipPoint[0] - shoulder.currentPosition[0]
  const shoulderToTipDz = tipPoint[2] - shoulder.currentPosition[2]
  let tipSlope = Math.min(
    (tipPoint[2] - previousPoint[2]) / Math.max(Math.abs(incomingDx), 0.000001),
    (nextPoint[2] - tipPoint[2]) / Math.max(Math.abs(outgoingDx), 0.000001),
    shoulderToTipDz / Math.max(Math.abs(shoulderToTipDx), 0.000001),
  )
  let finalTangentAngleDeg = Math.min(
    Math.atan2(tipPoint[2] - previousPoint[2], Math.abs(incomingDx)) * 180 / Math.PI,
    Math.atan2(nextPoint[2] - tipPoint[2], Math.abs(outgoingDx)) * 180 / Math.PI,
    Math.atan2(shoulderToTipDz, Math.abs(shoulderToTipDx)) * 180 / Math.PI,
  )
  const curlPath = centerline.slice(
    Math.max(0, centerline.findIndex((node) => node.id === crest.id)),
    Math.max(centerline.findIndex((node) => node.id === flatReturn.id) + 1, tipCenterlineIndex + 1),
  )
  let maxTerminalSegmentDrop = 0
  for (let index = 0; index < curlPath.length - 1; index += 1) {
    const a = curlPath[index].currentPosition
    const b = curlPath[index + 1].currentPosition
    maxTerminalSegmentDrop = Math.max(maxTerminalSegmentDrop, Math.max(0, a[2] - b[2]))
    if (curlPath[index + 1].currentPosition[0] < crest.currentPosition[0]) continue
    const dx = b[0] - a[0]
    const dz = b[2] - a[2]
    const slope = dz / Math.max(Math.abs(dx), 0.000001)
    const angle = Math.atan2(dz, Math.abs(dx)) * 180 / Math.PI
    tipSlope = Math.min(tipSlope, slope)
    finalTangentAngleDeg = Math.min(finalTangentAngleDeg, angle)
  }
  const dropRatio = clampNumber((crest.currentPosition[2] - tip.currentPosition[2]) / maxHeight, 0, 1)
  const tipForwardDistance = shoulder.currentPosition[0] - crest.currentPosition[0]
  const hookTuckDistance = shoulder.currentPosition[0] - tip.currentPosition[0]
  const returnForwardDistance = flatReturn.currentPosition[0] - tip.currentPosition[0]
  const tipForwardOfCrest = tipForwardDistance > model.config.spacing * 0.25
  const hookTuckedUnderShoulder = hookTuckDistance > model.config.spacing * 0.2 &&
    tip.currentPosition[2] <= shoulder.currentPosition[2] - maxHeight * 0.08
  const openDownturnedLip = hookTuckDistance <= Math.max(model.config.spacing * 0.2, tipForwardDistance * 0.14) &&
    tip.currentPosition[0] >= shoulder.currentPosition[0] - model.config.spacing * 0.12
  const tuckRatio = hookTuckDistance / Math.max(tipForwardDistance, model.config.spacing)
  const returnRatio = returnForwardDistance / Math.max(tipForwardDistance, model.config.spacing)
  const returnToFlat = flatReturn !== tip &&
    flatReturn.currentPosition[2] <= maxHeight * 0.14 &&
    returnForwardDistance > model.config.spacing * 0.85
  const smoothTerminalReturn = maxTerminalSegmentDrop <= maxHeight * 0.48
  const noBackfoldCavity = centerlineBackfoldRatio(curlPath) <= 0.72
  const noVisibleDimplePocket = hookTuckedUnderShoulder &&
    tuckRatio >= 0.1 &&
    tuckRatio <= 0.72 &&
    returnRatio >= 0.1 &&
    flatReturn.currentPosition[0] > tip.currentPosition[0] + model.config.spacing * 0.85 &&
    flatReturn.currentPosition[2] <= maxHeight * 0.16

  return {
    tipBelowLastPeak: dropRatio >= 0.08,
    tipSlope,
    tipDx: incomingDx,
    tipForwardOfCrest,
    hookTuckedUnderShoulder,
    openDownturnedLip,
    returnToFlat,
    smoothTerminalReturn,
    noBackfoldCavity,
    noVisibleDimplePocket,
    dropRatio,
    tipForwardDistance,
    hookTuckDistance,
    finalTangentAngleDeg,
    crestX: crest.currentPosition[0],
    crestZ: crest.currentPosition[2],
    shoulderX: shoulder.currentPosition[0],
    shoulderZ: shoulder.currentPosition[2],
    tipX: tip.currentPosition[0],
    tipZ: tip.currentPosition[2],
    returnX: flatReturn.currentPosition[0],
    returnZ: flatReturn.currentPosition[2],
    returnForwardDistance,
  }
}

function emptyTerminalLipCurlStats() {
  return {
    tipBelowLastPeak: false,
    tipSlope: 0,
    tipDx: 0,
    tipForwardOfCrest: false,
    hookTuckedUnderShoulder: false,
    openDownturnedLip: false,
    returnToFlat: false,
    smoothTerminalReturn: false,
    noBackfoldCavity: true,
    noVisibleDimplePocket: false,
    dropRatio: 0,
    tipForwardDistance: 0,
    hookTuckDistance: 0,
    finalTangentAngleDeg: 0,
    crestX: 0,
    crestZ: 0,
    shoulderX: 0,
    shoulderZ: 0,
    tipX: 0,
    tipZ: 0,
    returnX: 0,
    returnZ: 0,
    returnForwardDistance: 0,
  }
}

function preTerminalLipCutoff(): number {
  return clampNumber(
    breakingLipStart() - 0.1,
    0.32,
    0.44,
  )
}

function flatContributionSharesApron(low: LatticeModel, high: LatticeModel): boolean {
  const heightBase = Math.max(low.summary.maxHeight, 0.000001)
  const overhangBase = Math.max(low.summary.overhangAmount, 0.000001)
  const heightResidual = Math.abs(high.summary.maxHeight - low.summary.maxHeight) / heightBase
  const overhangResidual = Math.abs(high.summary.overhangAmount - low.summary.overhangAmount) / overhangBase
  const centerlineResidual = centerlineProfileResidual(low, high)
  const lowApron = meanApronDisplacement(low)
  const highApron = meanApronDisplacement(high)

  return (
    heightResidual <= 0.03 &&
    overhangResidual <= 0.03 &&
    centerlineResidual <= DEFAULT_SHEET_SPACING * 0.95 &&
    highApron > lowApron + DEFAULT_SHEET_SPACING * 0.015
  )
}

function groundTransitionPreservesCoreAndBroadensSupport(low: LatticeModel, high: LatticeModel): boolean {
  const heightBase = Math.max(low.summary.maxHeight, 0.000001)
  const overhangBase = Math.max(low.summary.overhangAmount, 0.000001)
  const heightResidual = Math.abs(high.summary.maxHeight - low.summary.maxHeight) / heightBase
  const overhangResidual = Math.abs(high.summary.overhangAmount - low.summary.overhangAmount) / overhangBase
  const centerlineResidual = preTerminalCenterlineProfileResidual(low, high, 0.85)

  return (
    heightResidual <= 0.03 &&
    overhangResidual <= 0.03 &&
    centerlineResidual <= DEFAULT_SHEET_SPACING * 0.35 &&
    supportSpreadNodeCount(high) > supportSpreadNodeCount(low)
  )
}

function supportSpreadNodeCount(model: LatticeModel): number {
  const maxLift = Math.max(model.summary.maxHeight, 0.000001)
  return model.nodes.filter((node) => {
    if (isBoundaryNodeIndex(node.row, node.col, model.config)) return false
    const displacement = lengthVec(subtractVec(node.currentPosition, node.restPosition))
    return node.currentPosition[2] > maxLift * 0.025 || displacement > model.config.spacing * 0.1
  }).length
}

function meanApronDisplacement(model: LatticeModel): number {
  const centerRow = (model.config.rows - 1) / 2
  const sideStart = Math.max(model.config.rows * 0.16, 2)
  const sideEnd = Math.max(model.config.rows * 0.46, sideStart + 1)
  const candidates = model.nodes.filter((node) => {
    if (isBoundaryNodeIndex(node.row, node.col, model.config)) return false
    const rowDistance = Math.abs(node.row - centerRow)
    return rowDistance >= sideStart && rowDistance <= sideEnd
  })

  return mean(candidates.map((node) => lengthVec(subtractVec(node.currentPosition, node.restPosition))))
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
  const nodes: LatticeNode[] = []
  const restGrid: Vec3[][] = []
  const targetGrid: Vec3[][] = []
  const coreConfig = {
    ...config,
    flatContribution: 0,
  }

  for (let row = 0; row < config.rows; row += 1) {
    restGrid[row] = []
    targetGrid[row] = []

    for (let col = 0; col < config.columns; col += 1) {
      const restPosition = expectedCanonicalRestPosition(row, col, config)
      const targetPosition = isBoundaryNodeIndex(row, col, config)
        ? restPosition
        : targetFromDeformationField(restPosition, coreConfig)

      restGrid[row][col] = restPosition
      targetGrid[row][col] = targetPosition
    }
  }

  const continuousTargets = config.profileMode === 'custom'
    ? targetGrid
    : applySpanContinuitySmoothing(restGrid, targetGrid, coreConfig)
  const redistributedTargets = config.profileMode === 'custom'
    ? continuousTargets
    : applyFlatContributionDiffusion(restGrid, continuousTargets, config)

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.columns; col += 1) {
      const restPosition = restGrid[row][col]
      const targetPosition = redistributedTargets[row][col]
      const currentPosition = lerpVec(restPosition, targetPosition, morphGrowthAmount(config.morph))

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

function morphGrowthAmount(value: number): number {
  const morph = clampNumber(value, 0, 1)
  const sineEase = Math.sin(morph * Math.PI * 0.5)
  const fasterVisibleGrowth = 1 - (1 - morph) ** 3.2

  return lerpNumber(sineEase, fasterVisibleGrowth, 0.9)
}

function applySpanContinuitySmoothing(restGrid: Vec3[][], targetGrid: Vec3[][], config: InverseSheetConfig): Vec3[][] {
  const lipStrength = breakingLipStrength(lipDipAmount(config.overhangAngleDeg))
  const active = smootherStep(lipStrength)
  if (active <= 0.000001 || config.rows < 4 || config.columns < 4) return targetGrid

  const deltas = restGrid.map((row, rowIndex) =>
    row.map((restPosition, colIndex) => subtractVec(targetGrid[rowIndex][colIndex], restPosition)),
  )
  const requestedHalfWidth = Math.max(config.overhangWidth * 0.5, config.spacing)
  const smooth = clampNumber(config.wallSmoothness, 0, 1)
  const centerPreserveHalfWidth = Math.max(config.spacing * 1.65, requestedHalfWidth * 0.08)
  const corePreserveHalfWidth = requestedHalfWidth * lerpNumber(0.28, 0.44, active)
  const preserveFadeWidth = Math.max(config.spacing * 6.5, requestedHalfWidth * lerpNumber(0.38, 0.56, smooth))
  const iterations = Math.round(lerpNumber(4, 10, active))
  const alpha = lerpNumber(0.22, 0.52, active) * lerpNumber(0.98, 1.34, smooth)
  let current = deltas

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = current.map((row) => row.map((delta) => [...delta] as Vec3))

    for (let row = 1; row < config.rows - 1; row += 1) {
      for (let col = 1; col < config.columns - 1; col += 1) {
        const restPosition = restGrid[row][col]
        const sample = mapSheetPointToCanonicalWaveFrame(restPosition, config)
        if (!pointInsideCanonicalSupportField(sample, config)) continue

        const profileLimits = overhangProfileLimits(0)
        const profileU = clampNumber(
          (waveFieldU(sample) - profileLimits.profileStart) / Math.max(profileLimits.remainingU, 0.000001),
          0,
          1,
        )
        const lipRegion = smootherStep((profileU - (breakingLipStart() - 0.04)) / 0.075) *
          (1 - smootherStep((profileU - (breakingLipReturnU() + 0.04)) / 0.115))
        const spanDistance = Math.abs(sample[1])
        if (spanDistance <= centerPreserveHalfWidth) {
          next[row][col] = deltas[row][col]
          continue
        }
        let blendedDelta = current[row][col]
        const preserveCore = 1 - smootherStep((spanDistance - corePreserveHalfWidth) / Math.max(preserveFadeWidth, 0.000001))

        const terminalCurlLock = active * lipRegion
        const rowAverage = scaleVec(addVec(current[row - 1][col], current[row + 1][col]), 0.5)
        const blend = alpha * (1 - preserveCore * 0.58) * (1 - terminalCurlLock * 0.18)
        blendedDelta = lerpVec(blendedDelta, rowAverage, blend)

        const columnAverage = scaleVec(addVec(current[row][col - 1], current[row][col + 1]), 0.5)
        const longitudinalBlend = alpha *
          lerpNumber(0.46, 0.86, active) *
          (1 - preserveCore * 0.38) *
          (1 - terminalCurlLock * 0.26)
        next[row][col] = lerpVec(blendedDelta, columnAverage, longitudinalBlend)
      }
    }

    current = next
  }

  return restGrid.map((row, rowIndex) =>
    row.map((restPosition, colIndex) => {
      if (isBoundaryNodeIndex(rowIndex, colIndex, config)) return restPosition
      return addVec(restPosition, current[rowIndex][colIndex])
    }),
  )
}

function applyFlatContributionDiffusion(restGrid: Vec3[][], targetGrid: Vec3[][], config: InverseSheetConfig): Vec3[][] {
  const flatContribution = clampNumber(config.flatContribution, 0, 1)
  if (flatContribution <= 0.000001) return targetGrid

  const deltas = restGrid.map((row, rowIndex) =>
    row.map((restPosition, colIndex) => subtractVec(targetGrid[rowIndex][colIndex], restPosition)),
  )
  const pinWeights = restGrid.map((row, rowIndex) =>
    row.map((restPosition, colIndex) => {
      if (isBoundaryNodeIndex(rowIndex, colIndex, config)) return 1
      return coreFeaturePinWeight(restPosition, config)
    }),
  )
  const participationWeights = restGrid.map((row, rowIndex) =>
    row.map((restPosition, colIndex) => {
      if (isBoundaryNodeIndex(rowIndex, colIndex, config)) return 0
      return diffusionParticipationWeight(restPosition, config)
    }),
  )
  const iterations = Math.round(lerpNumber(5, 34, flatContribution))
  const alpha = lerpNumber(0.16, 0.48, flatContribution)
  let current = deltas

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = current.map((row) => row.map((delta) => [...delta] as Vec3))

    for (let row = 1; row < config.rows - 1; row += 1) {
      for (let col = 1; col < config.columns - 1; col += 1) {
        const pinWeight = pinWeights[row][col]
        if (pinWeight >= 0.999) {
          next[row][col] = deltas[row][col]
          continue
        }

        const neighborAverage = scaleVec(
          addVec(addVec(current[row - 1][col], current[row + 1][col]), addVec(current[row][col - 1], current[row][col + 1])),
          0.25,
        )
        const blend = alpha * participationWeights[row][col] * (1 - pinWeight)
        const smoothed = lerpVec(current[row][col], neighborAverage, blend)

        next[row][col] = lerpVec(smoothed, deltas[row][col], pinWeight)
      }
    }

    current = next
  }

  return restGrid.map((row, rowIndex) =>
    row.map((restPosition, colIndex) => {
      if (isBoundaryNodeIndex(rowIndex, colIndex, config)) return restPosition
      if (pinWeights[rowIndex][colIndex] >= 0.999) return targetGrid[rowIndex][colIndex]
      const originalDelta = deltas[rowIndex][colIndex]
      const diffusedDelta = current[rowIndex][colIndex]
      const originalLength = lengthVec(originalDelta)
      const diffusedLength = lengthVec(diffusedDelta)
      const preservedDelta = diffusedLength < originalLength
        ? lerpVec(diffusedDelta, originalDelta, 0.78)
        : diffusedDelta

      return addVec(restPosition, preservedDelta)
    }),
  )
}

function coreFeaturePinWeight(restPosition: Vec3, config: InverseSheetConfig): number {
  const canonicalSample = mapSheetPointToCanonicalWaveFrame(restPosition, config)
  const gridStepX = DEFAULT_SHEET_LENGTH / Math.max(config.columns - 1, 1)
  const centerBand = Math.max(DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1) * 1.3, 1.1)
  const nearCenterline = Math.abs(canonicalSample[1]) <= centerBand

  if (
    nearCenterline &&
    canonicalSample[0] > DEFAULT_WAVE_FIELD_MAX_X &&
    canonicalSample[0] <= DEFAULT_WAVE_FIELD_MAX_X + gridStepX * 3.2
  ) {
    return 1
  }

  if (!pointInsideCanonicalWaveField(canonicalSample)) return 0

  const profileLimits = overhangProfileLimits(0)
  const u = waveFieldU(canonicalSample)
  if (u < profileLimits.profileStart || u > profileLimits.profileEnd) return 0

  const profileU = clampNumber((u - profileLimits.profileStart) / Math.max(profileLimits.remainingU, 0.000001), 0, 1)
  const uncenteredY = waveFieldV(canonicalSample) * DEFAULT_WAVE_FIELD_SPAN
  const pinMask = baseCoreWaveMask(profileU, uncenteredY, config)
  const centerlinePin = nearCenterline ? 1 : 0
  const lipPin = profileU >= breakingLipStart() - 0.025 && pinMask > 0.045 ? 1 : 0
  const maskPin = smootherStep((pinMask - 0.58) / 0.24)

  return clampNumber(Math.max(centerlinePin, lipPin, maskPin), 0, 1)
}

function diffusionParticipationWeight(restPosition: Vec3, config: InverseSheetConfig): number {
  const canonicalSample = mapSheetPointToCanonicalWaveFrame(restPosition, config)
  const centerBand = Math.max(DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1) * 1.3, 1.1)
  if (!pointInsideCanonicalSheet(canonicalSample)) return 0
  if (pointInsideCanonicalWaveField(canonicalSample)) {
    const lipStrength = breakingLipStrength(lipDipAmount(config.overhangAngleDeg))
    if (lipStrength > 0.000001) {
      const profileLimits = overhangProfileLimits(0)
      const u = waveFieldU(canonicalSample)
      const profileU = clampNumber((u - profileLimits.profileStart) / Math.max(profileLimits.remainingU, 0.000001), 0, 1)
      const lipLock = smootherStep((profileU - (breakingLipStart() - 0.04)) / 0.16)
      if (lipLock > 0.96 && Math.abs(canonicalSample[1]) <= centerBand * 1.2) return 1
    }
  }

  const outsideX = canonicalSample[0] < DEFAULT_WAVE_FIELD_MIN_X
    ? DEFAULT_WAVE_FIELD_MIN_X - canonicalSample[0]
    : Math.max(0, canonicalSample[0] - DEFAULT_WAVE_FIELD_MAX_X)
  const outsideY = Math.max(0, Math.abs(canonicalSample[1]) - DEFAULT_WAVE_FIELD_SPAN * 0.5)
  const outsideDistance = Math.hypot(outsideX, outsideY)
  const spread = lerpNumber(5, 18, clampNumber(config.smoothing, 0, 1)) +
    clampNumber(config.flatContribution, 0, 1) * 10
  const outsideWeight = Math.exp(-((outsideDistance / Math.max(spread, 0.000001)) ** 2))

  return clampNumber(0.16 + outsideWeight * 0.84, 0, 1)
}

function baseCoreWaveMask(profileU: number, uncenteredY: number, config: InverseSheetConfig): number {
  const wallSmoothness = clampNumber(config.wallSmoothness, 0, 1)
  const rimY = transverseWaveMask(uncenteredY, DEFAULT_WAVE_FIELD_SPAN, config, 0, 0.08, wallSmoothness)

  return coreWaveMaskFromRim(profileU, rimY, config)
}

function coreWaveMaskFromRim(profileU: number, rimY: number, config: InverseSheetConfig): number {
  const wallSmoothness = clampNumber(config.wallSmoothness, 0, 1)
  const lipDip = lipDipAmount(config.overhangAngleDeg)
  const lipStrength = breakingLipStrength(lipDip)
  const coreLongitudinalFade = 0.055
  const bodyX = edgeRamp(profileU, 0, coreLongitudinalFade)
  const bodyMask = Math.pow(bodyX, 1.18) * Math.pow(rimY, lerpNumber(2.6, 1.82, wallSmoothness))
  const lipStart = breakingLipStart()
  const lipPreserveEnvelope = smootherStep((profileU - lipStart) / 0.035)
  const lipSpanMask = Math.pow(clampNumber(rimY, 0, 1), lerpNumber(2.9, 1.94, Math.max(wallSmoothness, lipStrength)))
  const lipMask = lipStrength *
    lipPreserveEnvelope *
    edgeRamp(profileU, 0, coreLongitudinalFade) *
    lipSpanMask

  return clampNumber(Math.max(bodyMask, lipMask), 0, 1)
}

function lipAwareRimMask(
  profileU: number,
  uncenteredY: number,
  config: InverseSheetConfig,
  flatRim: number,
  coreBlendRim: number,
  lipStrength = breakingLipStrength(lipDipAmount(config.overhangAngleDeg)),
): number {
  const wallSmoothness = clampNumber(config.wallSmoothness, 0, 1)
  const coneWidth = config.overhangWidth * coneCurlSpanScale(profileU, lipStrength)

  return transverseWaveMask(uncenteredY, DEFAULT_WAVE_FIELD_SPAN, config, flatRim, coreBlendRim, wallSmoothness, coneWidth)
}

function coneCurlSpanScale(profileU: number, lipStrength: number): number {
  const curl = clampNumber(lipStrength, 0, 1)
  if (curl <= 0.000001) return 1

  const bodyTaper = smootherStep((profileU - 0.16) / 0.68)
  const terminalTaper = smootherStep((profileU - 0.42) / 0.38)
  const returnTaper = smootherStep((profileU - 0.72) / 0.24)
  const scale = 1 - curl * (bodyTaper * 0.16 + terminalTaper * 0.3 + returnTaper * 0.2)

  return clampNumber(scale, 0.42, 1)
}

function terminalLipOpeningStrength(profileU: number, lipStrength: number): number {
  const curl = clampNumber(lipStrength, 0, 1)
  if (curl <= 0.000001) return 0

  const terminalOpen = smootherStep((profileU - 0.5) / 0.24)
  const flatReturnRelease = 1 - 0.28 * smootherStep((profileU - 0.92) / 0.08)

  return clampNumber(curl * terminalOpen * flatReturnRelease, 0, 1)
}

function terminalLipSpanMask(
  profileU: number,
  uncenteredY: number,
  config: InverseSheetConfig,
  lipStrength: number,
): number {
  const curl = clampNumber(lipStrength, 0, 1)
  if (curl <= 0.000001) return 0

  const spanScale = coneCurlSpanScale(profileU, curl)
  const centeredY = uncenteredY - DEFAULT_WAVE_FIELD_SPAN * 0.5
  const gridSpacingY = DEFAULT_WAVE_FIELD_SPAN / Math.max(config.rows - 1, 1)
  const maxHalfWidth = Math.max(DEFAULT_WAVE_FIELD_SPAN * 0.5, config.spacing)
  const requestedHalfWidth = clampNumber(
    config.overhangWidth * 0.5 * spanScale,
    gridSpacingY * 1.8,
    maxHalfWidth,
  )
  const terminalOpen = smootherStep((profileU - 0.42) / 0.28)
  const feather = Math.max(
    gridSpacingY * lerpNumber(0.7, 1.42, terminalOpen),
    requestedHalfWidth * lerpNumber(0.06, 0.18, terminalOpen),
  )
  const centerRidgeHalfWidth = Math.max(
    DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1) * 0.62,
    gridSpacingY * 1.25,
    1.7,
  )
  const lateLipHalfWidth = Math.max(
    centerRidgeHalfWidth * lerpNumber(1.24, 0.94, curl),
    requestedHalfWidth * lerpNumber(0.58, 0.48, curl),
  )
  const earlyLipHalfWidth = Math.max(
    centerRidgeHalfWidth * lerpNumber(1.58, 1.14, curl),
    requestedHalfWidth * lerpNumber(0.78, 0.62, curl),
  )
  const fullHalfWidth = lerpNumber(earlyLipHalfWidth, lateLipHalfWidth, terminalOpen * curl)
  const distance = Math.abs(centeredY)

  if (distance <= fullHalfWidth) return 1

  return clampNumber(1 - smootherStep((distance - fullHalfWidth) / Math.max(feather, 0.000001)), 0, 1)
}

function customProfileTargetPosition(
  profileU: number,
  insideLongitudinalField: boolean,
  sheetY: number,
  rest: Vec3,
  config: InverseSheetConfig,
): Vec3 {
  if (!insideLongitudinalField) return rest

  const profileLimits = overhangProfileLimits(0)
  const profileRestLength = DEFAULT_WAVE_FIELD_LENGTH * profileLimits.remainingU
  const scale = clampNumber(config.profileScale, 0.35, 1.55)
  const scaleAmount = (scale - 0.35) / (1.55 - 0.35)
  const curlProfile = sampleCustomProfilePath(config.profilePoints, profileU)
  const bodyProfile = sampleLocalizedMoanaBodyProfile(profileU)
  const curlCenterGate = customProfileCurlCenterGate(sheetY, config)
  const curlInterior = customProfileInteriorCurlWeight(profileU, curlProfile.x, curlProfile.z)
  const lipAmount = customProfileLipCurlAmount(config)
  const profileBlend = clampNumber(
    Math.pow(lipAmount, 0.62) * lerpNumber(0.82, 1, Math.pow(curlCenterGate, 0.86)),
    0,
    1,
  )
  const profile = {
    x: lerpNumber(bodyProfile.x, curlProfile.x, profileBlend),
    z: lerpNumber(bodyProfile.z, curlProfile.z, profileBlend),
  }
  const rowMask = customProfileRowMask(profileU, profile.x, profile.z, sheetY, config, curlInterior * curlCenterGate)
  const longitudinalMask = edgeRamp(profileU, 0, 0.035) * edgeRamp(1 - profileU, 0, 0.025)
  const shapeMask = clampNumber(rowMask * longitudinalMask, 0, 1)
  if (shapeMask <= 0.000001) return rest

  const profileSpan = profileRestLength * lerpNumber(0.66, 0.952, scaleAmount)
  const profileHeight = profileRestLength * lerpNumber(0.5, 0.82, scaleAmount)
  const restX = profileRestLength * profileU
  const horizontalProjection = profile.x * profileSpan - restX
  const liftedHeight = Math.max(0, profile.z) * profileHeight

  return [
    rest[0] + shapeMask * horizontalProjection,
    rest[1],
    shapeMask * liftedHeight,
  ]
}

function customProfileRowMask(
  profileU: number,
  profileX: number,
  profileZ: number,
  sheetY: number,
  config: InverseSheetConfig,
  profileCurlInterior = customProfileInteriorCurlWeight(profileU, profileX, profileZ),
): number {
  const distanceToPerimeter = DEFAULT_SHEET_SPAN * 0.5 - Math.abs(sheetY)
  const gridSpacingY = DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1)
  const envelopeAmount = sampleSectionProfileAtX(config.sectionPoints, profileX)
  const lipAmount = customProfileLipCurlAmount(config)
  const curlInterior = profileCurlInterior * lipAmount
  const curlCenterGate = customProfileCurlCenterGate(sheetY, config)
  const effectiveEnvelope = Math.max(envelopeAmount, curlInterior * 0.42)

  if (distanceToPerimeter <= gridSpacingY * 0.18) return 0

  const profileActivity = Math.max(smootherStep(Math.max(0, profileZ) / 0.055), curlInterior * 0.9) *
    edgeRamp(profileU, 0, 0.04) *
    edgeRamp(1 - profileU, 0, 0.035)
  if (profileActivity <= 0.000001 || effectiveEnvelope <= 0.000001) return 0

  const maxHalfWidth = DEFAULT_SHEET_SPAN * 0.5 - gridSpacingY * 1.15
  const broadBack = smootherStep((profileU - 0.13) / 0.17) * (1 - smootherStep((profileU - 0.7) / 0.22))
  const terminalCurl = curlInterior * smootherStep((profileU - 0.56) / 0.2)
  const returnTail = smootherStep((profileU - 0.84) / 0.13)
  const heightTaper = lerpNumber(1.08, 0.66, smootherStep(Math.max(0, profileZ) / 0.82))
  const bodyTaper = lerpNumber(0.92, 1.7, broadBack * (1 - terminalCurl * 0.72))
  const curlTaper = lerpNumber(1, 0.44, terminalCurl)
  const returnTailTaper = lerpNumber(1, 0.5, returnTail * lipAmount)
  const bodyHalfWidth = clampNumber(
    config.overhangWidth *
      lerpNumber(0.14, 0.58, effectiveEnvelope) *
      lerpNumber(0.82, 1, profileActivity) *
      heightTaper *
      bodyTaper,
    gridSpacingY * 2.2,
    maxHalfWidth,
  ) * curlTaper * returnTailTaper
  const normalizedDistance = Math.abs(sheetY) / Math.max(bodyHalfWidth, 0.000001)
  const bodyRadial = Math.exp(-Math.pow(
    normalizedDistance,
    lerpNumber(1.72, 3.15, clampNumber(config.wallSmoothness, 0, 1)),
  ))
  const sheetFalloff = 1 - smootherStep((normalizedDistance - 0.92) / 0.5)
  const rimFade = edgeRamp(
    distanceToPerimeter,
    0,
    gridSpacingY * lerpNumber(3.2, 6.8, clampNumber(config.smoothing, 0, 1)),
  )
  const bodyMask = bodyRadial * sheetFalloff * profileActivity
  const wallFreeCurlZone = smootherStep(curlInterior / 0.24)
  const wallFreeBodyMask = lerpNumber(
    bodyMask,
    bodyMask * Math.pow(curlCenterGate, 3.2),
    wallFreeCurlZone,
  )
  const curlMask = Math.pow(curlCenterGate, 1.35) * curlInterior * profileActivity
  const centerlineGuarantee = 1 - smootherStep(
    (Math.abs(sheetY) - gridSpacingY * 0.65) / Math.max(gridSpacingY * 0.9, 0.000001),
  )

  return clampNumber(Math.max(wallFreeBodyMask, curlMask, centerlineGuarantee * profileActivity) * rimFade, 0, 1)
}

function sampleLocalizedMoanaBodyProfile(profileU: number): ProfilePoint {
  return sampleBezierPathByLength(localizedMoanaBodySegments(), clampNumber(profileU, 0, 1))
}

function localizedMoanaBodySegments(): Array<[ProfilePoint, ProfilePoint, ProfilePoint, ProfilePoint]> {
  const start = point(0, 0)
  const toe = point(0.08, 0)
  const rampFoot = point(0.21, 0.055)
  const face = point(0.38, 0.4)
  const crest = point(0.6, 0.68)
  const shoulder = point(0.79, 0.52)
  const nose = point(0.89, 0.13)
  const returnFlat = point(1, 0)

  return [
    [
      start,
      point(0.035, 0),
      point(toe.x - 0.035, 0),
      toe,
    ],
    [
      toe,
      point(0.12, 0),
      point(rampFoot.x - 0.07, rampFoot.z * 0.42),
      rampFoot,
    ],
    [
      rampFoot,
      point(rampFoot.x + 0.1, rampFoot.z + 0.11),
      point(face.x - 0.1, face.z - 0.13),
      face,
    ],
    [
      face,
      point(face.x + 0.13, face.z + 0.14),
      point(crest.x - 0.17, crest.z + 0.01),
      crest,
    ],
    [
      crest,
      point(crest.x + 0.15, crest.z + 0.015),
      point(shoulder.x - 0.12, shoulder.z + 0.035),
      shoulder,
    ],
    [
      shoulder,
      point(shoulder.x + 0.11, shoulder.z - 0.045),
      point(nose.x + 0.04, nose.z + 0.08),
      nose,
    ],
    [
      nose,
      point(nose.x - 0.025, nose.z - 0.055),
      point(returnFlat.x - 0.12, 0.02),
      returnFlat,
    ],
  ]
}

function customProfileInteriorCurlWeight(profileU: number, profileX: number, profileZ: number): number {
  const afterCrest = smootherStep((profileU - 0.52) / 0.14)
  const beforeFlatReturn = 1 - smootherStep((profileU - 0.985) / 0.025)
  const terminalLip = smootherStep((profileX - 0.82) / 0.16) * smootherStep((0.74 - profileZ) / 0.24)
  const downturnedLip = smootherStep((profileU - 0.64) / 0.13) * (1 - smootherStep((profileU - 0.98) / 0.035))

  return clampNumber(afterCrest * beforeFlatReturn * Math.max(terminalLip, downturnedLip), 0, 1)
}

function customProfileLipCurlAmount(config: InverseSheetConfig): number {
  return smootherStep((clampNumber(config.overhangAngleDeg, 90, 120) - 90) / 30)
}

function customProfileCurlCenterGate(sheetY: number, config: InverseSheetConfig): number {
  const gridSpacingY = DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1)
  const coreHalfWidth = Math.max(gridSpacingY * 1.2, config.overhangWidth * 0.075)
  const featherWidth = Math.max(gridSpacingY * 3.85, config.overhangWidth * 0.16)
  const distance = Math.abs(sheetY)

  if (distance <= coreHalfWidth) return 1

  return Math.pow(
    clampNumber(1 - smootherStep((distance - coreHalfWidth) / Math.max(featherWidth, 0.000001)), 0, 1),
    1.12,
  )
}

function sampleSectionProfileAtX(value: string, amount: number): number {
  const points = parseProfilePoints(value)
    .slice()
    .sort((a, b) => a.x - b.x)
  const x = clampNumber(amount, 0, 1)

  if (x <= points[0].x) return points[0].z

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    if (x > next.x) continue

    const local = smootherStep((x - current.x) / Math.max(next.x - current.x, 0.000001))
    return clampNumber(lerpNumber(current.z, next.z, local), 0, 1)
  }

  return points[points.length - 1].z
}

function sampleCustomProfilePath(value: string, amount: number): ProfilePoint {
  const points = parseProfilePoints(value)
  const tension = 0.78
  return sampleBezierPathByLength(
    smoothProfileSegments(points, tension),
    clampNumber(amount, 0, 1),
  )
}

function canonicalOverhangTargetPosition(
  u: number,
  v: number,
  rest: Vec3,
  config: InverseSheetConfig,
): Vec3 {
  const rawGroundTransition = clampNumber(config.smoothing, 0, 1)
  const flatShare = clampNumber(config.flatContribution, 0, 1)
  const wallSmoothness = clampNumber(config.wallSmoothness, 0, 1)
  const profileLimits = overhangProfileLimits(0)
  const flatRim = profileLimits.flatRim
  const coreBlendRim = 0.08
  const profileStart = profileLimits.profileStart
  const profileEnd = profileLimits.profileEnd
  const uncenteredY = v * DEFAULT_WAVE_FIELD_SPAN

  if (Math.abs(config.height) <= 0.000001 || config.overhangWidth <= 0.000001) {
    return rest
  }

  const remainingU = Math.max(profileEnd - profileStart, 0.000001)
  const rawProfileU = (u - profileStart) / remainingU
  const profileU = clampNumber(rawProfileU, 0, 1)
  const longitudinalOutside = rawProfileU < 0 ? -rawProfileU : (rawProfileU > 1 ? rawProfileU - 1 : 0)
  const insideCoreField = rawProfileU >= 0 && rawProfileU <= 1 && v >= 0 && v <= 1

  if (config.profileMode === 'custom') {
    const insideLongitudinalField = rawProfileU >= 0 && rawProfileU <= 1
    return customProfileTargetPosition(profileU, insideLongitudinalField, rest[1], rest, config)
  }

  const lipDip = lipDipAmount(config.overhangAngleDeg)
  const lipStrength = breakingLipStrength(lipDip)
  const coreLongitudinalFade = 0.055
  const lipStart = breakingLipStart()
  const rimY = lipAwareRimMask(profileU, uncenteredY, config, flatRim, coreBlendRim, lipStrength)
  const projectedRimY = lipStrength > 0.000001
    ? lerpNumber(
      rimY,
      smootherStep((rimY - 0.18) / 0.38),
      lipStrength * smootherStep((profileU - 0.18) / 0.22) * 0.94,
    )
    : rimY
  const bodyX = edgeRamp(profileU, 0, coreLongitudinalFade)
  const bodyMask = Math.pow(bodyX, 1.18) * Math.pow(projectedRimY, lerpNumber(2.6, 1.82, wallSmoothness))
  const lipPreserveEnvelope = smootherStep((profileU - lipStart) / 0.035)
  const lipSpanMask = Math.pow(clampNumber(projectedRimY, 0, 1), lerpNumber(2.9, 1.94, Math.max(wallSmoothness, lipStrength)))
  const lipMask = lipStrength *
    lipPreserveEnvelope *
    edgeRamp(profileU, 0, coreLongitudinalFade) *
    lipSpanMask
  const coreMask = insideCoreField ? clampNumber(Math.max(bodyMask, lipMask), 0, 1) : 0
  const supportControl = Math.max(rawGroundTransition, flatShare * 0.92)
  const supportLongitudinalFade = Math.min(
    0.72,
    lerpNumber(0.14, 0.52, supportControl),
  )
  const supportWidth = config.overhangWidth * lerpNumber(1.32, 3.45, supportControl)
  const supportY = transverseSupportMask(
    uncenteredY - DEFAULT_WAVE_FIELD_SPAN * 0.5,
    config,
    Math.max(wallSmoothness, 0.56 + supportControl * 0.28),
    supportWidth,
  )
  const supportX = 1 - smootherStep(longitudinalOutside / Math.max(supportLongitudinalFade, 0.000001))
  const postSupportX = 1 - smootherStep(longitudinalOutside / Math.max(supportLongitudinalFade * 2.15, 0.000001))
  const supportMask = Math.pow(supportX, lerpNumber(1.28, 0.52, rawGroundTransition)) *
    Math.pow(supportY, lerpNumber(0.9, 0.58, wallSmoothness))
  const taperOnly = Math.max(0, supportMask - coreMask)
  const postCoreTaper = rawProfileU > 1 ? clampNumber(Math.max(bodyMask, lipMask) * postSupportX, 0, 1) : 0
  const terminalApronRelease = 1 - lipStrength * smootherStep((profileU - 0.34) / 0.22) * 0.9
  const taperStrength = clampNumber(
    (lerpNumber(0.03, 0.5, rawGroundTransition) + flatShare * 0.42) * terminalApronRelease,
    0,
    0.82,
  )
  const centerPreserveBand = lerpNumber(0.22, 0.48, Math.max(rawGroundTransition, flatShare))
  const centerPreserve = smootherStep(1 - Math.abs(v - 0.5) / centerPreserveBand)
  const baseShapeMask = clampNumber(Math.max(
    coreMask,
    postCoreTaper,
    taperOnly * taperStrength * centerPreserve,
  ), 0, 1)
  const lipOpening = terminalLipOpeningStrength(profileU, lipStrength)
  const lipWallFreeMask = terminalLipSpanMask(profileU, uncenteredY, config, lipStrength)
  const shapeMask = lipOpening > 0.000001
    ? lerpNumber(baseShapeMask, lipWallFreeMask, lipOpening * 0.96)
    : baseShapeMask
  const fullCurlCarrier = lipStrength *
    edgeRamp(profileU, 0, coreLongitudinalFade) *
    lipWallFreeMask
  const resolvedShapeMask = lipStrength > 0.000001
    ? clampNumber(Math.max(shapeMask, fullCurlCarrier), 0, 1)
    : shapeMask

  if (resolvedShapeMask <= 0.000001) return rest

  const eased = profileBaseParameter(profileU)
  const remainingLength = Math.max(DEFAULT_WAVE_FIELD_LENGTH * remainingU, DEFAULT_SHEET_SPACING)
  const scale = clampNumber(config.profileScale, 0.35, 1.55)
  const normalizedScale = (scale - 0.35) / (1.55 - 0.35)
  const horizontalScale = lerpNumber(0.78, 1.14, normalizedScale)
  const verticalScale = lerpNumber(0.88, 1.34, normalizedScale)
  const overhangAmount = Math.min(config.horizontalOffset * horizontalScale, remainingLength * 0.86)
  const nominalWaveHeight = Math.min(config.height * verticalScale, remainingLength * 0.54)
  const waveHeight = gridResolvedWaveHeight(nominalWaveHeight, remainingLength, lipStrength, config.columns)
  const baseProfile = baseWaveProfile(eased, overhangAmount, waveHeight, CORE_PROFILE_SMOOTHING, config.conicRho, config.curlRadius)
  let horizontalProjection = baseProfile.x
  let liftedHeight = baseProfile.z

  if (lipStrength > 0.000001) {
    const terminalLip = applyCurledConeLip(
      clampNumber(rawProfileU, 0, breakingLipReturnU()),
      eased,
      overhangAmount,
      waveHeight,
      DEFAULT_WAVE_FIELD_LENGTH * remainingU,
      lipStrength,
      config.lipSharpness,
      config.conicRho,
      config.curlRadius,
    )
    horizontalProjection = terminalLip.x
    liftedHeight = terminalLip.z
  }

  const deformed: Vec3 = [
    rest[0] + resolvedShapeMask * horizontalProjection,
    rest[1],
    resolvedShapeMask * liftedHeight,
  ]

  return deformed
}

function baseWaveProfile(
  t: number,
  overhangAmount: number,
  waveHeight: number,
  smoothing: number,
  conicRho: number,
  curlRadius: number,
): { x: number; z: number } {
  const curl = 0
  const heightProfile = waveHeightProfile(t, curl, smoothing, PROFILE_LIP_SHARPNESS, conicRho, curlRadius)
  const horizontalProjection = overhangAmount * curlProjectionProfile(
    t,
    curl,
    smoothing,
    PROFILE_LIP_SHARPNESS,
    conicRho,
    curlRadius,
  )

  return {
    x: horizontalProjection,
    z: waveHeight * heightProfile,
  }
}

function gridResolvedWaveHeight(
  nominalWaveHeight: number,
  remainingLength: number,
  lipStrength: number,
  columns: number,
): number {
  void columns
  const compensation = 1 + 0.82 * clampNumber(lipStrength, 0, 1)
  const heightCap = remainingLength * lerpNumber(0.58, 0.78, clampNumber(lipStrength, 0, 1))

  return Math.min(nominalWaveHeight * compensation, heightCap)
}

function applyCurledConeLip(
  profileU: number,
  t: number,
  overhangAmount: number,
  waveHeight: number,
  profileRestLength: number,
  lipDip: number,
  lipSharpness: number,
  conicRho: number,
  curlRadius: number,
): { x: number; z: number } {
  const rawDip = clampNumber(lipDip, 0, 1)
  const curlFeasibility = smootherStep(overhangAmount / Math.max(DEFAULT_SHEET_SPACING * 2, 0.000001))
  const dip = rawDip * curlFeasibility
  const sharp = Math.sqrt(smootherStep(clampNumber(lipSharpness, 0, 1)))
  const returnU = breakingLipReturnU()
  const restXAt = (amount: number) => profileRestLength * amount
  const toDisplacement = (amount: number, current: { x: number; z: number }) => ({
    x: current.x - restXAt(amount),
    z: current.z,
  })

  const base = baseWaveProfile(t, overhangAmount, waveHeight, CORE_PROFILE_SMOOTHING, conicRho, curlRadius)
  if (dip <= 0.000001 || overhangAmount <= 0.000001 || waveHeight <= 0.000001) return base

  const baseCurrent = {
    x: restXAt(profileU) + base.x,
    z: base.z,
  }
  const profileExtent = curledConeProfileExtent(overhangAmount, profileRestLength, dip)
  const target = sampleCurledConeProfile(
    profileU,
    returnU,
    profileExtent.curlSpan,
    profileRestLength * returnU,
    waveHeight,
    dip,
    sharp,
  )

  const targetBlend = dip
  return toDisplacement(profileU, {
    x: lerpNumber(baseCurrent.x, target.x, targetBlend),
    z: lerpNumber(baseCurrent.z, target.z, targetBlend),
  })
}

type ProfilePoint = { x: number; z: number }

function curledConeProfileExtent(
  overhangAmount: number,
  profileRestLength: number,
  dip: number,
): { curlSpan: number } {
  const dipAmount = clampNumber(dip, 0, 1)
  const profileDrivenSpan = profileRestLength * lerpNumber(0.38, 0.62, dipAmount)
  const requestedReachSpan = overhangAmount * lerpNumber(1.25, 2.24, dipAmount)
  const desiredSpan = Math.max(profileDrivenSpan, requestedReachSpan)
  const minSpan = Math.min(profileRestLength * 0.34, DEFAULT_SHEET_SPACING * 4.5)
  const maxSpan = Math.max(minSpan, profileRestLength * 0.72)
  const curlSpan = clampNumber(desiredSpan, minSpan, maxSpan)

  return { curlSpan }
}

function sampleCurledConeProfile(
  profileU: number,
  returnU: number,
  curlSpan: number,
  restEndX: number,
  waveHeight: number,
  dip: number,
  sharp: number,
): ProfilePoint {
  const rawAmount = clampNumber(profileU / Math.max(returnU, 0.000001), 0, 1)
  void curlSpan
  const amount = Math.pow(rawAmount, lerpNumber(1, 0.82, clampNumber(dip, 0, 1)))
  const blunt = sampleMoanaReferenceLipProfile(restEndX, waveHeight, dip, 0, amount)

  if (sharp <= 0.000001) return blunt

  const pointed = sampleMoanaReferenceLipProfile(restEndX, waveHeight, dip, sharp, amount)
  const terminalSharpEnvelope = smootherStep((rawAmount - 0.46) / 0.34)

  return {
    x: lerpNumber(blunt.x, pointed.x, terminalSharpEnvelope),
    z: lerpNumber(blunt.z, pointed.z, terminalSharpEnvelope),
  }
}

function sampleMoanaReferenceLipProfile(
  restEndX: number,
  waveHeight: number,
  dip: number,
  sharp: number,
  amount: number,
): ProfilePoint {
  const points = moanaReferenceLipPoints(dip, sharp).map((profilePoint) => ({
    x: profilePoint.x * restEndX,
    z: profilePoint.z * waveHeight / 0.9,
  }))

  return sampleBezierPathByLength(
    smoothProfileSegments(points, 0.78),
    clampNumber(amount, 0, 1),
  )
}

function moanaReferenceLipPoints(dip: number, sharp: number): ProfilePoint[] {
  const curl = clampNumber(dip, 0, 1)
  const pointed = Math.pow(clampNumber(sharp, 0, 1), 1.35)
  const shoulderX = lerpNumber(0.885, 0.922, curl) + pointed * 0.003
  const shoulderZ = lerpNumber(0.77, 0.735, curl)
  const roundNoseX = lerpNumber(0.956, 1.006, curl) + pointed * 0.026
  const roundNoseZ = lerpNumber(0.48, 0.43, curl) - pointed * 0.055
  const undersideX = lerpNumber(0.95, 0.972, curl) - pointed * 0.03
  const undersideZ = lerpNumber(0.33, 0.31, curl) - pointed * 0.036
  const innerLipX = lerpNumber(0.88, 0.835, curl) - pointed * 0.026
  const innerLipZ = lerpNumber(0.36, 0.335, curl) - pointed * 0.024
  const innerFloorX = lerpNumber(0.8, 0.746, curl) - pointed * 0.012
  const innerFloorZ = lerpNumber(0.105, 0.075, curl) - pointed * 0.012

  return [
    point(0, 0),
    point(0.08, 0),
    point(0.17, 0.025),
    point(0.3, 0.29),
    point(0.45, 0.63),
    point(0.61, 0.84),
    point(0.76, 0.88),
    point(shoulderX, shoulderZ),
    point(roundNoseX, roundNoseZ),
    point(undersideX, undersideZ),
    point(innerLipX, innerLipZ),
    point(innerFloorX, innerFloorZ),
    point(0.86, 0.014),
    point(1, 0),
  ]
}

function sampleBezierPathByLength(
  segments: Array<[ProfilePoint, ProfilePoint, ProfilePoint, ProfilePoint]>,
  amount: number,
): ProfilePoint {
  const samples: ProfilePoint[] = []

  segments.forEach((segment, segmentIndex) => {
    const steps = 18
    for (let index = segmentIndex === 0 ? 0 : 1; index <= steps; index += 1) {
      samples.push(cubicBezierProfile(segment[0], segment[1], segment[2], segment[3], index / steps))
    }
  })

  if (samples.length <= 1) return samples[0] ?? point(0, 0)

  const minX = Math.min(...samples.map((sample) => sample.x))
  const maxX = Math.max(...samples.map((sample) => sample.x))
  const minZ = Math.min(...samples.map((sample) => sample.z))
  const maxZ = Math.max(...samples.map((sample) => sample.z))
  const xScale = Math.max(maxX - minX, DEFAULT_SHEET_SPACING)
  const zScale = Math.max(maxZ - minZ, DEFAULT_SHEET_SPACING)
  const lengths: number[] = [0]
  let total = 0
  for (let index = 1; index < samples.length; index += 1) {
    total += normalizedProfileDistance(samples[index - 1], samples[index], xScale, zScale)
    lengths[index] = total
  }

  const target = clampNumber(amount, 0, 1) * total
  for (let index = 1; index < samples.length; index += 1) {
    if (lengths[index] < target) continue
    const local = (target - lengths[index - 1]) / Math.max(lengths[index] - lengths[index - 1], 0.000001)
    return {
      x: lerpNumber(samples[index - 1].x, samples[index].x, local),
      z: lerpNumber(samples[index - 1].z, samples[index].z, local),
    }
  }

  return samples[samples.length - 1]
}

function point(x: number, z: number): ProfilePoint {
  return { x, z }
}

export function parseProfilePoints(value: string): ProfileControlPoint[] {
  const parsed = value
    .split(';')
    .map((chunk) => {
      const [rawX, rawZ] = chunk.split(',')
      const x = Number(rawX)
      const z = Number(rawZ)
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null
      return {
        x: clampNumber(x, 0, 1),
        z: clampNumber(z, 0, 1),
      }
    })
    .filter(Boolean) as ProfileControlPoint[]

  if (parsed.length >= 4) return parsed
  if (value === DEFAULT_CUSTOM_PROFILE_POINTS) {
    return [
      { x: 0, z: 0 },
      { x: 0.17, z: 0.025 },
      { x: 0.45, z: 0.63 },
      { x: 0.76, z: 0.88 },
      { x: 0.995, z: 0.35 },
      { x: 0.86, z: 0.18 },
      { x: 0.63, z: 0.3 },
      { x: 0.54, z: 0.08 },
      { x: 0.84, z: 0.018 },
      { x: 1, z: 0 },
    ]
  }

  return parseProfilePoints(DEFAULT_CUSTOM_PROFILE_POINTS)
}

export function serializeProfilePoints(points: ProfileControlPoint[]): string {
  return points
    .map((profilePoint) => `${formatProfileNumber(profilePoint.x)},${formatProfileNumber(profilePoint.z)}`)
    .join(';')
}

function formatProfileNumber(value: number): string {
  return clampNumber(value, 0, 1).toFixed(3).replace(/\.?0+$/, '')
}

function smoothProfileSegments(
  anchors: ProfilePoint[],
  tension: number,
): Array<[ProfilePoint, ProfilePoint, ProfilePoint, ProfilePoint]> {
  const segments: Array<[ProfilePoint, ProfilePoint, ProfilePoint, ProfilePoint]> = []
  const handleScale = clampNumber(tension, 0.15, 0.9) / 6

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const p0 = anchors[index]
    const p3 = anchors[index + 1]
    const previous = anchors[Math.max(0, index - 1)]
    const next = anchors[Math.min(anchors.length - 1, index + 2)]
    const p1 = point(
      p0.x + (p3.x - previous.x) * handleScale,
      Math.max(0, p0.z + (p3.z - previous.z) * handleScale),
    )
    const p2 = point(
      p3.x - (next.x - p0.x) * handleScale,
      Math.max(0, p3.z - (next.z - p0.z) * handleScale),
    )

    segments.push([p0, p1, p2, p3])
  }

  return segments
}

function normalizedProfileDistance(a: ProfilePoint, b: ProfilePoint, xScale: number, zScale: number): number {
  return Math.hypot((a.x - b.x) / xScale, (a.z - b.z) / zScale)
}

function breakingLipStart(): number {
  return 0.38
}

function breakingLipReturnU(): number {
  return 1
}

function profileBaseParameter(profileU: number): number {
  const amount = clampNumber(profileU, 0, 1)
  return lerpNumber(amount, smootherStep(amount), 0.08 + CORE_PROFILE_SMOOTHING * 0.46)
}

function cubicBezierProfile(
  p0: { x: number; z: number },
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  p3: { x: number; z: number },
  amount: number,
): { x: number; z: number } {
  const q = clampNumber(amount, 0, 1)
  const inv = 1 - q

  return {
    x: inv ** 3 * p0.x + 3 * inv ** 2 * q * p1.x + 3 * inv * q ** 2 * p2.x + q ** 3 * p3.x,
    z: inv ** 3 * p0.z + 3 * inv ** 2 * q * p1.z + 3 * inv * q ** 2 * p2.z + q ** 3 * p3.z,
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
  const pointed = smootherStep(clampNumber(lipSharpness, 0, 1))
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const riseEnd = clampNumber(
    0.86 + lerpNumber(0.04, -0.035, rho) + lerpNumber(-0.025, 0.045, radius) - pointed * 0.025,
    0.72,
    0.94,
  )
  const rise = smootherStep(t / Math.max(riseEnd, 0.000001))
  const power = clampNumber(
    lerpNumber(1.2, 0.74, smoothing) + lerpNumber(0.12, -0.12, rho) + lerpNumber(-0.08, 0.1, radius) +
      pointed * 0.12,
    0.54,
    1.4,
  )
  const curledWave = Math.pow(Math.max(rise, 0), power)

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
    0.52 + lerpNumber(-0.01, 0.025, pointed) + lerpNumber(0.018, -0.018, rho) + lerpNumber(-0.022, 0.022, radius) -
      smoothing * 0.012,
    0.46,
    0.72,
  )
}

function curlParallelAmount(curl: number): number {
  return clampNumber(curl / PARALLEL_ANGLE_CURL, 0, 1)
}

function curlDownDipAmount(curl: number): number {
  return clampNumber((curl - PARALLEL_ANGLE_CURL) / (1 - PARALLEL_ANGLE_CURL), 0, 1)
}

function openWaveProjection(t: number): number {
  const rise = smootherStep(t / 0.66)

  return Math.pow(Math.max(rise, 0), 1.04)
}

function openWaveHeight(t: number, smoothing: number, conicRho: number, curlRadius: number): number {
  const rho = normalizedConicRho(conicRho)
  const radius = normalizedCurlRadius(curlRadius)
  const rise = smootherStep(t / 0.62)
  const shoulderSettle = 1 - lerpNumber(0.04, 0.1, radius) *
    smootherStep((t - lerpNumber(0.72, 0.82, smoothing) + lerpNumber(-0.025, 0.02, radius)) /
      lerpNumber(0.18, 0.25, radius))
  const returnStart = clampNumber(
    lerpNumber(0.58, 0.72, smoothing) + lerpNumber(-0.016, 0.014, radius) + lerpNumber(0.014, -0.014, rho),
    0.56,
    0.78,
  )
  const returnFall = smootherStep((t - returnStart) / Math.max(1 - returnStart, 0.000001))
  const terminalReturn = 1 - returnFall

  return Math.pow(
    Math.max(rise * shoulderSettle * terminalReturn, 0),
    clampNumber(lerpNumber(1.22, 0.88, smoothing) + lerpNumber(0.16, -0.16, rho), 0.62, 1.45),
  )
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
  overhangWidth = config.overhangWidth,
): number {
  const yCenter = totalHeight * 0.5
  const gridSpacingY = DEFAULT_WAVE_FIELD_SPAN / Math.max(config.rows - 1, 1)
  const smooth = clampNumber(wallSmoothness, 0, 1)
  const lipStrength = breakingLipStrength(lipDipAmount(config.overhangAngleDeg))
  const widthOpen = smootherStep(lipStrength)
  const edgeMask = edgeRamp(y / Math.max(totalHeight, 0.000001), flatRim, blendRim) *
    edgeRamp(1 - y / Math.max(totalHeight, 0.000001), flatRim, blendRim)
  const maxHalfWidth = Math.max(totalHeight * (0.5 - flatRim), config.spacing)
  const requestedHalfWidth = clampNumber(overhangWidth * 0.5, 0, maxHalfWidth)

  if (requestedHalfWidth <= 0.000001) return 0
  const coneCurl = widthOpen * 0.94
  const coreWidthFactor = lerpNumber(
    lerpNumber(0.32, 0.22, smooth),
    lerpNumber(0.34, 0.26, smooth),
    coneCurl,
  )
  const taperWidthFactor = lerpNumber(
    lerpNumber(2.05, 2.9, smooth),
    lerpNumber(1.04, 1.24, smooth),
    coneCurl,
  )
  const coreHalfWidth = Math.min(
    requestedHalfWidth,
    Math.max(
      gridSpacingY * lerpNumber(2.4, 3.2, smooth),
      requestedHalfWidth * coreWidthFactor,
    ),
  )
  const taperHalfWidth = Math.min(
    maxHalfWidth,
    Math.max(
      coreHalfWidth + gridSpacingY * lerpNumber(7.5, 11.5, smooth) * lerpNumber(1, 0.64, coneCurl),
      requestedHalfWidth * taperWidthFactor +
        gridSpacingY * lerpNumber(2.6, 4.6, smooth) * lerpNumber(1, 0.58, coneCurl),
    ),
  )
  const distanceFromCenter = Math.abs(y - yCenter)
  const fadeWidth = Math.max(
    taperHalfWidth - coreHalfWidth,
    gridSpacingY * lerpNumber(8.5, 13.5, smooth) * lerpNumber(1, 0.28, coneCurl),
  )
  const rawWidthMask = distanceFromCenter <= coreHalfWidth
    ? 1
    : 1 - smootherStep((distanceFromCenter - coreHalfWidth) / Math.max(fadeWidth, 0.000001))
  const widthMask = Math.pow(
    clampNumber(rawWidthMask, 0, 1),
    lerpNumber(lerpNumber(0.98, 1.08, smooth), lerpNumber(0.82, 0.94, smooth), coneCurl),
  )

  return clampNumber(edgeMask * widthMask, 0, 1)
}

function transverseSupportMask(
  centeredY: number,
  config: InverseSheetConfig,
  wallSmoothness: number,
  overhangWidth: number,
): number {
  const maxHalfWidth = DEFAULT_SHEET_SPAN * 0.5 - DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1)
  const requestedHalfWidth = clampNumber(overhangWidth * 0.5, config.spacing, maxHalfWidth)
  const smooth = clampNumber(wallSmoothness, 0, 1)
  const gridSpacingY = DEFAULT_SHEET_SPAN / Math.max(config.rows - 1, 1)
  const centerCoreHalfWidth = Math.min(
    requestedHalfWidth,
    Math.max(gridSpacingY * lerpNumber(1.7, 2.4, smooth), requestedHalfWidth * lerpNumber(0.16, 0.1, smooth)),
  )
  const taperHalfWidth = Math.min(
    maxHalfWidth,
    Math.max(
      requestedHalfWidth,
      requestedHalfWidth * lerpNumber(1.22, 1.5, smooth) + gridSpacingY * lerpNumber(2.8, 4.8, smooth),
    ),
  )
  const fadeWidth = Math.max(taperHalfWidth - centerCoreHalfWidth, gridSpacingY * lerpNumber(4.5, 7.4, smooth))
  const distance = Math.abs(centeredY)

  if (distance <= centerCoreHalfWidth) return 1

  return clampNumber(1 - smootherStep((distance - centerCoreHalfWidth) / Math.max(fadeWidth, 0.000001)), 0, 1)
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

function buildDihedralPairs(rows: number, columns: number, quadIds: Set<string>): DihedralPair[] {
  const pairs: DihedralPair[] = []

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns - 2; col += 1) {
      if (!quadIds.has(quadId(row, col)) || !quadIds.has(quadId(row, col + 1))) continue
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
      if (!quadIds.has(quadId(row, col)) || !quadIds.has(quadId(row + 1, col))) continue
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

  const liftedNodes = nodes.filter((node) => (
    Math.abs(node.currentPosition[2]) >= maxLift * CORE_OVERHANG_HEIGHT_FRACTION
  ))
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

function scaleVec(value: Vec3, amount: number): Vec3 {
  return [value[0] * amount, value[1] * amount, value[2] * amount]
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

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
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
