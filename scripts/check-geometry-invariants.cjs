const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'node_modules', '.tmp', 'wavevis-geometry-check')
const tscRunner = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n')

execFileSync(
  process.execPath,
  [
    tscRunner,
    'src/types.ts',
    'src/geometry.ts',
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

const geometry = require(path.join(outDir, 'geometry.js'))
const { CELL_STATES } = require(path.join(outDir, 'types.js'))

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a, scalar) => [a[0] * scalar, a[1] * scalar, a[2] * scalar]
const length = (a) => Math.hypot(a[0], a[1], a[2])

const cases = [
  {
    name: '2x2 one bend up',
    grid: [
      [CELL_STATES.BEND_UP, CELL_STATES.OFF],
      [CELL_STATES.OFF, CELL_STATES.OFF],
    ],
    passiveLayerChecks: [
      { row: 0, col: 0, layer: 'upper', maxHeight: 1.95 },
      { row: 0, col: 1, layer: 'lower', maxHeight: 1.8 },
      { row: 1, col: 0, layer: 'upper', maxHeight: 1.8 },
    ],
  },
  {
    name: '2x2 one bend down',
    grid: [
      [CELL_STATES.BEND_DOWN, CELL_STATES.OFF],
      [CELL_STATES.OFF, CELL_STATES.OFF],
    ],
    passiveLayerChecks: [
      { row: 0, col: 0, layer: 'lower', maxHeight: 1.95 },
      { row: 0, col: 1, layer: 'upper', maxHeight: 1.8 },
      { row: 1, col: 0, layer: 'lower', maxHeight: 1.8 },
    ],
  },
  {
    name: '1x2 edge bend passive upper pull',
    grid: [[
      CELL_STATES.BEND_UP,
      CELL_STATES.OFF,
    ]],
    checkStripContact: true,
    passiveLayerChecks: [
      { row: 0, col: 0, layer: 'upper', maxHeight: 1.9 },
    ],
  },
  {
    name: '1x10 mixed strip',
    grid: [[
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.BEND_UP,
      CELL_STATES.BEND_DOWN,
      CELL_STATES.BEND_DOWN,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
    ]],
    checkStripContact: true,
  },
  {
    name: '1x5 edge bend strip contact',
    grid: [[
      CELL_STATES.BEND_UP,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
    ]],
    checkStripContact: true,
  },
  {
    name: '1x5 center bend strip contact',
    grid: [[
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.BEND_UP,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
    ]],
    checkStripContact: true,
  },
  {
    name: '2x10 mixed strip',
    grid: [
      [
        CELL_STATES.OFF,
        CELL_STATES.BEND_UP,
        CELL_STATES.BEND_UP,
        CELL_STATES.OFF,
        CELL_STATES.BEND_DOWN,
        CELL_STATES.BEND_DOWN,
        CELL_STATES.OFF,
        CELL_STATES.EXPAND,
        CELL_STATES.OFF,
        CELL_STATES.OFF,
      ],
      [
        CELL_STATES.OFF,
        CELL_STATES.OFF,
        CELL_STATES.BEND_UP,
        CELL_STATES.OFF,
        CELL_STATES.OFF,
        CELL_STATES.BEND_DOWN,
        CELL_STATES.BEND_DOWN,
        CELL_STATES.EXPAND,
        CELL_STATES.OFF,
        CELL_STATES.OFF,
      ],
    ],
  },
]

function checkCase(testCase) {
  const params = geometry.DEFAULT_PARAMS
  const layout = geometry.buildArrayLayout(testCase.grid, params, 0)
  let maxLegError = 0
  let maxConnectorGap = 0
  let minVerticalStack = Infinity
  let maxPassiveLayerHeightError = 0

  layout.forEach((row) => {
    row.forEach((cell) => {
      minVerticalStack = Math.min(minVerticalStack, cell.middle[2] - cell.bottom[2], cell.top[2] - cell.middle[2])

      ;['lower', 'upper'].forEach((layer) => {
        const lowCenter = layer === 'lower' ? cell.bottom : cell.middle
        const highCenter = layer === 'lower' ? cell.middle : cell.top

        geometry.SIDE_NAMES.forEach((side) => {
          const sideVector = geometry.sideVectorFromLayout(cell, side)
          const node = geometry.sideNodePositionFromLayout(cell, layer, side)
          const lowAnchor = add(lowCenter, scale(sideVector, params.plateSize / 2))
          const highAnchor = add(highCenter, scale(sideVector, params.plateSize / 2))

          maxLegError = Math.max(maxLegError, Math.abs(length(subtract(node, lowAnchor)) - params.linkLength))
          maxLegError = Math.max(maxLegError, Math.abs(length(subtract(node, highAnchor)) - params.linkLength))
        })
      })
    })
  })

  if (testCase.checkStripContact) {
    layout.forEach((row) => {
      for (let col = 0; col < row.length - 1; col += 1) {
        ;['lower', 'upper'].forEach((layer) => {
          const start = geometry.sideNodePositionFromLayout(row[col], layer, 'px')
          const end = geometry.sideNodePositionFromLayout(row[col + 1], layer, 'nx')
          maxConnectorGap = Math.max(maxConnectorGap, length(subtract(end, start)))
        })
      }
    })
  }

  ;(testCase.passiveLayerChecks ?? []).forEach((check) => {
    const cell = layout[check.row][check.col]
    const height = check.layer === 'lower' ? cell.bottomH : cell.topH
    maxPassiveLayerHeightError = Math.max(maxPassiveLayerHeightError, Math.max(0, height - check.maxHeight))
  })

  return {
    name: testCase.name,
    maxLegError,
    maxConnectorGap,
    maxPassiveLayerHeightError,
    minVerticalStack,
  }
}

const results = cases.map(checkCase)
console.log(JSON.stringify(results, null, 2))

const failed = results.filter(
  (result) =>
    result.maxLegError > 1e-9 ||
    result.maxConnectorGap > 1e-8 ||
    result.maxPassiveLayerHeightError > 1e-8 ||
    result.minVerticalStack <= 0,
)
if (failed.length > 0) {
  console.error('Geometry invariant failure:', JSON.stringify(failed, null, 2))
  process.exit(1)
}
