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
  connectorLength: 0,
  zRotationFlex: 0,
  angleFlex: 0.85,
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
    zRotationFlex: clampNumber(params.zRotationFlex, 0, 180),
    angleFlex: clampNumber(params.angleFlex, 0, 1),
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

export function cellOrigin(row: number, col: number, params: CellParams): Vec3 {
  return [col * params.cellPitch, row * params.cellPitch, 0]
}

export function buildArrayLayout(grid: CellGrid, params: CellParams, time = 0): CellLayout[][] {
  const poses = buildInitialPoses(grid, params, time)
  solveConnectorPoses(grid, params, poses)

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
// side-node offset from the current layer height. The iterative pass treats red
// connector length as another hard constraint, then spends the allowed leeway on
// whole-cell z-yaw and small layer-height/expansion relaxation. Individual side
// nodes are never pulled independently, so each cell remains symmetric.
function solveConnectorPoses(grid: CellGrid, params: CellParams, poses: CellPose[][]): void {
  const constraints = buildConnectorConstraints(grid)

  for (let pass = 0; pass < 320; pass += 1) {
    const layout = buildLayoutFromPoses(grid, params, poses)

    constraints.forEach((constraint) => {
      projectConnectorConstraint(poses, layout, constraint, params, 0.42)
    })

    poses.forEach((row) =>
      row.forEach((pose) => {
        projectPoseSpan(pose, params)
        relaxPoseYaw(pose, 0.08)
      }),
    )
  }

  for (let pass = 0; pass < 1200; pass += 1) {
    const layout = buildLayoutFromPoses(grid, params, poses)
    constraints.forEach((constraint) => {
      projectConnectorConstraint(poses, layout, constraint, params, 0.62)
    })
    poses.forEach((row) =>
      row.forEach((pose) => {
        relaxPoseYaw(pose, 0.02)
      }),
    )
  }
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
  const correctionLength = clampNumber((currentLength - params.connectorLength) * 0.5 * strength, -0.08, 0.08)
  const correction = scale(direction, correctionLength)
  const aCanMove = !aPose.locked
  const bCanMove = !bPose.locked
  const aScale = aCanMove && bCanMove ? 1 : aCanMove ? 2 : 0
  const bScale = aCanMove && bCanMove ? 1 : bCanMove ? 2 : 0

  movePoseLayer(aPose, constraint.layer, scale(correction, aScale))
  movePoseLayer(bPose, constraint.layer, scale(correction, -bScale))
  relaxPoseLayerHeight(aPose, constraint.layer, currentLength - params.connectorLength, params, strength)
  relaxPoseLayerHeight(bPose, constraint.layer, currentLength - params.connectorLength, params, strength)
  rotatePoseTowardNodeMove(aPose, aLayout, constraint.layer, constraint.aSide, scale(correction, aScale), params, strength)
  rotatePoseTowardNodeMove(bPose, bLayout, constraint.layer, constraint.bSide, scale(correction, -bScale), params, strength)
}

function movePoseLayer(pose: CellPose, layer: LayerName, correction: Vec3): void {
  if (pose.locked) return

  if (layer === 'lower') {
    pose.lowerCenter = add(pose.lowerCenter, correction)
  } else {
    pose.upperCenter = add(pose.upperCenter, correction)
  }
}

function relaxPoseLayerHeight(pose: CellPose, layer: LayerName, connectorError: number, params: CellParams, strength: number): void {
  if (params.angleFlex <= 0) return

  const delta = clampNumber(connectorError * params.angleFlex * strength * 0.08, -0.08, 0.08)
  if (layer === 'lower') {
    pose.lowerHeight = clampLayerHeight(pose.lowerHeight - delta, params)
  } else {
    pose.upperHeight = clampLayerHeight(pose.upperHeight - delta, params)
  }
}

function rotatePoseTowardNodeMove(
  pose: CellPose,
  layout: CellLayout,
  layer: LayerName,
  side: SideName,
  desiredMove: Vec3,
  params: CellParams,
  strength: number,
): void {
  if (params.zRotationFlex <= 0 || params.connectorLength <= 0.0001 || pose.locked) return

  const center = layer === 'upper' ? layout.upperCenter : layout.lowerCenter
  const radius = subtract(sideNodePositionFromLayout(layout, layer, side), center)
  const tangent = cross([0, 0, 1], radius)
  const tangentLengthSq = Math.max(dot(tangent, tangent), 0.0001)
  const yawDelta = clampNumber((dot(desiredMove, tangent) / tangentLengthSq) * strength, -0.08, 0.08)
  pose.yaw = clampNumber(pose.yaw + yawDelta, pose.yawTarget - degreesToRadians(params.zRotationFlex), pose.yawTarget + degreesToRadians(params.zRotationFlex))
}

function relaxPoseYaw(pose: CellPose, strength: number): void {
  if (pose.locked) {
    restoreLockedPose(pose)
    return
  }

  pose.yaw += (pose.yawTarget - pose.yaw) * strength
}

function projectPoseSpan(pose: CellPose, params: CellParams): void {
  if (pose.locked) {
    restoreLockedPose(pose)
    return
  }

  const delta = subtract(pose.upperCenter, pose.lowerCenter)
  const currentLength = vectorLength(delta)
  if (currentLength <= 0.0001) return

  const targetStrength = params.connectorLength <= 0.0001 ? 0 : ((1 - params.angleFlex) ** 2) * 0.02
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
}

function maxTotalSpan(params: Pick<CellParams, 'linkLength'>, lowerRatio: number, upperRatio: number): number {
  const largestRatio = Math.max(lowerRatio, upperRatio, 0.0001)
  return ((params.linkLength * 2 - 0.02) / largestRatio)
}

function clampLayerHeight(height: number, params: Pick<CellParams, 'linkLength'>): number {
  return clampNumber(height, 0.15, params.linkLength * 2 - 0.02)
}

function restoreLockedPose(pose: CellPose): void {
  pose.lowerCenter = [...pose.lockedLowerCenter]
  pose.upperCenter = [...pose.lockedUpperCenter]
  pose.yaw = pose.lockedYaw
}

function isPerimeterCell(row: number, col: number, rows: number, columns: number): boolean {
  return row === 0 || col === 0 || row === rows - 1 || col === columns - 1
}

function perimeterAnchorCenter(row: number, col: number, rows: number, columns: number, params: CellParams, layer: LayerName): Vec3 {
  const x = (col - (columns - 1) * 0.5) * params.cellPitch
  const y = (row - (rows - 1) * 0.5) * params.cellPitch
  const z = layer === 'lower' ? params.hOff * 0.5 : params.hOff * 1.5

  return [x, y, z]
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function normalize(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length <= 0.0001) return [0, 0, 1]
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}
