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
    color: '#5f8ed9',
  },
  {
    value: CELL_STATES.BEND_DOWN,
    name: 'BEND_DOWN',
    label: 'Bend Down',
    shortLabel: 'DOWN',
    color: '#d45757',
  },
  {
    value: CELL_STATES.EXPAND,
    name: 'EXPAND',
    label: 'Expand',
    shortLabel: 'EXP',
    color: '#9b6bd5',
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
  hOn: 1,
  linkLength: 1.55,
  plateSize: 1.5,
  connectorLength: 0.15,
  showLabels: false,
  animate: false,
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
}

export type LayoutBounds = {
  min: Vec3
  max: Vec3
  center: Vec3
  span: Vec3
}

export function sideNodeOffset(height: number, params: Pick<CellParams, 'linkLength' | 'plateSize'>): number {
  const plateHalf = params.plateSize / 2
  const verticalHalfSpan = height / 2
  const lateralSpan = Math.sqrt(Math.max(params.linkLength ** 2 - verticalHalfSpan ** 2, 0))
  return plateHalf + lateralSpan
}

export function defaultCellPitch(params: Pick<CellParams, 'hOff' | 'linkLength' | 'plateSize' | 'connectorLength'>): number {
  return roundForInput(2 * sideNodeOffset(params.hOff, params) + params.connectorLength)
}

export const DEFAULT_PARAMS: CellParams = {
  ...DEFAULT_PARAM_SEED,
  cellPitch: defaultCellPitch(DEFAULT_PARAM_SEED),
}

export function createGrid(rows: number, columns: number, fill: CellState = CELL_STATES.OFF): CellGrid {
  return Array.from({ length: clampInteger(rows, 1, 12) }, () =>
    Array.from({ length: clampInteger(columns, 1, 12) }, () => fill),
  )
}

export function resizeGrid(grid: CellGrid, rows: number, columns: number): CellGrid {
  const safeRows = clampInteger(rows, 1, 12)
  const safeColumns = clampInteger(columns, 1, 12)

  return Array.from({ length: safeRows }, (_, row) =>
    Array.from({ length: safeColumns }, (_, col) => grid[row]?.[col] ?? CELL_STATES.OFF),
  )
}

export function randomGrid(rows: number, columns: number): CellGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => Math.floor(Math.random() * STATE_META.length) as CellState),
  )
}

export function sanitizeParams(params: CellParams): CellParams {
  const hOff = clampNumber(params.hOff, 0.25, 8)
  const hOn = clampNumber(params.hOn, 0.15, hOff)
  const plateSize = clampNumber(params.plateSize, 0.25, 3)

  return {
    hOff,
    hOn,
    plateSize,
    linkLength: clampNumber(params.linkLength, hOff / 2 + 0.05, 8),
    cellPitch: clampNumber(params.cellPitch, plateSize, 16),
    connectorLength: clampNumber(params.connectorLength, 0, 3),
    showLabels: params.showLabels,
    animate: params.animate,
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
  return baseHeight + (params.hOff - baseHeight) * pulse * 0.2
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

export function cellOrigin(row: number, col: number, params: CellParams): Vec3 {
  return [col * params.cellPitch, row * params.cellPitch, 0]
}

export function buildArrayLayout(grid: CellGrid, params: CellParams, time = 0): CellLayout[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const lowerX = buildLayerAxisCenters(grid, params, 'lower', 'x', time)
  const upperX = buildLayerAxisCenters(grid, params, 'upper', 'x', time)
  const lowerY = buildLayerAxisCenters(grid, params, 'lower', 'y', time)
  const upperY = buildLayerAxisCenters(grid, params, 'upper', 'y', time)

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => {
      const state = grid[row][col]
      const bottomH = layerHeight(state, 'lower', params, time)
      const topH = layerHeight(state, 'upper', params, time)
      const lowerOffset = sideNodeOffset(bottomH, params)
      const upperOffset = sideNodeOffset(topH, params)
      const bottom: Vec3 = [lowerX[row][col], lowerY[row][col], 0]
      const top: Vec3 = [upperX[row][col], upperY[row][col], bottomH + topH]
      const middle: Vec3 = [(lowerX[row][col] + upperX[row][col]) / 2, (lowerY[row][col] + upperY[row][col]) / 2, bottomH]

      return {
        bottom,
        middle,
        top,
        lowerCenter: [lowerX[row][col], lowerY[row][col], bottomH / 2],
        upperCenter: [upperX[row][col], upperY[row][col], bottomH + topH / 2],
        bottomH,
        topH,
        lowerOffset,
        upperOffset,
      }
    }),
  )
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

export function sideNodeWorldPosition(
  row: number,
  col: number,
  state: CellState,
  layer: LayerName,
  side: SideName,
  params: CellParams,
  time = 0,
): Vec3 {
  const [cx, cy] = cellOrigin(row, col, params)
  const [x, y, z] = sideNodeLocalPosition(state, layer, side, params, time)
  return [cx + x, cy + y, z]
}

export function arrayCenterOffset(rows: number, columns: number, params: CellParams): Vec3 {
  return [-(columns - 1) * params.cellPitch * 0.5, -(rows - 1) * params.cellPitch * 0.5, 0]
}

export function sideNodePositionFromLayout(layout: CellLayout, layer: LayerName, side: SideName): Vec3 {
  const [dx, dy] = sideDirection(side)
  const center = layer === 'upper' ? layout.upperCenter : layout.lowerCenter
  const offset = layer === 'upper' ? layout.upperOffset : layout.lowerOffset

  return [center[0] + dx * offset, center[1] + dy * offset, center[2]]
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
  axis: 'x' | 'y',
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
  return layerOffset(a, layer, params, time) + layerOffset(b, layer, params, time) + params.connectorLength
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

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length <= 0.0001) return [0, 0, 1]
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}
