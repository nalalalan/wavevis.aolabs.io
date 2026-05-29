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
  {
    name: '1x6 center pair bend up',
    grid: [[
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.BEND_UP,
      CELL_STATES.BEND_UP,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
    ]],
    checkStripContact: true,
  },
  {
    name: '1x6 center pair bend down',
    grid: [[
      CELL_STATES.OFF,
      CELL_STATES.OFF,
      CELL_STATES.BEND_DOWN,
      CELL_STATES.BEND_DOWN,
      CELL_STATES.OFF,
      CELL_STATES.OFF,
    ]],
    checkStripContact: true,
  },
]

function checkCase(testCase) {
  const params = geometry.DEFAULT_PARAMS
  const layout = geometry.buildArrayLayout(testCase.grid, params, 0)
  let maxLegError = 0
  let maxConnectorGap = 0
  let maxAdjacentAngle = 0
  let minVerticalStack = Infinity
  let minRenderedZ = Infinity
  let maxPassiveLayerHeightError = 0

  layout.forEach((row) => {
    row.forEach((cell) => {
      minVerticalStack = Math.min(minVerticalStack, cell.middle[2] - cell.bottom[2], cell.top[2] - cell.middle[2])
      ;[cell.bottom, cell.middle, cell.top].forEach((point) => {
        minRenderedZ = Math.min(minRenderedZ, point[2])
      })

      ;['lower', 'upper'].forEach((layer) => {
        const lowCenter = layer === 'lower' ? cell.bottom : cell.middle
        const highCenter = layer === 'lower' ? cell.middle : cell.top

        geometry.SIDE_NAMES.forEach((side) => {
          const sideVector = geometry.sideVectorFromLayout(cell, side)
          const node = geometry.sideNodePositionFromLayout(cell, layer, side)
          minRenderedZ = Math.min(minRenderedZ, node[2])
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

  if (testCase.grid.length === 1 && testCase.grid[0].length > 1) {
    for (let col = 0; col < layout[0].length - 1; col += 1) {
      maxAdjacentAngle = Math.max(maxAdjacentAngle, angleBetween(cellAxis(layout[0][col]), cellAxis(layout[0][col + 1])))
    }
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
    maxAdjacentAngle,
    maxPassiveLayerHeightError,
    minVerticalStack,
    minRenderedZ,
  }
}

const results = cases.map(checkCase)
console.log(JSON.stringify(results, null, 2))

function maxLayoutZ(layout) {
  let maxZ = -Infinity
  layout.forEach((row) =>
    row.forEach((cell) => {
      ;[cell.bottom, cell.middle, cell.top].forEach((point) => {
        maxZ = Math.max(maxZ, point[2])
      })
      ;['lower', 'upper'].forEach((layer) =>
        geometry.SIDE_NAMES.forEach((side) => {
          maxZ = Math.max(maxZ, geometry.sideNodePositionFromLayout(cell, layer, side)[2])
        }),
      )
    }),
  )
  return maxZ
}

function minLayoutZ(layout) {
  let minZ = Infinity
  layout.forEach((row) =>
    row.forEach((cell) => {
      ;[cell.bottom, cell.middle, cell.top].forEach((point) => {
        minZ = Math.min(minZ, point[2])
      })
      ;['lower', 'upper'].forEach((layer) =>
        geometry.SIDE_NAMES.forEach((side) => {
          minZ = Math.min(minZ, geometry.sideNodePositionFromLayout(cell, layer, side)[2])
        }),
      )
    }),
  )
  return minZ
}

function mirrorZError(a, b, mirrorSum) {
  return Math.abs(a[2] - (mirrorSum - b[2]))
}

function checkCenterPairMirror() {
  const params = geometry.DEFAULT_PARAMS
  const bendUp = geometry.buildArrayLayout([[
    CELL_STATES.OFF,
    CELL_STATES.OFF,
    CELL_STATES.BEND_UP,
    CELL_STATES.BEND_UP,
    CELL_STATES.OFF,
    CELL_STATES.OFF,
  ]], params, 0)
  const bendDown = geometry.buildArrayLayout([[
    CELL_STATES.OFF,
    CELL_STATES.OFF,
    CELL_STATES.BEND_DOWN,
    CELL_STATES.BEND_DOWN,
    CELL_STATES.OFF,
    CELL_STATES.OFF,
  ]], params, 0)
  const minZ = Math.min(minLayoutZ(bendUp), minLayoutZ(bendDown))
  const maxZ = Math.max(maxLayoutZ(bendUp), maxLayoutZ(bendDown))
  const mirrorSum = minZ + maxZ
  let maxMirrorError = Math.max(Math.abs(maxLayoutZ(bendUp) - maxLayoutZ(bendDown)), Math.abs(minLayoutZ(bendUp) - minLayoutZ(bendDown)))

  for (let col = 0; col < bendUp[0].length; col += 1) {
    const up = bendUp[0][col]
    const down = bendDown[0][col]
    maxMirrorError = Math.max(
      maxMirrorError,
      mirrorZError(up.bottom, down.top, mirrorSum),
      mirrorZError(up.middle, down.middle, mirrorSum),
      mirrorZError(up.top, down.bottom, mirrorSum),
      mirrorZError(up.lowerCenter, down.upperCenter, mirrorSum),
      mirrorZError(up.upperCenter, down.lowerCenter, mirrorSum),
    )

    geometry.SIDE_NAMES.forEach((side) => {
      maxMirrorError = Math.max(
        maxMirrorError,
        mirrorZError(up.nodes.lower[side], down.nodes.upper[side], mirrorSum),
        mirrorZError(up.nodes.upper[side], down.nodes.lower[side], mirrorSum),
      )
    })
  }

  return { name: '1x6 center pair bend up/down mirror', maxMirrorError }
}

const mirrorResult = checkCenterPairMirror()
console.log(JSON.stringify(mirrorResult, null, 2))

const failed = results.filter(
  (result) =>
    result.maxLegError > 1e-9 ||
    result.maxConnectorGap > 1e-7 ||
    result.maxAdjacentAngle > 0.64 ||
    result.maxPassiveLayerHeightError > 1e-8 ||
    result.minVerticalStack <= 0 ||
    result.minRenderedZ < -1e-8,
)
if (failed.length > 0) {
  console.error('Geometry invariant failure:', JSON.stringify(failed, null, 2))
  process.exit(1)
}

if (mirrorResult.maxMirrorError > 1e-7) {
  console.error('Geometry mirror failure:', JSON.stringify(mirrorResult, null, 2))
  process.exit(1)
}

function cellAxis(cell) {
  const axis = subtract(cell.top, cell.bottom)
  const axisLength = length(axis)
  return scale(axis, 1 / Math.max(axisLength, 0.0001))
}

function angleBetween(a, b) {
  const cosine = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(cosine)
}
