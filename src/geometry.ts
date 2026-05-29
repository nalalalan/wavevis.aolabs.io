import {
  CELL_STATES,
  type CellGrid,
  type CellParams,
  type CellState,
  type LayerName,
  type SideName,
  type Vec3,
} from './types'

export const STATE_META = [
  {
    value: CELL_STATES.OFF,
    name: 'OFF',
    label: 'OFF',
    shortLabel: 'OFF',
    color: '#f2f1ee',
  },
  {
    value: CELL_STATES.BEND_UP,
    name: 'BEND_UP',
    label: 'Bend Up',
    shortLabel: 'UP',
    color: '#32b66d',
  },
  {
    value: CELL_STATES.BEND_DOWN,
    name: 'BEND_DOWN',
    label: 'Bend Down',
    shortLabel: 'DOWN',
    color: '#d95757',
  },
  {
    value: CELL_STATES.EXPAND,
    name: 'EXPAND',
    label: 'Expand',
    shortLabel: 'EXP',
    color: '#ff9fba',
  },
] as const

export const SIDE_NAMES: SideName[] = ['px', 'nx', 'py', 'ny']

const CELL_STATE_SEQUENCE = [
  CELL_STATES.OFF,
  CELL_STATES.BEND_UP,
  CELL_STATES.BEND_DOWN,
  CELL_STATES.EXPAND,
] as const

export const DEFAULT_PARAM_SEED = {
  hOff: 3,
  hOn: 0.5,
  linkLength: 1,
  plateSize: 1,
  octagonFaceRatio: 1.5,
  showLabels: false,
  animate: false,
  constrainPerimeter: false,
}

export const DEFAULT_ROWS = 1
export const DEFAULT_COLUMNS = 2

export type CellLayout = {
  bottom: Vec3
  middle: Vec3
  top: Vec3
  lowerCenter: Vec3
  upperCenter: Vec3
  bottomH: number
  topH: number
  lowerOffset: number
  upperOffset: number
  yaw: number
  nodes: Record<LayerName, Record<SideName, Vec3>>
}

export type LayoutBounds = {
  min: Vec3
  max: Vec3
  center: Vec3
  span: Vec3
}

type AxisName = 'x' | 'y'

type CellPose = {
  lowerCenter: Vec3
  upperCenter: Vec3
  lowerTarget: number
  upperTarget: number
  lowerHeight: number
  upperHeight: number
  yaw: number
  yawTarget: number
  locked: boolean
  lockedLowerCenter: Vec3
  lockedUpperCenter: Vec3
  lockedYaw: number
}

type ConnectorConstraint = {
  aRow: number
  aCol: number
  aSide: SideName
  bRow: number
  bCol: number
  bSide: SideName
  layer: LayerName
}

export function sideNodeOffset(height: number, params: Pick<CellParams, 'linkLength' | 'plateSize'>): number {
  const plateHalf = params.plateSize / 2
  const verticalHalfSpan = height / 2
  const lateralSpan = Math.sqrt(Math.max(params.linkLength ** 2 - verticalHalfSpan ** 2, 0))
  return plateHalf + lateralSpan
}

export function nominalCellPitch(params: Pick<CellParams, 'hOff' | 'linkLength' | 'plateSize'>): number {
  return roundForInput(2 * sideNodeOffset(params.hOff, params))
}

export const DEFAULT_PARAMS: CellParams = {
  ...DEFAULT_PARAM_SEED,
}

export const REFERENCE_WAVE_COLUMNS = 33

export const REFERENCE_WAVE_PARAMS: CellParams = {
  ...DEFAULT_PARAMS,
  constrainPerimeter: false,
}

export const OVERHANG_ROWS = 5
export const OVERHANG_COLUMNS = 21

export const OVERHANG_PARAMS: CellParams = {
  ...DEFAULT_PARAMS,
  hOn: 0.82,
  linkLength: 1.35,
  plateSize: 1.38,
  animate: true,
  constrainPerimeter: true,
}

export function createGrid(rows: number, columns: number, fill: CellState = CELL_STATES.OFF): CellGrid {
  return Array.from({ length: clampInteger(rows, 1, 100) }, () =>
    Array.from({ length: clampInteger(columns, 1, 100) }, () => fill),
  )
}

export function resizeGrid(grid: CellGrid, rows: number, columns: number): CellGrid {
  const safeRows = clampInteger(rows, 1, 100)
  const safeColumns = clampInteger(columns, 1, 100)

  return Array.from({ length: safeRows }, (_, row) =>
    Array.from({ length: safeColumns }, (_, col) => grid[row]?.[col] ?? CELL_STATES.OFF),
  )
}

export function randomGrid(rows: number, columns: number): CellGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => Math.floor(Math.random() * STATE_META.length) as CellState),
  )
}

export function createReferenceWaveGrid(): CellGrid {
  const grid = createGrid(1, REFERENCE_WAVE_COLUMNS, CELL_STATES.OFF)

  for (let col = 11; col <= 30; col += 1) {
    grid[0][col] = CELL_STATES.BEND_DOWN
  }

  for (let col = 0; col <= 10; col += 1) {
    grid[0][col] = CELL_STATES.BEND_UP
  }

  for (let col = 15; col < REFERENCE_WAVE_COLUMNS; col += 1) {
    grid[0][col] = isUpperActuated(grid[0][col]) ? CELL_STATES.EXPAND : CELL_STATES.BEND_UP
  }

  return grid
}

