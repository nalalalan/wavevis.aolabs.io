const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'node_modules', '.tmp', 'wavevis-inverse-sheet-check')
const tscRunner = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n')

execFileSync(
  process.execPath,
  [
    tscRunner,
    'src/inverseSheetTypes.ts',
    'src/latticeGeometry.ts',
    'src/rigidCellMechanism.ts',
    '--outDir',
    path.relative(root, outDir),
    '--module',
    'commonjs',
    '--target',
    'es2022',
    '--moduleResolution',
    'node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--ignoreConfig',
    '--ignoreDeprecations',
    '6.0',
  ],
  { cwd: root, stdio: 'inherit' },
)

const { buildInverseSheetModel, runInverseSheetSanityChecks } = require(path.join(outDir, 'latticeGeometry.js'))
const { rigidCellMechanismStats } = require(path.join(outDir, 'rigidCellMechanism.js'))

const DEFAULT_SHEET_ROWS = 44
const DEFAULT_SHEET_COLUMNS = 44
const DEFAULT_SHEET_SPACING = 1
const DEFAULT_SHEET_LENGTH = (DEFAULT_SHEET_COLUMNS - 1) * DEFAULT_SHEET_SPACING
const DEFAULT_GRID_DENOMINATOR = Math.max(DEFAULT_SHEET_ROWS - 1, DEFAULT_SHEET_COLUMNS - 1)
const MAX_STEER_ANGLE_RAD = Math.PI / 4

const failures = [...runInverseSheetSanityChecks()]
const flat0 = summarizeFlatContribution(buildInverseSheetModel({ flatContribution: 0 }))
const flat1 = summarizeFlatContribution(buildInverseSheetModel({ flatContribution: 1 }))
const transition0 = buildInverseSheetModel({ smoothing: 0 })
const transition1 = buildInverseSheetModel({ smoothing: 1 })
const bluntLip = summarizeLipSharpness(buildInverseSheetModel({ smoothing: 1, flatContribution: 0, overhangAngleDeg: 120, lipSharpness: 0 }))
const sharpLip = summarizeLipSharpness(buildInverseSheetModel({ smoothing: 1, flatContribution: 0, overhangAngleDeg: 120, lipSharpness: 1 }))
const sharpWalls = summarizeWallSmoothness(buildInverseSheetModel({ smoothing: 1, wallSmoothness: 0, flatContribution: 0 }))
const roundWalls = summarizeWallSmoothness(buildInverseSheetModel({ smoothing: 1, wallSmoothness: 1, flatContribution: 0 }))
const mechanism = rigidCellMechanismStats(buildInverseSheetModel())
const wallSmoothnessExtreme = summarizeExtremeShape(buildInverseSheetModel({
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 120,
  overhangWidth: 32,
  lipSharpness: 0,
  smoothing: 1,
  wallSmoothness: 1,
  flatContribution: 0.35,
}))
const lipSharpnessExtreme = summarizeExtremeShape(buildInverseSheetModel({
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 120,
  overhangWidth: 32,
  lipSharpness: 1,
  smoothing: 1,
  wallSmoothness: 0.11,
  flatContribution: 0.35,
}))
const lowLipDip = summarizeLipDip(buildInverseSheetModel({
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 40,
  overhangWidth: 32,
  lipSharpness: 0.2,
  smoothing: 1,
  wallSmoothness: 0.2,
  flatContribution: 0.35,
}))
const highLipDip = summarizeLipDip(buildInverseSheetModel({
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 120,
  overhangWidth: 32,
  lipSharpness: 0.2,
  smoothing: 1,
  wallSmoothness: 0.2,
  flatContribution: 0.35,
}))
const userLipDipCase = summarizeTerminalCurl(buildInverseSheetModel({
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
}))
const positionNeutralModel = buildInverseSheetModel({ overhangPosition: 0 })
const positionRigid = {
  back: summarizePositionRigid(buildInverseSheetModel({ overhangPosition: -1 }), positionNeutralModel),
  front: summarizePositionRigid(buildInverseSheetModel({ overhangPosition: 1 }), positionNeutralModel),
}
const steerNeutralModel = buildInverseSheetModel({ steer: 0, overhangPosition: 0 })
const steerRigid = {
  left: summarizeSteerRigid(buildInverseSheetModel({ steer: -1, overhangPosition: 0 }), steerNeutralModel),
  right: summarizeSteerRigid(buildInverseSheetModel({ steer: 1, overhangPosition: 0 }), steerNeutralModel),
}
const widthInvariant = {
  narrowToWideCenterlineResidual: summarizeCenterlineProfileResidual(buildInverseSheetModel({ overhangWidth: 12 }), buildInverseSheetModel({ overhangWidth: 36 })),
}
const resolutionInvariant = {
  grid24Residual: summarizeCenterlineProfileResidual(buildInverseSheetModel({ rows: 24, columns: 24, overhangWidth: 32 }), buildInverseSheetModel({ rows: 44, columns: 44, overhangWidth: 32 })),
  grid72Residual: summarizeCenterlineProfileResidual(buildInverseSheetModel({ rows: 72, columns: 72, overhangWidth: 32 }), buildInverseSheetModel({ rows: 44, columns: 44, overhangWidth: 32 })),
}
const displayInvariant = summarizeGeometryMatch(
  buildInverseSheetModel({ showHeatmap: false, colorMode: 'edgeStrain' }),
  buildInverseSheetModel({ showHeatmap: true, colorMode: 'displacement' }),
)

