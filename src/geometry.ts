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

const PASSIVE_RESULTANT_RELAXATION_RATIO = 0.08
const COMPANION_PASSIVE_RELAXATION_RATIO = 0.04

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

type HeightCompatibilityConstraint = {
  aRow: number
  aCol: number
  bRow: number
  bCol: number
}

type LayerHeightFields = Record<LayerName, number[][]>

type CompatibilityDerivatives = {
  measure: number
  offsetDelta: number
  dMeasureLower: number
  dMeasureUpper: number
  dOffsetLower: number
  dOffsetUpper: number
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
  const layerHeights = solvePassiveLayerHeights(grid, params, time, planarStrip)
  const poses = planarStrip
    ? buildPlanarStripPoses(grid, params, layerHeights)
    : buildInitialPoses(grid, params, layerHeights)
  // Surface patches, including 2x2, still need the connector solve. Skipping it
  // leaves adjacent side nodes separated even though the individual legs remain
  // the right length.
  if (!planarStrip) solveConnectorPoses(grid, params, poses)

  const layout = buildLayoutFromPoses(grid, params, poses)
  normalizeLayoutFloor(layout, params)
  populateSymmetricNodes(layout)
  return layout
}

function buildInitialPoses(grid: CellGrid, params: CellParams, layerHeights: LayerHeightFields): CellPose[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const lowerX = buildLayerAxisCentersFromHeights(layerHeights.lower, params, 'x')
  const upperX = buildLayerAxisCentersFromHeights(layerHeights.upper, params, 'x')
  const lowerY = buildLayerAxisCentersFromHeights(layerHeights.lower, params, 'y')
  const upperY = buildLayerAxisCentersFromHeights(layerHeights.upper, params, 'y')

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => {
      const lowerTarget = layerHeights.lower[row][col]
      const upperTarget = layerHeights.upper[row][col]
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
      const locked = params.constrainPerimeter && isConstrainedCell(row, col, rows, columns)
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

function buildPlanarStripPoses(grid: CellGrid, params: CellParams, stripHeights: LayerHeightFields): CellPose[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const alongAxis: AxisName = columns >= rows ? 'x' : 'y'
  const primaryCount = alongAxis === 'x' ? columns : rows
  const crossCount = alongAxis === 'x' ? rows : columns
  const angles = exactStripCellAngles(params, alongAxis, primaryCount, crossCount, stripHeights)
  const lowerCenterline = exactStripLowerCenterline(params, alongAxis, primaryCount, crossCount, angles, stripHeights)
  const crossCenters = stripCrossCenters(params, alongAxis, primaryCount, crossCount, stripHeights)

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) => {
      const primaryIndex = alongAxis === 'x' ? col : row
      const crossIndex = alongAxis === 'x' ? row : col
      const lowerHeight = stripHeights.lower[row][col]
      const upperHeight = stripHeights.upper[row][col]
      const lowerTarget = lowerHeight
      const upperTarget = upperHeight
      const centerSpan = Math.max((lowerHeight + upperHeight) / 2, 0.0001)
      const angle = angles[primaryIndex]
      const axisAlong = Math.sin(angle)
      const axisZ = Math.cos(angle)
      const lowerCenterFromChain = lowerCenterline[primaryIndex]
      const crossCenter = crossCenters[crossIndex] ?? 0
      const lowerAlong = lowerCenterFromChain[0]
      const lowerZ = lowerCenterFromChain[1]
      const upperAlong = lowerAlong + axisAlong * centerSpan
      const upperZ = lowerZ + axisZ * centerSpan
      const lowerCenter: Vec3 = alongAxis === 'x' ? [lowerAlong, crossCenter, lowerZ] : [crossCenter, lowerAlong, lowerZ]
      const upperCenter: Vec3 = alongAxis === 'x' ? [upperAlong, crossCenter, upperZ] : [crossCenter, upperAlong, upperZ]
      const locked = false
      const lockedLowerCenter = perimeterAnchorCenter(row, col, rows, columns, params, 'lower')
      const lockedUpperCenter = perimeterAnchorCenter(row, col, rows, columns, params, 'upper')

      return {
        lowerCenter: locked ? [...lockedLowerCenter] : lowerCenter,
        upperCenter: locked ? [...lockedUpperCenter] : upperCenter,
        lowerTarget,
        upperTarget,
        lowerHeight,
        upperHeight,
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

function solvePassiveLayerHeights(grid: CellGrid, params: CellParams, time: number, enforceStripContact: boolean): LayerHeightFields {
  const targets = targetLayerHeights(grid, params, time)
  if (!hasActuatedCells(grid)) return targets
  if (!enforceStripContact) return seedSurfaceCompanionPassiveExpansion(grid, params, targets)

  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const lower = cloneHeightField(targets.lower)
  const upper = cloneHeightField(targets.upper)
  const lowerStiffness = buildLayerStiffnessMap(grid, params, time, 'lower')
  const upperStiffness = buildLayerStiffnessMap(grid, params, time, 'upper')
  const constraints = buildHeightCompatibilityConstraints(rows, columns)
  const passCount = enforceStripContact ? 96 : rows * columns > 2500 ? 28 : rows * columns > 900 ? 42 : 72
  const compatibilityStiffness = enforceStripContact ? 42 : 20
  const bodyShearStiffness = 7.5
  const minHeight = minimumSolvedLayerHeight(params)

  // This strip-only compatibility solve preserves direct node contact along a
  // 1D chain. Surface patches spend connector error through pose tilt/rotation
  // first, because otherwise neighboring OFF cells look passively actuated.
  for (let pass = 0; pass < passCount; pass += 1) {
    const stats = buildCompatibilityDerivativeField(lower, upper, params)
    const gradients = emptyGradientFields(rows, columns)
    const denominators = emptyGradientFields(rows, columns, 1)

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        addHeightTargetGradient(gradients, denominators, 'lower', row, col, lower[row][col], targets.lower[row][col], lowerStiffness[row][col])
        addHeightTargetGradient(gradients, denominators, 'upper', row, col, upper[row][col], targets.upper[row][col], upperStiffness[row][col])
        addSameCellShearGradient(gradients, denominators, stats[row][col], row, col, bodyShearStiffness)
      }
    }

    if (enforceStripContact) {
      const targetMeasure = averageCompatibilityMeasure(stats)
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          addCompatibilityTargetGradient(gradients, denominators, stats[row][col], row, col, targetMeasure, compatibilityStiffness)
        }
      }
    } else {
      constraints.forEach((constraint) => {
        const a = stats[constraint.aRow][constraint.aCol]
        const b = stats[constraint.bRow][constraint.bCol]
        addCompatibilityPairGradient(gradients, denominators, a, b, constraint, compatibilityStiffness)
      })
    }

    const baseStep = pass < passCount * 0.45 ? 0.075 : 0.045
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        lower[row][col] = clampNumber(
          lower[row][col] - (gradients.lower[row][col] / denominators.lower[row][col]) * baseStep,
          minHeight,
          params.linkLength * 2,
        )
        upper[row][col] = clampNumber(
          upper[row][col] - (gradients.upper[row][col] / denominators.upper[row][col]) * baseStep,
          minHeight,
          params.linkLength * 2,
        )
      }
    }
  }

  if (!enforceStripContact) return { lower, upper }

  let contactHeights: LayerHeightFields = { lower, upper }
  for (let pass = 0; pass < 3; pass += 1) {
    const compatibilityTarget = averageCompatibilityMeasure(buildCompatibilityDerivativeField(contactHeights.lower, contactHeights.upper, params))
    contactHeights = rebalanceStripHeightsForContact(contactHeights.lower, contactHeights.upper, params, compatibilityTarget)
  }

  return enforceStripBodyClearance(grid, params, contactHeights)
}

