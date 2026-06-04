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
  maxOrthogonalityErrorDeg: number
  maxConnectorEndpointGap: number
  maxArmSurfaceLeak: number
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
  let maxLegLengthSpread = 0
  let maxOrthogonalityErrorDeg = 0
  let maxConnectorEndpointGap = 0
  let maxArmSurfaceLeak = 0

  mechanism.frames.forEach((frame) => {
    const endpoints = [
      armEndpointForDirection(frame, 'east'),
      armEndpointForDirection(frame, 'west'),
      armEndpointForDirection(frame, 'north'),
      armEndpointForDirection(frame, 'south'),
    ]
    const lengths = endpoints.map((endpoint) => distanceVec(frame.center, endpoint))
    maxLegLengthSpread = Math.max(maxLegLengthSpread, Math.max(...lengths) - Math.min(...lengths))
    maxOrthogonalityErrorDeg = Math.max(maxOrthogonalityErrorDeg, Math.abs(90 - angleDeg(frame.xAxis, frame.yAxis)))
  })

  mechanism.endpointsByEdgeId.forEach((endpoints) => {
    maxConnectorEndpointGap = Math.max(maxConnectorEndpointGap, distanceVec(endpoints.endpointA, endpoints.endpointB))
  })

  model.edges.forEach((edge) => {
    const frameA = mechanism.frameByNodeId.get(edge.nodeA)
    const frameB = mechanism.frameByNodeId.get(edge.nodeB)
    const connector = mechanism.connectorByEdgeId.get(edge.id)
    if (!frameA || !frameB || !connector) return

    maxArmSurfaceLeak = Math.max(maxArmSurfaceLeak, pointSegmentDistance(connector, frameA.center, frameB.center))
  })

  return {
    maxLegLengthSpread,
    maxOrthogonalityErrorDeg,
    maxConnectorEndpointGap,
    maxArmSurfaceLeak,
  }
}