if (!(flat1.overhang < 0.000001 && flat1.height < 0.000001 && flat1.maxTensileStrain < 0.000001)) {
  failures.push('flat contribution 1 should blend the target back to the flat reference sheet')
}

if (!(flat0.overhang > flat1.overhang + 1 && flat0.height > flat1.height + 1)) {
  failures.push('flat contribution should be a predictable interpolation toward flat, not a second shape mode')
}

if (!(transition1.summary.maxTensileStrain < transition0.summary.maxTensileStrain)) {
  failures.push('higher ground transition should soften the overhang transition')
}

if (!(bluntLip.frontBandCount >= sharpLip.frontBandCount && bluntLip.frontZSpan < sharpLip.frontZSpan)) {
  failures.push('lip sharpness 0 should keep a visibly rounder front band than lip sharpness 1')
}

if (!(sharpLip.postTipDrop > bluntLip.postTipDrop * 1.1)) {
  failures.push('lip sharpness 1 should make the front lip drop tighter than lip sharpness 0')
}

if (Math.abs(bluntLip.frontX - sharpLip.frontX) > 0.5) {
  failures.push('lip sharpness should control tip shape without materially changing overhang reach')
}

if (!(roundWalls.edgeWidth < sharpWalls.edgeWidth && roundWalls.centerWidth <= sharpWalls.centerWidth)) {
  failures.push('wall smoothness 1 should round the active footprint without expanding it')
}

if (wallSmoothnessExtreme.mechanism.maxArmSurfaceLeak > 1.75 || wallSmoothnessExtreme.maxTensileStrain > 4.25) {
  failures.push('wall smoothness 1 should not create off-surface spikes in the high wall-smoothness case')
}

if (lipSharpnessExtreme.mechanism.maxArmSurfaceLeak > 1.75 || lipSharpnessExtreme.maxTensileStrain > 4.25) {
  failures.push('lip sharpness 1 should stay bounded and not overlap in the high-sharpness case')
}

if (!(highLipDip.tipDropRatio > lowLipDip.tipDropRatio + 0.02)) {
  failures.push('lip dip 120 deg should lower the front lip more than lip dip 40 deg')
}

if (!(userLipDipCase.tipBelowLastPeak && userLipDipCase.tipSlope < -0.05)) {
  failures.push('lip dip above 90 deg should make the terminal free tip point downward')
}

if (!(positionRigid.back.maxResidual < 0.000001 && positionRigid.front.maxResidual < 0.000001 &&
  positionRigid.back.maxStrainResidual < 0.000001 && positionRigid.front.maxStrainResidual < 0.000001)) {
  failures.push('overhang position should be a rigid horizontal translation with no shape or strain change')
}

