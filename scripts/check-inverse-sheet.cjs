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
    'src/xCellMechanism.ts',
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

const {
  DEFAULT_INVERSE_SHEET_CONFIG,
  buildInverseSheetModel,
  getInverseSheetUsableRanges,
  runInverseSheetSanityChecks,
} = require(path.join(outDir, 'latticeGeometry.js'))
const { buildRigidCellMechanism, rigidCellMechanismStats } = require(path.join(outDir, 'rigidCellMechanism.js'))
const { buildConnectedXCellMechanism, connectedXCellMechanismStats } = require(path.join(outDir, 'xCellMechanism.js'))
const inverseSheetTabSource = fs.readFileSync(path.join(root, 'src', 'InverseSheetTab.tsx'), 'utf8')
const latticeViewerSource = fs.readFileSync(path.join(root, 'src', 'LatticeViewer3D.tsx'), 'utf8')
const targetShapeControlsSource = fs.readFileSync(path.join(root, 'src', 'TargetShapeControls.tsx'), 'utf8')
const xCellMechanismSource = fs.readFileSync(path.join(root, 'src', 'xCellMechanism.ts'), 'utf8')

const DEFAULT_SHEET_ROWS = 44
const DEFAULT_SHEET_COLUMNS = 112
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
const CORE_PROFILE_START = 0.02
const CORE_PROFILE_END = 1
const SOURCE_BREAKING_WAVE_TRACE = '0,0;0.035,0.02;0.075,0.07;0.118,0.17;0.17,0.32;0.225,0.5;0.295,0.68;0.375,0.82;0.47,0.92;0.565,0.97;0.66,0.96;0.74,0.88;0.805,0.74;0.85,0.56;0.855,0.43;0.828,0.39;0.792,0.4;0.772,0.43;0.79,0.47;0.825,0.48;0.79,0.58;0.725,0.68;0.65,0.73;0.58,0.72;0.525,0.64;0.5,0.52;0.505,0.4;0.55,0.27;0.625,0.17;0.73,0.09;0.85,0.045;0.96,0.018;1,0'

const failures = [...runInverseSheetSanityChecks()]
const startupUrlParamCoverage = summarizeStartupUrlParamCoverage()
const startupDisplayContract = summarizeStartupDisplayContract()
const readableSurfaceRenderContract = summarizeReadableSurfaceRenderContract()
const generatedMode = { profileMode: 'generated' }
const breakingLipConfig = {
  ...generatedMode,
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
const flat0Model = buildInverseSheetModel({ ...generatedMode, flatContribution: 0 })
const flat1Model = buildInverseSheetModel({ ...generatedMode, flatContribution: 1 })
const flat0 = summarizeFlatContribution(flat0Model)
const flat1 = summarizeFlatContribution(flat1Model)
const flatContributionPair = summarizeFlatContributionPair(flat0Model, flat1Model)
const transition0 = buildInverseSheetModel({ ...generatedMode, smoothing: 0 })
const transition1 = buildInverseSheetModel({ ...generatedMode, smoothing: 1 })
const bluntLipModel = buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 118, lipSharpness: 0 })
const sharpLipModel = buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 118, lipSharpness: 1 })
const bluntLip = summarizeBreakingLip(bluntLipModel)
const sharpLip = summarizeBreakingLip(sharpLipModel)
const lipSharpnessPair = summarizeLipSharpnessPair(bluntLipModel, sharpLipModel)
const sharpWalls = summarizeWallSmoothness(buildInverseSheetModel({ ...generatedMode, smoothing: 1, wallSmoothness: 0, flatContribution: 0 }))
const roundWalls = summarizeWallSmoothness(buildInverseSheetModel({ ...generatedMode, smoothing: 1, wallSmoothness: 1, flatContribution: 0 }))
const mechanism = rigidCellMechanismStats(buildInverseSheetModel({ ...generatedMode }))
const xMechanism = connectedXCellMechanismStats(buildInverseSheetModel({ ...generatedMode }))
const xRenderDirectLines = summarizeXCellRenderDirectLines(buildInverseSheetModel())
const wallSmoothnessExtreme = summarizeExtremeShape(buildInverseSheetModel({
  ...generatedMode,
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
  ...generatedMode,
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 120,
  overhangWidth: 32,
  lipSharpness: 1,
  smoothing: 1,
  wallSmoothness: 0.11,
  flatContribution: 0.35,
}))
const neutralLipDip = summarizeBreakingLip(buildInverseSheetModel({
  ...generatedMode,
  height: 14.75,
  horizontalOffset: 16.25,
  overhangAngleDeg: 90,
  overhangWidth: 32,
  lipSharpness: 0.2,
  smoothing: 1,
  wallSmoothness: 0.2,
  flatContribution: 0.35,
}))
const highLipDip = summarizeBreakingLip(buildInverseSheetModel({
  ...generatedMode,
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
}))
const userSideAspectModel = buildInverseSheetModel({
  rows: 24,
  columns: 24,
  overhangPosition: -0.15,
  steer: 0,
  morph: 0.5,
})
const lipDipSweepModels = {
  90: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 90 }),
  105: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 105 }),
  118: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 118 }),
  120: buildInverseSheetModel({ ...breakingLipConfig, overhangAngleDeg: 120 }),
}
const lipDipSweep = Object.fromEntries(
  Object.entries(lipDipSweepModels).map(([angle, model]) => [angle, summarizeBreakingLip(model)]),
)
const lowLipDipStability = summarizeLowLipDipStability()
const lipDipPreTerminalResidual = summarizePreTerminalProfileResidual(
  lipDipSweepModels[90],
  lipDipSweepModels[118],
  preTerminalLipCutoff(lipDipSweepModels[118]),
)
const positionNeutralModel = buildInverseSheetModel({ overhangPosition: 0, flatContribution: 0 })
const positionField = {
  back: summarizePositionField(buildInverseSheetModel({ overhangPosition: -1, flatContribution: 0 }), positionNeutralModel),
  front: summarizePositionField(buildInverseSheetModel({ overhangPosition: 1, flatContribution: 0 }), positionNeutralModel),
}
const steerNeutralModel = buildInverseSheetModel({ steer: 0, overhangPosition: 0, flatContribution: 0 })
const steerField = {
  left: summarizeSteerField(buildInverseSheetModel({ steer: -1, overhangPosition: 0, flatContribution: 0 }), steerNeutralModel),
  right: summarizeSteerField(buildInverseSheetModel({ steer: 1, overhangPosition: 0, flatContribution: 0 }), steerNeutralModel),
}
const widthInvariant = {
  narrowToWideCenterlineResidual: summarizeCenterlineProfileResidual(buildInverseSheetModel({ ...generatedMode, overhangWidth: 12 }), buildInverseSheetModel({ ...generatedMode, overhangWidth: 36 })),
}
const lateralSmoothness = {
  default: summarizeLateralSmoothness(buildInverseSheetModel(generatedMode)),
  compactUser: summarizeLateralSmoothness(buildInverseSheetModel({
    ...generatedMode,
    rows: 24,
    columns: 24,
    height: 8,
    horizontalOffset: 9,
    overhangPosition: -0.15,
    steer: 0,
    overhangAngleDeg: 118,
    overhangWidth: 17,
    lipSharpness: 0.28,
    smoothing: 1,
    wallSmoothness: 0.18,
    flatContribution: 0.35,
  })),
  breakingWide: summarizeLateralSmoothness(lipDipSweepModels[118]),
}
const conicalSpanTaper = {
  default: summarizeConicalSpanTaper(buildInverseSheetModel(generatedMode)),
  compactUser: summarizeConicalSpanTaper(buildInverseSheetModel({
    ...generatedMode,
    rows: 24,
    columns: 24,
    height: 8,
    horizontalOffset: 9,
    overhangPosition: -0.15,
    steer: 0,
    overhangAngleDeg: 118,
    overhangWidth: 17,
    lipSharpness: 0.28,
    smoothing: 1,
    wallSmoothness: 0.18,
    flatContribution: 0.35,
  })),
  breakingWide: summarizeConicalSpanTaper(lipDipSweepModels[118]),
}
const topFootprintRoundness = {
  default: summarizeTopFootprintRoundness(buildInverseSheetModel()),
  compactUser: summarizeTopFootprintRoundness(buildInverseSheetModel({
    rows: 24,
    columns: 24,
    height: 8,
    horizontalOffset: 9,
    overhangPosition: -0.15,
    steer: 0,
    overhangAngleDeg: 118,
    overhangWidth: 17,
    lipSharpness: 0.28,
    smoothing: 1,
    wallSmoothness: 0.18,
    flatContribution: 0.35,
  })),
  breakingWide: summarizeTopFootprintRoundness(lipDipSweepModels[118]),
}
const outerRadiusSmoothness = {
  default: summarizeOuterRadiusSmoothness(buildInverseSheetModel()),
  compactUser: summarizeOuterRadiusSmoothness(buildInverseSheetModel({
    rows: 24,
    columns: 24,
    height: 8,
    horizontalOffset: 9,
    overhangPosition: -0.15,
    steer: 0,
    overhangAngleDeg: 118,
    overhangWidth: 17,
    lipSharpness: 0.28,
    smoothing: 1,
    wallSmoothness: 0.18,
    flatContribution: 0.35,
  })),
  breakingWide: summarizeOuterRadiusSmoothness(lipDipSweepModels[118]),
}
const bowlPocketCheck = {
  default: summarizeBowlPockets(buildInverseSheetModel()),
  compactUser: summarizeBowlPockets(buildInverseSheetModel({
    rows: 24,
    columns: 24,
    height: 8,
    horizontalOffset: 9,
    overhangPosition: -0.15,
    steer: 0,
    overhangAngleDeg: 118,
    overhangWidth: 17,
    lipSharpness: 0.28,
    smoothing: 1,
    wallSmoothness: 0.18,
    flatContribution: 0.35,
  })),
  breakingWide: summarizeBowlPockets(lipDipSweepModels[118]),
}
const resolutionInvariant = {
  grid24Residual: summarizeCenterlineProfileResidual(buildInverseSheetModel({ ...generatedMode, rows: 24, columns: 24, overhangWidth: 32 }), buildInverseSheetModel({ ...generatedMode, rows: 44, columns: 44, overhangWidth: 32 })),
  grid72Residual: summarizeCenterlineProfileResidual(buildInverseSheetModel({ ...generatedMode, rows: 72, columns: 72, overhangWidth: 32 }), buildInverseSheetModel({ ...generatedMode, rows: 44, columns: 44, overhangWidth: 32 })),
  grid24CoreResidual: round(summarizeCenterlineRegionResidual(
    buildInverseSheetModel({ ...generatedMode, rows: 24, columns: 24, overhangWidth: 32 }),
    buildInverseSheetModel({ ...generatedMode, rows: 44, columns: 44, overhangWidth: 32 }),
    0,
    0.94,
  )),
  grid72CoreResidual: round(summarizeCenterlineRegionResidual(
    buildInverseSheetModel({ ...generatedMode, rows: 72, columns: 72, overhangWidth: 32 }),
    buildInverseSheetModel({ ...generatedMode, rows: 44, columns: 44, overhangWidth: 32 }),
    0,
    0.94,
  )),
}
const displayInvariant = summarizeGeometryMatch(
  buildInverseSheetModel({ showHeatmap: false, colorMode: 'edgeStrain' }),
  buildInverseSheetModel({ showHeatmap: true, colorMode: 'displacement' }),
)
const sideOverhangAspect = {
  userMorphHalfLip120: summarizeSideOverhangAspect(userSideAspectModel),
  startupDefault: summarizeSideOverhangAspect(buildInverseSheetModel()),
}
const defaultReferenceTraceFit = summarizeReferenceTraceFit(buildInverseSheetModel())
const generatedMoanaSideGate = (
  sideOverhangAspect.userMorphHalfLip120.aspectRatio >= 1.45 &&
  sideOverhangAspect.userMorphHalfLip120.aspectRatio <= 2.85 &&
  sideOverhangAspect.userMorphHalfLip120.overhangToHeight >= 0.72 &&
  sideOverhangAspect.userMorphHalfLip120.overhangToHeight <= 1.35 &&
  sideOverhangAspect.startupDefault.aspectRatio >= 1.35 &&
  sideOverhangAspect.startupDefault.aspectRatio <= 2.65 &&
  sideOverhangAspect.startupDefault.overhangToHeight >= 0.72 &&
  sideOverhangAspect.startupDefault.overhangToHeight <= 1.35 &&
  defaultReferenceTraceFit.maxResidual <= 0.38 &&
  defaultReferenceTraceFit.rmsResidual <= 0.18 &&
  defaultReferenceTraceFit.selfIntersections === 0 &&
  defaultReferenceTraceFit.terminalDropRatio >= 0.8
)
const sliderRobustness = summarizeSliderRobustness()

if (!(flatContributionPair.heightResidual <= 0.03 &&
  flatContributionPair.overhangResidual <= 0.03 &&
  flatContributionPair.centerlineResidual <= DEFAULT_SHEET_SPACING * 0.95 &&
  flatContributionPair.highApron > flatContributionPair.lowApron + 0.015 &&
  flat1.activeMaxAbs <= flat0.activeMaxAbs * 1.02 &&
  flat1.maxTensileStrain <= flat0.maxTensileStrain * 1.02)) {
  failures.push('flat contribution should preserve the main wave while adding a broader support apron')
}

if (!(lipSharpnessPair.preTerminalResidual <= 0.7 && lipSharpnessPair.terminalResidual >= 0.3)) {
  failures.push('lip sharpness should change the terminal lip strongly without materially changing the broad wave body')
}

if (Math.abs(bluntLipModel.summary.overhangAmount - sharpLipModel.summary.overhangAmount) / Math.max(bluntLipModel.summary.overhangAmount, 0.000001) > 0.12) {
  failures.push('lip sharpness should control tip shape without materially changing total overhang reach')
}