export function createOverhangGrid(): CellGrid {
  const grid = createGrid(OVERHANG_ROWS, OVERHANG_COLUMNS, CELL_STATES.OFF)

  for (let row = 1; row < OVERHANG_ROWS - 1; row += 1) {
    for (let col = 2; col <= 8; col += 1) {
      grid[row][col] = CELL_STATES.BEND_UP
    }

    for (let col = 9; col <= 12; col += 1) {
      grid[row][col] = CELL_STATES.EXPAND
    }

    for (let col = 13; col <= 17; col += 1) {
      grid[row][col] = CELL_STATES.BEND_DOWN
    }
  }

  return grid
}

export function sanitizeParams(params: CellParams): CellParams {
  const hOff = clampNumber(params.hOff, 0.25, 8)
  const hOn = clampNumber(params.hOn, 0.15, hOff)
  const plateSize = clampNumber(params.plateSize, 0.25, 3)

  return {
    hOff,
    hOn,
    plateSize,
    octagonFaceRatio: clampNumber(params.octagonFaceRatio, 0.1, 4),
    // If the requested leg is shorter than half the ideal layer height, the
    // layout relaxes resultant height later instead of stretching the leg.
    linkLength: clampNumber(params.linkLength, 0.25, 8),
    showLabels: params.showLabels,
    animate: params.animate,
    constrainPerimeter: params.constrainPerimeter,
  }
}

export function stateMeta(state: CellState) {
  return STATE_META.find((entry) => entry.value === state) ?? STATE_META[0]
}

export function nextCellState(state: CellState): CellState {
  const index = CELL_STATE_SEQUENCE.indexOf(state)
  return CELL_STATE_SEQUENCE[(index + 1) % CELL_STATE_SEQUENCE.length]
}

export function isUpperActuated(state: CellState): boolean {
  return state === CELL_STATES.BEND_DOWN || state === CELL_STATES.EXPAND
}

export function isLowerActuated(state: CellState): boolean {
  return state === CELL_STATES.BEND_UP || state === CELL_STATES.EXPAND
}

export function layerHeight(state: CellState, layer: LayerName, params: CellParams, time = 0): number {
  const actuated = layer === 'upper' ? isUpperActuated(state) : isLowerActuated(state)
  const baseHeight = actuated ? params.hOn : params.hOff

  if (!params.animate || !actuated) return baseHeight

  // The animation changes layer height, then recomputes side-node offset from the
  // same link-length equation. That keeps the two links visually constant length.
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.2)
  return params.hOff + (baseHeight - params.hOff) * pulse
}

export function layerStack(state: CellState, params: CellParams, time = 0) {
  const bottomH = layerHeight(state, 'lower', params, time)
  const topH = layerHeight(state, 'upper', params, time)

  return {
    bottomH,
    topH,
    bottomZ: 0,
    middleZ: bottomH,
    topZ: bottomH + topH,
    lowerNodeZ: bottomH / 2,
    upperNodeZ: bottomH + topH / 2,
  }
}

export function buildArrayLayout(grid: CellGrid, params: CellParams, time = 0): CellLayout[][] {
  const planarStrip = isPlanarStrip(grid)
  const poses = planarStrip ? buildPlanarStripPoses(grid, params, time) : buildInitialPoses(grid, params, time)
  if (!planarStrip) solveConnectorPoses(grid, params, poses)

  const layout = buildLayoutFromPoses(grid, params, poses)
  normalizeLayoutFloor(layout)
  populateSymmetricNodes(layout)
  return layout
}

function buildInitialPoses(grid: CellGrid, params: CellParams, time: number): CellPose[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const lowerX = buildLayerAxisCenters(grid, params, 'lower', 'x', time)
  const upperX = buildLayerAxisCenters(grid, params, 'upper', 'x', time)
  const lowerY = buildLayerAxisCenters(grid, params, 'lower', 'y', time)
  const upperY = buildLayerAxisCenters(grid, params, 'upper', 'y', time)

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => {
      const state = grid[row][col]
      const lowerTarget = layerHeight(state, 'lower', params, time)
      const upperTarget = layerHeight(state, 'upper', params, time)
      const centerSpan = Math.max((lowerTarget + upperTarget) / 2, 0.0001)
      const centerDx = upperX[row][col] - lowerX[row][col]
      const centerDy = upperY[row][col] - lowerY[row][col]
      const centerDz = Math.sqrt(Math.max(centerSpan ** 2 - centerDx ** 2 - centerDy ** 2, 0))
      const axis = normalize([centerDx, centerDy, centerDz])
      const lowerCenter: Vec3 = [lowerX[row][col], lowerY[row][col], axis[2] * lowerTarget * 0.5]
      const upperCenter: Vec3 = [
        lowerX[row][col] + axis[0] * centerSpan,
        lowerY[row][col] + axis[1] * centerSpan,
        axis[2] * (lowerTarget * 0.5 + centerSpan),
      ]
      const locked = params.constrainPerimeter && isPerimeterCell(row, col, rows, columns)
      const lockedLowerCenter = perimeterAnchorCenter(row, col, rows, columns, params, 'lower')
      const lockedUpperCenter = perimeterAnchorCenter(row, col, rows, columns, params, 'upper')

      return {
        lowerCenter: locked ? [...lockedLowerCenter] : lowerCenter,
        upperCenter: locked ? [...lockedUpperCenter] : upperCenter,
        lowerTarget,
        upperTarget,
        lowerHeight: lowerTarget,
        upperHeight: upperTarget,
        yaw: 0,
        yawTarget: 0,
        locked,
        lockedLowerCenter,
        lockedUpperCenter,
        lockedYaw: 0,
      }
    }),
  )
}