export function buildRigidCellMechanism(model: LatticeModel): RigidCellMechanism {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const frameByNodeId = new Map<string, RigidCellFrame>()

  model.nodes.forEach((node) => {
    frameByNodeId.set(node.id, buildRigidCellFrame(node, nodeById, model.config.spacing))
  })

  const connectorByEdgeId = solveSurfaceAnchoredConnectors(model, frameByNodeId, nodeById)
  const endpointsByEdgeId = new Map<string, { endpointA: Vec3; endpointB: Vec3 }>()
  model.edges.forEach((edge) => {
    const connector = connectorByEdgeId.get(edge.id)
    if (!connector) return
    endpointsByEdgeId.set(edge.id, { endpointA: connector, endpointB: connector })
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
  const radiusByNodeId = solveCellLegRadii(model, frameByNodeId)
  const connectorByEdgeId = buildSurfaceSharedConnectors(model, frameByNodeId, radiusByNodeId)
  applySurfaceArmEndpoints(model, frameByNodeId, nodeById, connectorByEdgeId)
  return connectorByEdgeId
}

function solveCellLegRadii(
  model: LatticeModel,
  frameByNodeId: Map<string, RigidCellFrame>,
): Map<string, number> {
  const edgeLengths = model.edges.map((edge) => {
    const frameA = frameByNodeId.get(edge.nodeA)
    const frameB = frameByNodeId.get(edge.nodeB)
    return {
      edge,
      length: frameA && frameB ? distanceVec(frameA.center, frameB.center) : model.config.spacing,
    }
  })
  const radiusByNodeId = new Map<string, number>()

  frameByNodeId.forEach((frame, nodeIdValue) => {
    const incident = edgeLengths
      .filter(({ edge }) => edge.nodeA === nodeIdValue || edge.nodeB === nodeIdValue)
      .map(({ length }) => length)
    const meanLength = incident.length ? incident.reduce((sum, length) => sum + length, 0) / incident.length : model.config.spacing
    radiusByNodeId.set(nodeIdValue, Math.max(meanLength * 0.5, model.config.spacing * 0.12, frame.legLength * 0.4))
  })

  for (let iteration = 0; iteration < 36; iteration += 1) {
    const next = new Map(radiusByNodeId)

    frameByNodeId.forEach((_frame, nodeIdValue) => {
      const incidentTargets = edgeLengths
        .filter(({ edge }) => edge.nodeA === nodeIdValue || edge.nodeB === nodeIdValue)
        .map(({ edge, length }) => length - (radiusByNodeId.get(edge.nodeA === nodeIdValue ? edge.nodeB : edge.nodeA) ?? length * 0.5))
        .filter((target) => Number.isFinite(target))

      if (!incidentTargets.length) return
      const target = incidentTargets.reduce((sum, value) => sum + value, 0) / incidentTargets.length
      const localLengths = edgeLengths
        .filter(({ edge }) => edge.nodeA === nodeIdValue || edge.nodeB === nodeIdValue)
        .map(({ length }) => length)
      const shortest = Math.min(...localLengths)
      const longest = Math.max(...localLengths)
      const lower = Math.max(shortest * 0.18, model.config.spacing * 0.08)
      const upper = Math.max(longest * 0.82, lower + model.config.spacing * 0.05)
      const current = radiusByNodeId.get(nodeIdValue) ?? target

      next.set(nodeIdValue, lerpNumber(current, clampNumber(target, lower, upper), 0.34))
    })

    radiusByNodeId.clear()
    next.forEach((value, key) => radiusByNodeId.set(key, value))
  }

  return radiusByNodeId
}

function buildSurfaceSharedConnectors(
  model: LatticeModel,
  frameByNodeId: Map<string, RigidCellFrame>,
  radiusByNodeId: Map<string, number>,
): Map<string, Vec3> {
  const connectorByEdgeId = new Map<string, Vec3>()

  model.edges.forEach((edge) => {
    const frameA = frameByNodeId.get(edge.nodeA)
    const frameB = frameByNodeId.get(edge.nodeB)
    if (!frameA || !frameB) return

    const length = distanceVec(frameA.center, frameB.center)
    const radiusA = radiusByNodeId.get(edge.nodeA) ?? length * 0.5
    const radiusB = radiusByNodeId.get(edge.nodeB) ?? length * 0.5
    const ratio = clampNumber(radiusA / Math.max(radiusA + radiusB, 0.000001), 0.16, 0.84)

    connectorByEdgeId.set(edge.id, lerpVec(frameA.center, frameB.center, ratio))
  })

  return connectorByEdgeId
}

function applySurfaceArmEndpoints(
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

  frameByNodeId.forEach((frame) => {
    const endpoints = Object.values(frame.armEndpoints).filter(Boolean) as Vec3[]
    if (!endpoints.length) return

    frame.legLength = endpoints.reduce((sum, endpoint) => sum + distanceVec(frame.center, endpoint), 0) / endpoints.length

    const east = frame.armEndpoints.east
    const west = frame.armEndpoints.west
    const north = frame.armEndpoints.north
    const south = frame.armEndpoints.south
    const xSeed = east && west ? subtractVec(east, west) : east ? subtractVec(east, frame.center) : west ? subtractVec(frame.center, west) : frame.xAxis
    const ySeed = north && south ? subtractVec(north, south) : north ? subtractVec(north, frame.center) : south ? subtractVec(frame.center, south) : frame.yAxis

    frame.xAxis = normalizeVec(xSeed, frame.xAxis)
    frame.yAxis = normalizeVec(ySeed, frame.yAxis)
    frame.zAxis = normalizeVec(crossVec(frame.xAxis, frame.yAxis), frame.zAxis)
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

function pointSegmentDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const segment = subtractVec(end, start)
  const denominator = dotVec(segment, segment)
  if (denominator <= 0.000001) return distanceVec(point, start)
  const amount = clampNumber(dotVec(subtractVec(point, start), segment) / denominator, 0, 1)
  return distanceVec(point, lerpVec(start, end, amount))
}

function angleDeg(a: Vec3, b: Vec3): number {
  const denominator = lengthVec(a) * lengthVec(b)
  if (denominator <= 0.000001) return 0
  const cosine = Math.min(1, Math.max(-1, dotVec(a, b) / denominator))
  return (Math.acos(cosine) * 180) / Math.PI
}

function lerpVec(a: Vec3, b: Vec3, amount: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]
}

function lerpNumber(a: number, b: number, amount: number): number {
  return a + (b - a) * amount
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function nodeId(row: number, col: number): string {
  return `n-${row}-${col}`
}