if (!(roundWalls.centerWidth >= sharpWalls.centerWidth &&
  roundWalls.endToCenterWidthRatio <= 0.72)) {
  failures.push('wall smoothness 1 should round the active footprint without making a side wall')
}

if (wallSmoothnessExtreme.mechanism.maxArmSurfaceLeak > 4.25 || wallSmoothnessExtreme.maxTensileStrain > 6.3) {
  failures.push('wall smoothness 1 should not create off-surface spikes in the high wall-smoothness case')
}

if (lipSharpnessExtreme.mechanism.maxArmSurfaceLeak > 4 || lipSharpnessExtreme.maxTensileStrain > 6.3) {
  failures.push('lip sharpness 1 should stay bounded and not overlap in the high-sharpness case')
}

if (!(lipDipSweep[118].dropRatio >= 0.24 &&
  lipDipSweep[118].tipForwardOfCrest &&
  (lipDipSweep[118].hookTuckedUnderShoulder || lipDipSweep[118].openDownturnedLip) &&
  (lipDipSweep[120].hookTuckedUnderShoulder || lipDipSweep[120].openDownturnedLip) &&
  lipDipSweep[118].terminalFaceHasRun &&
  lipDipSweep[120].terminalFaceHasRun &&
  lipDipSweep[118].returnToFlat &&
  lipDipSweep[118].smoothTerminalReturn &&
  lipDipSweep[118].noBackfoldCavity &&
  lipDipSweep[118].noVisibleDimplePocket &&
  lipDipSweep[120].noVisibleDimplePocket &&
  lipDipSweep[118].openThroatVisible &&
  lipDipSweep[120].openThroatVisible &&
  lipDipSweep[118].tipForwardDistance >= breakingLipConfig.horizontalOffset * 0.055 &&
  lipDipSweep[118].tipDrop >= breakingLipConfig.height * 0.22 &&
  lipDipSweep[118].finalTangentAngleDeg <= -35 &&
  !lipDipSweep[105].openThroatVisible &&
  lipDipSweep[120].hookTuckDistance >= lipDipSweep[105].hookTuckDistance + DEFAULT_SHEET_SPACING * 3)) {
  failures.push('lip dip should create a forward shoulder, tucked downturned nose, smooth return, and no visible dimple/bowl pocket/collapsed cavity')
}

if (lipDipPreTerminalResidual < 0.5) {
  failures.push('lip dip should visibly reshape the full side profile into a curled tapered cone')
}

if (!(userLipDipCase.tipBelowLastPeak && (userLipDipCase.openDownturnedLip || userLipDipCase.hookTuckedUnderShoulder) && userLipDipCase.terminalFaceHasRun && userLipDipCase.finalTangentAngleDeg <= -40 && userLipDipCase.noVisibleDimplePocket && userLipDipCase.openThroatVisible)) {
  failures.push('lip dip above 90 deg should make the terminal free tip point downward without a visible dimple pocket')
}

if (!(positionField.back.restGridFixed && positionField.front.restGridFixed &&
  positionField.back.boundaryFlat && positionField.front.boundaryFlat &&
  positionField.back.shapePreserved && positionField.front.shapePreserved &&
  Math.abs(positionField.back.centroidShiftX - positionField.back.expectedShiftX) < 0.85 &&
  Math.abs(positionField.front.centroidShiftX - positionField.front.expectedShiftX) < 0.85)) {
  failures.push('overhang position should move the deformation field inside a fixed square sheet')
}

if (!(steerField.left.restGridFixed && steerField.right.restGridFixed &&
  steerField.left.boundaryFlat && steerField.right.boundaryFlat &&
  steerField.left.shapePreserved && steerField.right.shapePreserved &&
  steerField.left.centroidShiftY < -0.6 && steerField.right.centroidShiftY > 0.6)) {
  failures.push('steer should rotate the deformation field inside a fixed square sheet')
}

if (widthInvariant.narrowToWideCenterlineResidual > 0.05) {
  failures.push('width should only change y/span, not the x-z centerline')
}

if (!Object.values(lateralSmoothness).every(lateralSmoothnessPasses)) {
  failures.push('span taper should stay smooth without side walls, divots, or lateral zigzags')
}

if (!Object.values(conicalSpanTaper).every(conicalSpanTaperPasses)) {
  failures.push('max lip dip should read as an inverted-cone taper with a curled tip, not a broad side wall')
}

if (
  !topFootprintRoundnessPasses(topFootprintRoundness.default) ||
  !topFootprintRoundnessPasses(topFootprintRoundness.compactUser) ||
  !generatedTopFootprintRoundnessPasses(topFootprintRoundness.breakingWide)
) {
  failures.push('top view should keep a rounded footprint instead of collapsing into a big triangular fan')
}

if (!Object.values(bowlPocketCheck).every((summary) => summary.bowlPocketCount === 0)) {
  failures.push('curled cone surface should not contain bowl-like local minima')
}

if (!Object.values(outerRadiusSmoothness).every((summary) => (
  summary.maxTopCurvatureRatio <= (summary.topPointCount <= 5 ? 0.32 : 0.26) &&
  summary.maxTopAngleJumpDeg <= (summary.topPointCount <= 5 ? 60 : summary.topPointCount <= 8 ? 38 : 58) &&
  summary.hasSingleCrest
))) {
  failures.push('outer crest should stay a continuous round radius without top dents')
}

if (resolutionInvariant.grid24CoreResidual > 3.25 || resolutionInvariant.grid72CoreResidual > 1.05) {
  failures.push('rows and columns should only resample the same physical overhang')
}

if (displayInvariant.maxResidual > 0.000001 || displayInvariant.maxMetricResidual > 0.000001) {
  failures.push('display modes should only affect colors/materials')
}

if (!generatedMoanaSideGate) {
  failures.push('side-view terminal geometry should read as a custom Moana-wave body with a low downturned lip, curved interior, and no cave wall or horizontal tongue')
}

if (!sliderRobustness.ok) {
  failures.push('slider sweeps should stay finite, boundary-pinned, and free of sudden range-clamp jumps')
}

if (!lowLipDipStability.ok) {
  failures.push('low lip dip values should stay neutral/stable without partial-curl mangling')
}

if (!startupUrlParamCoverage.ok) {
  failures.push(`startup URL state should cover every public inverse-sheet slider alias: missing ${startupUrlParamCoverage.missing.join(', ')}`)
}

if (!startupDisplayContract.ok) {
  failures.push(`startup display contract should default to surface plus connected X mechanism with URL gates for cells/connectors: ${startupDisplayContract.failures.join('; ')}`)
}

if (!readableSurfaceRenderContract.ok) {
  failures.push(`readable surface renderer should keep top-view square-sheet projection separate from side/isometric views: ${readableSurfaceRenderContract.failures.join('; ')}`)
}

if (mechanism.maxConnectorEndpointGap > 0.0001) {
  failures.push('inverse-sheet arms should terminate directly at shared connector points')
}

if (mechanism.maxExpectedArmCountResidual !== 0 || mechanism.minInteriorConnectedArmCount !== 4) {
  failures.push('every inverse-sheet cell should have all expected connected legs, with interior cells connected to four legs')
}

if (
  xRenderDirectLines.renderedXSegmentCount !== xRenderDirectLines.expectedInteriorXSegmentCount ||
  xRenderDirectLines.renderedSharedJointArmCount !== xRenderDirectLines.expectedSharedJointArmCount ||
  xRenderDirectLines.renderedCenterPivotCount !== xRenderDirectLines.expectedNodeCount ||
  xRenderDirectLines.renderedJointCount !== xRenderDirectLines.expectedDiagonalConnectorCount ||
  xRenderDirectLines.minInteriorConnectedPairCount < 2 ||
  xMechanism.maxConnectorEndpointGap > 0.0001 ||
  xMechanism.minSharedConnectorUseCount !== 2 ||
  xMechanism.maxSharedConnectorUseCount !== 2 ||
  xMechanism.minPhysicalConnectorUseCount !== 2 ||
  xMechanism.maxPhysicalConnectorUseCount !== 2 ||
  xMechanism.overOccupiedPhysicalConnectorCount !== 0 ||
  !xRenderDirectLines.sourceUsesPhysicalConnectorSplit ||
  !xRenderDirectLines.sourceUsesCenterPivotJoints ||
  !xRenderDirectLines.sourceUsesSharedConnectorArms ||
  !xRenderDirectLines.sourceUsesSharedConnectorJoints ||
  !xRenderDirectLines.sourceUsesSharedConnectorRods ||
  !xRenderDirectLines.sourceUsesStraightLineSegments ||
  !xRenderDirectLines.sourceUsesConnectedXMechanism
) {
  failures.push('visible mechanism should render connected straight X cells, center pivot joints, and shared connector joints between adjacent X cells')
}

if (xMechanism.maxOppositePairLengthSpread > 0.0001) {
  failures.push('each straight X line should be bisected by its cell center; the two different X diagonals do not need equal total length')
}

if (xMechanism.maxOppositeColinearErrorDeg > 0.01 || xMechanism.maxOppositeCenterResidual > 0.0001) {
  failures.push('each straight X line should stay collinear through the cell center')
}

if (xMechanism.maxCenterSurfaceResidual > 1.15) {
  failures.push('connected X-cell display centers should stay close to the sampled wave surface instead of becoming a detached fake mechanism')
}

if (mechanism.maxArmSurfaceLeak > 3.6) {
  failures.push('equal-arm connector surface residual should stay bounded')
}

if (mechanism.maxCenterShift > 2.25) {
  failures.push('global connector assignment should not solve contact by drifting cell centers off the sampled surface')
}

const report = {
  startupUrlParamCoverage,
  startupDisplayContract,
  readableSurfaceRenderContract,
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
    maxCellOppositePairLengthSpread: round(mechanism.maxCellOppositePairLengthSpread),
    maxCellOppositeColinearErrorDeg: round(mechanism.maxCellOppositeColinearErrorDeg),
    maxCellOppositeCenterResidual: round(mechanism.maxCellOppositeCenterResidual),
    checkedCellOppositePairCount: mechanism.checkedCellOppositePairCount,
    maxOrthogonalityErrorDeg: round(mechanism.maxOrthogonalityErrorDeg),
    maxConnectorPathBendDeg: round(mechanism.maxConnectorPathBendDeg),
    maxExpectedArmCountResidual: round(mechanism.maxExpectedArmCountResidual),
    minInteriorConnectedArmCount: mechanism.minInteriorConnectedArmCount,
    maxConnectorEndpointGap: round(mechanism.maxConnectorEndpointGap),
    meanConnectorEndpointGap: round(mechanism.meanConnectorEndpointGap),
    rmsConnectorEndpointGap: round(mechanism.rmsConnectorEndpointGap),
    maxArmSurfaceLeak: round(mechanism.maxArmSurfaceLeak),
    maxCenterShift: round(mechanism.maxCenterShift),
  },
  xMechanism: {
    maxOppositePairLengthSpread: round(xMechanism.maxOppositePairLengthSpread),
    maxOppositeColinearErrorDeg: round(xMechanism.maxOppositeColinearErrorDeg),
    maxOppositeCenterResidual: round(xMechanism.maxOppositeCenterResidual),
    checkedOppositePairCount: xMechanism.checkedOppositePairCount,
    maxConnectorEndpointGap: round(xMechanism.maxConnectorEndpointGap),
    minPhysicalConnectorUseCount: xMechanism.minPhysicalConnectorUseCount,
    maxPhysicalConnectorUseCount: xMechanism.maxPhysicalConnectorUseCount,
    overOccupiedPhysicalConnectorCount: xMechanism.overOccupiedPhysicalConnectorCount,
    physicalConnectorCount: xMechanism.physicalConnectorCount,
    minSharedConnectorUseCount: xMechanism.minSharedConnectorUseCount,
    maxSharedConnectorUseCount: xMechanism.maxSharedConnectorUseCount,
    sharedConnectorCount: xMechanism.sharedConnectorCount,
    maxCenterSurfaceResidual: round(xMechanism.maxCenterSurfaceResidual),
    renderedXSegmentCount: xMechanism.renderedXSegmentCount,
    expectedInteriorXSegmentCount: xRenderDirectLines.expectedInteriorXSegmentCount,
    expectedDiagonalConnectorCount: xMechanism.expectedDiagonalConnectorCount,
    minInteriorConnectedPairCount: xMechanism.minInteriorConnectedPairCount,
  },
  xRenderDirectLines,
  extremeControls: {
    wallSmoothness1: wallSmoothnessExtreme,
    lipSharpness1: lipSharpnessExtreme,
    lipDip90: neutralLipDip,
    lipDip120: highLipDip,
    userLipDip118: userLipDipCase,
  },
  lipDipSweep: {
    ...lipDipSweep,
    preTerminal118Residual: round(lipDipPreTerminalResidual),
  },
  lowLipDipStability,
  overhangPosition: positionField,
  steer: steerField,
  widthInvariant,
  lateralSmoothness,
  conicalSpanTaper,
  topFootprintRoundness,
  bowlPocketCheck,
  outerRadiusSmoothness,
  resolutionInvariant,
  displayInvariant,
  sideOverhangAspect,
  defaultReferenceTraceFit,
  sliderRobustness,
}

console.log(JSON.stringify(report, null, 2))

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
}

