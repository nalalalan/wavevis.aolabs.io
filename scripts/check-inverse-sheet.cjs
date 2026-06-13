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

const { buildInverseSheetModel, getInverseSheetUsableRanges, runInverseSheetSanityChecks } = require(path.join(outDir, 'latticeGeometry.js'))
const { rigidCellMechanismStats } = require(path.join(outDir, 'rigidCellMechanism.js'))

const DEFAULT_SHEET_ROWS = 44
const DEFAULT_SHEET_COLUMNS = 96
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

const failures = [...runInverseSheetSanityChecks()]
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
const sideRenderDirectLines = summarizeSideRenderDirectLines(buildInverseSheetModel())
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
const sliderRobustness = summarizeSliderRobustness()

if (!(flatContributionPair.heightResidual <= 0.03 &&
  flatContributionPair.overhangResidual <= 0.03 &&
  flatContributionPair.centerlineResidual <= DEFAULT_SHEET_SPACING * 0.95 &&
  flatContributionPair.highApron > flatContributionPair.lowApron + 0.015 &&
  flat1.activeMaxAbs <= flat0.activeMaxAbs * 1.02 &&
  flat1.maxTensileStrain <= flat0.maxTensileStrain * 1.02)) {
  failures.push('flat contribution should preserve the main wave while adding a broader support apron')
}

