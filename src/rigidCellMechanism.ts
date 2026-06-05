import type { LatticeEdge, LatticeModel, LatticeNode, Vec3 } from './inverseSheetTypes'

export type CellArmDirection = 'east' | 'west' | 'north' | 'south'

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
  maxOrthogonalityErrorDeg: number
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
  let maxOrthogonalityErrorDeg = 0
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

    const pairedLengths: number[] = []

    if (eastEndpoint && westEndpoint) {
      const eastVector = subtractVec(eastEndpoint, frame.center)
      const westVector = subtractVec(westEndpoint, frame.center)
      const eastLength = lengthVec(eastVector)
      const westLength = lengthVec(westVector)

      pairedLengths.push(eastLength, westLength)
      maxPairLengthSpread = Math.max(maxPairLengthSpread, Math.abs(eastLength - westLength))
      maxOppositeColinearErrorDeg = Math.max(
        maxOppositeColinearErrorDeg,
        angleDeg(eastVector, scaleVec(westVector, -1)),
      )
    }

    if (northEndpoint && southEndpoint) {
      const northVector = subtractVec(northEndpoint, frame.center)
      const southVector = subtractVec(southEndpoint, frame.center)
      const northLength = lengthVec(northVector)
      const southLength = lengthVec(southVector)

      pairedLengths.push(northLength, southLength)
      maxPairLengthSpread = Math.max(maxPairLengthSpread, Math.abs(northLength - southLength))
      maxOppositeColinearErrorDeg = Math.max(
        maxOppositeColinearErrorDeg,
        angleDeg(northVector, scaleVec(southVector, -1)),
      )
    }

    if (pairedLengths.length >= 2) {
      maxLegLengthSpread = Math.max(maxLegLengthSpread, Math.max(...pairedLengths) - Math.min(...pairedLengths))
    }

    if (eastEndpoint && westEndpoint && northEndpoint && southEndpoint) {
      const visualXAxis = subtractVec(eastEndpoint, westEndpoint)
      const visualYAxis = subtractVec(northEndpoint, southEndpoint)
      maxOrthogonalityErrorDeg = Math.max(maxOrthogonalityErrorDeg, Math.abs(90 - angleDeg(visualXAxis, visualYAxis)))
    }

    const sourceNode = nodeById.get(frame.nodeId)
    if (sourceNode) {
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

    const midpoint = scaleVec(addVec(frameA.center, frameB.center), 0.5)
    const localNormal = normalizeVec(addVec(frameA.zAxis, frameB.zAxis), frameA.zAxis)
    maxArmSurfaceLeak = Math.max(maxArmSurfaceLeak, Math.abs(dotVec(subtractVec(connector, midpoint), localNormal)))
  })

  return {
    maxLegLengthSpread,
    maxPairLengthSpread,
    maxOppositeColinearErrorDeg,
    maxOrthogonalityErrorDeg,
    maxConnectorEndpointGap,
    meanConnectorEndpointGap: connectorEndpointGapCount ? connectorEndpointGapSum / connectorEndpointGapCount : 0,
    rmsConnectorEndpointGap: connectorEndpointGapCount
      ? Math.sqrt(connectorEndpointGapSquaredSum / connectorEndpointGapCount)
      : 0,
    maxArmSurfaceLeak,
    maxCenterShift,
  }
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
    const centers = Array.from({ length: model.config.columns }, (_value, col) => frameByNodeId.get(nodeId(row, col))?.center)
    solveOppositePairConnectorChain(centers).forEach((connector, col) => {
      connectorByEdgeId.set(`e-h-${row}-${col}`, connector)
    })
  }

  for (let col = 0; col < model.config.columns; col += 1) {
    const centers = Array.from({ length: model.config.rows }, (_value, row) => frameByNodeId.get(nodeId(row, col))?.center)
    solveOppositePairConnectorChain(centers).forEach((connector, row) => {
      connectorByEdgeId.set(`e-v-${row}-${col}`, connector)
    })
  }

  return connectorByEdgeId
}

function solveOppositePairConnectorChain(centers: Array<Vec3 | undefined>): Vec3[] {
  if (centers.length < 2) return []

  const edgeCount = centers.length - 1
  const signs: number[] = [1]
  const offsets: Vec3[] = [[0, 0, 0]]

  for (let edgeIndex = 1; edgeIndex < edgeCount; edgeIndex += 1) {
    const center = centers[edgeIndex]
    const previousOffset = offsets[edgeIndex - 1]
    signs[edgeIndex] = -signs[edgeIndex - 1]
    offsets[edgeIndex] = center ? subtractVec(scaleVec(center, 2), previousOffset) : previousOffset
  }

  let seedSum: Vec3 = [0, 0, 0]
  let seedCount = 0

  for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
    const left = centers[edgeIndex]
    const right = centers[edgeIndex + 1]
    if (!left || !right) continue

    const target = scaleVec(addVec(left, right), 0.5)
    seedSum = addVec(seedSum, scaleVec(subtractVec(target, offsets[edgeIndex]), signs[edgeIndex]))
    seedCount += 1
  }

  const seed = seedCount ? scaleVec(seedSum, 1 / seedCount) : centers[0] ?? [0, 0, 0]
  return Array.from({ length: edgeCount }, (_value, edgeIndex) =>
    addVec(scaleVec(seed, signs[edgeIndex]), offsets[edgeIndex]),
  )
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