function seedSurfaceCompanionPassiveExpansion(grid: CellGrid, params: CellParams, targets: LayerHeightFields): LayerHeightFields {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  if (rows * columns <= 1) return targets

  const lower = cloneHeightField(targets.lower)
  const upper = cloneHeightField(targets.upper)
  const relaxedOffHeight = clampLayerHeight(clampLayerHeight(params.hOff, params) * (1 - COMPANION_PASSIVE_RELAXATION_RATIO), params)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const state = grid[row][col]
      const lowerActuated = isLowerActuated(state)
      const upperActuated = isUpperActuated(state)
      if (lowerActuated === upperActuated) continue

      // A single-layer actuation still pulls on the unpowered layer through the
      // shared middle plate and neighboring connector field. Seed the companion
      // layer with a smaller bounded passive allowance than connected OFF
      // neighbors; the actual solve still keeps the powered layer at its EM
      // target.
      if (lowerActuated) upper[row][col] = Math.min(upper[row][col], relaxedOffHeight)
      else lower[row][col] = Math.min(lower[row][col], relaxedOffHeight)
    }
  }

  return { lower, upper }
}

function targetLayerHeights(grid: CellGrid, params: CellParams, time: number): LayerHeightFields {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0

  return {
    lower: Array.from({ length: rows }, (_, row) =>
      Array.from({ length: columns }, (_, col) => clampLayerHeight(layerHeight(grid[row][col], 'lower', params, time), params)),
    ),
    upper: Array.from({ length: rows }, (_, row) =>
      Array.from({ length: columns }, (_, col) => clampLayerHeight(layerHeight(grid[row][col], 'upper', params, time), params)),
    ),
  }
}