function buildPlanarStripPoses(grid: CellGrid, params: CellParams, time: number): CellPose[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const alongAxis: AxisName = columns >= rows ? 'x' : 'y'
  const primaryCount = alongAxis === 'x' ? columns : rows
  const crossCount = alongAxis === 'x' ? rows : columns
  const bendSteps = smoothStripBendSteps(grid, params, time, alongAxis, primaryCount, crossCount)
  const angles = stripCellAngles(bendSteps)
  const centerline = stripCenterline(grid, params, time, alongAxis, primaryCount, crossCount, angles)
  const crossCenters = cumulativeCenters(crossCount, () => nominalCellPitch(params))

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => {
      const state = grid[row][col]
      const primaryIndex = alongAxis === 'x' ? col : row
      const crossIndex = alongAxis === 'x' ? row : col
      const lowerTarget = layerHeight(state, 'lower', params, time)
      const upperTarget = layerHeight(state, 'upper', params, time)
      const centerSpan = Math.max((lowerTarget + upperTarget) / 2, 0.0001)
      const angle = angles[primaryIndex]
      const normalAlong = -Math.sin(angle)
      const normalZ = Math.cos(angle)
      const center = centerline[primaryIndex]
      const crossCenter = crossCenters[crossIndex] ?? 0
      const lowerAlong = center[0] - normalAlong * centerSpan * 0.5
      const upperAlong = center[0] + normalAlong * centerSpan * 0.5
      const lowerZ = center[1] - normalZ * centerSpan * 0.5
      const upperZ = center[1] + normalZ * centerSpan * 0.5
      const lowerCenter: Vec3 = alongAxis === 'x' ? [lowerAlong, crossCenter, lowerZ] : [crossCenter, lowerAlong, lowerZ]
      const upperCenter: Vec3 = alongAxis === 'x' ? [upperAlong, crossCenter, upperZ] : [crossCenter, upperAlong, upperZ]
      const locked = params.constrainPerimeter && isPerimeterCell(row, col, rows, columns)
      const lockedLowerCenter = perimeterAnchorCenter(row, col, rows, columns, params, 'lower')
      const lockedUpperCenter = perimeterAnchorCenter(row, col, rows, columns, params, 'upper')

      return {
        lowerCenter: locked ? [...lockedLowerCenter] : lowerCenter,
        upperCenter: locked ? [...lockedUpperCenter] : upperCenter,
        lowerTarget,
        upperTarget,
        lowerHeight: lowerTarget,
        upperHeight: upperTarget,
        yaw: 0,
        yawTarget: 0,
        locked,
        lockedLowerCenter,
        lockedUpperCenter,
        lockedYaw: 0,
      }
    }),
  )
}

function smoothStripBendSteps(
  grid: CellGrid,
  params: CellParams,
  time: number,
  alongAxis: AxisName,
  primaryCount: number,
  crossCount: number,
): number[] {
  const raw = Array.from({ length: primaryCount }, (_, index) => {
    let sum = 0
    for (let crossIndex = 0; crossIndex < crossCount; crossIndex += 1) {
      const state = alongAxis === 'x' ? grid[crossIndex][index] : grid[index][crossIndex]
      sum += layerOffset(state, 'lower', params, time) - layerOffset(state, 'upper', params, time)
    }

    return sum / Math.max(crossCount, 1)
  })

  const bendGain = 0.42
  const displacementRatio = clampNumber((params.hOff - params.hOn) / Math.max(params.hOff, 0.0001), 0, 1)
  const maxStep = 0.22 + displacementRatio * 0.36

  return raw.map((value, index) => {
    const prev = raw[Math.max(index - 1, 0)]
    const next = raw[Math.min(index + 1, raw.length - 1)]
    const smoothed = prev * 0.22 + value * 0.56 + next * 0.22
    return clampNumber(smoothed * bendGain, -maxStep, maxStep)
  })
}

function stripCellAngles(bendSteps: number[]): number[] {
  if (bendSteps.length === 0) return []

  const angles = Array.from({ length: bendSteps.length }, () => 0)
  for (let index = 1; index < bendSteps.length; index += 1) {
    angles[index] = angles[index - 1] + (bendSteps[index - 1] + bendSteps[index]) * 0.5
  }

  const mean = angles.reduce((sum, angle) => sum + angle, 0) / angles.length
  return angles.map((angle) => clampNumber(angle - mean, -Math.PI * 0.46, Math.PI * 0.46))
}