if (!(steerRigid.left.maxResidual < 0.000001 && steerRigid.right.maxResidual < 0.000001 &&
  steerRigid.left.maxMetricResidual < 0.000001 && steerRigid.right.maxMetricResidual < 0.000001 &&
  steerRigid.left.maxZResidual < 0.000001 && steerRigid.right.maxZResidual < 0.000001)) {
  failures.push('steer should be a rigid yaw with no shape or metric change')
}

if (widthInvariant.narrowToWideCenterlineResidual > 0.000001) {
  failures.push('width should only change y/span, not the x-z centerline')
}

if (resolutionInvariant.grid24Residual > 0.12 || resolutionInvariant.grid72Residual > 0.08) {
  failures.push('rows and columns should only resample the same physical overhang')
}

if (displayInvariant.maxResidual > 0.000001 || displayInvariant.maxMetricResidual > 0.000001) {
  failures.push('display modes should only affect colors/materials')
}

if (mechanism.maxConnectorEndpointGap > 0.0001) {
  failures.push('inverse-sheet arms should terminate directly at shared connector points')
}

if (mechanism.maxPairLengthSpread > 0.005) {
  failures.push('opposite arms within each inverse-sheet pair should stay nearly equal length')
}

if (mechanism.maxOppositeColinearErrorDeg > 0.25) {
  failures.push('opposite arms within each inverse-sheet pair should stay visually collinear')
}

if (mechanism.maxArmSurfaceLeak > 1.75) {
  failures.push('equal-arm connector surface residual should stay bounded')
}

if (mechanism.maxCenterShift > 2.25) {
  failures.push('global connector assignment should not solve contact by drifting cell centers off the sampled surface')
}

const report = {
  flat0,
  flat1,
  transition0: {
    maxTensileStrain: round(transition0.summary.maxTensileStrain),
    maxEdgeRotationDeg: round(transition0.summary.maxEdgeRotationDeg),
  },
  transition1: {
    maxTensileStrain: round(transition1.summary.maxTensileStrain),
    maxEdgeRotationDeg: round(transition1.summary.maxEdgeRotationDeg),
  },
  lipSharpness: {
    blunt: bluntLip,
    pointed: sharpLip,
  },
  wallSmoothness: {
    sharp: sharpWalls,
    round: roundWalls,
  },
  mechanism: {
    maxLegLengthSpread: round(mechanism.maxLegLengthSpread),
    maxPairLengthSpread: round(mechanism.maxPairLengthSpread),
    maxOppositeColinearErrorDeg: round(mechanism.maxOppositeColinearErrorDeg),
    maxOrthogonalityErrorDeg: round(mechanism.maxOrthogonalityErrorDeg),
    maxConnectorEndpointGap: round(mechanism.maxConnectorEndpointGap),
    meanConnectorEndpointGap: round(mechanism.meanConnectorEndpointGap),
    rmsConnectorEndpointGap: round(mechanism.rmsConnectorEndpointGap),
    maxArmSurfaceLeak: round(mechanism.maxArmSurfaceLeak),
    maxCenterShift: round(mechanism.maxCenterShift),
  },
  extremeControls: {
    wallSmoothness1: wallSmoothnessExtreme,
    lipSharpness1: lipSharpnessExtreme,
    lipDip40: lowLipDip,
    lipDip120: highLipDip,
    userLipDip118: userLipDipCase,
  },
  overhangPosition: positionRigid,
  steer: steerRigid,
  widthInvariant,
  resolutionInvariant,
  displayInvariant,
}

console.log(JSON.stringify(report, null, 2))

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
}