function cloneHeightField(field: number[][]): number[][] {
  return field.map((row) => [...row])
}

function buildLayerStiffnessMap(grid: CellGrid, params: CellParams, time: number, layer: LayerName): number[][] {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const actuatedStiffness = 32
  const passiveStiffness = 1

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, col) =>
      layerCompressionDemand(grid[row][col], layer, params, time) > 0.0001 ? actuatedStiffness : passiveStiffness,
    ),
  )
}

function rebalanceStripHeightsForContact(
  lower: number[][],
  upper: number[][],
  params: CellParams,
  target: number,
): Record<LayerName, number[][]> {
  return {
    lower: lower.map((row, rowIndex) =>
      row.map((lowerHeight, colIndex) => projectLayerPairForContact(lowerHeight, upper[rowIndex][colIndex], params, target)[0]),
    ),
    upper: upper.map((row, rowIndex) =>
      row.map((upperHeight, colIndex) => projectLayerPairForContact(lower[rowIndex][colIndex], upperHeight, params, target)[1]),
    ),
  }
}

function projectLayerPairForContact(lowerHeight: number, upperHeight: number, params: CellParams, target: number): [number, number] {
  let lower = lowerHeight
  let upper = upperHeight
  const minHeight = minimumSolvedLayerHeight(params)

  for (let pass = 0; pass < 48; pass += 1) {
    const derivatives = compatibilityDerivatives(lower, upper, params)
    const error = derivatives.measure - target
    if (Math.abs(error) <= 0.0000001) break

    let lowerDerivative = derivatives.dMeasureLower
    let upperDerivative = derivatives.dMeasureUpper
    const maxHeight = params.linkLength * 2
    const lowerStepDirection = -error * lowerDerivative
    const upperStepDirection = -error * upperDerivative

    if ((lower >= maxHeight - 0.000001 && lowerStepDirection > 0) || (lower <= minHeight + 0.000001 && lowerStepDirection < 0)) {
      lowerDerivative = 0
    }

    if ((upper >= maxHeight - 0.000001 && upperStepDirection > 0) || (upper <= minHeight + 0.000001 && upperStepDirection < 0)) {
      upperDerivative = 0
    }

    const denominator = Math.max(lowerDerivative ** 2 + upperDerivative ** 2, 0.0001)
    lower = clampNumber(lower - (error * lowerDerivative) / denominator, minHeight, maxHeight)
    upper = clampNumber(upper - (error * upperDerivative) / denominator, minHeight, maxHeight)
  }

  return [lower, upper]
}

