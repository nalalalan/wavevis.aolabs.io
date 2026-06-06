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
const DEFAULT_SHEET_SPAN = (DEFAULT_SHEET_ROWS - 1) * DEFAULT_SHEET_SPACING
const DEFAULT_GRID_DENOMINATOR = Math.max(DEFAULT_SHEET_ROWS - 1, DEFAULT_SHEET_COLUMNS - 1)
const MAX_STEER_ANGLE_RAD = Math.PI / 4

const failures = [...runInverseSheetSanityChecks()]
const breakingLipConfig = {
  rows: 44,
  columns: 44,
  height: 10,
  horizontalOffset: 18,
  overhangWidth: 32,
  overhangPosition: 0,
  steer: 0,
  smoothing: 0.3,
  wallSmoothness: 0.2,
  lipSharpness: 0.5,
  flatContribution: 0,
}
const flat0Model = buildInverseSheetModel({ flatContribution: 0 })
const flat1Model = buildInverseSheetModel({ flatContribution: 1 })
const flat0 = summarizeFlatContribution(flat0Model)
const flat1 = summarizeFlatContribution(flat1Model)
const flatContributionPair = summarizeFlatContributionPair(flat0Model, flat1Model)
const transition0 = buildInverseSheetModel({ smoothing: 0 })
const transition1 = buildInverseSheetModel({ smoothing: 1 })
const bluntLipModel = buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 118, lipSharpness: 0 })
const sharpLipModel = buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 118, lipSharpness: 1 })
const bluntLip = summarizeBreakingLip(bluntLipModel)
const sharpLip = summarizeBreakingLip(sharpLipModel)
const lipSharpnessPair = summarizeLipSharpnessPair(bluntLipModel, sharpLipModel)
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
const lowLipDip = summarizeBreakingLip(buildInverseSheetModel({
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 40,
  overhangWidth: 32,
  lipSharpness: 0.2,
  smoothing: 1,
  wallSmoothness: 0.2,
  flatContribution: 0.35,
}))
const highLipDip = summarizeBreakingLip(buildInverseSheetModel({
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 120,
  overhangWidth: 32,
  lipSharpness: 0.2,
  smoothing: 1,
  wallSmoothness: 0.2,
  flatContribution: 0.35,
}))
const userLipDipCase = summarizeBreakingLip(buildInverseSheetModel({
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
const lipDipSweepModels = {
  90: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 90 }),
  105: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 105 }),
  118: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 118 }),
  120: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 120 }),
}
const lipDipSweep = Object.fromEntries(
  Object.entries(lipDipSweepModels).map(([angle, model]) => [angle, summarizeBreakingLip(model)]),
)
const lipDipPreTerminalResidual = summarizePreTerminalProfileResidual(lipDipSweepModels[90], lipDipSweepModels[118], 0.65)
const positionNeutralModel = buildInverseSheetModel({ overhangPosition: 0 })
const positionField = {
  back: summarizePositionField(buildInverseSheetModel({ overhangPosition: -1 }), positionNeutralModel),
  front: summarizePositionField(buildInverseSheetModel({ overhangPosition: 1 }), positionNeutralModel),
}
const steerNeutralModel = buildInverseSheetModel({ steer: 0, overhangPosition: 0 })
const steerField = {
  left: summarizeSteerField(buildInverseSheetModel({ steer: -1, overhangPosition: 0 }), steerNeutralModel),
  right: summarizeSteerField(buildInverseSheetModel({ steer: 1, overhangPosition: 0 }), steerNeutralModel),
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

if (!(flatContributionPair.heightResidual <= 0.03 &&
  flatContributionPair.overhangResidual <= 0.03 &&
  flatContributionPair.centerlineResidual <= 0.35 &&
  flatContributionPair.highApron > flatContributionPair.lowApron + 0.015)) {
  failures.push('flat contribution should preserve the main wave while adding a broader support apron')
}

if (!(transition1.summary.maxTensileStrain < transition0.summary.maxTensileStrain)) {
  failures.push('higher ground transition should soften the overhang transition')
}

if (!(lipSharpnessPair.preTerminalResidual <= 0.08 && lipSharpnessPair.terminalResidual >= 0.08)) {
  failures.push('lip sharpness should change the terminal lip strongly without changing the broad wave body')
}

if (Math.abs(bluntLip.tipX - sharpLip.tipX) > 1.2) {
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

if (!(lipDipSweep[118].dropRatio >= 0.15 &&
  lipDipSweep[118].tipForwardOfCrest &&
  lipDipSweep[118].tipSlope < -0.05 &&
  lipDipSweep[120].dropRatio >= lipDipSweep[105].dropRatio + 0.06)) {
  failures.push('lip dip should create a crest, forward overhanging lip, and downward terminal tangent')
}

if (lipDipPreTerminalResidual > 0.12) {
  failures.push('lip dip should keep the broad pre-terminal wave body stable')
}

if (!(userLipDipCase.tipBelowLastPeak && userLipDipCase.tipSlope < -0.05)) {
  failures.push('lip dip above 90 deg should make the terminal free tip point downward')
}

if (!(positionField.back.restGridFixed && positionField.front.restGridFixed &&
  positionField.back.boundaryFlat && positionField.front.boundaryFlat &&
  positionField.back.fieldResidual < 0.35 && positionField.front.fieldResidual < 0.35 &&
  Math.abs(positionField.back.centroidShiftX - positionField.back.expectedShiftX) < 0.85 &&
  Math.abs(positionField.front.centroidShiftX - positionField.front.expectedShiftX) < 0.85)) {
  failures.push('overhang position should move the deformation field inside a fixed square sheet')
}

if (!(steerField.left.restGridFixed && steerField.right.restGridFixed &&
  steerField.left.boundaryFlat && steerField.right.boundaryFlat &&
  steerField.left.fieldResidual < 2.35 && steerField.right.fieldResidual < 2.35 &&
  steerField.left.centroidShiftY < -0.6 && steerField.right.centroidShiftY > 0.6)) {
  failures.push('steer should rotate the deformation field inside a fixed square sheet')
}

if (widthInvariant.narrowToWideCenterlineResidual > 0.000001) {
  failures.push('width should only change y/span, not the x-z centerline')
}

if (resolutionInvariant.grid24Residual > 0.45 || resolutionInvariant.grid72Residual > 0.16) {
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
  flatContributionPair,
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
    comparison: lipSharpnessPair,
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
  lipDipSweep: {
    ...lipDipSweep,
    preTerminal118Residual: round(lipDipPreTerminalResidual),
  },
  overhangPosition: positionField,
  steer: steerField,
  widthInvariant,
  resolutionInvariant,
  displayInvariant,
}

console.log(JSON.stringify(report, null, 2))

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
}

function summarizeBreakingLip(model) {
  const points = centerlinePoints(model)
  const maxZ = Math.max(...points.map((point) => point.z), 0.000001)
  const maxReach = maxOf(points.map((point) => point.reach))
  const activePoints = points.filter((point) => point.reach >= maxReach * 0.08 || point.z > maxZ * 0.02)

  if (activePoints.length < 3) {
    return {
      tipBelowLastPeak: false,
      tipForwardOfCrest: false,
      tipDx: 0,
      tipSlope: 0,
      dropRatio: 0,
      crestX: 0,
      crestZ: 0,
      tipX: 0,
      tipZ: 0,
    }
  }

  const activeStartCol = activePoints[0].col
  const activeEndCol = activePoints[activePoints.length - 1].col
  const terminalStartCol = activeStartCol + (activeEndCol - activeStartCol) * 0.55
  const terminal = activePoints.filter((point) => point.col >= terminalStartCol && point.z > maxZ * 0.08)

  if (terminal.length < 3) {
    return {
      tipBelowLastPeak: false,
      tipForwardOfCrest: false,
      tipDx: 0,
      tipSlope: 0,
      dropRatio: 0,
      crestX: 0,
      crestZ: 0,
      tipX: 0,
      tipZ: 0,
    }
  }

  const crest = terminal.reduce((best, point) => {
    if (point.z > best.z + 0.000001) return point
    if (Math.abs(point.z - best.z) <= 0.000001 && point.col < best.col) return point
    return best
  }, terminal[0])
  const postCrest = terminal.filter((point) => point.col > crest.col)
  const forwardPostCrest = postCrest.filter((point) => point.x > crest.x + model.config.spacing * 0.25)
  const candidates = forwardPostCrest.length ? forwardPostCrest : (postCrest.length ? postCrest : terminal)
  const tip = candidates.reduce((best, point) => {
    const bestDrop = crest.z - best.z
    const pointDrop = crest.z - point.z
    if (pointDrop > bestDrop + 0.000001) return point
    if (Math.abs(pointDrop - bestDrop) <= 0.000001 && point.x > best.x) return point
    return best
  }, candidates[0])
  const tipIndex = points.findIndex((point) => point.col === tip.col)
  const previous = points[Math.max(0, tipIndex - 1)]
  const tipDx = tip.x - previous.x
  const tipSlope = (tip.z - previous.z) / Math.max(Math.abs(tipDx), 0.000001)
  const dropRatio = clampNumber((crest.z - tip.z) / maxZ, 0, 1)
  const tipForwardDistance = tip.x - crest.x

  return {
    tipBelowLastPeak: dropRatio >= 0.08,
    tipForwardOfCrest: tipForwardDistance > model.config.spacing * 0.25,
    tipDx: round(tipDx),
    tipSlope: round(tipSlope),
    dropRatio: round(dropRatio),
    tipForwardDistance: round(tipForwardDistance),
    crestX: round(crest.x),
    crestZ: round(crest.z),
    tipX: round(tip.x),
    tipZ: round(tip.z),
  }
}

function summarizeLipSharpnessPair(bluntModel, sharpModel) {
  return {
    preTerminalResidual: round(summarizePreTerminalProfileResidual(bluntModel, sharpModel, 0.65)),
    terminalResidual: round(summarizeCenterlineRegionResidual(bluntModel, sharpModel, 0.74, 1)),
  }
}

function summarizeFlatContributionPair(low, high) {
  const heightBase = Math.max(low.summary.maxHeight, 0.000001)
  const overhangBase = Math.max(low.summary.overhangAmount, 0.000001)

  return {
    heightResidual: round(Math.abs(high.summary.maxHeight - low.summary.maxHeight) / heightBase),
    overhangResidual: round(Math.abs(high.summary.overhangAmount - low.summary.overhangAmount) / overhangBase),
    centerlineResidual: round(centerlineProfileResidual(low, high)),
    lowApron: round(meanApronDisplacement(low)),
    highApron: round(meanApronDisplacement(high)),
  }
}

function summarizePreTerminalProfileResidual(a, b, endProfileU) {
  return summarizeCenterlineRegionResidual(a, b, 0, endProfileU)
}

function summarizeCenterlineRegionResidual(a, b, startProfileU, endProfileU) {
  const samples = 18
  const aProfile = overhangProfileLimits(a.config.smoothing)
  const bProfile = overhangProfileLimits(b.config.smoothing)
  let residual = 0

  for (let index = 0; index < samples; index += 1) {
    const amount = samples === 1 ? 0 : index / (samples - 1)
    const profileU = lerpNumber(startProfileU, endProfileU, amount)
    const aU = aProfile.profileStart + clampNumber(profileU, 0, 1) * aProfile.remainingU
    const bU = bProfile.profileStart + clampNumber(profileU, 0, 1) * bProfile.remainingU
    const aPoint = sampleCenterlineLocalPoint(a, aU)
    const bPoint = sampleCenterlineLocalPoint(b, bU)
    residual = Math.max(residual, Math.hypot(aPoint[0] - bPoint[0], aPoint[2] - bPoint[2]))
  }

  return residual
}

function meanApronDisplacement(model) {
  const centerRow = (model.config.rows - 1) / 2
  const sideStart = Math.max(model.config.rows * 0.16, 2)
  const sideEnd = Math.max(model.config.rows * 0.46, sideStart + 1)
  const candidates = model.nodes.filter((node) => {
    if (node.row <= 0 || node.col <= 0 || node.row >= model.config.rows - 1 || node.col >= model.config.columns - 1) return false
    const rowDistance = Math.abs(node.row - centerRow)
    return rowDistance >= sideStart && rowDistance <= sideEnd
  })

  return mean(candidates.map((node) => distanceVec(node.currentPosition, node.restPosition)))
}

function centerlinePoints(model) {
  const centerRow = Math.floor((model.config.rows - 1) / 2)

  return model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
    .map((node) => ({
      col: node.col,
      x: node.currentPosition[0],
      z: node.currentPosition[2],
      reach: horizontalDisplacement(node),
      node,
    }))
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

function summarizePositionField(candidate, neutral) {
  const candidateCenter = activeDisplacementCentroid(candidate)
  const neutralCenter = activeDisplacementCentroid(neutral)
  const expectedShiftX = overhangPositionOffset(candidate.config.overhangPosition) - overhangPositionOffset(neutral.config.overhangPosition)

  return {
    restGridFixed: restGridsMatch(candidate, neutral),
    fieldResidual: round(transformedDisplacementFieldResidual(candidate, neutral)),
    centroidShiftX: round(candidateCenter[0] - neutralCenter[0]),
    expectedShiftX: round(expectedShiftX),
    boundaryFlat: boundaryNodesStayFlat(candidate),
  }
}

function boundaryNodesStayFlat(model) {
  const tolerance = 0.000001
  return model.nodes.every((node) => {
    const expected = expectedCanonicalRestPosition(node.row, node.col, model.config)

    if (distanceVec(node.restPosition, expected) > tolerance) return false
    if (!isBoundaryNodeIndex(node.row, node.col, model.config)) return true

    return (
      distanceVec(node.currentPosition, expected) <= tolerance &&
      distanceVec(node.targetPosition, expected) <= tolerance &&
      Math.abs(node.currentPosition[2]) <= tolerance &&
      Math.abs(node.targetPosition[2]) <= tolerance
    )
  })
}

function summarizeSteerField(candidate, neutral) {
  const candidateCenter = activeDisplacementCentroid(candidate)
  const neutralCenter = activeDisplacementCentroid(neutral)

  return {
    restGridFixed: restGridsMatch(candidate, neutral),
    fieldResidual: round(transformedDisplacementFieldResidual(candidate, neutral)),
    centroidShiftY: round(candidateCenter[1] - neutralCenter[1]),
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
  const leftPoint = left ? left.currentPosition : [0, 0, 0]
  const rightPoint = right ? right.currentPosition : leftPoint

  return lerpVec(leftPoint, rightPoint, amount)
}

function restGridsMatch(a, b) {
  if (a.nodes.length !== b.nodes.length) return false
  const tolerance = 0.000001

  return a.nodes.every((node, index) => {
    const other = b.nodes[index]
    const expected = expectedCanonicalRestPosition(node.row, node.col, a.config)

    return distanceVec(node.restPosition, expected) <= tolerance && distanceVec(node.restPosition, other.restPosition) <= tolerance
  })
}

function transformedDisplacementFieldResidual(candidate, neutral) {
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

function sampleDisplacementOnRestGrid(model, x, y) {
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

function nodeDisplacement(model, row, col) {
  const node = model.nodes.find((candidate) => candidate.row === row && candidate.col === col)
  if (!node) return [0, 0, 0]
  return subtractVec(node.targetPosition, node.restPosition)
}

function activeDisplacementCentroid(model) {
  let weightSum = 0
  const weighted = [0, 0, 0]

  model.nodes.forEach((node) => {
    const displacement = distanceVec(node.targetPosition, node.restPosition)
    if (displacement <= 0.0001) return
    weighted[0] += node.restPosition[0] * displacement
    weighted[1] += node.restPosition[1] * displacement
    weighted[2] += node.restPosition[2] * displacement
    weightSum += displacement
  })

  if (weightSum <= 0.000001) return [0, 0, 0]
  return [weighted[0] / weightSum, weighted[1] / weightSum, weighted[2] / weightSum]
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

function rootAnchor(config) {
  const profileStart = overhangProfileLimits(config.smoothing).profileStart
  return [-DEFAULT_SHEET_LENGTH / 2 + profileStart * DEFAULT_SHEET_LENGTH, 0, 0]
}

function expectedCanonicalRestPosition(row, col, config) {
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

function isBoundaryNodeIndex(row, col, config) {
  return row === 0 || col === 0 || row === config.rows - 1 || col === config.columns - 1
}

function mapSheetPointToCanonicalWaveFrame(point, config) {
  const anchor = rootAnchor({ ...config, overhangPosition: 0, steer: 0 })
  const yaw = -steerYaw(config.steer)
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const placedAnchor = [anchor[0] + overhangPositionOffset(config.overhangPosition), anchor[1], anchor[2]]
  const dx = point[0] - placedAnchor[0]
  const dy = point[1] - placedAnchor[1]

  return [
    anchor[0] + c * dx - s * dy,
    anchor[1] + s * dx + c * dy,
    point[2],
  ]
}

function rotateYawVector(vector, yaw) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)

  return [
    c * vector[0] - s * vector[1],
    s * vector[0] + c * vector[1],
    vector[2],
  ]
}

function pointInsideCanonicalSheet(point, tolerance = 0) {
  return (
    point[0] >= -DEFAULT_SHEET_LENGTH / 2 - tolerance &&
    point[0] <= DEFAULT_SHEET_LENGTH / 2 + tolerance &&
    point[1] >= -DEFAULT_SHEET_SPAN / 2 - tolerance &&
    point[1] <= DEFAULT_SHEET_SPAN / 2 + tolerance
  )
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
  return lerpNumber(0.58, 1, clampNumber(value, 0, 1))
}

function overhangPositionOffset(overhangPosition) {
  return clampNumber(overhangPosition, -1, 1) * DEFAULT_SHEET_LENGTH * 0.06
}

function steerYaw(steer) {
  return clampNumber(steer, -1, 1) * MAX_STEER_ANGLE_RAD
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

function subtractVec(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
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
