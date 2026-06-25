import type { LatticeEdge, LatticeModel, LatticeNode, Vec3 } from './inverseSheetTypes'

export type CellArmDirection = 'east' | 'west' | 'north' | 'south'
export const CELL_ARM_DIRECTIONS: CellArmDirection[] = ['east', 'west', 'north', 'south']

export type RigidCellFrame = {
  nodeId: string
  center: Vec3
  xAxis: Vec3
  yAxis: Vec3
  zAxis: Vec3
  legLength: number
  armEndpoints: Partial<Record<CellArmDirection, Vec3>>
}

export type RigidCellMechanismStats = {
  maxLegLengthSpread: number
  maxPairLengthSpread: number
  maxOppositeColinearErrorDeg: number
  maxCellOppositePairLengthSpread: number
  maxCellOppositeColinearErrorDeg: number
  maxCellOppositeCenterResidual: number
  checkedCellOppositePairCount: number
  maxOrthogonalityErrorDeg: number
  maxConnectorPathBendDeg: number
  maxExpectedArmCountResidual: number
  minInteriorConnectedArmCount: number
  maxConnectorEndpointGap: number
  meanConnectorEndpointGap: number
  rmsConnectorEndpointGap: number
  maxArmSurfaceLeak: number
  maxCenterShift: number
}

export type RigidCellMechanism = {
  frames: RigidCellFrame[]
  frameByNodeId: Map<string, RigidCellFrame>
  connectorByEdgeId: Map<string, Vec3>
  endpointsByEdgeId: Map<string, { endpointA: Vec3; endpointB: Vec3 }>
}

export function rigidCellBodyThickness(spacing: number): number {
  return Math.max(spacing * 0.07, 0.022)
}

export function rigidCellBodyOffset(spacing: number): number {
  return rigidCellBodyThickness(spacing) * 0.72
}

export function connectedArmDirectionsForFrame(frame: RigidCellFrame): CellArmDirection[] {
  return CELL_ARM_DIRECTIONS.filter((direction) => Boolean(frame.armEndpoints[direction]))
}

export function buildRigidCellFrame(
  node: LatticeNode,
  nodeById: Map<string, LatticeNode>,
  spacing: number,
  surfaceOffset = rigidCellBodyOffset(spacing),
): RigidCellFrame {
  const centerBase = node.currentPosition
  const left = nodeById.get(nodeId(node.row, node.col - 1))
  const right = nodeById.get(nodeId(node.row, node.col + 1))
  const down = nodeById.get(nodeId(node.row - 1, node.col))
  const up = nodeById.get(nodeId(node.row + 1, node.col))
  const xSeed = axisSeed(centerBase, left?.currentPosition, right?.currentPosition, [1, 0, 0])
  const ySeed = axisSeed(centerBase, down?.currentPosition, up?.currentPosition, [0, 1, 0])
  const xAxis = normalizeVec(xSeed, [1, 0, 0])
  const yProjected = subtractVec(ySeed, scaleVec(xAxis, dotVec(ySeed, xAxis)))
  let yAxis = normalizeVec(yProjected, fallbackPerpendicular(xAxis))
  let zAxis = normalizeVec(crossVec(xAxis, yAxis), [0, 0, 1])

  yAxis = normalizeVec(crossVec(zAxis, xAxis), yAxis)
  zAxis = normalizeVec(crossVec(xAxis, yAxis), zAxis)

  return {
    nodeId: node.id,
    center: addVec(centerBase, scaleVec(zAxis, surfaceOffset)),
    xAxis,
    yAxis,
    zAxis,
    legLength: Math.max(estimateCellCrossLength(node, nodeById, spacing) * 0.5, spacing * 0.35),
    armEndpoints: {},
  }
}

export function armEndpointForDirection(frame: RigidCellFrame, direction: CellArmDirection): Vec3 {
  const anchoredEndpoint = frame.armEndpoints[direction]
  if (anchoredEndpoint) return anchoredEndpoint

  const axis = direction === 'east' || direction === 'west' ? frame.xAxis : frame.yAxis
  const sign = direction === 'east' || direction === 'north' ? 1 : -1
  return addVec(frame.center, scaleVec(axis, frame.legLength * sign))
}

