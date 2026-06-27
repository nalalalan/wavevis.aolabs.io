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
  minSharedConnectorUseCount: number
  maxSharedConnectorUseCount: number
  sharedConnectorCount: number
  maxCenterSurfaceResidual: number
  renderedXSegmentCount: number
  expectedDiagonalConnectorCount: number
  minInteriorConnectedPairCount: number
}

export type ConnectedXCellMechanism = {
  frames: ConnectedXCellFrame[]
  frameByNodeId: Map<string, ConnectedXCellFrame>
  connectorByDiagonalId: Map<string, Vec3>
  connectorUseCountByDiagonalId: Map<string, number>
  connectorUsesByDiagonalId: Map<string, ConnectedXCellEndpointUse[]>
}

export type XCellCenterOverrides = Map<string, Vec3>

type DiagonalFamily = {
  positive: XCellDirection
  negative: XCellDirection
  makeStarts: (rows: number, columns: number) => Array<{ row: number; col: number }>
  next: (row: number, col: number) => { row: number; col: number }
  diagonalId: (row: number, col: number) => string
}

const NE_SW_FAMILY: DiagonalFamily = {
  positive: 'ne',
  negative: 'sw',
  makeStarts: (rows, columns) => [
    ...Array.from({ length: columns }, (_value, col) => ({ row: 0, col })),
    ...Array.from({ length: Math.max(rows - 1, 0) }, (_value, index) => ({ row: index + 1, col: 0 })),
  ],
  next: (row, col) => ({ row: row + 1, col: col + 1 }),
  diagonalId: (row, col) => `x-ne-${row}-${col}`,
}

const NW_SE_FAMILY: DiagonalFamily = {
  positive: 'nw',
  negative: 'se',
  makeStarts: (rows, columns) => [
    ...Array.from({ length: columns }, (_value, col) => ({ row: 0, col })),
    ...Array.from({ length: Math.max(rows - 1, 0) }, (_value, index) => ({ row: index + 1, col: columns - 1 })),
  ],
  next: (row, col) => ({ row: row + 1, col: col - 1 }),
  diagonalId: (row, col) => `x-nw-${row}-${col}`,
}

export function buildConnectedXCellMechanism(model: LatticeModel, centerOverrides?: XCellCenterOverrides): ConnectedXCellMechanism {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const centerByNodeId = buildSmoothedXCellCenters(model, centerOverrides)
  const frameByNodeId = new Map<string, ConnectedXCellFrame>()
  const connectorByDiagonalId = new Map<string, Vec3>()
  const connectorUseCountByDiagonalId = new Map<string, number>()
  const connectorUsesByDiagonalId = new Map<string, ConnectedXCellEndpointUse[]>()

  model.nodes.forEach((node) => {
    frameByNodeId.set(node.id, {
      nodeId: node.id,
      center: centerByNodeId.get(node.id) ?? node.currentPosition,
      endpoints: {},
    })
  })

  solveDiagonalFamily(model, nodeById, frameByNodeId, connectorByDiagonalId, connectorUseCountByDiagonalId, connectorUsesByDiagonalId, NE_SW_FAMILY)
  solveDiagonalFamily(model, nodeById, frameByNodeId, connectorByDiagonalId, connectorUseCountByDiagonalId, connectorUsesByDiagonalId, NW_SE_FAMILY)

  return {
    frames: model.nodes.map((node) => frameByNodeId.get(node.id)).filter(Boolean) as ConnectedXCellFrame[],
    frameByNodeId,
    connectorByDiagonalId,
    connectorUseCountByDiagonalId,
    connectorUsesByDiagonalId,
  }
}

