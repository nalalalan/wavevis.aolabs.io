import type { LatticeModel, LatticeNode, Vec3 } from './inverseSheetTypes'

export type XCellDirection = 'ne' | 'sw' | 'nw' | 'se'

export type ConnectedXCellFrame = {
  nodeId: string
  center: Vec3
  endpoints: Partial<Record<XCellDirection, Vec3>>
}

export type ConnectedXCellEndpointUse = {
  nodeId: string
  direction: XCellDirection
}

export type ConnectedXCellMechanismStats = {
  maxOppositePairLengthSpread: number
  maxOppositeColinearErrorDeg: number
  maxOppositeCenterResidual: number
  checkedOppositePairCount: number
  maxConnectorEndpointGap: number
  maxConnectorCenterLineResidual: number
  maxConnectorSegmentOvershoot: number
  maxConnectorMidpointResidual: number
  minConnectorCenterParameter: number
  maxConnectorCenterParameter: number
  invalidConnectorCenterPairCount: number
  minPhysicalConnectorUseCount: number
  maxPhysicalConnectorUseCount: number
  overOccupiedPhysicalConnectorCount: number
  physicalConnectorCount: number
  minSharedConnectorUseCount: number
  maxSharedConnectorUseCount: number
  sharedConnectorCount: number
  minInteriorLegCount: number
  maxInteriorLegCount: number
  maxCenterSurfaceResidual: number
  renderedXSegmentCount: number
  expectedAdjacentConnectorCount: number
  minInteriorConnectedPairCount: number
}

export type ConnectedXCellMechanism = {
  frames: ConnectedXCellFrame[]
  frameByNodeId: Map<string, ConnectedXCellFrame>
  connectorByPairId: Map<string, Vec3>
  connectorUseCountByPairId: Map<string, number>
  connectorUsesByPairId: Map<string, ConnectedXCellEndpointUse[]>
}

export type XCellCenterOverrides = Map<string, Vec3>

type AdjacentPairFamily = {
  positive: XCellDirection
  negative: XCellDirection
  makeStarts: (rows: number, columns: number) => Array<{ row: number; col: number }>
  next: (row: number, col: number) => { row: number; col: number }
  pairId: (row: number, col: number) => string
}

const EAST_WEST_FAMILY: AdjacentPairFamily = {
  positive: 'ne',
  negative: 'sw',
  makeStarts: (rows) => Array.from({ length: rows }, (_value, row) => ({ row, col: 0 })),
  next: (row, col) => ({ row, col: col + 1 }),
  pairId: (row, col) => `x-ew-${row}-${col}`,
}

const NORTH_SOUTH_FAMILY: AdjacentPairFamily = {
  positive: 'se',
  negative: 'nw',
  makeStarts: (_rows, columns) => Array.from({ length: columns }, (_value, col) => ({ row: 0, col })),
  next: (row, col) => ({ row: row + 1, col }),
  pairId: (row, col) => `x-ns-${row}-${col}`,
}

export function buildConnectedXCellMechanism(model: LatticeModel, centerOverrides?: XCellCenterOverrides): ConnectedXCellMechanism {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const centerByNodeId = buildSmoothedXCellCenters(model, centerOverrides)
  const frameByNodeId = new Map<string, ConnectedXCellFrame>()
  const connectorByPairId = new Map<string, Vec3>()
  const connectorUseCountByPairId = new Map<string, number>()
  const connectorUsesByPairId = new Map<string, ConnectedXCellEndpointUse[]>()

  model.nodes.forEach((node) => {
    frameByNodeId.set(node.id, {
      nodeId: node.id,
      center: centerByNodeId.get(node.id) ?? node.currentPosition,
      endpoints: {},
    })
  })

  solveAdjacentPairFamily(model, nodeById, frameByNodeId, connectorByPairId, connectorUseCountByPairId, connectorUsesByPairId, EAST_WEST_FAMILY)
  solveAdjacentPairFamily(model, nodeById, frameByNodeId, connectorByPairId, connectorUseCountByPairId, connectorUsesByPairId, NORTH_SOUTH_FAMILY)

  return {
    frames: model.nodes.map((node) => frameByNodeId.get(node.id)).filter(Boolean) as ConnectedXCellFrame[],
    frameByNodeId,
    connectorByPairId,
    connectorUseCountByPairId,
    connectorUsesByPairId,
  }
}

