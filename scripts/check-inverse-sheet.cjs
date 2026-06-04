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
const mechanism = rigidCellMechanismStats(buildInverseSheetModel())

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

if (mechanism.maxLegLengthSpread > 0.000001) {
  failures.push('rigid cell arms should have equal length within each cell')
}

if (mechanism.maxOrthogonalityErrorDeg > 0.000001) {
  failures.push('rigid cell arms should remain perpendicular within each cell')
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
  mechanism: {
    maxLegLengthSpread: round(mechanism.maxLegLengthSpread),
    maxOrthogonalityErrorDeg: round(mechanism.maxOrthogonalityErrorDeg),
    maxConnectorEndpointGap: round(mechanism.maxConnectorEndpointGap),
  },
}

console.log(JSON.stringify(report, null, 2))

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2))
  process.exit(1)
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

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value) {
  return Number(value.toFixed(4))
}