function summarizeSliderRobustness() {
  const badCases = []
  const caseSummaries = []
  const caseConfigs = [
    ['startup-default', {}],
    ['compact-default', { rows: 20, columns: 20 }],
    ['dense-default', { rows: 72, columns: 72 }],
    ['max-lip-small-grid', { rows: 20, columns: 20, overhangAngleDeg: 120, height: 10, horizontalOffset: 16, overhangWidth: 20 }],
    ['zero-height', { height: 0 }],
    ['zero-overhang', { horizontalOffset: 0 }],
    ['narrow-width', { overhangWidth: 4 }],
    ['wide-width', { overhangWidth: 40 }],
    ['full-left-position', { overhangPosition: -1 }],
    ['full-right-position', { overhangPosition: 1 }],
    ['full-left-steer', { steer: -1 }],
    ['full-right-steer', { steer: 1 }],
    ['neutral-lip', { overhangAngleDeg: 90 }],
    ['hard-lip', { overhangAngleDeg: 120, lipSharpness: 1 }],
    ['round-walls', { wallSmoothness: 1 }],
    ['full-flat-contribution', { flatContribution: 1 }],
    ['full-ground-transition', { smoothing: 1 }],
  ]
  const sweeps = [
    ['morph', [0, 0.15, 0.3, 0.5, 0.75, 1], (value) => ({ morph: value })],
    ['height', [0, 3, 6, 10, 14.75], (value) => ({ height: value })],
    ['overhang', [0, 4, 8, 12, 16.25], (value) => ({ horizontalOffset: value })],
    ['lipDip', [90, 98, 105, 112, 118, 120], (value) => ({ overhangAngleDeg: value })],
    ['width', [0, 4, 8, 16, 32, 40], (value) => ({ overhangWidth: value })],
    ['lipSharpness', [0, 0.25, 0.5, 0.75, 1], (value) => ({ lipSharpness: value })],
    ['groundTransition', [0, 0.25, 0.5, 0.75, 1], (value) => ({ smoothing: value })],
    ['wallSmoothness', [0, 0.25, 0.5, 0.75, 1], (value) => ({ wallSmoothness: value })],
    ['flatContribution', [0, 0.25, 0.5, 0.75, 1], (value) => ({ flatContribution: value })],
    ['position', [-1, -0.5, 0, 0.5, 1], (value) => ({ overhangPosition: value })],
    ['steer', [-1, -0.5, 0, 0.5, 1], (value) => ({ steer: value })],
    ['resolution', [20, 24, 44, 72], (value) => ({ rows: value, columns: value })],
  ]

  for (const [label, patch] of caseConfigs) {
    const health = summarizeModelHealth(buildInverseSheetModel(patch))
    caseSummaries.push([label, health])
    if (!health.ok) badCases.push(label)
  }

  for (const [name, values, patcher] of sweeps) {
    let previousHealth = null
    for (const value of values) {
      const label = `${name}:${value}`
      const model = buildInverseSheetModel(patcher(value))
      const health = summarizeModelHealth(model)
      if (!health.ok) badCases.push(label)
      const bothActive = previousHealth &&
        previousHealth.maxHeight > 0.001 &&
        health.maxHeight > 0.001
      if (bothActive && Math.abs(health.maxHeight - previousHealth.maxHeight) > 18) badCases.push(`${label}:height-jump`)
      if (bothActive && Math.abs(health.overhangAmount - previousHealth.overhangAmount) > 24) badCases.push(`${label}:overhang-jump`)
      previousHealth = health
    }
  }

  const neutralRange = getInverseSheetUsableRanges({ overhangPosition: 0, overhangAngleDeg: 90 })
  const forwardRange = getInverseSheetUsableRanges({ overhangPosition: 1, overhangAngleDeg: 120 })
  const backwardRange = getInverseSheetUsableRanges({ overhangPosition: -1, overhangAngleDeg: 120 })
  const maxRangeDelta = Math.max(
    Math.abs(neutralRange.horizontalOffsetMax - forwardRange.horizontalOffsetMax),
    Math.abs(neutralRange.horizontalOffsetMax - backwardRange.horizontalOffsetMax),
    Math.abs(neutralRange.heightMax - forwardRange.heightMax),
    Math.abs(neutralRange.heightMax - backwardRange.heightMax),
  )

  if (maxRangeDelta > 0.000001) badCases.push('usable-ranges-change-with-position-or-lipDip')

  return {
    ok: badCases.length === 0,
    checkedCases: caseConfigs.length + sweeps.reduce((sum, [, values]) => sum + values.length, 0),
    badCases,
    maxRangeDelta: round(maxRangeDelta),
    sampleCases: Object.fromEntries(caseSummaries.slice(0, 6)),
  }
}

function summarizeLowLipDipStability() {
  const angles = [90, 95, 98, 100, 105]
  const families = [
    ['startup-morph-half', {
      ...generatedMode,
      rows: 44,
      columns: 96,
      height: 10,
      horizontalOffset: 18,
      overhangWidth: 32,
      smoothing: 1,
      wallSmoothness: 0.35,
      flatContribution: 0.35,
      lipSharpness: 0.28,
      morph: 0.5,
    }],
    ['breaking-preset', breakingLipConfig],
  ]
  const badCases = []
  const cases = {}

  for (const [family, baseConfig] of families) {
    let previous = null

    for (const angle of angles) {
      const label = `${family}:${angle}`
      const model = buildInverseSheetModel({ ...baseConfig, overhangAngleDeg: angle })
      const mechanismStats = rigidCellMechanismStats(model)
      const lateral = summarizeLateralSmoothness(model)
      const outer = summarizeOuterRadiusSmoothness(model)
      const health = summarizeModelHealth(model)
      const summary = {
        maxTensileStrain: round(model.summary.maxTensileStrain),
        maxCompressStrain: round(model.summary.maxCompressiveStrain),
        maxEdgeRotationDeg: round(model.summary.maxEdgeRotationDeg),
        maxHeight: round(model.summary.maxHeight),
        overhangAmount: round(model.summary.overhangAmount),
        maxArmSurfaceLeak: round(mechanismStats.maxArmSurfaceLeak),
        maxCenterShift: round(mechanismStats.maxCenterShift),
        maxConnectorPathBendDeg: round(mechanismStats.maxConnectorPathBendDeg),
        maxConnectorEndpointGap: round(mechanismStats.maxConnectorEndpointGap),
        lateral,
        outer,
      }
      const stable =
        health.ok &&
        boundaryNodesStayFlat(model) &&
        lateralSmoothnessPasses(lateral) &&
        outer.hasSingleCrest &&
        outer.maxTopAngleJumpDeg <= 26 &&
        model.summary.maxTensileStrain <= 6 &&
        Math.abs(model.summary.maxCompressiveStrain) <= 4 &&
        mechanismStats.maxArmSurfaceLeak <= 4.2 &&
        mechanismStats.maxCenterShift <= 2.4 &&
        mechanismStats.maxConnectorEndpointGap <= 0.0001

      if (!stable) badCases.push(label)

      if (previous) {
        const heightJump = Math.abs(model.summary.maxHeight - previous.maxHeight)
        const overhangJump = Math.abs(model.summary.overhangAmount - previous.overhangAmount)
        if (heightJump > 2.2) badCases.push(`${label}:height-jump`)
        if (overhangJump > 4.8) badCases.push(`${label}:overhang-jump`)
      }

      previous = model.summary
      cases[label] = summary
    }
  }

  return {
    ok: badCases.length === 0,
    badCases,
    cases,
  }
}

function summarizeSideOverhangAspect(model) {
  const points = centerlinePoints(model)
  const maxZ = Math.max(...points.map((point) => point.z), 0.000001)
  const activeIndices = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.z > maxZ * 0.18)

  if (activeIndices.length < 2) {
    return {
      spanX: 0,
      spanZ: 0,
      aspectRatio: 0,
      overhangToHeight: 0,
      sampleCount: activeIndices.length,
    }
  }

  const firstIndex = activeIndices[0].index
  const lastIndex = activeIndices[activeIndices.length - 1].index
  const section = points.slice(firstIndex, lastIndex + 1)
  const minX = Math.min(...section.map((point) => point.x))
  const maxX = Math.max(...section.map((point) => point.x))
  const minZ = Math.min(0, ...section.map((point) => point.z))
  const maxSectionZ = Math.max(...section.map((point) => point.z))
  const spanX = maxX - minX
  const spanZ = maxSectionZ - minZ

  return {
    spanX: round(spanX),
    spanZ: round(spanZ),
    aspectRatio: round(spanX / Math.max(spanZ, 0.000001)),
    overhangToHeight: round(model.summary.overhangAmount / Math.max(model.summary.maxHeight, 0.000001)),
    sampleCount: section.length,
  }
}

function summarizeReferenceTraceFit(model) {
  const current = normalizedSideProfileTrace(model)
  const reference = parseReferenceTrace(SOURCE_BREAKING_WAVE_TRACE).map((point) => ({
    x: 1 - point.x,
    z: point.z,
  }))

  if (current.length < 3 || reference.length < 3) {
    return {
      maxResidual: Infinity,
      rmsResidual: Infinity,
      selfIntersections: Infinity,
      terminalDropRatio: 0,
      sampleCount: current.length,
    }
  }

  const samples = 72
  let residualSum = 0
  let maxResidual = 0
  for (let index = 0; index < samples; index += 1) {
    const amount = index / Math.max(samples - 1, 1)
    const a = sampleTraceByLength(current, amount)
    const b = sampleTraceByLength(reference, amount)
    const residual = Math.hypot(a.x - b.x, a.z - b.z)
    residualSum += residual * residual
    maxResidual = Math.max(maxResidual, residual)
  }

  const crestIndex = current.reduce((best, point, index) => point.z > current[best].z ? index : best, 0)
  const terminalPoint = current[current.length - 1]
  const terminalDropRatio = (current[crestIndex].z - terminalPoint.z) / Math.max(current[crestIndex].z, 0.000001)

  return {
    maxResidual: round(maxResidual),
    rmsResidual: round(Math.sqrt(residualSum / samples)),
    selfIntersections: countTraceSelfIntersections(current),
    terminalDropRatio: round(terminalDropRatio),
    sampleCount: current.length,
  }
}

function normalizedSideProfileTrace(model) {
  const points = centerlinePoints(model)
  const maxZ = Math.max(...points.map((point) => point.z), 0.000001)
  const active = points
    .map((point, index) => ({ point, index }))
    .filter(({ point }) => point.z > maxZ * 0.018)
  if (active.length < 3) return []

  const start = Math.max(0, active[0].index - 2)
  const end = Math.min(points.length - 1, active[active.length - 1].index + 1)
  const activeSection = points.slice(start, end + 1)
  const localCrestIndex = activeSection.reduce((best, point, index) => point.z > activeSection[best].z ? index : best, 0)
  const postCrestTipCandidates = activeSection
    .map((point, index) => ({ point, index }))
    .filter(({ point, index }) => index > localCrestIndex && point.z >= maxZ * 0.035)
  const lowTipCandidateIndex = postCrestTipCandidates.findIndex((candidate) =>
    candidate.point.z <= maxZ * 0.08 * 1.25)
  const localTipIndex = lowTipCandidateIndex >= 0
    ? terminalTraceLocalMinimumIndex(
      activeSection,
      postCrestTipCandidates[lowTipCandidateIndex].index,
      maxZ,
    )
    : postCrestTipCandidates.length
      ? postCrestTipCandidates.reduce((best, candidate) => {
      const targetTipZ = maxZ * 0.08
      const distance = Math.abs(candidate.point.z - targetTipZ)
      const bestDistance = Math.abs(best.point.z - targetTipZ)
      if (distance < bestDistance - DEFAULT_SHEET_SPACING * 0.01) return candidate
      if (Math.abs(distance - bestDistance) <= DEFAULT_SHEET_SPACING * 0.01 && candidate.point.x < best.point.x) return candidate
      return best
    }, postCrestTipCandidates[0]).index
      : activeSection.length - 1
  const displaySection = activeSection.slice(0, Math.max(localTipIndex + 1, localCrestIndex + 2))
  const screenPoints = displaySection.map((point) => ({ x: -point.x, z: Math.max(0, point.z) }))
  const minX = Math.min(...screenPoints.map((point) => point.x))
  const maxX = Math.max(...screenPoints.map((point) => point.x))
  const spanX = Math.max(maxX - minX, 0.000001)

  return screenPoints.map((point) => ({
    x: (point.x - minX) / spanX,
    z: point.z / maxZ,
  }))
}

function terminalTraceLocalMinimumIndex(points, firstLowIndex, maxZ) {
  let tipIndex = firstLowIndex

  for (let index = firstLowIndex + 1; index < points.length; index += 1) {
    const point = points[index]
    const tip = points[tipIndex]
    if (
      point.z <= maxZ * 0.025 &&
      Math.abs(point.x - tip.x) >= DEFAULT_SHEET_SPACING * 1.15
    ) break
    if (point.z < tip.z - maxZ * 0.004) {
      tipIndex = index
      continue
    }
    if (point.z > tip.z + maxZ * 0.035) break
    if (point.z > maxZ * 0.18) break
  }

  return tipIndex
}

function parseReferenceTrace(value) {
  return value.split(';').map((chunk) => {
    const [x, z] = chunk.split(',').map(Number)
    return { x, z }
  })
}

function sampleTraceByLength(points, amount) {
  const lengths = [0]
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z)
    lengths[index] = total
  }
  const target = clampNumber(amount, 0, 1) * total
  for (let index = 1; index < points.length; index += 1) {
    if (lengths[index] < target) continue
    const local = (target - lengths[index - 1]) / Math.max(lengths[index] - lengths[index - 1], 0.000001)
    return {
      x: lerpNumber(points[index - 1].x, points[index].x, local),
      z: lerpNumber(points[index - 1].z, points[index].z, local),
    }
  }
  return points[points.length - 1]
}

function countTraceSelfIntersections(points) {
  let intersections = 0
  for (let a = 0; a < points.length - 1; a += 1) {
    for (let b = a + 2; b < points.length - 1; b += 1) {
      if (a === 0 && b === points.length - 2) continue
      if (segmentsIntersect(points[a], points[a + 1], points[b], points[b + 1])) intersections += 1
    }
  }
  return intersections
}