function enforceStripBodyClearance(grid: CellGrid, params: CellParams, heights: LayerHeightFields): LayerHeightFields {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const alongAxis: AxisName = columns >= rows ? 'x' : 'y'
  const primaryCount = alongAxis === 'x' ? columns : rows
  const crossCount = alongAxis === 'x' ? rows : columns
  const maxAdjacentAngle = stripBodyClearanceAngleLimit(params)
  let next = cloneHeightFields(heights)

  // Strip contact is a hard node-to-node rule, but the cells are not zero-width
  // mathematical bars. If exact actuation would fold adjacent octagonal bodies
  // through each other, relax the resultant layer split before rendering.
  for (let pass = 0; pass < 8; pass += 1) {
    const angles = exactStripCellAngles(params, alongAxis, primaryCount, crossCount, next)
    const worst = maxAdjacentAngleDelta(angles)
    if (worst <= maxAdjacentAngle) break

    const severity = clampNumber((worst - maxAdjacentAngle) / Math.max(worst, 0.0001), 0, 1)
    blendLayerSplitTowardClearance(next, 0.18 + severity * 0.34)
    const compatibilityTarget = averageCompatibilityMeasure(buildCompatibilityDerivativeField(next.lower, next.upper, params))
    next = rebalanceStripHeightsForContact(next.lower, next.upper, params, compatibilityTarget)
  }

  return next
}

function cloneHeightFields(fields: LayerHeightFields): LayerHeightFields {
  return {
    lower: cloneHeightField(fields.lower),
    upper: cloneHeightField(fields.upper),
  }
}

function maxAdjacentAngleDelta(angles: number[]): number {
  let worst = 0
  for (let index = 0; index < angles.length - 1; index += 1) {
    worst = Math.max(worst, Math.abs(angles[index + 1] - angles[index]))
  }
  return worst
}

function blendLayerSplitTowardClearance(fields: LayerHeightFields, strength: number): void {
  fields.lower.forEach((row, rowIndex) =>
    row.forEach((lowerHeight, colIndex) => {
      const upperHeight = fields.upper[rowIndex][colIndex]
      const averageHeight = (lowerHeight + upperHeight) * 0.5
      fields.lower[rowIndex][colIndex] = lowerHeight + (averageHeight - lowerHeight) * strength
      fields.upper[rowIndex][colIndex] = upperHeight + (averageHeight - upperHeight) * strength
    }),
  )
}

function stripBodyClearanceAngleLimit(params: Pick<CellParams, 'linkLength' | 'plateSize'>): number {
  const bodyToLegRatio = params.plateSize / Math.max(params.linkLength, 0.0001)
  return clampNumber(0.72 - bodyToLegRatio * 0.1, 0.54, 0.76)
}

function layerCompressionDemand(state: CellState, layer: LayerName, params: CellParams, time: number): number {
  const span = Math.max(params.hOff - params.hOn, 0.0001)
  return clampNumber((params.hOff - layerHeight(state, layer, params, time)) / span, 0, 1)
}

function buildHeightCompatibilityConstraints(rows: number, columns: number): HeightCompatibilityConstraint[] {
  const constraints: HeightCompatibilityConstraint[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      constraints.push({ aRow: row, aCol: col, bRow: row, bCol: col + 1 })
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      constraints.push({ aRow: row, aCol: col, bRow: row + 1, bCol: col })
    }
  }

  return constraints
}

function buildCompatibilityDerivativeField(lower: number[][], upper: number[][], params: CellParams): CompatibilityDerivatives[][] {
  return lower.map((row, rowIndex) =>
    row.map((lowerHeight, colIndex) => compatibilityDerivatives(lowerHeight, upper[rowIndex][colIndex], params)),
  )
}