function stripCenterline(
  grid: CellGrid,
  params: CellParams,
  time: number,
  alongAxis: AxisName,
  primaryCount: number,
  crossCount: number,
  angles: number[],
): Array<[number, number]> {
  if (primaryCount <= 0) return []

  const averageOffsets = Array.from({ length: primaryCount }, (_, index) => {
    let sum = 0
    for (let crossIndex = 0; crossIndex < crossCount; crossIndex += 1) {
      const state = alongAxis === 'x' ? grid[crossIndex][index] : grid[index][crossIndex]
      sum += (layerOffset(state, 'lower', params, time) + layerOffset(state, 'upper', params, time)) * 0.5
    }

    return sum / Math.max(crossCount, 1)
  })

  const centers: Array<[number, number]> = [[0, 0]]
  for (let index = 1; index < primaryCount; index += 1) {
    const gap = averageOffsets[index - 1] + averageOffsets[index]
    const angle = (angles[index - 1] + angles[index]) * 0.5
    const previous = centers[index - 1]
    centers[index] = [previous[0] + Math.cos(angle) * gap, previous[1] + Math.sin(angle) * gap]
  }

  const originAlong = (centers[0][0] + centers[centers.length - 1][0]) * 0.5
  const minZ = Math.min(...centers.map((center) => center[1]))
  return centers.map((center) => [center[0] - originAlong, center[1] - minZ])
}

function buildLayoutFromPoses(grid: CellGrid, params: CellParams, poses: CellPose[][]): CellLayout[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const layout = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => {
      const pose = poses[row][col]
      const lowerHeight = clampLayerHeight(pose.lowerHeight, params)
      const upperHeight = clampLayerHeight(pose.upperHeight, params)
      pose.lowerHeight = lowerHeight
      pose.upperHeight = upperHeight
      const targetTotal = Math.max(lowerHeight + upperHeight, 0.0001)
      const lowerRatio = lowerHeight / targetTotal
      const upperRatio = upperHeight / targetTotal
      const centerDelta = subtract(pose.upperCenter, pose.lowerCenter)
      const centerDistance = Math.max(vectorLength(centerDelta), 0.0001)
      const axis = normalize(centerDelta)
      const actualTotal = Math.min(centerDistance * 2, maxTotalSpan(params, lowerRatio, upperRatio))
      const bottomH = actualTotal * lowerRatio
      const topH = actualTotal * upperRatio
      const lowerCenter = pose.lowerCenter
      const upperCenter = pose.locked ? pose.upperCenter : add(lowerCenter, scale(axis, actualTotal * 0.5))
      if (!pose.locked) pose.upperCenter = upperCenter
      const bottom = subtract(lowerCenter, scale(axis, bottomH * 0.5))
      const middle = add(lowerCenter, scale(axis, bottomH * 0.5))
      const top = add(upperCenter, scale(axis, topH * 0.5))

      return {
        bottom,
        middle,
        top,
        lowerCenter,
        upperCenter,
        bottomH,
        topH,
        lowerOffset: sideNodeOffset(bottomH, params),
        upperOffset: sideNodeOffset(topH, params),
        yaw: pose.yaw,
        nodes: emptyNodeRecord(),
      }
    }),
  )

  populateSymmetricNodes(layout)

  return layout
}

export function sideDirection(side: SideName): [number, number] {
  if (side === 'px') return [1, 0]
  if (side === 'nx') return [-1, 0]
  if (side === 'py') return [0, 1]
  return [0, -1]
}

export function sideNodeLocalPosition(
  state: CellState,
  layer: LayerName,
  side: SideName,
  params: CellParams,
  time = 0,
): Vec3 {
  const stack = layerStack(state, params, time)
  const height = layer === 'upper' ? stack.topH : stack.bottomH
  const z = layer === 'upper' ? stack.upperNodeZ : stack.lowerNodeZ
  const offset = sideNodeOffset(height, params)
  const [dx, dy] = sideDirection(side)

  return [dx * offset, dy * offset, z]
}

export function sideNodePositionFromLayout(layout: CellLayout, layer: LayerName, side: SideName): Vec3 {
  return layout.nodes[layer][side]
}

export function sideVectorFromLayout(layout: CellLayout, side: SideName): Vec3 {
  const axis = normalize(subtract(layout.top, layout.bottom))
  const yawSeed: Vec3 = [Math.cos(layout.yaw), Math.sin(layout.yaw), 0]
  const fallbackSeed: Vec3 = [-Math.sin(layout.yaw), Math.cos(layout.yaw), 0]
  const seed = vectorLength(subtract(yawSeed, scale(axis, dot(yawSeed, axis)))) > 0.02 ? yawSeed : fallbackSeed
  const basisX = normalize(subtract(seed, scale(axis, dot(seed, axis))))
  const basisY = normalize(cross(axis, basisX))

  if (side === 'px') return basisX
  if (side === 'nx') return scale(basisX, -1)
  if (side === 'py') return basisY
  return scale(basisY, -1)
}

export function plateNormal(layout: CellLayout, level: 'bottom' | 'middle' | 'top'): Vec3 {
  const lower = normalize(subtract(layout.middle, layout.bottom))
  const upper = normalize(subtract(layout.top, layout.middle))

  if (level === 'bottom') return lower
  if (level === 'top') return upper
  return normalize(add(lower, upper))
}