function segmentsIntersect(a, b, c, d) {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const acx = c.x - a.x
  const acz = c.z - a.z
  const adx = d.x - a.x
  const adz = d.z - a.z
  const cdx = d.x - c.x
  const cdz = d.z - c.z
  const cax = a.x - c.x
  const caz = a.z - c.z
  const cbx = b.x - c.x
  const cbz = b.z - c.z
  const o1 = abx * acz - abz * acx
  const o2 = abx * adz - abz * adx
  const o3 = cdx * caz - cdz * cax
  const o4 = cdx * cbz - cdz * cbx
  const epsilon = 0.000001
  return o1 * o2 < -epsilon && o3 * o4 < -epsilon
}

function summarizeModelHealth(model) {
  const finiteNodes = model.nodes.every((node) => (
    isFiniteVec(node.restPosition) &&
    isFiniteVec(node.targetPosition) &&
    isFiniteVec(node.currentPosition)
  ))
  const finiteSummary = Object.values(model.summary).every(Number.isFinite)
  const centerline = centerlinePoints(model)
  let maxSegment = 0
  let maxVerticalStep = 0
  for (let index = 0; index < centerline.length - 1; index += 1) {
    const a = centerline[index]
    const b = centerline[index + 1]
    maxSegment = Math.max(maxSegment, Math.hypot(b.x - a.x, b.z - a.z))
    maxVerticalStep = Math.max(maxVerticalStep, Math.abs(b.z - a.z))
  }
  const segmentLimit = Math.max(14, model.summary.overhangAmount * 0.82, model.summary.maxHeight * 1.75)
  const verticalStepLimit = Math.max(9, model.summary.maxHeight * 0.78)

  return {
    ok: finiteNodes &&
      finiteSummary &&
      boundaryNodesStayFlat(model) &&
      maxSegment <= segmentLimit &&
      maxVerticalStep <= verticalStepLimit,
    maxSegment: round(maxSegment),
    maxVerticalStep: round(maxVerticalStep),
    maxHeight: round(model.summary.maxHeight),
    overhangAmount: round(model.summary.overhangAmount),
  }
}

function summarizeBreakingLip(model) {
  if (model.config.overhangAngleDeg <= 90.000001) {
    return emptyBreakingLipSummary()
  }

  const points = centerlinePoints(model)
  const maxZ = Math.max(...points.map((point) => point.z), 0.000001)
  const maxReach = maxOf(points.map((point) => point.reach))
  const activePoints = points.filter((point) => point.reach >= maxReach * 0.08 || point.z > maxZ * 0.02)

  if (activePoints.length < 3) {
    return emptyBreakingLipSummary()
  }

  const crest = activePoints.reduce((best, point) => {
    if (point.z > best.z + 0.000001) return point
    if (Math.abs(point.z - best.z) <= 0.000001 && point.col < best.col) return point
    return best
  }, activePoints[0])
  const postCrest = activePoints.filter((point) => point.col > crest.col)
  if (!postCrest.length) return emptyBreakingLipSummary()

  const shoulderCandidates = postCrest.filter((point) => point.z >= maxZ * 0.38)
  const shoulderPool = shoulderCandidates.length ? shoulderCandidates : postCrest
  const shoulder = shoulderPool.reduce((best, point) => {
    if (point.x > best.x + 0.000001) return point
    if (Math.abs(point.x - best.x) <= 0.000001 && point.col < best.col) return point
    return best
  }, shoulderPool[0])
  const postShoulder = activePoints.filter((point) => point.col > shoulder.col)
  if (!postShoulder.length) return emptyBreakingLipSummary()

  const shoulderReach = shoulder.x - crest.x
  const allowedTipTuck = Math.max(
    model.config.spacing * 0.4,
    shoulderReach * 3.6,
    maxZ * 0.52,
  )
  const hookCandidates = postShoulder.filter((point) => (
    point.z >= maxZ * 0.055 &&
    point.z <= shoulder.z - maxZ * 0.08 &&
    point.x >= shoulder.x - allowedTipTuck
  ))
  const targetTipZ = maxZ * 0.08
  const tipPool = hookCandidates.length ? hookCandidates : postShoulder
  const firstLowTipIndex = tipPool.findIndex((point) => point.z <= targetTipZ * 1.25)
  const tip = firstLowTipIndex >= 0
    ? terminalTraceLocalMinimum(tipPool, firstLowTipIndex, maxZ)
    : tipPool.reduce((best, point) => {
      const targetDistance = Math.abs(point.z - targetTipZ)
      const bestDistance = Math.abs(best.z - targetTipZ)
      if (targetDistance < bestDistance - 0.000001) return point
      if (Math.abs(targetDistance - bestDistance) <= 0.000001 && point.x < best.x) return point
      return best
    }, tipPool[0])
  const postTip = points.filter((point) => point.col > tip.col)
  const activePostTip = postTip.filter((point) => point.reach >= maxReach * 0.02 || point.z > maxZ * 0.005)
  const forwardFlatReturnCandidates = postTip.filter((point) =>
    point.z <= maxZ * 0.12 &&
    point.x > tip.x + model.config.spacing * 0.85)
  const flatReturnCandidates = forwardFlatReturnCandidates.length
    ? forwardFlatReturnCandidates
    : activePostTip.filter((point) => point.z <= maxZ * 0.12)
  const flatReturn = (flatReturnCandidates.length ? flatReturnCandidates : activePostTip).reduce((best, point) => {
    if (!best) return point
    if (point.x > best.x + 0.000001) return point
    if (Math.abs(point.x - best.x) <= 0.000001 && point.col > best.col) return point
    return best
  }, undefined) ?? postTip[postTip.length - 1] ?? tip
  const tipIndex = points.findIndex((point) => point.col === tip.col)
  const previous = points[Math.max(0, tipIndex - 1)]
  const next = points[Math.min(points.length - 1, tipIndex + 1)]
  const tipDx = tip.x - previous.x
  const shoulderToTipDx = tip.x - shoulder.x
  const shoulderToTipDz = tip.z - shoulder.z
  let tipSlope = Math.min(
    (tip.z - previous.z) / Math.max(Math.abs(tipDx), 0.000001),
    (next.z - tip.z) / Math.max(Math.abs(next.x - tip.x), 0.000001),
    shoulderToTipDz / Math.max(Math.abs(shoulderToTipDx), 0.000001),
  )
  let finalTangentAngleDeg = Math.min(
    Math.atan2(tip.z - previous.z, Math.abs(tipDx)) * 180 / Math.PI,
    Math.atan2(next.z - tip.z, Math.abs(next.x - tip.x)) * 180 / Math.PI,
    Math.atan2(shoulderToTipDz, Math.abs(shoulderToTipDx)) * 180 / Math.PI,
  )
  const crestIndex = points.findIndex((point) => point.col === crest.col)
  const returnIndex = points.findIndex((point) => point.col === flatReturn.col)
  const curlPath = points.slice(Math.max(0, crestIndex), Math.max(returnIndex + 1, tipIndex + 1, crestIndex + 2))
  let maxTerminalSegmentDrop = 0
  for (let index = 0; index < curlPath.length - 1; index += 1) {
    const a = curlPath[index]
    const b = curlPath[index + 1]
    maxTerminalSegmentDrop = Math.max(maxTerminalSegmentDrop, Math.max(0, a.z - b.z))
    if (b.x < crest.x) continue
    const dx = b.x - a.x
    const dz = b.z - a.z
    const slope = dz / Math.max(Math.abs(dx), 0.000001)
    const angle = Math.atan2(dz, Math.abs(dx)) * 180 / Math.PI
    tipSlope = Math.min(tipSlope, slope)
    finalTangentAngleDeg = Math.min(finalTangentAngleDeg, angle)
  }
  const dropRatio = clampNumber((crest.z - tip.z) / maxZ, 0, 1)
  const tipDrop = crest.z - tip.z
  const tipForwardDistance = shoulder.x - crest.x
  const hookTuckDistance = shoulder.x - tip.x
  const returnForwardDistance = flatReturn.x - tip.x
  const returnPath = points.slice(tipIndex, Math.max(points.findIndex((point) => point.col === flatReturn.col) + 1, tipIndex + 1))
  const innerThroatCandidates = returnPath
    .filter((point) => point.z >= maxZ * 0.035)
    .map((point) => point.x)
  const innerThroatX = innerThroatCandidates.length ? Math.min(...innerThroatCandidates) : tip.x
  const openThroatHeight = tip.z - flatReturn.z
  const innerThroatBackfold = tip.x - innerThroatX
  const noBackfoldCavity = centerlineBackfoldRatio(curlPath) <= 0.72
  const tuckRatio = hookTuckDistance / Math.max(tipForwardDistance, model.config.spacing)
  const returnRatio = returnForwardDistance / Math.max(tipForwardDistance, model.config.spacing)
  const openDownturnedLip = hookTuckDistance <= Math.max(model.config.spacing * 1.8, tipForwardDistance * 0.14)
  const hookTuckedUnderShoulder = hookTuckDistance > model.config.spacing * 0.2 &&
    tip.z <= shoulder.z - maxZ * 0.08
  const terminalFaceRun = Math.abs(tip.x - shoulder.x)
  const terminalFaceDrop = Math.max(shoulder.z - tip.z, model.config.spacing)
  const terminalFaceHasRun = terminalFaceRun >= model.config.spacing * 1.2 &&
    terminalFaceRun / terminalFaceDrop >= 0.13
  const returnToFlat = flatReturn !== tip &&
    flatReturn.z <= maxZ * 0.14 &&
    returnForwardDistance > model.config.spacing * 0.85
  const broadOpenCurl = hookTuckedUnderShoulder &&
    tuckRatio >= 0.1 &&
    tuckRatio <= 8.6 &&
    noBackfoldCavity &&
    (
      hookTuckDistance <= Math.max(maxZ * 0.72, returnForwardDistance * 0.3) ||
      (
        terminalFaceHasRun &&
        innerThroatBackfold <= maxZ * 0.24 &&
        returnForwardDistance >= maxZ * 1.8
      )
    )
  const noVisibleDimplePocket = (openDownturnedLip || broadOpenCurl || (
    hookTuckedUnderShoulder &&
    tuckRatio >= 0.1 &&
    tuckRatio <= 1.45
  )) &&
    returnRatio >= 0.1 &&
    flatReturn.x > tip.x + model.config.spacing * 0.85 &&
    flatReturn.z <= maxZ * 0.16
  const raisedOpenThroatVisible = openThroatHeight >= maxZ * 0.075 &&
    tip.z >= maxZ * 0.055 &&
    tip.z <= maxZ * 0.78 &&
    hookTuckDistance >= model.config.spacing * 1.2
  const lowPointedTipVisible = tip.z >= maxZ * 0.01 &&
    tip.z <= maxZ * 0.14 &&
    terminalFaceHasRun &&
    returnToFlat &&
    noVisibleDimplePocket &&
    finalTangentAngleDeg <= -70
  const openThroatVisible = raisedOpenThroatVisible || lowPointedTipVisible

  return {
    tipBelowLastPeak: dropRatio >= 0.08,
    tipForwardOfCrest: tipForwardDistance > model.config.spacing * 0.25,
    hookTuckedUnderShoulder,
    openDownturnedLip,
    terminalFaceHasRun,
    returnToFlat,
    smoothTerminalReturn: maxTerminalSegmentDrop <= maxZ * 0.48,
    noBackfoldCavity,
    noVisibleDimplePocket,
    openThroatVisible,
    tipDx: round(tipDx),
    tipSlope: round(tipSlope),
    dropRatio: round(dropRatio),
    tipDrop: round(tipDrop),
    tipForwardDistance: round(tipForwardDistance),
    hookTuckDistance: round(hookTuckDistance),
    openThroatHeight: round(openThroatHeight),
    innerThroatBackfold: round(innerThroatBackfold),
    terminalFaceRun: round(terminalFaceRun),
    tuckRatio: round(tuckRatio),
    returnRatio: round(returnRatio),
    finalTangentAngleDeg: round(finalTangentAngleDeg),
    crestX: round(crest.x),
    crestZ: round(crest.z),
    shoulderX: round(shoulder.x),
    shoulderZ: round(shoulder.z),
    tipX: round(tip.x),
    tipZ: round(tip.z),
    returnX: round(flatReturn.x),
    returnZ: round(flatReturn.z),
    returnForwardDistance: round(returnForwardDistance),
  }
}

function terminalTraceLocalMinimum(points, firstLowIndex, maxZ) {
  return points[terminalTraceLocalMinimumIndex(points, firstLowIndex, maxZ)]
}