export function connectorPositionForRigidEdge(
  edge: LatticeEdge,
  nodeById: Map<string, LatticeNode>,
  spacing: number,
): Vec3 {
  const endpoints = rigidEdgeEndpoints(edge, nodeById, spacing)
  if (!endpoints) return [0, 0, 0]

  return scaleVec(addVec(endpoints.endpointA, endpoints.endpointB), 0.5)
}

export function rigidEdgeEndpoints(
  edge: LatticeEdge,
  nodeById: Map<string, LatticeNode>,
  spacing: number,
): { endpointA: Vec3; endpointB: Vec3 } | null {
  const nodeA = nodeById.get(edge.nodeA)
  const nodeB = nodeById.get(edge.nodeB)
  if (!nodeA || !nodeB) return null

  const frameA = buildRigidCellFrame(nodeA, nodeById, spacing)
  const frameB = buildRigidCellFrame(nodeB, nodeById, spacing)

  return {
    endpointA: armEndpointForDirection(frameA, armDirectionForEdge(edge, nodeA, nodeB)),
    endpointB: armEndpointForDirection(frameB, armDirectionForEdge(edge, nodeB, nodeA)),
  }
}

export function rigidCellMechanismStats(model: LatticeModel): RigidCellMechanismStats {
  const mechanism = buildRigidCellMechanism(model)
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  let maxLegLengthSpread = 0
  let maxPairLengthSpread = 0
  let maxOppositeColinearErrorDeg = 0
  let maxCellOppositePairLengthSpread = 0
  let maxCellOppositeColinearErrorDeg = 0
  let maxCellOppositeCenterResidual = 0
  let checkedCellOppositePairCount = 0
  let maxOrthogonalityErrorDeg = 0
  let maxExpectedArmCountResidual = 0
  let minInteriorConnectedArmCount = Infinity
  let maxConnectorEndpointGap = 0
  let connectorEndpointGapSum = 0
  let connectorEndpointGapSquaredSum = 0
  let connectorEndpointGapCount = 0
  let maxArmSurfaceLeak = 0
  let maxCenterShift = 0

  mechanism.frames.forEach((frame) => {
    const eastEndpoint = frame.armEndpoints.east
    const westEndpoint = frame.armEndpoints.west
    const northEndpoint = frame.armEndpoints.north
    const southEndpoint = frame.armEndpoints.south

    const connectedLengths: number[] = []

    if (eastEndpoint) connectedLengths.push(distanceVec(frame.center, eastEndpoint))
    if (westEndpoint) connectedLengths.push(distanceVec(frame.center, westEndpoint))
    if (northEndpoint) connectedLengths.push(distanceVec(frame.center, northEndpoint))
    if (southEndpoint) connectedLengths.push(distanceVec(frame.center, southEndpoint))

    if (connectedLengths.length >= 2) {
      maxLegLengthSpread = Math.max(maxLegLengthSpread, Math.max(...connectedLengths) - Math.min(...connectedLengths))
    }

    const measureOppositePair = (negativeEndpoint: Vec3, positiveEndpoint: Vec3) => {
      const negativeLeg = subtractVec(negativeEndpoint, frame.center)
      const positiveLeg = subtractVec(positiveEndpoint, frame.center)
      maxCellOppositePairLengthSpread = Math.max(
        maxCellOppositePairLengthSpread,
        Math.abs(lengthVec(negativeLeg) - lengthVec(positiveLeg)),
      )
      maxCellOppositeColinearErrorDeg = Math.max(
        maxCellOppositeColinearErrorDeg,
        angleDeg(positiveLeg, scaleVec(negativeLeg, -1)),
      )
      maxCellOppositeCenterResidual = Math.max(
        maxCellOppositeCenterResidual,
        distanceVec(scaleVec(addVec(negativeEndpoint, positiveEndpoint), 0.5), frame.center),
      )
      checkedCellOppositePairCount += 1
    }

    if (eastEndpoint && westEndpoint) measureOppositePair(westEndpoint, eastEndpoint)
    if (northEndpoint && southEndpoint) measureOppositePair(southEndpoint, northEndpoint)

    if (eastEndpoint && westEndpoint && northEndpoint && southEndpoint) {
      const visualXAxis = subtractVec(eastEndpoint, westEndpoint)
      const visualYAxis = subtractVec(northEndpoint, southEndpoint)
      maxOrthogonalityErrorDeg = Math.max(maxOrthogonalityErrorDeg, Math.abs(90 - angleDeg(visualXAxis, visualYAxis)))
    }

    const sourceNode = nodeById.get(frame.nodeId)
    if (sourceNode) {
      const expectedArmCount = expectedNeighborCount(sourceNode, model)
      maxExpectedArmCountResidual = Math.max(maxExpectedArmCountResidual, Math.abs(connectedLengths.length - expectedArmCount))
      if (expectedArmCount === 4) {
        minInteriorConnectedArmCount = Math.min(minInteriorConnectedArmCount, connectedLengths.length)
      }

      const baseFrame = buildRigidCellFrame(sourceNode, nodeById, model.config.spacing)
      maxCenterShift = Math.max(maxCenterShift, distanceVec(frame.center, baseFrame.center))
    }
  })

  mechanism.endpointsByEdgeId.forEach((endpoints) => {
    const endpointGap = distanceVec(endpoints.endpointA, endpoints.endpointB)
    maxConnectorEndpointGap = Math.max(maxConnectorEndpointGap, endpointGap)
    connectorEndpointGapSum += endpointGap
    connectorEndpointGapSquaredSum += endpointGap ** 2
    connectorEndpointGapCount += 1
  })

  model.edges.forEach((edge) => {
    const frameA = mechanism.frameByNodeId.get(edge.nodeA)
    const frameB = mechanism.frameByNodeId.get(edge.nodeB)
    const connector = mechanism.connectorByEdgeId.get(edge.id)
    if (!frameA || !frameB || !connector) return

    const legA = subtractVec(connector, frameA.center)
    const legB = subtractVec(connector, frameB.center)
    maxPairLengthSpread = Math.max(maxPairLengthSpread, Math.abs(lengthVec(legA) - lengthVec(legB)))
    maxOppositeColinearErrorDeg = Math.max(maxOppositeColinearErrorDeg, angleDeg(legA, scaleVec(legB, -1)))

    const midpoint = scaleVec(addVec(frameA.center, frameB.center), 0.5)
    const localNormal = normalizeVec(addVec(frameA.zAxis, frameB.zAxis), frameA.zAxis)
    maxArmSurfaceLeak = Math.max(maxArmSurfaceLeak, Math.abs(dotVec(subtractVec(connector, midpoint), localNormal)))
  })

  const maxConnectorPathBendDeg = measureConnectorPathBend(model, mechanism.connectorByEdgeId)

  return {
    maxLegLengthSpread,
    maxPairLengthSpread,
    maxOppositeColinearErrorDeg,
    maxCellOppositePairLengthSpread,
    maxCellOppositeColinearErrorDeg,
    maxCellOppositeCenterResidual,
    checkedCellOppositePairCount,
    maxOrthogonalityErrorDeg,
    maxConnectorPathBendDeg,
    maxExpectedArmCountResidual,
    minInteriorConnectedArmCount: Number.isFinite(minInteriorConnectedArmCount) ? minInteriorConnectedArmCount : 0,
    maxConnectorEndpointGap,
    meanConnectorEndpointGap: connectorEndpointGapCount ? connectorEndpointGapSum / connectorEndpointGapCount : 0,
    rmsConnectorEndpointGap: connectorEndpointGapCount
      ? Math.sqrt(connectorEndpointGapSquaredSum / connectorEndpointGapCount)
      : 0,
    maxArmSurfaceLeak,
    maxCenterShift,
  }
}