function summarizeWallSmoothness(model) {
  const maxLift = Math.max(...model.nodes.map((node) => node.currentPosition[2]))
  const threshold = Math.max(maxLift * 0.08, 0.0001)
  const countsByColumn = new Map()

  for (const node of model.nodes) {
    if (node.currentPosition[2] <= threshold) continue
    countsByColumn.set(node.col, (countsByColumn.get(node.col) ?? 0) + 1)
  }

  const activeColumns = [...countsByColumn.keys()].sort((a, b) => a - b)
  if (!activeColumns.length) {
    return {
      edgeWidth: 0,
      centerWidth: 0,
      endToCenterWidthRatio: 0,
    }
  }

  const edgeSpan = Math.max(2, Math.floor(activeColumns.length * 0.16))
  const edgeColumns = [...activeColumns.slice(0, edgeSpan), ...activeColumns.slice(-edgeSpan)]
  const centerIndex = Math.floor(activeColumns.length * 0.5)
  const centerColumns = activeColumns.slice(Math.max(0, centerIndex - edgeSpan), Math.min(activeColumns.length, centerIndex + edgeSpan))
  const edgeWidth = mean(edgeColumns.map((col) => countsByColumn.get(col) ?? 0))
  const centerWidth = mean(centerColumns.map((col) => countsByColumn.get(col) ?? 0))

  return {
    edgeWidth: round(edgeWidth),
    centerWidth: round(centerWidth),
    endToCenterWidthRatio: round(edgeWidth / Math.max(centerWidth, 0.0001)),
  }
}

function summarizeFlatContribution(model) {
  const maxLift = Math.max(...model.nodes.map((node) => Math.abs(node.currentPosition[2])))
  const flatNodeIds = new Set(
    model.nodes
      .filter(
        (node) =>
          Math.abs(node.currentPosition[2]) <= Math.max(maxLift * 0.03, 0.0001) &&
          node.row > 0 &&
          node.col > 0 &&
          node.row < model.config.rows - 1 &&
          node.col < model.config.columns - 1,
      )
      .map((node) => node.id),
  )
  const flatEdges = model.edgeMetrics.filter((edge) => flatNodeIds.has(edge.nodeA) && flatNodeIds.has(edge.nodeB))
  const activeEdges = model.edgeMetrics.filter((edge) => !flatNodeIds.has(edge.nodeA) || !flatNodeIds.has(edge.nodeB))

  return {
    maxTensileStrain: round(model.summary.maxTensileStrain),
    flatMeanAbs: round(mean(flatEdges.map((edge) => Math.abs(edge.strain)))),
    flatMaxAbs: round(maxOf(flatEdges.map((edge) => Math.abs(edge.strain)))),
    activeMaxAbs: round(maxOf(activeEdges.map((edge) => Math.abs(edge.strain)))),
    overhang: round(model.summary.overhangAmount),
    height: round(model.summary.maxHeight),
  }
}

function summarizeLipSharpness(model) {
  const centerRow = Math.floor(model.config.rows / 2)
  const points = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
    .map((node) => ({ col: node.col, x: node.currentPosition[0], z: node.currentPosition[2] }))
  const maxZ = Math.max(...points.map((point) => point.z))
  const activePoints = points.filter((point) => point.z > maxZ * 0.08)
  if (activePoints.length < 3) {
    return {
      frontX: 0,
      frontBandCount: 0,
      frontZSpan: 0,
      postTipDrop: 0,
    }
  }

  const tip = activePoints.reduce((best, point) => (point.x > best.x ? point : best), activePoints[0])
  const frontBand = activePoints.filter(
    (point) => point.x >= tip.x - model.config.spacing * 0.75 && point.z > maxZ * 0.18,
  )
  const frontZValues = frontBand.map((point) => point.z)
  const tipIndex = points.findIndex((point) => point.col === tip.col)
  const postTipPoint = points[Math.min(points.length - 1, tipIndex + 2)]

  return {
    frontX: round(tip.x),
    frontBandCount: frontBand.length,
    frontZSpan: round(maxOf(frontZValues) - minOf(frontZValues)),
    postTipDrop: round(tip.z - postTipPoint.z),
  }
}

function summarizeLipDip(model) {
  const centerRow = Math.floor(model.config.rows / 2)
  const points = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
    .map((node) => ({
      col: node.col,
      x: node.currentPosition[0],
      z: node.currentPosition[2],
      reach: horizontalDisplacement(node),
    }))
  const maxZ = Math.max(...points.map((point) => point.z))
  const maxReach = maxOf(points.map((point) => point.reach))
  const activePoints = points.filter((point) => point.reach >= maxReach * 0.08 && point.z > maxZ * 0.02)
  if (!activePoints.length) {
    return {
      maxZ: round(maxZ),
      tipX: 0,
      tipZ: 0,
      tipDropRatio: 0,
    }
  }

  const tip = activePoints.reduce((best, point) => {
    if (point.reach > best.reach + 0.000001) return point
    if (Math.abs(point.reach - best.reach) <= 0.000001 && point.col > best.col) return point
    return best
  }, activePoints[0])

  return {
    maxZ: round(maxZ),
    tipX: round(tip.x),
    tipZ: round(tip.z),
    tipDropRatio: round((maxZ - tip.z) / Math.max(maxZ, 0.0001)),
  }
}