export function connectedXCellMechanismStats(model: LatticeModel, centerOverrides?: XCellCenterOverrides): ConnectedXCellMechanismStats {
  const mechanism = buildConnectedXCellMechanism(model, centerOverrides)
  let maxOppositePairLengthSpread = 0
  let maxOppositeColinearErrorDeg = 0
  let maxOppositeCenterResidual = 0
  let checkedOppositePairCount = 0
  let minInteriorConnectedPairCount = Infinity
  let maxCenterSurfaceResidual = 0
  let maxConnectorEndpointGap = 0
  let minSharedConnectorUseCount = Infinity
  let maxSharedConnectorUseCount = 0

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
      minInteriorConnectedPairCount = Math.min(minInteriorConnectedPairCount, connectedPairCount)
    }
  })
  mechanism.connectorUseCountByDiagonalId.forEach((useCount) => {
    minSharedConnectorUseCount = Math.min(minSharedConnectorUseCount, useCount)
    maxSharedConnectorUseCount = Math.max(maxSharedConnectorUseCount, useCount)
  })
  mechanism.connectorUsesByDiagonalId.forEach((uses, diagonalId) => {
    const connector = mechanism.connectorByDiagonalId.get(diagonalId)
    if (!connector) return
    uses.forEach((use) => {
      const endpoint = mechanism.frameByNodeId.get(use.nodeId)?.endpoints[use.direction]
      if (!endpoint) return
      maxConnectorEndpointGap = Math.max(maxConnectorEndpointGap, distanceVec(connector, endpoint))
    })
  })

  return {
    maxOppositePairLengthSpread,
    maxOppositeColinearErrorDeg,
    maxOppositeCenterResidual,
    checkedOppositePairCount,
    maxConnectorEndpointGap,
    minSharedConnectorUseCount: Number.isFinite(minSharedConnectorUseCount) ? minSharedConnectorUseCount : 0,
    maxSharedConnectorUseCount,
    sharedConnectorCount: mechanism.connectorByDiagonalId.size,
    maxCenterSurfaceResidual,
    renderedXSegmentCount: checkedOppositePairCount,
    expectedDiagonalConnectorCount: 2 * Math.max(model.config.rows - 1, 0) * Math.max(model.config.columns - 1, 0),
    minInteriorConnectedPairCount: Number.isFinite(minInteriorConnectedPairCount) ? minInteriorConnectedPairCount : 0,
  }
}

function solveDiagonalFamily(
  model: LatticeModel,
  nodeById: Map<string, LatticeNode>,
  frameByNodeId: Map<string, ConnectedXCellFrame>,
  connectorByDiagonalId: Map<string, Vec3>,
  connectorUseCountByDiagonalId: Map<string, number>,
  connectorUsesByDiagonalId: Map<string, ConnectedXCellEndpointUse[]>,
  family: DiagonalFamily,
): void {
  family.makeStarts(model.config.rows, model.config.columns).forEach((start) => {
    const nodes: LatticeNode[] = []
    const diagonalIds: string[] = []
    let row = start.row
    let col = start.col

    while (row >= 0 && row < model.config.rows && col >= 0 && col < model.config.columns) {
      const node = nodeById.get(nodeId(row, col))
      if (!node) break
      nodes.push(node)
      const next = family.next(row, col)
      if (next.row >= 0 && next.row < model.config.rows && next.col >= 0 && next.col < model.config.columns) {
        diagonalIds.push(family.diagonalId(row, col))
      }
      row = next.row
      col = next.col
    }

    solveOppositePairConnectors(nodes.map((node) => frameByNodeId.get(node.id)?.center ?? node.currentPosition)).forEach((connector, index) => {
      const source = nodes[index]
      const target = nodes[index + 1]
      const diagonalId = diagonalIds[index]
      if (!source || !target || !diagonalId) return
      connectorByDiagonalId.set(diagonalId, connector)
      const sourceFrame = frameByNodeId.get(source.id)
      const targetFrame = frameByNodeId.get(target.id)
      let useCount = 0
      const uses: ConnectedXCellEndpointUse[] = []
      if (sourceFrame) {
        sourceFrame.endpoints[family.positive] = connector
        useCount += 1
        uses.push({ nodeId: source.id, direction: family.positive })
      }
      if (targetFrame) {
        targetFrame.endpoints[family.negative] = connector
        useCount += 1
        uses.push({ nodeId: target.id, direction: family.negative })
      }
      connectorUseCountByDiagonalId.set(diagonalId, useCount)
      connectorUsesByDiagonalId.set(diagonalId, uses)
    })
  })
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

  for (let pass = 0; pass < 1; pass += 1) {
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