function expectedNeighborCount(node: LatticeNode, model: LatticeModel): number {
  let count = 0
  if (node.col > 0) count += 1
  if (node.col < model.config.columns - 1) count += 1
  if (node.row > 0) count += 1
  if (node.row < model.config.rows - 1) count += 1
  return count
}

export function buildRigidCellMechanism(model: LatticeModel): RigidCellMechanism {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const frameByNodeId = new Map<string, RigidCellFrame>()

  model.nodes.forEach((node) => {
    frameByNodeId.set(node.id, buildRigidCellFrame(node, nodeById, model.config.spacing))
  })
  smoothFrameAxes(model, frameByNodeId)

  const connectorByEdgeId = solveSurfaceAnchoredConnectors(model, frameByNodeId, nodeById)
  const endpointsByEdgeId = new Map<string, { endpointA: Vec3; endpointB: Vec3 }>()
  model.edges.forEach((edge) => {
    const endpoints = rigidEdgeEndpointsFromFrames(edge, frameByNodeId, nodeById)
    if (!endpoints) return
    endpointsByEdgeId.set(edge.id, endpoints)
  })

  return {
    frames: model.nodes.map((node) => frameByNodeId.get(node.id)).filter(Boolean) as RigidCellFrame[],
    frameByNodeId,
    connectorByEdgeId,
    endpointsByEdgeId,
  }
}