export function connectedXCellMechanismStats(model: LatticeModel, centerOverrides?: XCellCenterOverrides): ConnectedXCellMechanismStats {
  const mechanism = buildConnectedXCellMechanism(model, centerOverrides)
  let maxOppositePairLengthSpread = 0
  let maxOppositeColinearErrorDeg = 0
  let maxOppositeCenterResidual = 0
  let checkedOppositePairCount = 0
  let minInteriorConnectedPairCount = Infinity
  let minInteriorLegCount = Infinity
  let maxInteriorLegCount = 0
  let maxCenterSurfaceResidual = 0
  let maxConnectorEndpointGap = 0
  let maxConnectorCenterLineResidual = 0
  let maxConnectorSegmentOvershoot = 0
  let maxConnectorMidpointResidual = 0
  let minConnectorCenterParameter = Infinity
  let maxConnectorCenterParameter = -Infinity
  let invalidConnectorCenterPairCount = 0
  let minSharedConnectorUseCount = Infinity
  let maxSharedConnectorUseCount = 0
  const physicalOccupancy = physicalConnectorOccupancy(mechanism)

  mechanism.frames.forEach((frame) => {
    const sourceNode = model.nodes.find((node) => node.id === frame.nodeId)
    if (sourceNode) {
      maxCenterSurfaceResidual = Math.max(maxCenterSurfaceResidual, distanceVec(frame.center, sourceNode.currentPosition))
    }

    let connectedPairCount = 0
    const checkPair = (negativeEndpoint?: Vec3, positiveEndpoint?: Vec3) => {
      if (!negativeEndpoint || !positiveEndpoint) return
      const negativeLeg = subtractVec(negativeEndpoint, frame.center)
      const positiveLeg = subtractVec(positiveEndpoint, frame.center)
      maxOppositePairLengthSpread = Math.max(
        maxOppositePairLengthSpread,
        Math.abs(lengthVec(negativeLeg) - lengthVec(positiveLeg)),
      )
      maxOppositeColinearErrorDeg = Math.max(
        maxOppositeColinearErrorDeg,
        angleDeg(positiveLeg, scaleVec(negativeLeg, -1)),
      )
      maxOppositeCenterResidual = Math.max(
        maxOppositeCenterResidual,
        distanceVec(scaleVec(addVec(negativeEndpoint, positiveEndpoint), 0.5), frame.center),
      )
      checkedOppositePairCount += 1
      connectedPairCount += 1
    }

    checkPair(frame.endpoints.sw, frame.endpoints.ne)
    checkPair(frame.endpoints.se, frame.endpoints.nw)

    const [row, col] = parseNodeRowColumn(frame.nodeId)
    if (row > 0 && row < model.config.rows - 1 && col > 0 && col < model.config.columns - 1) {
      const legCount = (['ne', 'sw', 'nw', 'se'] as const).filter((direction) => Boolean(frame.endpoints[direction])).length
      minInteriorLegCount = Math.min(minInteriorLegCount, legCount)
      maxInteriorLegCount = Math.max(maxInteriorLegCount, legCount)
      minInteriorConnectedPairCount = Math.min(minInteriorConnectedPairCount, connectedPairCount)
    }
  })
  mechanism.connectorUseCountByPairId.forEach((useCount) => {
    minSharedConnectorUseCount = Math.min(minSharedConnectorUseCount, useCount)
    maxSharedConnectorUseCount = Math.max(maxSharedConnectorUseCount, useCount)
  })
  mechanism.connectorUsesByPairId.forEach((uses, pairId) => {
    const connector = mechanism.connectorByPairId.get(pairId)
    if (!connector) return
    uses.forEach((use) => {
      const endpoint = mechanism.frameByNodeId.get(use.nodeId)?.endpoints[use.direction]
      if (!endpoint) return
      maxConnectorEndpointGap = Math.max(maxConnectorEndpointGap, distanceVec(connector, endpoint))
    })

    if (uses.length !== 2) {
      invalidConnectorCenterPairCount += 1
      return
    }

    const sourceFrame = mechanism.frameByNodeId.get(uses[0].nodeId)
    const targetFrame = mechanism.frameByNodeId.get(uses[1].nodeId)
    if (!sourceFrame || !targetFrame) {
      invalidConnectorCenterPairCount += 1
      return
    }

    const centerSpan = subtractVec(targetFrame.center, sourceFrame.center)
    const connectorOffset = subtractVec(connector, sourceFrame.center)
    const spanLengthSq = dotVec(centerSpan, centerSpan)
    const parameter = spanLengthSq > 0.000000000001
      ? dotVec(connectorOffset, centerSpan) / spanLengthSq
      : 0
    const closestOnCenterSpan = addVec(sourceFrame.center, scaleVec(centerSpan, parameter))
    const centerMidpoint = scaleVec(addVec(sourceFrame.center, targetFrame.center), 0.5)
    maxConnectorCenterLineResidual = Math.max(maxConnectorCenterLineResidual, distanceVec(connector, closestOnCenterSpan))
    maxConnectorSegmentOvershoot = Math.max(maxConnectorSegmentOvershoot, Math.max(0, -parameter, parameter - 1))
    maxConnectorMidpointResidual = Math.max(maxConnectorMidpointResidual, distanceVec(connector, centerMidpoint))
    minConnectorCenterParameter = Math.min(minConnectorCenterParameter, parameter)
    maxConnectorCenterParameter = Math.max(maxConnectorCenterParameter, parameter)
  })

  return {
    maxOppositePairLengthSpread,
    maxOppositeColinearErrorDeg,
    maxOppositeCenterResidual,
    checkedOppositePairCount,
    maxConnectorEndpointGap,
    maxConnectorCenterLineResidual,
    maxConnectorSegmentOvershoot,
    maxConnectorMidpointResidual,
    minConnectorCenterParameter: Number.isFinite(minConnectorCenterParameter) ? minConnectorCenterParameter : 0,
    maxConnectorCenterParameter: Number.isFinite(maxConnectorCenterParameter) ? maxConnectorCenterParameter : 0,
    invalidConnectorCenterPairCount,
    minPhysicalConnectorUseCount: physicalOccupancy.minUseCount,
    maxPhysicalConnectorUseCount: physicalOccupancy.maxUseCount,
    overOccupiedPhysicalConnectorCount: physicalOccupancy.overOccupiedCount,
    physicalConnectorCount: physicalOccupancy.groupCount,
    minSharedConnectorUseCount: Number.isFinite(minSharedConnectorUseCount) ? minSharedConnectorUseCount : 0,
    maxSharedConnectorUseCount,
    sharedConnectorCount: mechanism.connectorByPairId.size,
    minInteriorLegCount: Number.isFinite(minInteriorLegCount) ? minInteriorLegCount : 0,
    maxInteriorLegCount,
    maxCenterSurfaceResidual,
    renderedXSegmentCount: checkedOppositePairCount,
    expectedAdjacentConnectorCount: (
      model.config.rows * Math.max(model.config.columns - 1, 0) +
      Math.max(model.config.rows - 1, 0) * model.config.columns
    ),
    minInteriorConnectedPairCount: Number.isFinite(minInteriorConnectedPairCount) ? minInteriorConnectedPairCount : 0,
  }
}

