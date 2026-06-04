import type { LatticeEdge, LatticeModel, LatticeNode, Vec3 } from './inverseSheetTypes'

export type CellArmDirection = 'east' | 'west' | 'north' | 'south'

export type RigidCellFrame = {
  nodeId: string
  center: Vec3
  xAxis: Vec3
  yAxis: Vec3
  zAxis: Vec3
  legLength: number
}

export type RigidCellMechanismStats = {
  maxLegLengthSpread: number
  maxOrthogonalityErrorDeg: number
  maxConnectorEndpointGap: number
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
  }
}

export function armEndpointForDirection(frame: RigidCellFrame, direction: CellArmDirection): Vec3 {
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

  return {
    maxLegLengthSpread,
    maxOrthogonalityErrorDeg,
    maxConnectorEndpointGap,
  }
}

export function buildRigidCellMechanism(model: LatticeModel): RigidCellMechanism {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  const frameByNodeId = new Map<string, RigidCellFrame>()

  model.nodes.forEach((node) => {
    frameByNodeId.set(node.id, buildRigidCellFrame(node, nodeById, model.config.spacing))
  })

  solveIsotropicLegLengths(model, frameByNodeId, nodeById)

  const endpointsByEdgeId = new Map<string, { endpointA: Vec3; endpointB: Vec3 }>()
  const connectorByEdgeId = new Map<string, Vec3>()
  model.edges.forEach((edge) => {
    const endpoints = rigidEdgeEndpointsFromFrames(edge, frameByNodeId, nodeById)
    if (!endpoints) return
    endpointsByEdgeId.set(edge.id, endpoints)
    connectorByEdgeId.set(edge.id, scaleVec(addVec(endpoints.endpointA, endpoints.endpointB), 0.5))
  })

  return {
    frames: model.nodes.map((node) => frameByNodeId.get(node.id)).filter(Boolean) as RigidCellFrame[],
    frameByNodeId,
    connectorByEdgeId,
    endpointsByEdgeId,
  }
}

function solveIsotropicLegLengths(
  model: LatticeModel,
  frameByNodeId: Map<string, RigidCellFrame>,
  nodeById: Map<string, LatticeNode>,
): void {
  const minLength = model.config.spacing * 0.16
  const maxLength = Math.max(model.config.spacing * 4.8, 2)

  for (let iteration = 0; iteration < 90; iteration += 1) {
    model.edges.forEach((edge) => {
      const nodeA = nodeById.get(edge.nodeA)
      const nodeB = nodeById.get(edge.nodeB)
      const frameA = frameByNodeId.get(edge.nodeA)
      const frameB = frameByNodeId.get(edge.nodeB)
      if (!nodeA || !nodeB || !frameA || !frameB) return

      const directionA = armUnitForEdge(edge, nodeA, nodeB, frameA)
      const directionB = armUnitForEdge(edge, nodeB, nodeA, frameB)
      const residual = subtractVec(
        addVec(frameA.center, scaleVec(directionA, frameA.legLength)),
        addVec(frameB.center, scaleVec(directionB, frameB.legLength)),
      )
      const coupling = dotVec(directionA, directionB)
      const b = -coupling
      const rhsA = -dotVec(directionA, residual)
      const rhsB = dotVec(directionB, residual)
      const det = 1 - coupling * coupling

      const [deltaA, deltaB] = Math.abs(det) > 0.000001
        ? [(rhsA - b * rhsB) / det, (rhsB - b * rhsA) / det]
        : [rhsA * 0.5, rhsB * 0.5]

      const relaxation = iteration < 30 ? 0.16 : iteration < 65 ? 0.08 : 0.035
      const nextLengthA = clampNumber(frameA.legLength + deltaA * relaxation, minLength, maxLength)
      const nextLengthB = clampNumber(frameB.legLength + deltaB * relaxation, minLength, maxLength)
      const nextResidual = subtractVec(
        addVec(frameA.center, scaleVec(directionA, nextLengthA)),
        addVec(frameB.center, scaleVec(directionB, nextLengthB)),
      )

      if (lengthVec(nextResidual) < lengthVec(residual)) {
        frameA.legLength = nextLengthA
        frameB.legLength = nextLengthB
      }
    })
  }
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
    endpointA: addVec(frameA.center, scaleVec(armUnitForEdge(edge, nodeA, nodeB, frameA), frameA.legLength)),
    endpointB: addVec(frameB.center, scaleVec(armUnitForEdge(edge, nodeB, nodeA, frameB), frameB.legLength)),
  }
}

function armUnitForEdge(edge: LatticeEdge, node: LatticeNode, other: LatticeNode, frame: RigidCellFrame): Vec3 {
  return unitForDirection(frame, armDirectionForEdge(edge, node, other))
}

function unitForDirection(frame: RigidCellFrame, direction: CellArmDirection): Vec3 {
  const axis = direction === 'east' || direction === 'west' ? frame.xAxis : frame.yAxis
  const sign = direction === 'east' || direction === 'north' ? 1 : -1
  return scaleVec(axis, sign)
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

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function nodeId(row: number, col: number): string {
  return `n-${row}-${col}`
}