function solveSurfaceAnchoredConnectors(
  model: LatticeModel,
  frameByNodeId: Map<string, RigidCellFrame>,
  nodeById: Map<string, LatticeNode>,
): Map<string, Vec3> {
  const connectorByEdgeId = buildPairwiseOppositeConnectorMap(model, frameByNodeId)
  applyConnectedArmEndpoints(model, frameByNodeId, nodeById, connectorByEdgeId)
  alignFrameAxesToPairwiseArms(frameByNodeId)

  return connectorByEdgeId
}

function buildPairwiseOppositeConnectorMap(
  model: LatticeModel,
  frameByNodeId: Map<string, RigidCellFrame>,
): Map<string, Vec3> {
  const connectorByEdgeId = new Map<string, Vec3>()

  for (let row = 0; row < model.config.rows; row += 1) {
    const centers = Array.from({ length: model.config.columns }, (_value, col) =>
      frameByNodeId.get(nodeId(row, col))?.center)
    const edgeIds = Array.from({ length: Math.max(model.config.columns - 1, 0) }, (_value, col) =>
      `e-h-${row}-${col}`)
    addSolvedOppositePairChain(connectorByEdgeId, centers, edgeIds)
  }

  for (let col = 0; col < model.config.columns; col += 1) {
    const centers = Array.from({ length: model.config.rows }, (_value, row) =>
      frameByNodeId.get(nodeId(row, col))?.center)
    const edgeIds = Array.from({ length: Math.max(model.config.rows - 1, 0) }, (_value, row) =>
      `e-v-${row}-${col}`)
    addSolvedOppositePairChain(connectorByEdgeId, centers, edgeIds)
  }

  model.edges.forEach((edge) => {
    if (connectorByEdgeId.has(edge.id)) return
    const frameA = frameByNodeId.get(edge.nodeA)
    const frameB = frameByNodeId.get(edge.nodeB)
    if (!frameA || !frameB) return
    connectorByEdgeId.set(edge.id, scaleVec(addVec(frameA.center, frameB.center), 0.5))
  })

  return connectorByEdgeId
}