export function layoutBounds(layout: CellLayout[][]): LayoutBounds {
  const points: Vec3[] = []

  layout.forEach((row) =>
    row.forEach((cell) => {
      points.push(cell.bottom, cell.middle, cell.top)
      SIDE_NAMES.forEach((side) => {
        points.push(sideNodePositionFromLayout(cell, 'lower', side))
        points.push(sideNodePositionFromLayout(cell, 'upper', side))
      })
    }),
  )

  if (points.length === 0) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], span: [1, 1, 1] }
  }

  const min: Vec3 = [...points[0]]
  const max: Vec3 = [...points[0]]

  points.forEach((point) => {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  })

  return {
    min,
    max,
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    span: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

export function roundForInput(value: number): number {
  return Math.round(value * 100) / 100
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function buildLayerAxisCenters(
  grid: CellGrid,
  params: CellParams,
  layer: LayerName,
  axis: AxisName,
  time: number,
): number[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0

  if (axis === 'x') {
    return Array.from({ length: rows }, (_, row) => {
      const centers = cumulativeCenters(columns, (col) => layerPitch(grid[row][col], grid[row][col + 1], layer, params, time))
      return Array.from({ length: columns }, (_, col) => centers[col])
    })
  }

  const centersByColumn = Array.from({ length: columns }, (_, col) =>
    cumulativeCenters(rows, (row) => layerPitch(grid[row][col], grid[row + 1][col], layer, params, time)),
  )

  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => centersByColumn[col][row]))
}

function layerPitch(a: CellState, b: CellState, layer: LayerName, params: CellParams, time: number): number {
  return layerOffset(a, layer, params, time) + layerOffset(b, layer, params, time)
}

function layerOffset(state: CellState, layer: LayerName, params: CellParams, time: number): number {
  return sideNodeOffset(layerHeight(state, layer, params, time), params)
}

function cumulativeCenters(count: number, gap: (index: number) => number): number[] {
  if (count <= 0) return []

  const centers = [0]
  for (let index = 1; index < count; index += 1) {
    centers[index] = centers[index - 1] + gap(index - 1)
  }

  const origin = (centers[0] + centers[centers.length - 1]) / 2
  return centers.map((center) => center - origin)
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
}

function vectorLength(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function shiftZ(vector: Vec3, amount: number): Vec3 {
  return [vector[0], vector[1], vector[2] + amount]
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function rotatePointSmall(point: Vec3, pivot: Vec3, axis: Vec3, radians: number): Vec3 {
  return add(point, scale(cross(axis, subtract(point, pivot)), radians))
}

function emptyNodeRecord(): Record<LayerName, Record<SideName, Vec3>> {
  return {
    lower: {
      px: [0, 0, 0],
      nx: [0, 0, 0],
      py: [0, 0, 0],
      ny: [0, 0, 0],
    },
    upper: {
      px: [0, 0, 0],
      nx: [0, 0, 0],
      py: [0, 0, 0],
      ny: [0, 0, 0],
    },
  }
}

function symmetricSideNodePosition(layout: CellLayout, layer: LayerName, side: SideName): Vec3 {
  const center = layer === 'upper' ? layout.upperCenter : layout.lowerCenter
  const offset = layer === 'upper' ? layout.upperOffset : layout.lowerOffset
  return add(center, scale(sideVectorFromLayout(layout, side), offset))
}

function populateSymmetricNodes(layout: CellLayout[][]): void {
  layout.forEach((row) =>
    row.forEach((cell) => {
      SIDE_NAMES.forEach((side) => {
        cell.nodes.lower[side] = symmetricSideNodePosition(cell, 'lower', side)
        cell.nodes.upper[side] = symmetricSideNodePosition(cell, 'upper', side)
      })
    }),
  )
}

function normalizeLayoutFloor(layout: CellLayout[][]): void {
  const minZ = Math.min(...layout.flatMap((row) => row.map((cell) => Math.min(cell.bottom[2], cell.middle[2], cell.top[2]))), 0)
  if (Math.abs(minZ) <= 0.0001) return

  layout.forEach((row) =>
    row.forEach((cell) => {
      shiftCell(cell, -minZ)
    }),
  )
}

function shiftCell(cell: CellLayout, amount: number): void {
  cell.bottom = shiftZ(cell.bottom, amount)
  cell.middle = shiftZ(cell.middle, amount)
  cell.top = shiftZ(cell.top, amount)
  cell.lowerCenter = shiftZ(cell.lowerCenter, amount)
  cell.upperCenter = shiftZ(cell.upperCenter, amount)
}

// Kinematic model: every layer keeps the Sarrus link length fixed by deriving
// side-node offset from the current layer height. Connector constraints move
// whole cell poses and layer centers; final rendering never snaps a side node
// independently, because that would fake connector closure by stretching legs.
// Connections are solved with free rotation and bend propagation. Individual
// side nodes are never pulled independently, so each cell remains symmetric and
// all same-cell legs keep the same length.
// One/two-cell-wide strips skip this 3D projection pass and use the deterministic
// initial planar layout instead. That avoids high-displacement corkscrew modes
// where a strip can satisfy connector pulls by twisting out of plane.
function solveConnectorPoses(grid: CellGrid, params: CellParams, poses: CellPose[][]): void {
  if (!hasActuatedCells(grid)) return

  const constraints = buildConnectorConstraints(grid)
  const cellCount = grid.length * (grid[0]?.length ?? 0)
  const overhangSurface = isOverhangSurface(grid, params)
  const baseSettlePasses = overhangSurface ? 72 : cellCount > 2500 ? 3 : cellCount > 900 ? 8 : cellCount > 225 ? 18 : 56
  const settlePasses = params.constrainPerimeter ? baseSettlePasses : Math.min(baseSettlePasses, 28)
  const finalPasses = overhangSurface ? 72 : cellCount > 2500 ? 4 : cellCount > 900 ? 8 : Math.max(12, Math.floor(settlePasses * 0.65))

  for (let pass = 0; pass < settlePasses; pass += 1) {
    const layout = buildLayoutFromPoses(grid, params, poses)

    constraints.forEach((constraint) => {
      projectConnectorConstraint(poses, layout, constraint, params, overhangSurface ? 0.62 : 0.28, true, false)
    })

    poses.forEach((row) =>
      row.forEach((pose) => {
        projectPoseSpan(pose, params)
        relaxPoseYaw(pose)
      }),
    )

  }

  for (let pass = 0; pass < finalPasses; pass += 1) {
    const layout = buildLayoutFromPoses(grid, params, poses)
    constraints.forEach((constraint) => {
      projectConnectorConstraint(poses, layout, constraint, params, overhangSurface ? 0.74 : 0.34, true, pass > finalPasses * 0.35)
    })
    poses.forEach((row) =>
      row.forEach((pose) => {
        projectPoseSpan(pose, params)
        relaxPoseYaw(pose)
      }),
    )
  }
}

function hasActuatedCells(grid: CellGrid): boolean {
  return grid.some((row) => row.some((state) => state !== CELL_STATES.OFF))
}

function isPlanarStrip(grid: CellGrid): boolean {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  return Math.max(rows, columns) >= 4 && (rows <= 2 || columns <= 2)
}

function isOverhangSurface(grid: CellGrid, params: CellParams): boolean {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  return params.constrainPerimeter && rows >= 5 && columns >= 8 && hasInteriorActuation(grid)
}

function hasInteriorActuation(grid: CellGrid): boolean {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0

  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < columns - 1; col += 1) {
      if (grid[row][col] !== CELL_STATES.OFF) return true
    }
  }

  return false
}