function summarizeTerminalCurl(model) {
  const centerRow = Math.floor((model.config.rows - 1) / 2)
  const centerline = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
  const points = centerline.map((node) => ({
    col: node.col,
    x: node.currentPosition[0],
    z: node.currentPosition[2],
    reach: horizontalDisplacement(node),
    node,
  }))
  const maxZ = Math.max(...points.map((point) => point.z))
  const maxReach = maxOf(points.map((point) => point.reach))
  const activePoints = points.filter((point) => point.reach >= maxReach * 0.08)

  if (activePoints.length < 3) {
    return {
      tipBelowLastPeak: false,
      tipDx: 0,
      tipSlope: 0,
      peakZ: 0,
      tipZ: 0,
    }
  }

  const tip = activePoints.reduce((best, point) => {
    if (point.reach > best.reach + 0.000001) return point
    if (Math.abs(point.reach - best.reach) <= 0.000001 && point.col > best.col) return point
    return best
  }, activePoints[0])
  const tipIndex = centerline.findIndex((node) => node.id === tip.node.id)
  const terminalStartIndex = Math.max(0, Math.floor(tipIndex * 0.6))
  const terminal = points.slice(terminalStartIndex, tipIndex + 1)
  const peakZ = Math.max(...terminal.map((point) => point.z))
  const previous = points[Math.max(0, tipIndex - 1)]
  const tipLocal = undoPlacementTransform(tip.node.currentPosition, model.config)
  const previousLocal = undoPlacementTransform(previous.node.currentPosition, model.config)
  const tipDx = tipLocal[0] - previousLocal[0]
  const tipSlope = (tipLocal[2] - previousLocal[2]) / Math.max(Math.abs(tipDx), 0.000001)

  return {
    tipBelowLastPeak: tip.z < peakZ - maxZ * 0.035,
    tipDx: round(tipDx),
    tipSlope: round(tipSlope),
    peakZ: round(peakZ),
    tipZ: round(tip.z),
  }
}

function summarizePositionRigid(candidate, neutral) {
  const xOffset = mean(candidate.nodes.map((node, index) => node.restPosition[0] - neutral.nodes[index].restPosition[0]))
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

  return {
    xOffset: round(xOffset),
    maxResidual: round(maxResidual),
    maxStrainResidual: round(maxStrainResidual),
    boundaryFlat: boundaryNodesStayFlat(candidate),
  }
}

function boundaryNodesStayFlat(model) {
  const tolerance = 0.000001
  return model.nodes.every((node) => {
    const onBoundary =
      node.row === 0 ||
      node.col === 0 ||
      node.row === model.config.rows - 1 ||
      node.col === model.config.columns - 1

    return !onBoundary || (
      distanceVec(node.currentPosition, node.restPosition) <= tolerance &&
      distanceVec(node.targetPosition, node.restPosition) <= tolerance &&
      Math.abs(node.currentPosition[2]) <= tolerance &&
      Math.abs(node.targetPosition[2]) <= tolerance
    )
  })
}

function summarizeSteerRigid(candidate, neutral) {
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
  const maxZResidual = candidate.nodes.reduce((currentMax, node, index) => {
    const baseline = neutral.nodes[index]
    return Math.max(
      currentMax,
      Math.abs(node.restPosition[2] - baseline.restPosition[2]),
      Math.abs(node.targetPosition[2] - baseline.targetPosition[2]),
      Math.abs(node.currentPosition[2] - baseline.currentPosition[2]),
    )
  }, 0)

  return {
    maxResidual: round(maxResidual),
    maxMetricResidual: round(maxMetricResidual),
    maxZResidual: round(maxZResidual),
    boundaryFlat: boundaryNodesStayFlat(candidate),
  }
}