function solveAdjacentPairFamily(
  model: LatticeModel,
  nodeById: Map<string, LatticeNode>,
  frameByNodeId: Map<string, ConnectedXCellFrame>,
  connectorByPairId: Map<string, Vec3>,
  connectorUseCountByPairId: Map<string, number>,
  connectorUsesByPairId: Map<string, ConnectedXCellEndpointUse[]>,
  family: AdjacentPairFamily,
): void {
  family.makeStarts(model.config.rows, model.config.columns).forEach((start) => {
    const nodes: LatticeNode[] = []
    const pairIds: string[] = []
    let row = start.row
    let col = start.col

    while (row >= 0 && row < model.config.rows && col >= 0 && col < model.config.columns) {
      const node = nodeById.get(nodeId(row, col))
      if (!node) break
      nodes.push(node)
      const next = family.next(row, col)
      if (next.row >= 0 && next.row < model.config.rows && next.col >= 0 && next.col < model.config.columns) {
        pairIds.push(family.pairId(row, col))
      }
      row = next.row
      col = next.col
    }

    const connectors = solveOppositePairConnectors(nodes.map((node) =>
      frameByNodeId.get(node.id)?.center ?? node.currentPosition))

    nodes.slice(0, -1).forEach((source, index) => {
      const target = nodes[index + 1]
      const pairId = pairIds[index]
      if (!source || !target || !pairId) return
      const physicalConnector = connectors[index]
      if (!physicalConnector) return
      connectorByPairId.set(pairId, physicalConnector)
      const sourceFrame = frameByNodeId.get(source.id)
      const targetFrame = frameByNodeId.get(target.id)
      let useCount = 0
      const uses: ConnectedXCellEndpointUse[] = []
      if (sourceFrame) {
        sourceFrame.endpoints[family.positive] = physicalConnector
        useCount += 1
        uses.push({ nodeId: source.id, direction: family.positive })
      }
      if (targetFrame) {
        targetFrame.endpoints[family.negative] = physicalConnector
        useCount += 1
        uses.push({ nodeId: target.id, direction: family.negative })
      }
      connectorUseCountByPairId.set(pairId, useCount)
      connectorUsesByPairId.set(pairId, uses)
    })
  })
}