function emptyBreakingLipSummary() {
  return {
    tipBelowLastPeak: false,
    tipForwardOfCrest: false,
    hookTuckedUnderShoulder: false,
    openDownturnedLip: false,
    terminalFaceHasRun: false,
    returnToFlat: false,
    smoothTerminalReturn: false,
    noBackfoldCavity: true,
    noVisibleDimplePocket: true,
    openThroatVisible: false,
    tipDx: 0,
    tipSlope: 0,
    dropRatio: 0,
    tipDrop: 0,
    tipForwardDistance: 0,
    hookTuckDistance: 0,
    openThroatHeight: 0,
    innerThroatBackfold: 0,
    terminalFaceRun: 0,
    tuckRatio: 0,
    returnRatio: 0,
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

function summarizeStartupUrlParamCoverage() {
  const requiredAliases = [
    'rows',
    'cols',
    'columns',
    'morph',
    'position',
    'overhangPosition',
    'steer',
    'steerYaw',
    'profileScale',
    'scale',
    'height',
    'horizontalOffset',
    'overhang',
    'width',
    'overhangWidth',
    'lipDip',
    'overhangAngleDeg',
    'lipSharpness',
    'groundTransition',
    'smoothing',
    'wallSmoothness',
    'flatContribution',
    'conicRho',
    'curlRadius',
  ]
  const missing = requiredAliases.filter((alias) => !inverseSheetTabSource.includes(`'${alias}'`))

  return {
    ok: missing.length === 0,
    checked: requiredAliases.length,
    missing,
  }
}

function summarizeStartupDisplayContract() {
  const expectedDefaults = {
    showSurface: true,
    showRestGhost: false,
    showNodes: false,
    showEdges: true,
    showHeatmap: false,
  }
  const urlAliases = [
    ['showSurface', 'showSurface'],
    ['surface', 'showSurface'],
    ['showRestGhost', 'showRestGhost'],
    ['flatGrid', 'showRestGhost'],
    ['showNodes', 'showNodes'],
    ['cells', 'showNodes'],
    ['showEdges', 'showEdges'],
    ['connectors', 'showEdges'],
  ]
  const defaultMismatches = Object.entries(expectedDefaults).filter(([key, expected]) => DEFAULT_INVERSE_SHEET_CONFIG[key] !== expected)
  const missingUrlGates = urlAliases.filter(([param, key]) => (
    !inverseSheetTabSource.includes(`readBooleanConfigParam(search, config, '${param}', '${key}')`)
  ))
  const expectedVisibleLabels = [
    ['cell centers', "if (key === 'showNodes') return 'cell centers'"],
    ['X links', "return 'X links'"],
  ]
  const missingVisibleLabels = expectedVisibleLabels.filter(([, fragment]) => !targetShapeControlsSource.includes(fragment))
  const failures = [
    ...defaultMismatches.map(([key, expected]) => `${key} default is ${JSON.stringify(DEFAULT_INVERSE_SHEET_CONFIG[key])}, expected ${JSON.stringify(expected)}`),
    ...missingUrlGates.map(([param, key]) => `${param}->${key} URL gate missing`),
    ...missingVisibleLabels.map(([label]) => `${label} visible display label missing`),
  ]

  return {
    ok: failures.length === 0,
    defaults: Object.fromEntries(Object.keys(expectedDefaults).map((key) => [key, DEFAULT_INVERSE_SHEET_CONFIG[key]])),
    checkedDefaults: Object.keys(expectedDefaults),
    checkedUrlGates: urlAliases.length,
    checkedVisibleLabels: expectedVisibleLabels.length,
    missingUrlGates,
    missingVisibleLabels,
    failures,
  }
}

function summarizeReadableSurfaceRenderContract() {
  const frontProjectionStart = latticeViewerSource.indexOf('function readableWaveFrontPoint')
  const frontProjectionEnd = latticeViewerSource.indexOf('function readableWaveTopPlanPoint')
  const frontProjectionSource = frontProjectionStart >= 0 && frontProjectionEnd > frontProjectionStart
    ? latticeViewerSource.slice(frontProjectionStart, frontProjectionEnd)
    : ''
  const requiredFragments = [
    ['component passes active view', '<ReadableWaveSurface model={model} view={view} />'],
    ['surface geometry is keyed by view', 'buildReadableWaveSurfaceGeometry(model, view)'],
    ['geometry builder accepts view', "function buildReadableWaveSurfaceGeometry(model: LatticeModel, view: CameraViewRequest['view'])"],
    ['top view keeps its own display projection', "function readableWaveTopPlanPoint(frame: ReadableWaveFrame, t: number, s: number): Vec3"],
    ['front view keeps its own display projection', "function readableWaveFrontPoint(frame: ReadableWaveFrame, t: number, s: number): Vec3"],
    ['top view branches before side/isometric fallback', "if (view === 'top') return readableWaveTopPlanPoint(frame, t, s)"],
    ['front view branches before side/isometric fallback', "if (view === 'front') return readableWaveFrontPoint(frame, t, s)"],
    ['top view uses the plan point', 'return readableWaveTopPlanPoint(frame, t, s)'],
    ['front view uses the front point', 'return readableWaveFrontPoint(frame, t, s)'],
    ['isometric view keeps a bounded 3D-only lip opening transform', "if (view === 'isometric') return readableWaveIsometricPoint(frame, t, s)"],
    ['side view keeps a bounded side-display open-throat projection', "if (view === 'side') return readableWaveSidePoint(frame, t, s)"],
    ['side-display projection is explicit rather than a profile-only debug view', "function readableWaveSidePoint(frame: ReadableWaveFrame, t: number, s: number): Vec3"],
    ['front camera fits the front readable projection', "activeReadableWaveBounds(model, 'front')"],
    ['readable bounds sample the display projection', 'readableWaveDisplayPoint(frame, view, t'],
    ['readable reference X-only views use readable display bounds', 'const readableReferenceBounds = !selected && readableWaveReferenceDisplay(model) && (model.config.showSurface || model.config.showEdges)'],
    ['readable reference camera bounds stay view-specific', 'activeReadableWaveBounds(model, view)'],
    ['front view keeps dense but pale lengthwise wire density', "view === 'front' ? 2"],
    ['front view keeps dense but pale spanwise wire density', "view === 'front' ? 4"],
    ['front view keeps a softened outline trace', "view === 'front' ? 0.1"],
    ['front view depth-tests the grid against the readable lip', 'depthTest depthWrite={false}'],
    ['side surface writes depth so hidden backside grid lines do not fake the throat', "depthWrite={view === 'side'}"],
    ['front outline avoids a heavy terminal contour stack', '[0.58, 0.72, 0.86, 0.94]'],
    ['side view keeps a lighter continuous surface skin', "view === 'side' ? 0.2"],
    ['side view keeps a readable pale wire grid without darkening the throat into a cavity', "view === 'side' ? 0.22"],
    ['top surface keeps enough skin for the plan footprint to read without hiding the X array', "view === 'top' ? 0.22 : 0.36"],
    ['isometric surface uses a soft-lit real material rather than a fake throat patch', "view === 'isometric' ? ("],
    ['isometric soft-lit material stays pale enough to preserve the grid and throat', 'emissiveIntensity={0.82} roughness={1} metalness={0}'],
    ['top wire grid stays strong enough to carry the cross-section footprint without returning to a dark tunnel', "view === 'top' ? 0.48 : 0.16"],
    ['top wire grid uses a slightly darker reference-sheet ink instead of relying on a helper contour', "const wireColor = view === 'top' ? '#9d968d' : '#b8b3ab'"],
    ['isometric span lines stay thinned after the throat-knot branch', "view === 'top' ? 1 : view === 'side' ? 6 : view === 'front' ? 2 : 3"],
    ['isometric profile lines stay thinned after the throat-knot branch', "view === 'top' ? 3 : view === 'side' ? 5 : view === 'front' ? 4 : 4"],
    ['side wire rows are thinned so the throat does not become a dark tunnel cluster', "view === 'side' ? 6"],
    ['side projected throat profile lines stay omitted so the throat does not read as a support wall', "if (view === 'side' && t > 0.61 && t < 0.87) continue"],
    ['side view keeps only the outer contour as its extra side outline', "if (view === 'side') {\n    pushPolyline(sampleOuterSideProfileLine(frame, samples))\n  } else if (view === 'front')"],
    ['side throat helper stays faint enough not to draw a separate cavity outline', 'opacity={0.02} depthTest={false} depthWrite={false}'],
    ['isometric full X bars stay subordinate to the smooth readable surface', 'opacity={readableSurfaceMode ? 0.018 : 0.18}'],
    ['side full X bars stay subordinate to the smooth readable throat', 'opacity={readableSurfaceMode ? 0.018 : 0.17}'],
    ['surface shared X arms stay visible enough to read endpoint-to-endpoint cell linkage without making top a stripe', '? scope.topView ? 0.032 : scope.sideView ? 0.09 : 0.084'],
    ['surface shared X rods stay visible without turning the curl or top terminal into a black cavity', '? scope.topView ? 0.012 : scope.sideView ? 0.078 : 0.074'],
    ['surface shared X joint pins stay visible as shared endpoints between adjacent X cells without forming a top wall', '? scope.topView ? 0.24 : scope.sideView ? 0.74 : 0.7'],
    ['top surface shared joint halos stay visible without becoming the X-only proof layer', 'opacity={readableSurfaceMode ? (scope.topView ? 0.1 : scope.sideView ? 0.58 : 0.54) : scope.topView ? 0.76 : scope.sideView ? 0.62 : 0.58}'],
    ['side outline stays visible through the curl', "depthTest={view !== 'side'}"],
    ['side projection preserves the accepted raw curl profile after wall-branch rejection', 'const point = readableWavePoint(frame, t, s)\n\n  return point'],
    ['readable reference span stays narrower than the earlier thick cap branch', 'const visualHalfSpan = waveWidth * 0.31'],
    ['terminal lip lift stays localized with the accepted narrower-hook lateral spread', 'const terminalLipEnvelope = lerpNumber(Math.pow(envelope, 1.22), Math.pow(envelope, 7.2), terminalLocalization * 0.92)'],
    ['off-center spans stay localized enough to avoid a full-width tube while preserving the sheet read', 'const lateralCurlBlend = curlBlend * Math.pow(envelope, 1.45)'],
    ['off-center curl relief stays reduced so the side throat stays open', 'const offCenterCurlRelief = smoothStep(0.36, 0.92, t) * frame.progress * (1 - Math.pow(envelope, 0.32)) * 0.75'],
    ['readable reference lateral envelope broadens the curl without becoming a full-width tube', 'return Math.pow(Math.cos(absolute * Math.PI * 0.5), 2.18)'],
    ['terminal curl pinch stays below the knot-forming branch', 'Math.min(0.66, frame.progress * pinchEnvelope * (0.04 * curlShoulder + 0.54 * lipTip))'],
    ['top projection broadens the readable footprint before the terminal edge', 'const bodyPush = waveWidth * ('],
    ['top projection keeps the plan sheet extension small enough to avoid a terminal wall', 'const planMaxX = frame.maxX + waveWidth * 0.1'],
    ['top projection keeps the rounded lobe inside the original sheet width', 'const baseX = lerpNumber(frame.minX, frame.maxX, t)'],
    ['top projection uses one shoulder lobe rather than stacked terminal bands', 'const shoulderLobe = Math.exp(-Math.pow((t - 0.58) / 0.3, 2)) * (1 - smoothStep(0.9, 1, t))'],
    ['top projection rounds the terminal nose before the square sheet edge', 'const terminalNose = Math.exp(-Math.pow((t - 0.78) / 0.2, 2)) * (1 - smoothStep(0.94, 1, t))'],
    ['top projection uses the shoulder lobe as the readable top footprint instead of a pointed terminal nose', 'const teardropLobe = shoulderLobe * Math.pow(envelope, 1.16)'],
    ['top projection adds a center-led terminal nose instead of an off-center wall', 'const terminalCenterNose = terminalNose * Math.pow(envelope, 0.92) * smoothStep(0.68, 0.9, t)'],
    ['top projection adds an off-center rounded terminal shoulder instead of a vertical seam', 'const terminalRound = terminalNose * Math.pow(envelope, 0.58) * (1 - Math.pow(envelope, 1.75))'],
    ['top projection rounds the terminal shoulders without making a full-height side bulge', 'const shoulderRound = shoulderLobe * Math.pow(envelope, 0.54) * (1 - Math.pow(envelope, 2.1))'],
    ['top projection returns the lobe before it becomes the outer right boundary', 'const edgeReturn = smoothStep(0.78, 0.98, t)'],
    ['top projection adds a mid-height oval cross-section shoulder from the June 28 reference row', 'const midSectionShoulder = midSectionOval * (1 - Math.pow(envelope, 1.62)) * (1 - 0.18 * edgeReturn)'],
    ['top projection keeps the centerline push reduced so the terminal footprint is not pointed', 'const terminalCenterRelief = terminalNose * Math.pow(envelope, 1.82) * smoothStep(0.74, 0.92, t)'],
    ['top projection keeps the retained plan lobe broad enough to show the mound without becoming the stripe-forming branch', '0.068 * teardropLobe'],
    ['top projection keeps retained shoulder rounding narrow enough to avoid a full-height terminal fan', '0.044 * shoulderRound'],
    ['top projection keeps off-center terminal rounding narrow enough to avoid a full-height terminal fan', '0.052 * terminalRound'],
    ['top projection keeps the center-led terminal nose below the pointed-footprint branch', '0.05 * terminalCenterNose'],
    ['top projection scales down the retained push before it reaches the terminal edge without stacking rows', ') * (1 - 0.7 * edgeReturn)'],
    ['top projection pulls the terminal centerline back only enough to round the plan footprint without clamping rows', '0.009 * terminalCenterRelief'],
    ['top projection avoids a hard terminal clamp that stacks rows into a stripe', 'planX,'],
    ['top projection releases terminal pinch so the top footprint stays rounded', 'const terminalPlanRelease = smoothStep(0.66, 0.94, t)'],
    ['top projection keeps terminal shoulder widening narrow so the top view does not form a vertical fan', 'const terminalWidthRound = 0.122 * terminalRound * (1 - 0.12 * edgeReturn)'],
    ['top projection adds a bounded terminal pinch so the footprint rounds inward instead of widening into a stripe', 'const terminalPlanPinch = 0.0035 * terminalNose * Math.pow(envelope, 0.9) * (1 - 0.25 * edgeReturn)'],
    ['top projection keeps terminal pinch below the triangular-fan branch', '0.0055 * teardropLobe * (1 - 0.68 * terminalPlanRelease)'],
    ['top projection lets terminal shoulders round in y without collapsing rows', 's * planHalfSpan * (1 - planPinch + 0.016 * terminalRound + 0.018 * midSectionShoulder)'],
    ['top X overlay keeps one continuous frame layer instead of a terminal stripe split', 'topPlan: buildXCellGeometry(mechanism.frames),'],
    ['top X overlay keeps the old terminal split disabled', 'topFold: buildXCellGeometry([]),'],
    ['top readable X bars stay pale enough not to turn the rounded footprint into a terminal stripe', 'opacity={readableSurfaceMode ? 0.012 : 0.36}'],
    ['top readable shared rods stay pale enough not to darken the terminal into a wall', 'scope.topView ? 0.012 : scope.sideView ? 0.078 : 0.074'],
    ['top readable connector pins stay small enough not to form a terminal wall while X-only proof remains dark', 'scope.topView ? 1.2 : scope.sideView ? 3.45 : 3.24'],
    ['top readable connector cores stay pale enough not to form a terminal wall while X-only proof remains dark', 'scope.topView ? 0.24 : scope.sideView ? 0.74 : 0.7'],
    ['isometric camera balances full-sheet read with the accepted open-curl view', 'new THREE.Vector3(target.x + distance * 0.58, target.y - distance * 0.58, target.z + distance * 0.34)'],
    ['isometric camera keeps the curl inspectable without cropping the mechanism sheet', "view === 'isometric' ? 1.24"],
    ['3D-only curl path advances the center lip without changing side/top surfaces', 'const profileT = clampUnit(t + lipAdvance)'],
    ['3D-only rounded curl profile stays isolated to isometric display', 'const roundedProfilePoint = sampleReadableWaveProfile(frame.isometricProfile, profileT)'],
    ['3D-only lower-lip band stays narrow enough to avoid an underside wall', 'const lowerLip = smoothStep(0.7, 0.88, t) * (1 - smoothStep(0.94, 0.995, t))'],
    ['3D-only center localization stays narrow enough to protect the square sheet perimeter', 'const center = Math.pow(envelope, 2.22)'],
    ['3D-only rounded lip blend stays localized instead of becoming a full-width tunnel', 'Math.pow(envelope, 1.95)'],
    ['3D-only rounded lip blend stays localized so the isometric curl keeps the side-profile opening', '0.45'],
    ['3D-only rounded profile height stays localized to the center curl', 'Math.pow(envelope, 3.8)'],
    ['3D-only lateral height focus reduces full-width tube read without changing front/top surfaces', 'const lateralHeightFocus = lerpNumber(0.22, 1, Math.pow(envelope, 1.2))'],
    ['3D-only lateral height focus stays bounded before the terminal edge', 'smoothStep(0.24, 0.78, t)'],
    ['3D-only terminal side taper stays bounded so the lip does not become a full-width tube cap', 'const terminalTipTaper = frame.progress *'],
    ['3D-only terminal taper only affects off-center terminal spans', '(1 - Math.pow(envelope, 0.9))'],
    ['3D-only center lip advance stays bounded at the retained open-curl branch', '0.052'],
    ['3D-only lower lip tucks under the forward face without changing front/top surfaces', 'displayPoint[0] + waveWidth * openThroat * (0.14 * lipFace - 0.3 * lowerLip - 0.088 * throat - 0.024 * facePinch) - waveWidth * terminalTipTaper'],
    ['3D-only side pinch stays removed so the lip does not collapse into a closed cap', 'displayPoint[1],'],
    ['3D-only throat lift keeps the opening readable without a fake shadow patch', 'focusedZ + frame.height * openThroat * (0.11 * throat - 0.44 * lowerLip - 0.08 * facePinch)'],
    ['isometric view isolates the center throat trace', 'buildReadableWaveThroatGeometry(model)'],
    ['center throat trace stays removed so the barrel read comes from the sheet grid', 'transparent opacity={0} depthTest={false} depthWrite={false}'],
    ['isometric throat helper stays centerline-only after rib overlay rejection', 'readableWavePoint(frame, lerpNumber(0.58, 0.94, index / samples), 0)'],
    ['readable profile follows the June 24 reference-trace curl family', '0.66,0.96;0.74,0.88;0.805,0.74;0.85,0.56;0.855,0.43'],
    ['readable profile keeps the rounded inner loop and smooth lower return', '0.828,0.39;0.792,0.4;0.772,0.43;0.79,0.47;0.825,0.48'],
  ]
  const requiredFrontFragments = [
    ['front projection derives depth center from frame bounds', 'const frontDepthCenter = (frame.minX + frame.maxX) * 0.5'],
    ['front projection compresses depth instead of stacking full side geometry', 'lerpNumber(frontDepthCenter, wavePoint[0], 0.07)'],
    ['front terminal lip is bounded before the terminal edge', 'smoothStep(0.78, 0.9, t) * (1 - smoothStep(0.95, 1, t))'],
    ['front terminal lip is pulled toward the viewer', 'waveWidth * 0.32 * centralLipMask'],
    ['front terminal lip lowers through the center instead of making one dome', 'lerpNumber(domeHeight, tuckedLip, clampUnit(0.84 * centralLipMask))'],
    ['front view keeps the projection dome lower than the rejected pointed mound', 'const bodyArch = frame.height * 0.78'],
    ['front cap arch stays lower after the pointed-mound reduction', 'const capArch = frame.height * 0.82 * capShoulder'],
    ['front lifted body pinches inward while the base stays wide', 'const bodyPinch = 0.26 * bodyBand * Math.pow(envelope, 0.4)'],
    ['front terminal lip keeps rounded width instead of collapsing to a centerline', '0.18 * centralLipMask'],
  ]
  const forbiddenFragments = [
    ['front projection uses nonexistent frame.length', 'frame.length'],
    ['front projection uses nonexistent frame.centerX', 'frame.centerX'],
    ['side guide returns to the long false-cavity centerline loop', 'sampleProfileRange(0, 0.66, 0.96)'],
    ['side view reintroduces the standalone inner guide line', 'sampleProfileRange(0, 0.72, 0.88, 48)'],
    ['top view reintroduces the terminal stripe split', 'terminalStackFrame'],
  ]
  const forbiddenFrontFragments = [
    ['front cap raises outer span with a constant offset', '0.02 +'],
    ['front lip raises outer span with a constant offset', '0.03 +'],
    ['front cap pinch returns to tower-like width', '0.58 * capBand'],
    ['front view returns to a mound-only max stack', 'Math.max(wavePoint[2] * 0.16, bodyArch * (1 - 0.48 * capBand), capArch, tuckedLip)'],
    ['front view reintroduces a pasted cap surface', 'buildReadableWaveFrontLipGeometry'],
    ['front view reintroduces a pasted cap wire layer', 'buildReadableWaveFrontLipWireGeometry'],
    ['front view reintroduces a detached cap projection', 'readableWaveFrontLipPoint'],
  ]
  const missingFragments = requiredFragments.filter(([, fragment]) => !latticeViewerSource.includes(fragment))
  const missingFrontFragments = requiredFrontFragments.filter(([, fragment]) => !frontProjectionSource.includes(fragment))
  const presentForbiddenFragments = forbiddenFragments.filter(([, fragment]) => latticeViewerSource.includes(fragment))
  const presentForbiddenFrontFragments = forbiddenFrontFragments.filter(([, fragment]) => frontProjectionSource.includes(fragment))
  const displayPointUses = countSourceOccurrences(latticeViewerSource, 'readableWaveDisplayPoint(frame, view')
  const failures = [
    ...missingFragments.map(([label]) => `${label} missing`),
    ...missingFrontFragments.map(([label]) => `${label} missing`),
    ...presentForbiddenFragments.map(([label]) => label),
    ...presentForbiddenFrontFragments.map(([label]) => label),
    ...(displayPointUses < 5 ? [`readableWaveDisplayPoint used ${displayPointUses} times, expected at least 5`] : []),
  ]

  return {
    ok: failures.length === 0,
    checkedFragments: requiredFragments.map(([label]) => label),
    missingFragments,
    checkedFrontFragments: requiredFrontFragments.map(([label]) => label),
    missingFrontFragments,
    forbiddenFragments: presentForbiddenFragments,
    forbiddenFrontFragments: presentForbiddenFrontFragments,
    displayPointUses,
    failures,
  }
}

function countSourceOccurrences(source, needle) {
  return source.split(needle).length - 1
}

function summarizeLipSharpnessPair(bluntModel, sharpModel) {
  const preTerminalCutoff = Math.min(preTerminalLipCutoff(bluntModel), preTerminalLipCutoff(sharpModel))

  return {
    preTerminalResidual: round(summarizePreTerminalProfileResidual(bluntModel, sharpModel, preTerminalCutoff)),
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
  const aProfile = overhangProfileLimits(0)
  const bProfile = overhangProfileLimits(0)
  let residual = 0

  for (let index = 0; index < samples; index += 1) {
    const amount = samples === 1 ? 0 : index / (samples - 1)
    const profileU = lerpNumber(startProfileU, endProfileU, amount)
    const aU = aProfile.profileStart + clampNumber(profileU, 0, 1) * aProfile.remainingU
    const bU = bProfile.profileStart + clampNumber(profileU, 0, 1) * bProfile.remainingU
    const aPoint = sampleCenterlineLocalPoint(a, sheetUFromWaveFieldU(aU))
    const bPoint = sampleCenterlineLocalPoint(b, sheetUFromWaveFieldU(bU))
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
  return Array.from({ length: model.config.columns }, (_, col) => {
    const point = sampleCenterlineLocalPoint(model, col / Math.max(model.config.columns - 1, 1))
    const restPoint = sampleCenterlineRestPoint(model, col / Math.max(model.config.columns - 1, 1))

    return {
      col,
      x: point[0],
      z: point[2],
      reach: Math.hypot(point[0] - restPoint[0], point[1] - restPoint[1]),
      node: {
        id: `centerline-${col}`,
        col,
        currentPosition: point,
        restPosition: restPoint,
      },
    }
  })
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

function summarizeLateralSmoothness(model) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  let maxSpanStep = 0
  let maxLongStep = 0
  let maxSpanCurvature = 0

  for (let row = 0; row < model.config.rows; row += 1) {
    for (let col = 0; col < model.config.columns; col += 1) {
      const node = nodeById.get(`n-${row}-${col}`)
      if (!node) continue

      const spanNeighbor = nodeById.get(`n-${row + 1}-${col}`)
      if (spanNeighbor) {
        maxSpanStep = Math.max(maxSpanStep, Math.abs(spanNeighbor.currentPosition[2] - node.currentPosition[2]))
      }

      const longitudinalNeighbor = nodeById.get(`n-${row}-${col + 1}`)
      if (longitudinalNeighbor) {
        maxLongStep = Math.max(maxLongStep, Math.abs(longitudinalNeighbor.currentPosition[2] - node.currentPosition[2]))
      }
    }
  }

  for (let col = 0; col < model.config.columns; col += 1) {
    for (let row = 1; row < model.config.rows - 1; row += 1) {
      const previous = nodeById.get(`n-${row - 1}-${col}`)
      const current = nodeById.get(`n-${row}-${col}`)
      const next = nodeById.get(`n-${row + 1}-${col}`)
      if (!previous || !current || !next) continue

      maxSpanCurvature = Math.max(
        maxSpanCurvature,
        Math.abs(previous.currentPosition[2] - 2 * current.currentPosition[2] + next.currentPosition[2]),
      )
    }
  }

  const height = Math.max(model.summary.maxHeight, 0.000001)
  return {
    maxSpanStep: round(maxSpanStep),
    maxLongStep: round(maxLongStep),
    maxSpanCurvature: round(maxSpanCurvature),
    maxSpanStepRatio: round(maxSpanStep / height),
    maxSpanCurvatureRatio: round(maxSpanCurvature / height),
    maxSpanToLongStepRatio: round(maxSpanStep / Math.max(maxLongStep, 0.000001)),
  }
}

function lateralSmoothnessPasses(summary) {
  const absoluteSmooth = summary.maxSpanStepRatio <= 0.28 && summary.maxSpanCurvatureRatio <= 0.17
  const ratioSmooth = summary.maxSpanStepRatio <= 0.42 &&
    summary.maxSpanCurvatureRatio <= 0.38 &&
    summary.maxSpanToLongStepRatio <= 1.55

  return absoluteSmooth || ratioSmooth
}

function summarizeCustomSliceMapping(model) {
  const stats = {
    leadTaper: summarizeFootprintColumn(model, 0.04),
    frontShoulder: summarizeFootprintColumn(model, 0.2),
    body: summarizeFootprintColumn(model, 0.55),
    tailTaper: summarizeFootprintColumn(model, 0.96),
  }
  const widths = [stats.leadTaper.activeRows, stats.frontShoulder.activeRows, stats.body.activeRows, stats.tailTaper.activeRows]
  const activeCentroids = [
    stats.leadTaper,
    stats.frontShoulder,
    stats.body,
    stats.tailTaper,
  ]
    .filter((entry) => entry.activeRows > 0 && Number.isFinite(entry.centroidY))
    .map((entry) => Math.abs(entry.centroidY))
  const maxCenterOffset = activeCentroids.length ? Math.max(...activeCentroids) : Infinity
  const gridSpacingY = DEFAULT_SHEET_SPAN / Math.max(model.config.rows - 1, 1)
  const localizedSpanFalloff = stats.frontShoulder.activeRows >= stats.leadTaper.activeRows + 4 &&
    stats.frontShoulder.activeRows >= stats.tailTaper.activeRows + 4 &&
    stats.body.activeRows >= stats.tailTaper.activeRows + 4 &&
    Math.max(...widths) < model.config.rows - 2
  const centerSpanStaysCentered = maxCenterOffset <= gridSpacingY * 0.7

  return {
    ...stats,
    widthRangeRows: Math.max(...widths) - Math.min(...widths),
    maxCenterOffset: round(maxCenterOffset),
    localizedSpanFalloff,
    centerSpanStaysCentered,
    ok: localizedSpanFalloff && centerSpanStaysCentered,
  }
}

function summarizeFootprintColumn(model, profileU) {
  const targetX = DEFAULT_WAVE_FIELD_MIN_X + clampNumber(profileU, 0, 1) * DEFAULT_WAVE_FIELD_LENGTH
  const columns = new Map()

  model.nodes.forEach((node) => {
    if (!columns.has(node.col)) columns.set(node.col, [])
    columns.get(node.col).push(node)
  })

  let bestColumn = null
  let bestDistance = Infinity
  columns.forEach((nodes, col) => {
    const meanX = mean(nodes.map((node) => node.restPosition[0]))
    const distance = Math.abs(meanX - targetX)
    if (distance < bestDistance) {
      bestDistance = distance
      bestColumn = col
    }
  })

  const nodes = (columns.get(bestColumn) ?? [])
    .filter((node) => node.row > 0 && node.row < model.config.rows - 1)
  const displacements = nodes.map((node) => planDisplacement(node))
  const maxDisplacement = maxOf(displacements)
  const active = nodes.filter((node) => (
    planDisplacement(node) >= Math.max(maxDisplacement * 0.22, 0.0001)
  ))
  const centroidY = active.length ? mean(active.map((node) => node.restPosition[1])) : Infinity

  return {
    profileU,
    col: bestColumn,
    activeRows: active.length,
    centroidY: round(centroidY),
    maxDisplacement: round(maxDisplacement),
  }
}

function planDisplacement(node) {
  return Math.hypot(
    node.currentPosition[0] - node.restPosition[0],
    node.currentPosition[1] - node.restPosition[1],
  )
}

function summarizeTopFootprintRoundness(model) {
  const samples = [0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9]
  const columns = samples.map((profileU) => summarizeFootprintColumn(model, profileU))
  const widths = columns.map((entry) => entry.activeRows)
  const maxRows = Math.max(...widths)
  const meanRows = mean(widths)
  const terminalRows = mean(widths.slice(-2))
  const maxAdjacentDrop = widths.slice(0, -1).reduce((maxDrop, width, index) => (
    Math.max(maxDrop, (width - widths[index + 1]) / Math.max(maxRows, 1))
  ), 0)
  const collapseRatio = maxRows / Math.max(terminalRows, 1)
  const peakDominance = maxRows / Math.max(meanRows, 1)

  return {
    samples: samples.map((sample) => round(sample)),
    activeRows: widths,
    maxRows,
    terminalRows: round(terminalRows),
    collapseRatio: round(collapseRatio),
    peakDominance: round(peakDominance),
    maxAdjacentDrop: round(maxAdjacentDrop),
  }
}

function topFootprintRoundnessPasses(summary) {
  return summary.collapseRatio <= 1.55 &&
    summary.peakDominance <= 1.35 &&
    summary.maxAdjacentDrop <= 0.25 &&
    summary.terminalRows >= summary.maxRows * 0.62
}

function generatedTopFootprintRoundnessPasses(summary) {
  return summary.collapseRatio <= 1.75 &&
    summary.peakDominance <= 1.35 &&
    summary.maxAdjacentDrop <= 0.31 &&
    summary.terminalRows >= summary.maxRows * 0.54
}

function summarizeLocalizedCustomSheet(model) {
  const rowMaxHeights = []
  const centerRow = Math.round((model.config.rows - 1) * 0.5)
  const centerline = centerlinePoints(model)

  for (let row = 0; row < model.config.rows; row += 1) {
    const rowNodes = model.nodes.filter((node) => node.row === row)
    rowMaxHeights.push(maxOf(rowNodes.map((node) => node.currentPosition[2])))
  }

  const centerMaxHeight = rowMaxHeights[centerRow] ?? 0
  const activeRows = rowMaxHeights.filter((height) => height >= centerMaxHeight * 0.04).length
  const topRows = rowMaxHeights.filter((height) => height >= centerMaxHeight * 0.82).length
  const flatRows = rowMaxHeights.filter((height) => height <= centerMaxHeight * 0.02).length
  const intermediateRows = rowMaxHeights.filter((height) => (
    height > centerMaxHeight * 0.08 && height < centerMaxHeight * 0.82
  )).length
  const activeCenterline = centerline.filter((point) => (
    point.z >= centerMaxHeight * 0.04 || point.reach >= model.config.spacing * 0.12
  ))
  const centerlineBackfold = centerlineBackfoldRatio(activeCenterline)
  let maxAdjacentHeightJumpRatio = 0

  for (let row = 1; row < rowMaxHeights.length; row += 1) {
    maxAdjacentHeightJumpRatio = Math.max(
      maxAdjacentHeightJumpRatio,
      Math.abs(rowMaxHeights[row] - rowMaxHeights[row - 1]) / Math.max(centerMaxHeight, 0.000001),
    )
  }

  return {
    boundaryFlat: boundaryNodesStayFlat(model),
    centerMaxHeight: round(centerMaxHeight),
    activeRows,
    topRows,
    flatRows,
    intermediateRows,
    topBandFraction: round(topRows / Math.max(activeRows, 1)),
    centerlineBackfoldRatio: round(centerlineBackfold),
    maxAdjacentHeightJumpRatio: round(maxAdjacentHeightJumpRatio),
    horizontalEdges: model.edges.filter((edge) => edge.orientation === 'horizontal').length,
    expectedHorizontalEdges: model.config.rows * Math.max(model.config.columns - 1, 0),
    verticalEdges: model.edges.filter((edge) => edge.orientation === 'vertical').length,
    expectedVerticalEdges: Math.max(model.config.rows - 1, 0) * model.config.columns,
    quads: model.quads.length,
    expectedQuads: Math.max(model.config.rows - 1, 0) * Math.max(model.config.columns - 1, 0),
  }
}

function localizedCustomSheetPasses(summary) {
  return summary.boundaryFlat &&
    summary.centerMaxHeight > 0 &&
    summary.activeRows >= 4 &&
    summary.flatRows >= 2 &&
    summary.intermediateRows >= 2 &&
    summary.topBandFraction <= 0.7 &&
    summary.centerlineBackfoldRatio <= 0.08 &&
    summary.maxAdjacentHeightJumpRatio <= 0.48 &&
    summary.horizontalEdges === summary.expectedHorizontalEdges &&
    summary.verticalEdges === summary.expectedVerticalEdges &&
    summary.quads === summary.expectedQuads
}

function uniqueNumbers(values) {
  return [...new Set(values)]
}

function summarizeConicalSpanTaper(model) {
  const centerRow = (model.config.rows - 1) * 0.5
  const rowHeights = []

  for (let row = 0; row < model.config.rows; row += 1) {
    const rowNodes = model.nodes.filter((node) => node.row === row)
    rowHeights.push({
      row,
      distance: Math.abs(row - centerRow),
      maxHeight: maxOf(rowNodes.map((node) => node.currentPosition[2])),
    })
  }

  const centerBand = rowHeights.filter((entry) => entry.distance <= 1)
  const centerMax = maxOf(centerBand.map((entry) => entry.maxHeight))
  const active = rowHeights.filter((entry) => entry.maxHeight >= centerMax * 0.045)
  const activeHalfWidth = maxOf(active.map((entry) => entry.distance))
  const outerBand = active.filter((entry) => entry.distance >= activeHalfWidth * 0.68)
  const topBand = active.filter((entry) => entry.maxHeight >= centerMax * 0.82)
  const outerMax = maxOf(outerBand.map((entry) => entry.maxHeight))

  return {
    activeRowCount: active.length,
    centerMax: round(centerMax),
    outerMaxRatio: round(outerMax / Math.max(centerMax, 0.000001)),
    topBandFraction: round(topBand.length / Math.max(active.length, 1)),
  }
}

function conicalSpanTaperPasses(summary) {
  return summary.activeRowCount >= 4 &&
    summary.outerMaxRatio <= 0.64 &&
    summary.topBandFraction <= 0.58
}

function centerlineBackfoldRatio(points) {
  if (points.length < 2) return 0
  let totalForward = 0
  let totalBackward = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const dx = points[index + 1].x - points[index].x
    if (dx >= 0) totalForward += dx
    else totalBackward += -dx
  }

  return totalBackward / Math.max(totalForward, DEFAULT_SHEET_SPACING)
}

function summarizeBowlPockets(model) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const bowlTolerance = Math.max(maxHeight * 0.012, model.config.spacing * 0.025)
  const activeTolerance = Math.max(maxHeight * 0.04, model.config.spacing * 0.08)
  let bowlPocketCount = 0
  let maxBowlDepth = 0

  for (let row = 1; row < model.config.rows - 1; row += 1) {
    for (let col = 1; col < model.config.columns - 1; col += 1) {
      const center = nodeById.get(`n-${row}-${col}`)
      const north = nodeById.get(`n-${row - 1}-${col}`)
      const south = nodeById.get(`n-${row + 1}-${col}`)
      const west = nodeById.get(`n-${row}-${col - 1}`)
      const east = nodeById.get(`n-${row}-${col + 1}`)
      if (!center || !north || !south || !west || !east) continue

      const centerZ = center.currentPosition[2]
      const neighborZ = [
        north.currentPosition[2],
        south.currentPosition[2],
        west.currentPosition[2],
        east.currentPosition[2],
      ]
      if (Math.max(centerZ, ...neighborZ) < activeTolerance) continue

      const minRise = Math.min(...neighborZ.map((z) => z - centerZ))
      if (minRise > bowlTolerance) {
        bowlPocketCount += 1
        maxBowlDepth = Math.max(maxBowlDepth, minRise)
      }
    }
  }

  return {
    bowlPocketCount,
    maxBowlDepth: round(maxBowlDepth),
    maxBowlDepthRatio: round(maxBowlDepth / maxHeight),
  }
}

function summarizeOuterRadiusSmoothness(model) {
  const points = centerlinePoints(model)
  const maxZ = Math.max(...points.map((point) => point.z), 0.000001)
  const peakIndex = points.reduce((bestIndex, point, index) => (point.z > points[bestIndex].z ? index : bestIndex), 0)
  let startIndex = peakIndex
  while (startIndex > 0 && points[startIndex - 1].z >= maxZ * 0.48) startIndex -= 1

  let endIndex = peakIndex
  while (endIndex < points.length - 1 && points[endIndex + 1].z >= maxZ * 0.56) endIndex += 1
  for (let index = peakIndex + 1; index <= endIndex; index += 1) {
    if (points[index].x < points[index - 1].x - model.config.spacing * 0.35) {
      endIndex = index - 1
      break
    }
  }

  const active = points.slice(startIndex, endIndex + 1)
  let maxTopCurvature = 0
  let maxTopAngleJumpDeg = 0
  let signChanges = 0
  let previousSlopeSign = 0

  for (let index = 1; index < active.length - 1; index += 1) {
    const previous = active[index - 1]
    const current = active[index]
    const next = active[index + 1]
    const dxA = Math.max(Math.hypot(current.x - previous.x, current.reach - previous.reach), 0.000001)
    const dxB = Math.max(Math.hypot(next.x - current.x, next.reach - current.reach), 0.000001)
    const slopeA = (current.z - previous.z) / dxA
    const slopeB = (next.z - current.z) / dxB
    const angleA = Math.atan(slopeA)
    const angleB = Math.atan(slopeB)
    const slopeSign = Math.sign(slopeB)

    if (previousSlopeSign !== 0 && slopeSign !== 0 && slopeSign !== previousSlopeSign) signChanges += 1
    if (slopeSign !== 0) previousSlopeSign = slopeSign

    maxTopCurvature = Math.max(maxTopCurvature, Math.abs(previous.z - 2 * current.z + next.z))
    maxTopAngleJumpDeg = Math.max(maxTopAngleJumpDeg, Math.abs(angleB - angleA) * 180 / Math.PI)
  }

  return {
    maxTopCurvature: round(maxTopCurvature),
    maxTopCurvatureRatio: round(maxTopCurvature / maxZ),
    maxTopAngleJumpDeg: round(maxTopAngleJumpDeg),
    topPointCount: active.length,
    hasSingleCrest: signChanges <= 1,
  }
}

function summarizeGroundTransitionSpread(model) {
  const maxLift = Math.max(...model.nodes.map((node) => node.currentPosition[2]), 0.000001)
  return model.nodes.filter((node) => {
    if (node.row <= 0 || node.col <= 0 || node.row >= model.config.rows - 1 || node.col >= model.config.columns - 1) return false
    return node.currentPosition[2] > maxLift * 0.03 || horizontalDisplacement(node) > model.config.spacing * 0.15
  }).length
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
    shapePreserved: shapeMetricsPreserved(candidate, neutral),
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
    shapePreserved: shapeMetricsPreserved(candidate, neutral),
  }
}

function shapeMetricsPreserved(candidate, neutral) {
  const heightBase = Math.max(neutral.summary.maxHeight, 0.000001)
  const overhangBase = Math.max(neutral.summary.overhangAmount, 0.000001)
  const heightResidual = Math.abs(candidate.summary.maxHeight - neutral.summary.maxHeight) / heightBase
  const overhangResidual = Math.abs(candidate.summary.overhangAmount - neutral.summary.overhangAmount) / overhangBase
  const yawChanged = Math.abs(candidate.config.steer - neutral.config.steer) > 0.000001

  return heightResidual <= 0.045 && (yawChanged || overhangResidual <= 0.075)
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

function sheetUFromWaveFieldU(u) {
  const x = DEFAULT_WAVE_FIELD_MIN_X + clampNumber(u, 0, 1) * DEFAULT_WAVE_FIELD_LENGTH
  return (x + DEFAULT_SHEET_LENGTH / 2) / DEFAULT_SHEET_LENGTH
}

function sampleCenterlineLocalPoint(model, u) {
  return sampleCenterlineGridPoint(model, u, 'currentPosition')
}

function sampleCenterlineRestPoint(model, u) {
  return sampleCenterlineGridPoint(model, u, 'restPosition')
}

function sampleCenterlineGridPoint(model, u, key) {
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
  const topLeftPoint = topLeft?.[key] ?? [0, 0, 0]
  const topRightPoint = topRight?.[key] ?? topLeftPoint
  const bottomLeftPoint = bottomLeft?.[key] ?? topLeftPoint
  const bottomRightPoint = bottomRight?.[key] ?? bottomLeftPoint
  const topPoint = lerpVec(topLeftPoint, topRightPoint, columnAmount)
  const bottomPoint = lerpVec(bottomLeftPoint, bottomRightPoint, columnAmount)

  return lerpVec(topPoint, bottomPoint, rowAmount)
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
  const profileStart = overhangProfileLimits(0).profileStart
  return [DEFAULT_WAVE_FIELD_MIN_X + profileStart * DEFAULT_WAVE_FIELD_LENGTH, 0, 0]
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

function overhangProfileLimits() {
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

function preTerminalLipCutoff(model) {
  const lipStart = breakingLipStart(model.config.lipSharpness)

  return clampNumber(lipStart - 0.1, 0.32, 0.44)
}

function breakingLipStart(_lipSharpness) {
  return 0.38
}

function overhangPositionOffset(overhangPosition) {
  return clampNumber(overhangPosition, -1, 1) * DEFAULT_WAVE_FIELD_LENGTH * 0.045
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
      maxConnectorPathBendDeg: round(mechanismStats.maxConnectorPathBendDeg),
      maxConnectorEndpointGap: round(mechanismStats.maxConnectorEndpointGap),
    },
  }
}

function summarizeXCellRenderDirectLines(model) {
  const stats = connectedXCellMechanismStats(model)
  const mechanism = buildConnectedXCellMechanism(model)
  const expectedInteriorNodeCount = Math.max(model.config.rows - 2, 0) * Math.max(model.config.columns - 2, 0)
  const expectedInteriorXSegmentCount = expectedInteriorNodeCount * 2
  const renderedSharedJointArmCount = [...mechanism.connectorUsesByDiagonalId.values()].reduce((sum, uses) => sum + uses.length, 0)
  const sourceUsesConnectedXMechanism =
    latticeViewerSource.includes("import { buildConnectedXCellMechanism, type ConnectedXCellFrame } from './xCellMechanism'") &&
    latticeViewerSource.includes('const readableReferenceMode = readableWaveReferenceDisplay(model)') &&
    latticeViewerSource.includes('const centerOverrides = readableReferenceMode ? buildReadableWaveXCellCenterOverrides(model, view) : undefined') &&
    latticeViewerSource.includes('if (scope.topView) {\n      if (readableReferenceMode)') &&
    latticeViewerSource.includes('const mechanism = buildConnectedXCellMechanism(model, centerOverrides)')
  const straightSegmentFragments = [
    'writeVec(positions, segmentIndex * 6, sw)',
    'writeVec(positions, segmentIndex * 6 + 3, ne)',
    'writeVec(positions, segmentIndex * 6, se)',
    'writeVec(positions, segmentIndex * 6 + 3, nw)',
  ]
  const sourceUsesStraightLineSegments = straightSegmentFragments.every((fragment) => latticeViewerSource.includes(fragment))
  const sourceUsesSharedConnectorArms =
    latticeViewerSource.includes('<XCellSharedJointArms model={model} scope={renderScope} view={view} />') &&
    latticeViewerSource.includes('function XCellSharedJointArms') &&
    latticeViewerSource.includes('mechanism.connectorUsesByDiagonalId.forEach((uses, diagonalId) => {') &&
    latticeViewerSource.includes('const connector = mechanism.connectorByDiagonalId.get(diagonalId)') &&
    latticeViewerSource.includes('if (!connector || uses.length !== 2) return') &&
    latticeViewerSource.includes('const frame = mechanism.frameByNodeId.get(use.nodeId)') &&
    latticeViewerSource.includes('positions.push(...frame.center, ...connector)') &&
    latticeViewerSource.includes('<lineSegments geometry={geometry} renderOrder={17}>') &&
    latticeViewerSource.includes('const depthTest = readableSurfaceMode ? (scope.sideView || scope.topView ? false : true) : !scope.topView')
  const sourceUsesSharedConnectorRods =
    latticeViewerSource.includes('const rodRef = useRef<THREE.InstancedMesh>(null)') &&
    latticeViewerSource.includes('const armCount = Math.floor(armPositions.length / 6)') &&
    latticeViewerSource.includes('new THREE.CylinderGeometry(1, 1, 1, model.config.rows > 30 || model.config.columns > 30 ? 5 : 8)') &&
    latticeViewerSource.includes("const mechanismInk = readableSurfaceMode ? '#5f5b54' : '#161713'") &&
    latticeViewerSource.includes('color: mechanismInk') &&
    latticeViewerSource.includes('dummy.position.addVectors(start, end).multiplyScalar(0.5)') &&
    latticeViewerSource.includes('dummy.scale.set(rodRadius, length, rodRadius)') &&
    latticeViewerSource.includes('<instancedMesh ref={rodRef} args={[rodGeometry, rodMaterial, armCount]} renderOrder={16} frustumCulled={false} />')
  const sourceUsesSharedConnectorJoints =
    latticeViewerSource.includes('<XCellConnectorJoints model={model} scope={renderScope} view={view} />') &&
    latticeViewerSource.includes('function XCellConnectorJoints') &&
    latticeViewerSource.includes('return [...mechanism.connectorByDiagonalId.values()]') &&
    latticeViewerSource.includes('const pinRef = useRef<THREE.InstancedMesh>(null)') &&
    latticeViewerSource.includes('const pinGeometry = useMemo(() => new THREE.SphereGeometry(1, 7, 5), [])') &&
    latticeViewerSource.includes("const pinInk = readableSurfaceMode ? '#5a554f' : '#10120e'") &&
    latticeViewerSource.includes("const jointCoreInk = readableSurfaceMode ? '#5f5b54' : '#151712'") &&
    latticeViewerSource.includes('color: pinInk') &&
    latticeViewerSource.includes('pinRef.current?.setMatrixAt(index, dummy.matrix)') &&
    latticeViewerSource.includes('<instancedMesh ref={pinRef} args={[pinGeometry, pinMaterial, jointPositions.length]} renderOrder={21} />') &&
    latticeViewerSource.includes('<points geometry={geometry} renderOrder={19}>') &&
    latticeViewerSource.includes('<points geometry={geometry} renderOrder={20}>') &&
    latticeViewerSource.includes('color="#f7f3ed"') &&
    latticeViewerSource.includes('color={jointCoreInk}') &&
    latticeViewerSource.includes('? scope.topView ? 2.8 : scope.sideView ? 6.35 : 5.95') &&
    latticeViewerSource.includes('? scope.topView ? 1.2 : scope.sideView ? 3.45 : 3.24') &&
    latticeViewerSource.includes('? scope.topView ? 0.24 : scope.sideView ? 0.74 : 0.7') &&
    latticeViewerSource.includes('const jointDepthTest = readableSurfaceMode ? (scope.sideView || scope.topView ? false : true) : !scope.topView') &&
    latticeViewerSource.includes('depthTest={jointDepthTest}') &&
    latticeViewerSource.includes('depthWrite={false}')
  const sourceUsesCenterPivotJoints =
    latticeViewerSource.includes('<XCellCenterPivots model={model} scope={renderScope} view={view} />') &&
    latticeViewerSource.includes('function XCellCenterPivots') &&
    latticeViewerSource.includes('return mechanism.frames.map((frame) => frame.center)') &&
    latticeViewerSource.includes('<points geometry={geometry} renderOrder={18}>') &&
    latticeViewerSource.includes('color="#34342f"') &&
    latticeViewerSource.includes('const pivotDepthTest = readableSurfaceMode ? (scope.sideView || scope.topView ? false : true) : !scope.topView') &&
    latticeViewerSource.includes('depthTest={pivotDepthTest}') &&
    latticeViewerSource.includes('depthWrite={false}')
  const sourceUsesPhysicalConnectorSplit =
    xCellMechanismSource.includes('const physicalConnector = addVec(connector, connectorFamilySplitOffset(model, family, index))') &&
    xCellMechanismSource.includes('function connectorFamilySplitOffset(model: LatticeModel, family: DiagonalFamily, connectorIndex: number): Vec3') &&
    xCellMechanismSource.includes('const amount = model.config.spacing * 0.16 / Math.SQRT2') &&
    xCellMechanismSource.includes('function physicalConnectorOccupancy(mechanism: ConnectedXCellMechanism)') &&
    xCellMechanismSource.includes('if (useCount > 2) overOccupiedCount += 1') &&
    xCellMechanismSource.includes('function physicalConnectorKey(connector: Vec3): string')

  return {
    renderedNodeCount: model.nodes.length,
    expectedNodeCount: model.config.rows * model.config.columns,
    expectedInteriorNodeCount,
    renderedXSegmentCount: stats.renderedXSegmentCount,
    expectedInteriorXSegmentCount,
    renderedSharedJointArmCount,
    expectedSharedJointArmCount: mechanism.connectorByDiagonalId.size * 2,
    renderedCenterPivotCount: mechanism.frames.length,
    renderedJointCount: mechanism.connectorByDiagonalId.size,
    expectedDiagonalConnectorCount: stats.expectedDiagonalConnectorCount,
    minInteriorConnectedPairCount: stats.minInteriorConnectedPairCount,
    sourceUsesConnectedXMechanism,
    sourceUsesStraightLineSegments,
    sourceUsesSharedConnectorArms,
    sourceUsesSharedConnectorRods,
    sourceUsesSharedConnectorJoints,
    sourceUsesCenterPivotJoints,
    sourceUsesPhysicalConnectorSplit,
  }
}

function summarizeSideRenderDirectLines(model) {
  const renderedEdges = model.edges
  const mechanism = buildRigidCellMechanism(model)
  const renderedArmSegmentCount = renderedEdges.reduce((sum, edge) => {
    const frameA = mechanism.frameByNodeId.get(edge.nodeA)
    const frameB = mechanism.frameByNodeId.get(edge.nodeB)
    const connector = mechanism.connectorByEdgeId.get(edge.id)
    return sum + (frameA && frameB && connector ? 2 : 0)
  }, 0)
  const renderedDepthArmSegmentCount = renderedEdges
    .filter((edge) => edge.orientation === 'vertical')
    .reduce((sum, edge) => {
      const frameA = mechanism.frameByNodeId.get(edge.nodeA)
      const frameB = mechanism.frameByNodeId.get(edge.nodeB)
      const connector = mechanism.connectorByEdgeId.get(edge.id)
      return sum + (frameA && frameB && connector ? 2 : 0)
    }, 0)
  const degreeByNodeId = new Map(model.nodes.map((node) => [node.id, 0]))

  renderedEdges.forEach((edge) => {
    degreeByNodeId.set(edge.nodeA, (degreeByNodeId.get(edge.nodeA) ?? 0) + 1)
    degreeByNodeId.set(edge.nodeB, (degreeByNodeId.get(edge.nodeB) ?? 0) + 1)
  })

  let renderedDegreeSum = 0
  let expectedNeighborDegreeSum = 0
  let maxRenderedNeighborDegreeResidual = 0
  let minRenderedInteriorDegree = Infinity

  model.nodes.forEach((node) => {
    const renderedDegree = degreeByNodeId.get(node.id) ?? 0
    const expectedDegree = expectedNeighborCount(node, model)
    expectedNeighborDegreeSum += expectedDegree
    renderedDegreeSum += renderedDegree
    maxRenderedNeighborDegreeResidual = Math.max(maxRenderedNeighborDegreeResidual, Math.abs(renderedDegree - expectedDegree))
    if (node.col > 0 && node.col < model.config.columns - 1 && node.row > 0 && node.row < model.config.rows - 1) {
      minRenderedInteriorDegree = Math.min(minRenderedInteriorDegree, renderedDegree)
    }
  })
  const expectedHorizontalEdgeCount = model.config.rows * Math.max(model.config.columns - 1, 0)
  const expectedDepthEdgeCount = Math.max(model.config.rows - 1, 0) * model.config.columns
  const expectedFullRectEdgeCount = expectedHorizontalEdgeCount + expectedDepthEdgeCount

  return {
    renderedNodeCount: model.nodes.length,
    expectedNodeCount: model.config.rows * model.config.columns,
    renderedEdgeCount: renderedEdges.length,
    expectedFullRectEdgeCount,
    renderedArmSegmentCount,
    expectedFullRectArmSegmentCount: expectedFullRectEdgeCount * 2,
    renderedDepthEdgeCount: model.edges.filter((edge) => edge.orientation === 'vertical' && renderedEdges.includes(edge)).length,
    expectedDepthEdgeCount,
    renderedDepthArmSegmentCount,
    expectedDepthArmSegmentCount: expectedDepthEdgeCount * 2,
    renderedDegreeSum,
    expectedNeighborDegreeSum,
    maxRenderedNeighborDegreeResidual,
    minRenderedInteriorDegree: Number.isFinite(minRenderedInteriorDegree) ? minRenderedInteriorDegree : 0,
  }
}

function expectedHorizontalNeighborCount(node, model) {
  let count = 0
  if (node.col > 0) count += 1
  if (node.col < model.config.columns - 1) count += 1
  return count
}

function expectedNeighborCount(node, model) {
  let count = 0
  if (node.col > 0) count += 1
  if (node.col < model.config.columns - 1) count += 1
  if (node.row > 0) count += 1
  if (node.row < model.config.rows - 1) count += 1
  return count
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

function isFiniteVec(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
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

function smootherStep(value) {
  const t = clampNumber(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function round(value) {
  return Number(value.toFixed(4))
}