if (!(lipSharpnessPair.preTerminalResidual <= 0.7 && lipSharpnessPair.terminalResidual >= 0.45)) {
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

if (!(lipDipSweep[118].dropRatio >= 0.28 &&
  lipDipSweep[118].tipForwardOfCrest &&
  lipDipSweep[118].hookTuckedUnderShoulder &&
  lipDipSweep[118].returnToFlat &&
  lipDipSweep[118].smoothTerminalReturn &&
  lipDipSweep[118].noBackfoldCavity &&
  lipDipSweep[118].tipForwardDistance >= breakingLipConfig.horizontalOffset * 0.055 &&
  lipDipSweep[118].hookTuckDistance >= breakingLipConfig.horizontalOffset * 0.025 &&
  lipDipSweep[118].tipDrop >= breakingLipConfig.height * 0.22 &&
  lipDipSweep[118].finalTangentAngleDeg <= -35 &&
  lipDipSweep[120].tipDrop >= lipDipSweep[105].tipDrop + breakingLipConfig.height * 0.12)) {
  failures.push('lip dip should create a forward shoulder, downturned clean nose, smooth return, and no bowl pocket/collapsed cavity')
}

if (lipDipPreTerminalResidual < 0.5) {
  failures.push('lip dip should visibly reshape the full side profile into a curled tapered cone')
}

if (!(userLipDipCase.tipBelowLastPeak && userLipDipCase.finalTangentAngleDeg <= -40)) {
  failures.push('lip dip above 90 deg should make the terminal free tip point downward')
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

if (!Object.values(bowlPocketCheck).every((summary) => summary.bowlPocketCount === 0)) {
  failures.push('curled cone surface should not contain bowl-like local minima')
}

if (!Object.values(outerRadiusSmoothness).every((summary) => (
  summary.maxTopCurvatureRatio <= (summary.topPointCount <= 5 ? 0.32 : 0.26) &&
  summary.maxTopAngleJumpDeg <= (summary.topPointCount <= 5 ? 60 : summary.topPointCount <= 8 ? 38 : 45) &&
  summary.hasSingleCrest
))) {
  failures.push('outer crest should stay a continuous round radius without top dents')
}

if (resolutionInvariant.grid24CoreResidual > 2.7 || resolutionInvariant.grid72CoreResidual > 1.05) {
  failures.push('rows and columns should only resample the same physical overhang')
}

if (displayInvariant.maxResidual > 0.000001 || displayInvariant.maxMetricResidual > 0.000001) {
  failures.push('display modes should only affect colors/materials')
}

if (!(sideOverhangAspect.userMorphHalfLip120.aspectRatio <= 1.35 &&
  sideOverhangAspect.startupDefault.aspectRatio <= 1.12)) {
  failures.push('side-view overhang geometry should fit a roughly square active profile, not a long flat strip')
}

if (!sliderRobustness.ok) {
  failures.push('slider sweeps should stay finite, boundary-pinned, and free of sudden range-clamp jumps')
}

if (!lowLipDipStability.ok) {
  failures.push('low lip dip values should stay neutral/stable without partial-curl mangling')
}

if (mechanism.maxConnectorEndpointGap > 0.0001) {
  failures.push('inverse-sheet arms should terminate directly at shared connector points')
}

if (mechanism.maxExpectedArmCountResidual !== 0 || mechanism.minInteriorConnectedArmCount !== 4) {
  failures.push('every inverse-sheet cell should have all expected connected legs, with interior cells connected to four legs')
}

if (
  sideRenderDirectLines.renderedDepthEdgeCount !== sideRenderDirectLines.expectedDepthEdgeCount ||
  sideRenderDirectLines.renderedEdgeCount <= 0 ||
  sideRenderDirectLines.renderedNodeCount !== sideRenderDirectLines.expectedNodeCount ||
  sideRenderDirectLines.renderedEdgeCount !== sideRenderDirectLines.expectedFullRectEdgeCount ||
  sideRenderDirectLines.maxRenderedNeighborDegreeResidual !== 0 ||
  sideRenderDirectLines.minRenderedInteriorDegree < 4
) {
  failures.push('side view should show the full node array with direct rectangular linkages, not a sliced cross-section or hidden span legs')
}

if (mechanism.maxPairLengthSpread > 0.005) {
  failures.push('opposite arms within each inverse-sheet pair should stay nearly equal length')
}

if (mechanism.maxOppositeColinearErrorDeg > 0.25) {
  failures.push('opposite arms within each inverse-sheet pair should stay visually collinear')
}

if (mechanism.maxArmSurfaceLeak > 3.6) {
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
    maxConnectorPathBendDeg: round(mechanism.maxConnectorPathBendDeg),
    maxExpectedArmCountResidual: round(mechanism.maxExpectedArmCountResidual),
    minInteriorConnectedArmCount: mechanism.minInteriorConnectedArmCount,
    maxConnectorEndpointGap: round(mechanism.maxConnectorEndpointGap),
    meanConnectorEndpointGap: round(mechanism.meanConnectorEndpointGap),
    rmsConnectorEndpointGap: round(mechanism.rmsConnectorEndpointGap),
    maxArmSurfaceLeak: round(mechanism.maxArmSurfaceLeak),
    maxCenterShift: round(mechanism.maxCenterShift),
  },
  sideRenderDirectLines,
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
  bowlPocketCheck,
  outerRadiusSmoothness,
  resolutionInvariant,
  displayInvariant,
  sideOverhangAspect,
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

  const hookCandidates = postShoulder.filter((point) => (
    point.z > maxZ * 0.08 &&
    point.z <= shoulder.z - maxZ * 0.08
  ))
  const tipPool = hookCandidates.length ? hookCandidates : postShoulder
  const tip = tipPool.reduce((best, point) => {
    if (point.z < best.z - 0.000001) return point
    if (Math.abs(point.z - best.z) <= 0.000001 && point.x > best.x) return point
    return best
  }, tipPool[0])
  const postTip = points.filter((point) => point.col > tip.col)
  const activePostTip = postTip.filter((point) => point.reach >= maxReach * 0.02 || point.z > maxZ * 0.005)
  const flatReturnCandidates = activePostTip.filter((point) => point.z <= maxZ * 0.12)
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
  const noBackfoldCavity = centerlineBackfoldRatio(curlPath) <= 0.72

  return {
    tipBelowLastPeak: dropRatio >= 0.08,
    tipForwardOfCrest: tipForwardDistance > model.config.spacing * 0.25,
    hookTuckedUnderShoulder: hookTuckDistance > model.config.spacing * 0.2 &&
      tip.z <= shoulder.z - maxZ * 0.08,
    returnToFlat: flatReturn !== tip &&
      flatReturn.z <= maxZ * 0.14 &&
      returnForwardDistance > model.config.spacing * 1.25,
    smoothTerminalReturn: maxTerminalSegmentDrop <= maxZ * 0.48,
    noBackfoldCavity,
    tipDx: round(tipDx),
    tipSlope: round(tipSlope),
    dropRatio: round(dropRatio),
    tipDrop: round(tipDrop),
    tipForwardDistance: round(tipForwardDistance),
    hookTuckDistance: round(hookTuckDistance),
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

function emptyBreakingLipSummary() {
  return {
    tipBelowLastPeak: false,
    tipForwardOfCrest: false,
    hookTuckedUnderShoulder: false,
    returnToFlat: false,
    smoothTerminalReturn: false,
    noBackfoldCavity: true,
    tipDx: 0,
    tipSlope: 0,
    dropRatio: 0,
    tipDrop: 0,
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
  const absoluteSmooth = summary.maxSpanStepRatio <= 0.28 && summary.maxSpanCurvatureRatio <= 0.14
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
  const sliceStaysCentered = maxCenterOffset <= gridSpacingY * 0.7

  return {
    ...stats,
    widthRangeRows: Math.max(...widths) - Math.min(...widths),
    maxCenterOffset: round(maxCenterOffset),
    localizedSpanFalloff,
    sliceStaysCentered,
    ok: localizedSpanFalloff && sliceStaysCentered,
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
  const displacements = nodes.map((node) => distanceVec(node.currentPosition, node.restPosition))
  const maxDisplacement = maxOf(displacements)
  const active = nodes.filter((node) => (
    distanceVec(node.currentPosition, node.restPosition) >= Math.max(maxDisplacement * 0.28, 0.0001)
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
    summary.topBandFraction <= 0.54
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

function summarizeSideRenderDirectLines(model) {
  const renderedEdges = model.edges
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

  return {
    renderedNodeCount: model.nodes.length,
    expectedNodeCount: model.config.rows * model.config.columns,
    renderedEdgeCount: renderedEdges.length,
    expectedFullRectEdgeCount: expectedHorizontalEdgeCount + expectedDepthEdgeCount,
    renderedDepthEdgeCount: model.edges.filter((edge) => edge.orientation === 'vertical' && renderedEdges.includes(edge)).length,
    expectedDepthEdgeCount,
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