function buildConnectorConstraints(grid: CellGrid): ConnectorConstraint[] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const constraints: ConnectorConstraint[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      constraints.push({ aRow: row, aCol: col, aSide: 'px', bRow: row, bCol: col + 1, bSide: 'nx', layer: 'lower' })
      constraints.push({ aRow: row, aCol: col, aSide: 'px', bRow: row, bCol: col + 1, bSide: 'nx', layer: 'upper' })
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      constraints.push({ aRow: row, aCol: col, aSide: 'py', bRow: row + 1, bCol: col, bSide: 'ny', layer: 'lower' })
      constraints.push({ aRow: row, aCol: col, aSide: 'py', bRow: row + 1, bCol: col, bSide: 'ny', layer: 'upper' })
    }
  }

  return constraints
}

function projectConnectorConstraint(
  poses: CellPose[][],
  layout: CellLayout[][],
  constraint: ConnectorConstraint,
  params: CellParams,
  strength: number,
  allowYaw: boolean,
  allowHeightFlex: boolean,
): void {
  const aLayout = layout[constraint.aRow][constraint.aCol]
  const bLayout = layout[constraint.bRow][constraint.bCol]
  const aPose = poses[constraint.aRow][constraint.aCol]
  const bPose = poses[constraint.bRow][constraint.bCol]
  const start = sideNodePositionFromLayout(aLayout, constraint.layer, constraint.aSide)
  const end = sideNodePositionFromLayout(bLayout, constraint.layer, constraint.bSide)
  const delta = subtract(end, start)
  const currentLength = vectorLength(delta)
  if (currentLength <= 0.000001) return

  const direction = scale(delta, 1 / currentLength)
  const maxCorrection = Math.max(nominalCellPitch(params), params.linkLength, params.plateSize) * 0.42
  const correctionLength = clampNumber(currentLength * 0.5 * strength, -maxCorrection, maxCorrection)
  const correction = scale(direction, correctionLength)
  // Node-to-node connectors are hard couplings in the visual model. Solver
  // relaxation can tilt/yaw cells or relax layer height, but it cannot leave a
  // connector stretched between separated side nodes.
  const couplingCorrection = correction
  const aCanMove = !aPose.locked
  const bCanMove = !bPose.locked
  const aScale = aCanMove && bCanMove ? 1 : aCanMove ? 2 : 0
  const bScale = aCanMove && bCanMove ? 1 : bCanMove ? 2 : 0
  const aRotationScale = aPose.locked ? 0.35 : bCanMove ? 1 : 2
  const bRotationScale = bPose.locked ? 0.35 : aCanMove ? 1 : 2

  if (allowYaw) {
    rotatePoseTiltTowardNodeMove(aPose, aLayout, constraint.layer, constraint.aSide, scale(correction, aRotationScale), strength * 0.31, 0)
    rotatePoseTiltTowardNodeMove(aPose, aLayout, constraint.layer, constraint.aSide, scale(correction, aRotationScale), strength * 0.31, 1)
    rotatePoseYawTowardNodeMove(aPose, aLayout, constraint.layer, constraint.aSide, scale(correction, aRotationScale), strength * 0.5)
    rotatePoseTiltTowardNodeMove(bPose, bLayout, constraint.layer, constraint.bSide, scale(correction, -bRotationScale), strength * 0.31, 0)
    rotatePoseTiltTowardNodeMove(bPose, bLayout, constraint.layer, constraint.bSide, scale(correction, -bRotationScale), strength * 0.31, 1)
    rotatePoseYawTowardNodeMove(bPose, bLayout, constraint.layer, constraint.bSide, scale(correction, -bRotationScale), strength * 0.5)
  }
  movePoseLayer(aPose, constraint.layer, scale(couplingCorrection, aScale))
  movePoseLayer(bPose, constraint.layer, scale(couplingCorrection, -bScale))
  if (allowHeightFlex) {
    const flexStrength = strength
    if (aPose.locked) {
      relaxPoseLayerHeightTowardNodeMove(aPose, aLayout, constraint.layer, constraint.aSide, correction, params, flexStrength)
    } else {
      relaxPoseLayerHeightByDistance(aPose, constraint.layer, currentLength, params, flexStrength)
    }

    if (bPose.locked) {
      relaxPoseLayerHeightTowardNodeMove(bPose, bLayout, constraint.layer, constraint.bSide, scale(correction, -1), params, flexStrength)
    } else {
      relaxPoseLayerHeightByDistance(bPose, constraint.layer, currentLength, params, flexStrength)
    }
  }
}