function compatibilityDerivatives(lowerHeight: number, upperHeight: number, params: CellParams): CompatibilityDerivatives {
  const centerSpan = Math.max((lowerHeight + upperHeight) * 0.5, 0.0001)
  const lowerOffsetDerivative = sideNodeOffsetDerivative(lowerHeight, params)
  const upperOffsetDerivative = sideNodeOffsetDerivative(upperHeight, params)
  const offsetDelta = sideNodeOffset(upperHeight, params) - sideNodeOffset(lowerHeight, params)
  const measure = Math.max(Math.hypot(centerSpan, offsetDelta), 0.0001)

  return {
    measure,
    offsetDelta,
    dMeasureLower: (centerSpan * 0.5 - offsetDelta * lowerOffsetDerivative) / measure,
    dMeasureUpper: (centerSpan * 0.5 + offsetDelta * upperOffsetDerivative) / measure,
    dOffsetLower: lowerOffsetDerivative,
    dOffsetUpper: upperOffsetDerivative,
  }
}

function sideNodeOffsetDerivative(height: number, params: Pick<CellParams, 'linkLength'>): number {
  const lateralSpan = Math.sqrt(Math.max(params.linkLength ** 2 - (height / 2) ** 2, 0))
  const safeLateralSpan = Math.max(lateralSpan, 0.04)
  return -height / (4 * safeLateralSpan)
}

function averageCompatibilityMeasure(stats: CompatibilityDerivatives[][]): number {
  let sum = 0
  let count = 0

  stats.forEach((row) =>
    row.forEach((cell) => {
      sum += cell.measure
      count += 1
    }),
  )

  return count > 0 ? sum / count : 0
}

function emptyGradientFields(rows: number, columns: number, fill = 0): LayerHeightFields {
  return {
    lower: Array.from({ length: rows }, () => Array.from({ length: columns }, () => fill)),
    upper: Array.from({ length: rows }, () => Array.from({ length: columns }, () => fill)),
  }
}

function addHeightTargetGradient(
  gradients: LayerHeightFields,
  denominators: LayerHeightFields,
  layer: LayerName,
  row: number,
  col: number,
  height: number,
  target: number,
  stiffness: number,
): void {
  gradients[layer][row][col] += 2 * stiffness * (height - target)
  denominators[layer][row][col] += stiffness
}

function addSameCellShearGradient(
  gradients: LayerHeightFields,
  denominators: LayerHeightFields,
  stats: CompatibilityDerivatives,
  row: number,
  col: number,
  stiffness: number,
): void {
  gradients.lower[row][col] += 2 * stiffness * stats.offsetDelta * -stats.dOffsetLower
  gradients.upper[row][col] += 2 * stiffness * stats.offsetDelta * stats.dOffsetUpper
  denominators.lower[row][col] += stiffness * Math.max(stats.dOffsetLower ** 2, 0.12)
  denominators.upper[row][col] += stiffness * Math.max(stats.dOffsetUpper ** 2, 0.12)
}

function addCompatibilityTargetGradient(
  gradients: LayerHeightFields,
  denominators: LayerHeightFields,
  stats: CompatibilityDerivatives,
  row: number,
  col: number,
  targetMeasure: number,
  stiffness: number,
): void {
  const diff = stats.measure - targetMeasure
  gradients.lower[row][col] += 2 * stiffness * diff * stats.dMeasureLower
  gradients.upper[row][col] += 2 * stiffness * diff * stats.dMeasureUpper
  denominators.lower[row][col] += stiffness * Math.max(stats.dMeasureLower ** 2, 0.12)
  denominators.upper[row][col] += stiffness * Math.max(stats.dMeasureUpper ** 2, 0.12)
}

function addCompatibilityPairGradient(
  gradients: LayerHeightFields,
  denominators: LayerHeightFields,
  a: CompatibilityDerivatives,
  b: CompatibilityDerivatives,
  constraint: HeightCompatibilityConstraint,
  stiffness: number,
): void {
  const diff = a.measure - b.measure

  gradients.lower[constraint.aRow][constraint.aCol] += 2 * stiffness * diff * a.dMeasureLower
  gradients.upper[constraint.aRow][constraint.aCol] += 2 * stiffness * diff * a.dMeasureUpper
  gradients.lower[constraint.bRow][constraint.bCol] -= 2 * stiffness * diff * b.dMeasureLower
  gradients.upper[constraint.bRow][constraint.bCol] -= 2 * stiffness * diff * b.dMeasureUpper
  denominators.lower[constraint.aRow][constraint.aCol] += stiffness * Math.max(a.dMeasureLower ** 2, 0.12)
  denominators.upper[constraint.aRow][constraint.aCol] += stiffness * Math.max(a.dMeasureUpper ** 2, 0.12)
  denominators.lower[constraint.bRow][constraint.bCol] += stiffness * Math.max(b.dMeasureLower ** 2, 0.12)
  denominators.upper[constraint.bRow][constraint.bCol] += stiffness * Math.max(b.dMeasureUpper ** 2, 0.12)
}

