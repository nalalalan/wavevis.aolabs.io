export const CELL_STATES = {
  OFF: 0,
  BEND_UP: 1,
  BEND_DOWN: 2,
  EXPAND: 3,
} as const

export type CellState = (typeof CELL_STATES)[keyof typeof CELL_STATES]

export type CellStateName = 'OFF' | 'BEND_UP' | 'BEND_DOWN' | 'EXPAND'

export type CellGrid = CellState[][]

export type LayerName = 'upper' | 'lower'

export type SideName = 'px' | 'nx' | 'py' | 'ny'

export type Vec3 = [number, number, number]

export type CellParams = {
  hOff: number
  hOn: number
  linkLength: number
  plateSize: number
  cellPitch: number
  connectorLength: number
  zRotationFlex: number
  angleFlex: number
  showLabels: boolean
  animate: boolean
}

export type CellStateMeta = {
  value: CellState
  name: CellStateName
  label: string
  shortLabel: string
  color: string
}