function movePoseLayer(pose: CellPose, layer: LayerName, correction: Vec3): void {
  if (pose.locked) {
    if (layer === 'lower') {
      pose.lowerCenter = add(pose.lowerCenter, correction)
      pose.upperCenter = add(pose.upperCenter, scale(correction, -1))
    } else {
      pose.upperCenter = add(pose.upperCenter, correction)
      pose.lowerCenter = add(pose.lowerCenter, scale(correction, -1))
    }
    return
  }

  if (layer === 'lower') {
    pose.lowerCenter = add(pose.lowerCenter, correction)
  } else {
    pose.upperCenter = add(pose.upperCenter, correction)
  }
}

function relaxPoseLayerHeightTowardNodeMove(
  pose: CellPose,
  layout: CellLayout,
  layer: LayerName,
  side: SideName,
  desiredNodeMove: Vec3,
  params: CellParams,
  strength: number,
): void {
  const height = layer === 'lower' ? pose.lowerHeight : pose.upperHeight
  const lateralSpan = Math.sqrt(Math.max(params.linkLength ** 2 - (height / 2) ** 2, 0))
  if (lateralSpan <= 0.0001) return

  const sideVector = sideVectorFromLayout(layout, side)
  const nodeMoveAlongSide = dot(desiredNodeMove, sideVector)
  const offsetChangePerHeight = -height / (4 * lateralSpan)
  const delta = clampNumber((nodeMoveAlongSide / offsetChangePerHeight) * strength, -0.08, 0.08)

  if (layer === 'lower') {
    pose.lowerHeight = clampLayerHeight(pose.lowerHeight + delta, params)
  } else {
    pose.upperHeight = clampLayerHeight(pose.upperHeight + delta, params)
  }
}

function relaxPoseLayerHeightByDistance(pose: CellPose, layer: LayerName, connectorError: number, params: CellParams, strength: number): void {
  const delta = clampNumber(connectorError * strength * 0.08, -0.08, 0.08)
  if (layer === 'lower') {
    pose.lowerHeight = clampLayerHeight(pose.lowerHeight - delta, params)
  } else {
    pose.upperHeight = clampLayerHeight(pose.upperHeight - delta, params)
  }
}

function rotatePoseYawTowardNodeMove(
  pose: CellPose,
  layout: CellLayout,
  layer: LayerName,
  side: SideName,
  desiredMove: Vec3,
  strength: number,
): void {
  if (pose.locked) return

  const center = layer === 'upper' ? layout.upperCenter : layout.lowerCenter
  const radius = subtract(sideNodePositionFromLayout(layout, layer, side), center)
  const tangent = cross([0, 0, 1], radius)
  const tangentLengthSq = Math.max(dot(tangent, tangent), 0.0001)
  const yawDelta = clampNumber((dot(desiredMove, tangent) / tangentLengthSq) * strength, -0.008, 0.008)
  const maxYaw = Math.PI / 10
  pose.yaw = clampNumber(pose.yaw + yawDelta, pose.yawTarget - maxYaw, pose.yawTarget + maxYaw)
}