function summarizeCenterlineProfileResidual(a, b) {
  return round(centerlineProfileResidual(a, b))
}

function summarizeGeometryMatch(a, b) {
  if (a.nodes.length !== b.nodes.length) {
    return {
      maxResidual: Infinity,
      maxMetricResidual: Infinity,
    }
  }

  const maxResidual = a.nodes.reduce((currentMax, node, index) => {
    const other = b.nodes[index]
    return Math.max(
      currentMax,
      distanceVec(node.restPosition, other.restPosition),
      distanceVec(node.targetPosition, other.targetPosition),
      distanceVec(node.currentPosition, other.currentPosition),
    )
  }, 0)

  return {
    maxResidual: round(maxResidual),
    maxMetricResidual: round(intrinsicMetricResidual(a, b)),
  }
}

function centerlineProfileResidual(a, b) {
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

function sampleCenterlineLocalPoint(model, u) {
  const row = Math.round((model.config.rows - 1) / 2)
  const scaledColumn = clampNumber(u, 0, 1) * (model.config.columns - 1)
  const leftColumn = Math.floor(scaledColumn)
  const rightColumn = Math.min(model.config.columns - 1, leftColumn + 1)
  const amount = scaledColumn - leftColumn
  const left = model.nodes.find((node) => node.row === row && node.col === leftColumn)
  const right = model.nodes.find((node) => node.row === row && node.col === rightColumn)
  const leftPoint = left ? undoPlacementTransform(left.currentPosition, model.config) : [0, 0, 0]
  const rightPoint = right ? undoPlacementTransform(right.currentPosition, model.config) : leftPoint

  return lerpVec(leftPoint, rightPoint, amount)
}

function intrinsicMetricResidual(a, b) {
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

function undoPlacementTransform(point, config) {
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

function rootAnchor(config) {
  const profileStart = overhangProfileLimits(config.smoothing).profileStart
  return [-DEFAULT_SHEET_LENGTH / 2 + profileStart * DEFAULT_SHEET_LENGTH, 0, 0]
}

function overhangProfileLimits(smoothing) {
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

function stableGroundTransitionValue(value) {
  return lerpNumber(0.72, 1, clampNumber(value, 0, 1))
}

function overhangPositionOffset(overhangPosition) {
  return clampNumber(overhangPosition, -1, 1) * DEFAULT_SHEET_LENGTH * 0.18
}

function steerYaw(steer) {
  return clampNumber(steer, -1, 1) * MAX_STEER_ANGLE_RAD
}

function pointTranslationResidual(candidate, baseline, xOffset) {
  return Math.hypot(
    candidate[0] - xOffset - baseline[0],
    candidate[1] - baseline[1],
    candidate[2] - baseline[2],
  )
}

function horizontalDisplacement(node) {
  return Math.hypot(
    node.currentPosition[0] - node.restPosition[0],
    node.currentPosition[1] - node.restPosition[1],
  )
}

function summarizeExtremeShape(model) {
  const mechanismStats = rigidCellMechanismStats(model)

  return {
    maxTensileStrain: round(model.summary.maxTensileStrain),
    maxEdgeRotationDeg: round(model.summary.maxEdgeRotationDeg),
    mechanism: {
      maxLegLengthSpread: round(mechanismStats.maxLegLengthSpread),
      maxArmSurfaceLeak: round(mechanismStats.maxArmSurfaceLeak),
      maxConnectorEndpointGap: round(mechanismStats.maxConnectorEndpointGap),
    },
  }
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function maxOf(values) {
  if (!values.length) return 0
  return Math.max(...values)
}

function minOf(values) {
  if (!values.length) return 0
  return Math.min(...values)
}

function distanceVec(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function lerpVec(a, b, amount) {
  return [
    lerpNumber(a[0], b[0], amount),
    lerpNumber(a[1], b[1], amount),
    lerpNumber(a[2], b[2], amount),
  ]
}

function lerpNumber(a, b, amount) {
  return a + (b - a) * amount
}

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round(value) {
  return Number(value.toFixed(4))
}