function addSolvedOppositePairChain(
  connectorByEdgeId: Map<string, Vec3>,
  maybeCenters: Array<Vec3 | undefined>,
  edgeIds: string[],
): void {
  if (!edgeIds.length) return
  if (maybeCenters.some((center) => !center)) {
    edgeIds.forEach((edgeId, index) => {
      const before = maybeCenters[index]
      const after = maybeCenters[index + 1]
      if (!before || !after) return
      connectorByEdgeId.set(edgeId, scaleVec(addVec(before, after), 0.5))
    })
    return
  }

  const centers = maybeCenters as Vec3[]
  solveOppositePairConnectors(centers).forEach((connector, index) => {
    const edgeId = edgeIds[index]
    if (!edgeId) return
    connectorByEdgeId.set(edgeId, connector)
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

function applyConnectedArmEndpoints(
  model: LatticeModel,
  frameByNodeId: Map<string, RigidCellFrame>,
  nodeById: Map<string, LatticeNode>,
  connectorByEdgeId: Map<string, Vec3>,
): void {
  frameByNodeId.forEach((frame) => {
    frame.armEndpoints = {}
  })

  model.edges.forEach((edge) => {
    const nodeA = nodeById.get(edge.nodeA)
    const nodeB = nodeById.get(edge.nodeB)
    const frameA = frameByNodeId.get(edge.nodeA)
    const frameB = frameByNodeId.get(edge.nodeB)
    const connector = connectorByEdgeId.get(edge.id)
    if (!nodeA || !nodeB || !frameA || !frameB || !connector) return

    frameA.armEndpoints[armDirectionForEdge(edge, nodeA, nodeB)] = connector
    frameB.armEndpoints[armDirectionForEdge(edge, nodeB, nodeA)] = connector
  })
}

function smoothFrameAxes(model: LatticeModel, frameByNodeId: Map<string, RigidCellFrame>): void {
  for (let pass = 0; pass < 10; pass += 1) {
    const nextAxes = new Map<string, Pick<RigidCellFrame, 'xAxis' | 'yAxis' | 'zAxis'>>()

    model.nodes.forEach((node) => {
      const frame = frameByNodeId.get(node.id)
      if (!frame) return

      let xSum = scaleVec(frame.xAxis, 2.2)
      let ySum = scaleVec(frame.yAxis, 2.2)

      neighboringNodeIds(node).forEach((neighborId) => {
        const neighbor = frameByNodeId.get(neighborId)
        if (!neighbor) return

        xSum = addVec(xSum, scaleVec(alignAxis(neighbor.xAxis, frame.xAxis), 0.72))
        ySum = addVec(ySum, scaleVec(alignAxis(neighbor.yAxis, frame.yAxis), 0.72))
      })

      const zAxis = frame.zAxis
      const xAxis = normalizeVec(projectToPlane(xSum, zAxis), frame.xAxis)
      const yCandidate = normalizeVec(projectToPlane(ySum, zAxis), frame.yAxis)
      let yAxis = normalizeVec(crossVec(zAxis, xAxis), fallbackPerpendicular(xAxis))
      if (dotVec(yAxis, yCandidate) < 0) yAxis = scaleVec(yAxis, -1)

      nextAxes.set(node.id, { xAxis, yAxis, zAxis })
    })

    nextAxes.forEach((axes, nodeIdValue) => {
      const frame = frameByNodeId.get(nodeIdValue)
      if (!frame) return
      frame.xAxis = axes.xAxis
      frame.yAxis = axes.yAxis
      frame.zAxis = axes.zAxis
    })
  }
}

function neighboringNodeIds(node: LatticeNode): string[] {
  return [
    nodeId(node.row, node.col - 1),
    nodeId(node.row, node.col + 1),
    nodeId(node.row - 1, node.col),
    nodeId(node.row + 1, node.col),
  ]
}

function alignAxis(axis: Vec3, reference: Vec3): Vec3 {
  return dotVec(axis, reference) < 0 ? scaleVec(axis, -1) : axis
}

function projectToPlane(vector: Vec3, normal: Vec3): Vec3 {
  return subtractVec(vector, scaleVec(normal, dotVec(vector, normal)))
}

function alignFrameAxesToPairwiseArms(frameByNodeId: Map<string, RigidCellFrame>): void {
  frameByNodeId.forEach((frame) => {
    const xSeed = frame.armEndpoints.east && frame.armEndpoints.west
      ? subtractVec(frame.armEndpoints.east, frame.armEndpoints.west)
      : frame.xAxis
    const ySeed = frame.armEndpoints.north && frame.armEndpoints.south
      ? subtractVec(frame.armEndpoints.north, frame.armEndpoints.south)
      : frame.yAxis
    const xAxis = normalizeVec(projectToPlane(xSeed, frame.zAxis), frame.xAxis)
    const yProjected = subtractVec(ySeed, scaleVec(xAxis, dotVec(ySeed, xAxis)))
    const yAxis = normalizeVec(projectToPlane(yProjected, frame.zAxis), fallbackPerpendicular(xAxis))
    const zAxis = normalizeVec(crossVec(xAxis, yAxis), frame.zAxis)
    const connectedLengths = Object.values(frame.armEndpoints).map((endpoint) => distanceVec(frame.center, endpoint))

    frame.xAxis = xAxis
    frame.yAxis = normalizeVec(crossVec(zAxis, xAxis), yAxis)
    frame.zAxis = zAxis
    if (connectedLengths.length) {
      frame.legLength = connectedLengths.reduce((sum, value) => sum + value, 0) / connectedLengths.length
    }
  })
}

export function rigidEdgeEndpointsFromFrames(
  edge: LatticeEdge,
  frameByNodeId: Map<string, RigidCellFrame>,
  nodeById: Map<string, LatticeNode>,
): { endpointA: Vec3; endpointB: Vec3 } | null {
  const nodeA = nodeById.get(edge.nodeA)
  const nodeB = nodeById.get(edge.nodeB)
  const frameA = frameByNodeId.get(edge.nodeA)
  const frameB = frameByNodeId.get(edge.nodeB)
  if (!nodeA || !nodeB || !frameA || !frameB) return null

  return {
    endpointA: armEndpointForDirection(frameA, armDirectionForEdge(edge, nodeA, nodeB)),
    endpointB: armEndpointForDirection(frameB, armDirectionForEdge(edge, nodeB, nodeA)),
  }
}

function armDirectionForEdge(edge: LatticeEdge, node: LatticeNode, other: LatticeNode): CellArmDirection {
  if (edge.orientation === 'horizontal') {
    return other.col >= node.col ? 'east' : 'west'
  }

  return other.row >= node.row ? 'north' : 'south'
}

function measureConnectorPathBend(model: LatticeModel, connectorByEdgeId: Map<string, Vec3>): number {
  let maxBend = 0

  for (let row = 0; row < model.config.rows; row += 1) {
    const chain = Array.from({ length: model.config.columns - 1 }, (_value, col) =>
      connectorByEdgeId.get(`e-h-${row}-${col}`),
    )
    maxBend = Math.max(maxBend, measureConnectorChainBend(chain))
  }

  for (let col = 0; col < model.config.columns; col += 1) {
    const chain = Array.from({ length: model.config.rows - 1 }, (_value, row) =>
      connectorByEdgeId.get(`e-v-${row}-${col}`),
    )
    maxBend = Math.max(maxBend, measureConnectorChainBend(chain))
  }

  return maxBend
}

function measureConnectorChainBend(chain: Array<Vec3 | undefined>): number {
  let maxBend = 0

  for (let index = 1; index < chain.length - 1; index += 1) {
    const previous = chain[index - 1]
    const current = chain[index]
    const next = chain[index + 1]
    if (!previous || !current || !next) continue

    const incoming = subtractVec(current, previous)
    const outgoing = subtractVec(next, current)
    const incomingLength = lengthVec(incoming)
    const outgoingLength = lengthVec(outgoing)
    if (incomingLength <= 0.000001 || outgoingLength <= 0.000001) continue

    maxBend = Math.max(maxBend, angleDeg(incoming, outgoing))
  }

  return maxBend
}

function axisSeed(center: Vec3, negative?: Vec3, positive?: Vec3, fallback: Vec3 = [1, 0, 0]): Vec3 {
  if (negative && positive) return subtractVec(positive, negative)
  if (positive) return subtractVec(positive, center)
  if (negative) return subtractVec(center, negative)
  return fallback
}

function estimateCellCrossLength(node: LatticeNode, nodeById: Map<string, LatticeNode>, fallback: number): number {
  const distances = [
    nodeById.get(nodeId(node.row, node.col - 1)),
    nodeById.get(nodeId(node.row, node.col + 1)),
    nodeById.get(nodeId(node.row - 1, node.col)),
    nodeById.get(nodeId(node.row + 1, node.col)),
  ]
    .map((neighbor) => (neighbor ? distanceVec(node.currentPosition, neighbor.currentPosition) : Number.NaN))
    .filter((distance) => Number.isFinite(distance) && distance > 0.000001)

  if (!distances.length) return fallback
  return distances.reduce((sum, distance) => sum + distance, 0) / distances.length
}

function fallbackPerpendicular(axis: Vec3): Vec3 {
  const seed: Vec3 = Math.abs(axis[2]) < 0.82 ? [0, 0, 1] : [0, 1, 0]
  return normalizeVec(crossVec(seed, axis), [1, 0, 0])
}

function normalizeVec(vector: Vec3, fallback: Vec3): Vec3 {
  const length = lengthVec(vector)
  if (length <= 0.000001) return normalizeVec(fallback, [1, 0, 0])
  return [vector[0] / length, vector[1] / length, vector[2] / length]
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

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function crossVec(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function lengthVec(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function distanceVec(a: Vec3, b: Vec3): number {
  return lengthVec(subtractVec(a, b))
}

function angleDeg(a: Vec3, b: Vec3): number {
  const denominator = lengthVec(a) * lengthVec(b)
  if (denominator <= 0.000001) return 0
  const cosine = Math.min(1, Math.max(-1, dotVec(a, b) / denominator))
  return (Math.acos(cosine) * 180) / Math.PI
}

function nodeId(row: number, col: number): string {
  return `n-${row}-${col}`
}