function rotatePoseTiltTowardNodeMove(
  pose: CellPose,
  layout: CellLayout,
  layer: LayerName,
  side: SideName,
  desiredMove: Vec3,
  strength: number,
  axisIndex: 0 | 1,
): void {
  const pivot = scale(add(pose.lowerCenter, pose.upperCenter), 0.5)
  const axis: Vec3 = axisIndex === 0 ? [1, 0, 0] : [0, 1, 0]
  const radius = subtract(sideNodePositionFromLayout(layout, layer, side), pivot)
  const tangent = cross(axis, radius)
  const tangentLengthSq = Math.max(dot(tangent, tangent), 0.0001)
  const angleDelta = clampNumber((dot(desiredMove, tangent) / tangentLengthSq) * strength, -0.024, 0.024)

  if (Math.abs(angleDelta) <= 0.000001) return

  pose.lowerCenter = rotatePointSmall(pose.lowerCenter, pivot, axis, angleDelta)
  pose.upperCenter = rotatePointSmall(pose.upperCenter, pivot, axis, angleDelta)

  if (pose.locked) {
    pinLockedPose(pose)
  }
}

function relaxPoseYaw(pose: CellPose): void {
  if (pose.locked) {
    pinLockedPose(pose)
  }
}

function projectPoseSpan(pose: CellPose, params: CellParams): void {
  const delta = subtract(pose.upperCenter, pose.lowerCenter)
  const currentLength = vectorLength(delta)
  if (currentLength <= 0.0001) return

  const targetStrength = 0.004
  const direction = scale(delta, 1 / currentLength)
  pose.lowerHeight += (pose.lowerTarget - pose.lowerHeight) * targetStrength
  pose.upperHeight += (pose.upperTarget - pose.upperHeight) * targetStrength
  pose.lowerHeight = clampLayerHeight(pose.lowerHeight, params)
  pose.upperHeight = clampLayerHeight(pose.upperHeight, params)

  const targetLength = (pose.lowerHeight + pose.upperHeight) * 0.5
  const lowerRatio = pose.lowerHeight / Math.max(pose.lowerHeight + pose.upperHeight, 0.0001)
  const upperRatio = pose.upperHeight / Math.max(pose.lowerHeight + pose.upperHeight, 0.0001)
  const hardLength = clampNumber(currentLength, 0.12, maxTotalSpan(params, lowerRatio, upperRatio) * 0.5)
  const hardError = currentLength - hardLength

  if (Math.abs(hardError) > 0.0001) {
    const hardCorrection = scale(direction, hardError * 0.5)
    pose.lowerCenter = add(pose.lowerCenter, hardCorrection)
    pose.upperCenter = add(pose.upperCenter, scale(hardCorrection, -1))
  }

  const adjustedDelta = subtract(pose.upperCenter, pose.lowerCenter)
  const adjustedLength = vectorLength(adjustedDelta)
  const adjustedDirection = scale(adjustedDelta, 1 / Math.max(adjustedLength, 0.0001))
  const targetError = adjustedLength - targetLength
  const targetCorrection = scale(adjustedDirection, targetError * 0.5 * targetStrength)
  pose.lowerCenter = add(pose.lowerCenter, targetCorrection)
  pose.upperCenter = add(pose.upperCenter, scale(targetCorrection, -1))

  preventPoseInversion(pose, params)

  if (pose.locked) {
    pinLockedPose(pose)
  }
}

function preventPoseInversion(pose: CellPose, params: Pick<CellParams, 'hOff' | 'hOn'>): void {
  if (pose.locked) return

  const minVerticalSpan = Math.min(Math.max(params.hOn, 0.15) * 0.2, Math.max(params.hOff, 0.25) * 0.08)
  const verticalSpan = pose.upperCenter[2] - pose.lowerCenter[2]
  if (verticalSpan >= minVerticalSpan) return

  const midZ = (pose.lowerCenter[2] + pose.upperCenter[2]) * 0.5
  pose.lowerCenter[2] = midZ - minVerticalSpan * 0.5
  pose.upperCenter[2] = midZ + minVerticalSpan * 0.5
}

function maxTotalSpan(params: Pick<CellParams, 'linkLength'>, lowerRatio: number, upperRatio: number): number {
  const largestRatio = Math.max(lowerRatio, upperRatio, 0.0001)
  return (params.linkLength * 2) / largestRatio
}

function clampLayerHeight(height: number, params: Pick<CellParams, 'linkLength'>): number {
  return clampNumber(height, 0.15, params.linkLength * 2)
}

function pinLockedPose(pose: CellPose): void {
  const lockedMid = scale(add(pose.lockedLowerCenter, pose.lockedUpperCenter), 0.5)
  const currentMid = scale(add(pose.lowerCenter, pose.upperCenter), 0.5)
  const correction = subtract(lockedMid, currentMid)
  pose.lowerCenter = add(pose.lowerCenter, correction)
  pose.upperCenter = add(pose.upperCenter, correction)
  pose.yaw = pose.lockedYaw
}

function isPerimeterCell(row: number, col: number, rows: number, columns: number): boolean {
  return row === 0 || col === 0 || row === rows - 1 || col === columns - 1
}

function perimeterAnchorCenter(row: number, col: number, rows: number, columns: number, params: CellParams, layer: LayerName): Vec3 {
  const pitch = nominalCellPitch(params)
  const x = (col - (columns - 1) * 0.5) * pitch
  const y = (row - (rows - 1) * 0.5) * pitch
  const z = layer === 'lower' ? params.hOff * 0.5 : params.hOff * 1.5

  return [x, y, z]
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length <= 0.0001) return [0, 0, 1]
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}