function minimumSolvedLayerHeight(params: Pick<CellParams, 'hOn' | 'linkLength'>): number {
  return clampNumber(params.hOn, 0.15, params.linkLength * 2)
}

function exactStripCellAngles(
  params: CellParams,
  alongAxis: AxisName,
  primaryCount: number,
  crossCount: number,
  stripHeights: Record<LayerName, number[][]>,
): number[] {
  if (primaryCount <= 0) return []

  const descriptors = Array.from({ length: primaryCount }, (_, index) => averageStripDescriptor(params, alongAxis, index, crossCount, stripHeights))
  const angles = Array.from({ length: primaryCount }, () => 0)

  for (let index = 1; index < primaryCount; index += 1) {
    const previous = descriptors[index - 1]
    const current = descriptors[index]
    const transfer = stripUpperTransferVector(angles[index - 1], previous.centerSpan, previous.offsetDelta)
    const currentPhase = Math.atan2(current.offsetDelta, current.centerSpan)
    angles[index] = Math.atan2(transfer[0], transfer[1]) + currentPhase
  }

  const mean = angles.reduce((sum, angle) => sum + angle, 0) / angles.length
  return angles.map((angle) => clampNumber(angle - mean, -Math.PI * 0.46, Math.PI * 0.46))
}

function exactStripLowerCenterline(
  params: CellParams,
  alongAxis: AxisName,
  primaryCount: number,
  crossCount: number,
  angles: number[],
  stripHeights: Record<LayerName, number[][]>,
): Array<[number, number]> {
  if (primaryCount <= 0) return []

  const centers: Array<[number, number]> = [[0, 0]]
  for (let index = 1; index < primaryCount; index += 1) {
    const previousOffset = averageStripLayerOffset(params, alongAxis, index - 1, crossCount, stripHeights, 'lower')
    const currentOffset = averageStripLayerOffset(params, alongAxis, index, crossCount, stripHeights, 'lower')
    const previous = centers[index - 1]
    const previousSide = stripSideVector2(angles[index - 1])
    const currentSide = stripSideVector2(angles[index])
    centers[index] = [
      previous[0] + previousSide[0] * previousOffset + currentSide[0] * currentOffset,
      previous[1] + previousSide[1] * previousOffset + currentSide[1] * currentOffset,
    ]
  }

  const originAlong = (centers[0][0] + centers[centers.length - 1][0]) * 0.5
  const minZ = Math.min(...centers.map((center) => center[1]))
  return centers.map((center) => [center[0] - originAlong, center[1] - minZ])
}

function averageStripDescriptor(
  params: CellParams,
  alongAxis: AxisName,
  primaryIndex: number,
  crossCount: number,
  stripHeights: Record<LayerName, number[][]>,
): { centerSpan: number; offsetDelta: number } {
  let centerSpan = 0
  let offsetDelta = 0

  for (let crossIndex = 0; crossIndex < crossCount; crossIndex += 1) {
    const row = alongAxis === 'x' ? crossIndex : primaryIndex
    const col = alongAxis === 'x' ? primaryIndex : crossIndex
    const lowerHeight = stripHeights.lower[row][col]
    const upperHeight = stripHeights.upper[row][col]
    centerSpan += (lowerHeight + upperHeight) * 0.5
    offsetDelta += sideNodeOffset(upperHeight, params) - sideNodeOffset(lowerHeight, params)
  }

  const divisor = Math.max(crossCount, 1)
  return { centerSpan: centerSpan / divisor, offsetDelta: offsetDelta / divisor }
}

