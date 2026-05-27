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

export const DEFAULT_PARAM_SEED = {
  hOff: 3,
  hOn: 1.2,
  linkLength: 2,
  plateSize: 0.8,
  connectorLength: 0.15,
  showLabels: false,
  animate: false,
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

export function roundForInput(value: number): number {
  return Math.round(value * 100) / 100
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