function solveOppositePairConnectors(centers: Vec3[]): Vec3[] {
  const connectorCount = Math.max(centers.length - 1, 0)
  if (connectorCount <= 0) return []
  if (connectorCount === 1) return [scaleVec(addVec(centers[0], centers[1]), 0.5)]

  const signs: number[] = [1]
  const offsets: Vec3[] = [[0, 0, 0]]

  for (let connectorIndex = 1; connectorIndex < connectorCount; connectorIndex += 1) {
    signs[connectorIndex] = -signs[connectorIndex - 1]
    offsets[connectorIndex] = subtractVec(scaleVec(centers[connectorIndex], 2), offsets[connectorIndex - 1])
  }

  let freeSum: Vec3 = [0, 0, 0]
  for (let connectorIndex = 0; connectorIndex < connectorCount; connectorIndex += 1) {
    const midpointTarget = scaleVec(addVec(centers[connectorIndex], centers[connectorIndex + 1]), 0.5)
    freeSum = addVec(freeSum, scaleVec(subtractVec(midpointTarget, offsets[connectorIndex]), signs[connectorIndex]))
  }

  const free = scaleVec(freeSum, 1 / connectorCount)
  return offsets.map((offset, index) => addVec(offset, scaleVec(free, signs[index])))
}

function physicalConnectorOccupancy(mechanism: ConnectedXCellMechanism): {
  minUseCount: number
  maxUseCount: number
  overOccupiedCount: number
  groupCount: number
} {
  const groups = new Map<string, number>()
  mechanism.connectorByPairId.forEach((connector, pairId) => {
    const useCount = mechanism.connectorUseCountByPairId.get(pairId) ?? 0
    const key = physicalConnectorKey(connector)
    groups.set(key, (groups.get(key) ?? 0) + useCount)
  })

  let minUseCount = Infinity
  let maxUseCount = 0
  let overOccupiedCount = 0
  groups.forEach((useCount) => {
    minUseCount = Math.min(minUseCount, useCount)
    maxUseCount = Math.max(maxUseCount, useCount)
    if (useCount > 2) overOccupiedCount += 1
  })

  return {
    minUseCount: Number.isFinite(minUseCount) ? minUseCount : 0,
    maxUseCount,
    overOccupiedCount,
    groupCount: groups.size,
  }
}

function physicalConnectorKey(connector: Vec3): string {
  const tolerance = 0.0001
  return connector.map((value) => Math.round(value / tolerance)).join(',')
}

function buildSmoothedXCellCenters(model: LatticeModel, centerOverrides?: XCellCenterOverrides): Map<string, Vec3> {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const sourceCenter = (node: LatticeNode) => centerOverrides?.get(node.id) ?? node.currentPosition
  let centers = new Map(model.nodes.map((node) => [node.id, sourceCenter(node)] as const))
  const neighborOffsets = [
    { row: 0, col: 0, weight: 0.46 },
    { row: -1, col: 0, weight: 0.09 },
    { row: 1, col: 0, weight: 0.09 },
    { row: 0, col: -1, weight: 0.09 },
    { row: 0, col: 1, weight: 0.09 },
    { row: -1, col: -1, weight: 0.045 },
    { row: -1, col: 1, weight: 0.045 },
    { row: 1, col: -1, weight: 0.045 },
    { row: 1, col: 1, weight: 0.045 },
  ]

  for (let pass = 0; pass < 5; pass += 1) {
    const nextCenters = new Map<string, Vec3>()

    model.nodes.forEach((node) => {
      if (node.row === 0 || node.row === model.config.rows - 1 || node.col === 0 || node.col === model.config.columns - 1) {
        nextCenters.set(node.id, sourceCenter(node))
        return
      }

      const sum: Vec3 = [0, 0, 0]
      let weightSum = 0

      neighborOffsets.forEach((offset) => {
        const neighbor = nodeById.get(nodeId(node.row + offset.row, node.col + offset.col))
        if (!neighbor) return
        const center = centers.get(neighbor.id) ?? sourceCenter(neighbor)
        for (let axis = 0; axis < 3; axis += 1) {
          sum[axis] += center[axis] * offset.weight
        }
        weightSum += offset.weight
      })

      nextCenters.set(node.id, weightSum > 0
        ? [sum[0] / weightSum, sum[1] / weightSum, sum[2] / weightSum]
        : sourceCenter(node))
    })

    centers = nextCenters
  }

  return centers
}

function parseNodeRowColumn(id: string): [number, number] {
  const match = /^n-(\d+)-(\d+)$/.exec(id)
  if (!match) return [0, 0]
  return [Number(match[1]), Number(match[2])]
}

function nodeId(row: number, col: number): string {
  return `n-${row}-${col}`
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scaleVec(vector: Vec3, scale: number): Vec3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale]
}

function lengthVec(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function distanceVec(a: Vec3, b: Vec3): number {
  return lengthVec(subtractVec(a, b))
}

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function angleDeg(a: Vec3, b: Vec3): number {
  const denominator = lengthVec(a) * lengthVec(b)
  if (denominator <= 0.000001) return 0
  const cosine = Math.min(1, Math.max(-1, dotVec(a, b) / denominator))
  return (Math.acos(cosine) * 180) / Math.PI
}
