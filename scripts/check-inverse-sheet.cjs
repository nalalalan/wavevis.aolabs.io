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

const failures = [...runInverseSheetSanityChecks()]
const flat0 = summarizeFlatContribution(buildInverseSheetModel({ flatContribution: 0 }))
const flat1 = summarizeFlatContribution(buildInverseSheetModel({ flatContribution: 1 }))
const transition0 = buildInverseSheetModel({ smoothing: 0 })
const transition1 = buildInverseSheetModel({ smoothing: 1 })
const bluntLip = summarizeLipSharpness(buildInverseSheetModel({ smoothing: 1, flatContribution: 1, overhangAngleDeg: 90, lipSharpness: 0 }))
const sharpLip = summarizeLipSharpness(buildInverseSheetModel({ smoothing: 1, flatContribution: 1, overhangAngleDeg: 90, lipSharpness: 1 }))
const sharpWalls = summarizeWallSmoothness(buildInverseSheetModel({ smoothing: 1, wallSmoothness: 0, flatContribution: 1 }))
const roundWalls = summarizeWallSmoothness(buildInverseSheetModel({ smoothing: 1, wallSmoothness: 1, flatContribution: 1 }))
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

if (!(flat1.flatMeanAbs > flat0.flatMeanAbs * 1.8)) {
  failures.push('flat contribution should increase strain in flat areas')
}

if (!(flat1.activeMaxAbs < flat0.activeMaxAbs)) {
  failures.push('flat contribution should reduce active overhang max strain')
}

if (Math.abs(flat1.overhang - flat0.overhang) > 0.15 || Math.abs(flat1.height - flat0.height) > 0.15) {
  failures.push('flat contribution should not materially change overhang amount or height')
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
    flatMaxAbs: round(Math.max(...flatEdges.map((edge) => Math.abs(edge.strain)))),
    activeMaxAbs: round(Math.max(...activeEdges.map((edge) => Math.abs(edge.strain)))),
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
    frontZSpan: round(Math.max(...frontZValues) - Math.min(...frontZValues)),
    postTipDrop: round(tip.z - postTipPoint.z),
  }
}

function summarizeLipDip(model) {
  const centerRow = Math.floor(model.config.rows / 2)
  const points = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
    .map((node) => ({ col: node.col, x: node.currentPosition[0], z: node.currentPosition[2] }))
  const maxZ = Math.max(...points.map((point) => point.z))
  const activePoints = points.filter((point) => point.z > maxZ * 0.02)
  const tip = activePoints.reduce((best, point) => (point.col > best.col ? point : best), activePoints[0])

  return {
    maxZ: round(maxZ),
    tipX: round(tip.x),
    tipZ: round(tip.z),
    tipDropRatio: round((maxZ - tip.z) / Math.max(maxZ, 0.0001)),
  }
}

function summarizeTerminalCurl(model) {
  const centerRow = Math.floor((model.config.rows - 1) / 2)
  const points = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
    .map((node) => ({ col: node.col, x: node.currentPosition[0], z: node.currentPosition[2] }))
  const maxZ = Math.max(...points.map((point) => point.z))
  const activePoints = points.filter((point) => point.z > maxZ * 0.04)

  if (activePoints.length < 3) {
    return {
      tipBelowLastPeak: false,
      tipDx: 0,
      tipSlope: 0,
      peakZ: 0,
      tipZ: 0,
    }
  }

  const terminalStartIndex = Math.max(0, Math.floor(activePoints.length * 0.6))
  const terminal = activePoints.slice(terminalStartIndex)
  const peakZ = Math.max(...terminal.map((point) => point.z))
  const tip = activePoints[activePoints.length - 1]
  const previous = activePoints[activePoints.length - 2]
  const tipDx = tip.x - previous.x
  const tipSlope = (tip.z - previous.z) / Math.max(Math.abs(tipDx), 0.000001)

  return {
    tipBelowLastPeak: tip.z < peakZ - maxZ * 0.035,
    tipDx: round(tipDx),
    tipSlope: round(tipSlope),
    peakZ: round(peakZ),
    tipZ: round(tip.z),
  }
}

function summarizePositionRigid(candidate, neutral) {
  const xOffset = mean(candidate.nodes.map((node, index) => node.currentPosition[0] - neutral.nodes[index].currentPosition[0]))
  const maxResidual = candidate.nodes.reduce((currentMax, node, index) => {
    const baseline = neutral.nodes[index]
    const residual = Math.hypot(
      node.currentPosition[0] - xOffset - baseline.currentPosition[0],
      node.currentPosition[1] - baseline.currentPosition[1],
      node.currentPosition[2] - baseline.currentPosition[2],
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
  const totalWidth = Math.max((model.config.columns - 1) * model.config.spacing, model.config.spacing)
  const xOffset = model.config.morph * Math.max(-1, Math.min(1, model.config.overhangPosition)) * totalWidth * 0.18
  return model.nodes.every((node) => {
    const onBoundary =
      node.row === 0 ||
      node.col === 0 ||
      node.row === model.config.rows - 1 ||
      node.col === model.config.columns - 1

    return !onBoundary || (
      Math.abs(node.currentPosition[0] - (node.restPosition[0] + xOffset)) <= tolerance &&
      Math.abs(node.currentPosition[1] - node.restPosition[1]) <= tolerance &&
      Math.abs(node.currentPosition[2]) <= tolerance
    )
  })
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

function round(value) {
  return Number(value.toFixed(4))
}