function averageStripLayerOffset(
  params: CellParams,
  alongAxis: AxisName,
  primaryIndex: number,
  crossCount: number,
  stripHeights: Record<LayerName, number[][]>,
  layer: LayerName,
): number {
  let offset = 0

  for (let crossIndex = 0; crossIndex < crossCount; crossIndex += 1) {
    const row = alongAxis === 'x' ? crossIndex : primaryIndex
    const col = alongAxis === 'x' ? primaryIndex : crossIndex
    offset += sideNodeOffset(stripHeights[layer][row][col], params)
  }

  return offset / Math.max(crossCount, 1)
}

function stripCrossCenters(
  params: CellParams,
  alongAxis: AxisName,
  primaryCount: number,
  crossCount: number,
  stripHeights: Record<LayerName, number[][]>,
): number[] {
  if (crossCount <= 0) return []

  // Two-cell-wide strips still use the planar strip chain along their long axis.
  // Across the short axis, use the largest actual side-node reach so parallel
  // strips do not get packed into each other when one layer expands.
  return cumulativeCenters(crossCount, (crossIndex) => {
    let spacing = nominalCellPitch(params)

    for (let primaryIndex = 0; primaryIndex < primaryCount; primaryIndex += 1) {
      const aRow = alongAxis === 'x' ? crossIndex : primaryIndex
      const aCol = alongAxis === 'x' ? primaryIndex : crossIndex
      const bRow = alongAxis === 'x' ? crossIndex + 1 : primaryIndex
      const bCol = alongAxis === 'x' ? primaryIndex : crossIndex + 1

      spacing = Math.max(
        spacing,
        sideNodeOffset(stripHeights.lower[aRow][aCol], params) + sideNodeOffset(stripHeights.lower[bRow][bCol], params),
        sideNodeOffset(stripHeights.upper[aRow][aCol], params) + sideNodeOffset(stripHeights.upper[bRow][bCol], params),
      )
    }

    return spacing
  })
}

function stripUpperTransferVector(angle: number, centerSpan: number, offsetDelta: number): [number, number] {
  const axis = stripAxisVector2(angle)
  const side = stripSideVector2(angle)
  return [axis[0] * centerSpan + side[0] * offsetDelta, axis[1] * centerSpan + side[1] * offsetDelta]
}

function stripAxisVector2(angle: number): [number, number] {
  return [Math.sin(angle), Math.cos(angle)]
}

function stripSideVector2(angle: number): [number, number] {
  return [Math.cos(angle), -Math.sin(angle)]
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
      // Height is an actuation state, not the main connector-error budget. The
      // array should share a little passive expansion through connected cells,
      // but only within this small resultant-height band; the remaining
      // mismatch is spent through whole-cell tilt/yaw so neighbors do not look
      // fully actuated just because one cell moved.
      const minimumResultantTotal = targetTotal * (1 - PASSIVE_RESULTANT_RELAXATION_RATIO)
      const actualTotal = Math.min(
        targetTotal,
        maxTotalSpan(params, lowerRatio, upperRatio),
        Math.max(minimumResultantTotal, centerDistance * 2),
      )
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

function buildLayerAxisCentersFromHeights(heights: number[][], params: CellParams, axis: AxisName): number[][] {
  const rows = heights.length
  const columns = heights[0]?.length ?? 0

  if (axis === 'x') {
    return Array.from({ length: rows }, (_, row) => {
      const centers = cumulativeCenters(columns, (col) => sideNodeOffset(heights[row][col], params) + sideNodeOffset(heights[row][col + 1], params))
      return Array.from({ length: columns }, (_, col) => centers[col])
    })
  }

  const centersByColumn = Array.from({ length: columns }, (_, col) =>
    cumulativeCenters(rows, (row) => sideNodeOffset(heights[row][col], params) + sideNodeOffset(heights[row + 1][col], params)),
  )

  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => centersByColumn[col][row]))
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

function normalizeLayoutFloor(layout: CellLayout[][], params: Pick<CellParams, 'plateSize'>): void {
  const minZ = Math.min(
    ...layout.flatMap((row) =>
      row.flatMap((cell) => [
        cell.bottom[2],
        cell.middle[2],
        cell.top[2],
        ...SIDE_NAMES.flatMap((side) => [cell.nodes.lower[side][2], cell.nodes.upper[side][2]]),
      ]),
    ),
    0,
  )
  // The floor is only a reference plane. It should never become an accidental
  // contact constraint that makes a vertically mirrored bend look clipped.
  const visualFloorClearance = Math.max(0.12, params.plateSize * 0.28)
  const shiftAmount = visualFloorClearance - minZ
  if (Math.abs(shiftAmount) <= 0.0001) return

  layout.forEach((row) =>
    row.forEach((cell) => {
      shiftCell(cell, shiftAmount)
    }),
  )
}

function shiftCell(cell: CellLayout, amount: number): void {
  cell.bottom = shiftZ(cell.bottom, amount)
  cell.middle = shiftZ(cell.middle, amount)
  cell.top = shiftZ(cell.top, amount)
  cell.lowerCenter = shiftZ(cell.lowerCenter, amount)
  cell.upperCenter = shiftZ(cell.upperCenter, amount)
  SIDE_NAMES.forEach((side) => {
    cell.nodes.lower[side] = shiftZ(cell.nodes.lower[side], amount)
    cell.nodes.upper[side] = shiftZ(cell.nodes.upper[side], amount)
  })
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
  const baseSettlePasses = overhangSurface ? 72 : cellCount <= 16 ? 140 : cellCount > 2500 ? 3 : cellCount > 900 ? 8 : cellCount > 225 ? 18 : 56
  const settlePasses = params.constrainPerimeter ? baseSettlePasses : Math.min(baseSettlePasses, 28)
  const finalPasses = overhangSurface ? 72 : cellCount <= 16 ? 180 : cellCount > 2500 ? 4 : cellCount > 900 ? 8 : Math.max(12, Math.floor(settlePasses * 0.65))

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
      projectConnectorConstraint(
        poses,
        layout,
        constraint,
        params,
        overhangSurface ? 0.74 : cellCount <= 16 ? 0.48 : 0.34,
        true,
        cellCount <= 16 ? false : pass > finalPasses * 0.65,
      )
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
  const oneCellWide = (rows === 1 && columns >= 2) || (columns === 1 && rows >= 2)
  const longTwoCellWideStrip = (rows === 2 && columns >= 3) || (columns === 2 && rows >= 3)
  return oneCellWide || longTwoCellWideStrip
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
  // Node-to-node connectors are direct contacts in the visual model. Solver
  // relaxation can tilt/yaw cells or relax layer height, but the renderer does
  // not add an extra bridge piece between adjacent cells.
  const bodyCorrection = scale(correction, 0.58)
  const couplingCorrection = scale(correction, 0.18)
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
  movePoseBody(aPose, scale(bodyCorrection, aScale))
  movePoseBody(bPose, scale(bodyCorrection, -bScale))
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

function movePoseBody(pose: CellPose, correction: Vec3): void {
  if (pose.locked) return
  pose.lowerCenter = add(pose.lowerCenter, correction)
  pose.upperCenter = add(pose.upperCenter, correction)
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

function isConstrainedCell(row: number, col: number, rows: number, columns: number): boolean {
  if (rows >= 3 && columns >= 3) return isPerimeterCell(row, col, rows, columns)

  const alongAxis: AxisName = columns >= rows ? 'x' : 'y'
  const primaryCount = alongAxis === 'x' ? columns : rows
  return isStripEndCell(row, col, alongAxis, primaryCount)
}

function isPerimeterCell(row: number, col: number, rows: number, columns: number): boolean {
  return row === 0 || col === 0 || row === rows - 1 || col === columns - 1
}

function isStripEndCell(row: number, col: number, alongAxis: AxisName, primaryCount: number): boolean {
  const primaryIndex = alongAxis === 'x' ? col : row
  return primaryIndex === 0 || primaryIndex === primaryCount - 1
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
