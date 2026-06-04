import { Billboard, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type {
  CameraViewRequest,
  DihedralMetric,
  EdgeMetric,
  LatticeBounds,
  LatticeModel,
  LatticeNode,
  LatticeQuad,
  NodeMetric,
  QuadMetric,
  SelectedElement,
  Vec3,
} from './inverseSheetTypes'
import { colorForEdge, colorForNode, colorForQuad } from './metricVisuals'

type LatticeViewer3DProps = {
  model: LatticeModel
  selected: SelectedElement
  viewRequest: CameraViewRequest
}

export default function LatticeViewer3D({ model, selected, viewRequest }: LatticeViewer3DProps) {
  return (
    <section className="scene-shell inverse-scene" aria-label="Inverse Sheet 3D lattice view">
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#f7f3ed']} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[8, -8, 10]} intensity={1.1} />
        <directionalLight position={[-5, 7, 5]} intensity={0.42} />
        <Suspense fallback={null}>
          <LatticeModelGroup model={model} selected={selected} />
        </Suspense>
        <SceneGrid bounds={model.bounds} />
        <AxisLabels bounds={model.bounds} />
        <CameraRig bounds={model.bounds} viewRequest={viewRequest} />
      </Canvas>
    </section>
  )
}

function LatticeModelGroup({ model, selected }: { model: LatticeModel; selected: SelectedElement }) {
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes])
  const edgeMetricById = useMemo(() => new Map(model.edgeMetrics.map((metric) => [metric.edgeId, metric])), [model.edgeMetrics])
  const nodeMetricById = useMemo(() => new Map(model.nodeMetrics.map((metric) => [metric.nodeId, metric])), [model.nodeMetrics])
  const quadMetricById = useMemo(() => new Map(model.quadMetrics.map((metric) => [metric.quadId, metric])), [model.quadMetrics])
  const dihedralByQuad = useMemo(() => buildDihedralByQuad(model.dihedralMetrics), [model.dihedralMetrics])
  const edgeGeometry = useMemo(() => buildEdgeGeometry(model, nodeById, edgeMetricById), [model, nodeById, edgeMetricById])
  const restGhostGeometry = useMemo(() => buildRestGhostGeometry(model, nodeById), [model, nodeById])
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(model, nodeById, quadMetricById, dihedralByQuad), [model, nodeById, quadMetricById, dihedralByQuad])
  const labelsVisible = model.config.showLabels && model.config.rows <= 15 && model.config.columns <= 15
  const nodeSize = Math.max(model.config.spacing * (model.config.rows > 30 || model.config.columns > 30 ? 0.035 : 0.055), 0.018)
  const surfaceOpacity = model.config.rows > 30 || model.config.columns > 30 ? 0.34 : 0.48

  return (
    <group>
      {model.config.showRestGhost && (
        <lineSegments geometry={restGhostGeometry}>
          <lineBasicMaterial color="#9e968c" transparent opacity={0.28} />
        </lineSegments>
      )}
      {model.config.showSurface && (
        <mesh geometry={surfaceGeometry}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={surfaceOpacity} roughness={0.78} metalness={0.02} />
        </mesh>
      )}
      {model.config.showEdges && (
        <lineSegments geometry={edgeGeometry}>
          <lineBasicMaterial vertexColors transparent opacity={0.96} />
        </lineSegments>
      )}
      {model.config.showNodes && <NodeInstances model={model} nodeMetrics={nodeMetricById} nodeSize={nodeSize} />}
      {labelsVisible && <NodeLabels nodes={model.nodes} />}
      <SelectedHighlight selected={selected} model={model} nodeById={nodeById} />
    </group>
  )
}

function NodeInstances({
  model,
  nodeMetrics,
  nodeSize,
}: {
  model: LatticeModel
  nodeMetrics: Map<string, NodeMetric>
  nodeSize: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, model.config.rows > 30 || model.config.columns > 30 ? 8 : 14, 8), [model.config.columns, model.config.rows])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.58, metalness: 0.04 }), [])

  useLayoutEffect(() => {
    if (!ref.current) return

    const dummy = new THREE.Object3D()
    model.nodes.forEach((node, index) => {
      const metric = nodeMetrics.get(node.id)
      const color = metric ? colorForNode(metric, model) : '#f2f1ee'
      dummy.position.set(...node.currentPosition)
      dummy.scale.setScalar(nodeSize)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
      ref.current?.setColorAt(index, new THREE.Color(color))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [model, nodeMetrics, nodeSize])

  return (
    <instancedMesh ref={ref} args={[geometry, material, model.nodes.length]} />
  )
}

function NodeLabels({ nodes }: { nodes: LatticeNode[] }) {
  return (
    <>
      {nodes.map((node) => (
        <Billboard key={node.id} position={[node.currentPosition[0], node.currentPosition[1], node.currentPosition[2] + 0.08]}>
          <Text fontSize={0.11} color="#1f2328" anchorX="center" anchorY="middle">
            {`${node.row},${node.col}`}
          </Text>
        </Billboard>
      ))}
    </>
  )
}

function SelectedHighlight({
  selected,
  model,
  nodeById,
}: {
  selected: SelectedElement
  model: LatticeModel
  nodeById: Map<string, LatticeNode>
}) {
  if (!selected) return null

  if (selected.kind === 'edge') {
    const edge = model.edges.find((candidate) => candidate.id === selected.id)
    const nodeA = edge ? nodeById.get(edge.nodeA) : undefined
    const nodeB = edge ? nodeById.get(edge.nodeB) : undefined
    if (!nodeA || !nodeB) return null
    return <TubeSegment start={nodeA.currentPosition} end={nodeB.currentPosition} radius={0.035} color="#f5d84b" />
  }

  if (selected.kind === 'node') {
    const node = nodeById.get(selected.id)
    if (!node) return null
    return (
      <mesh position={node.currentPosition}>
        <sphereGeometry args={[0.13, 18, 12]} />
        <meshStandardMaterial color="#f5d84b" emissive="#f5d84b" emissiveIntensity={0.18} roughness={0.42} />
      </mesh>
    )
  }

  if (selected.kind === 'quad') {
    const quad = model.quads.find((candidate) => candidate.id === selected.id)
    if (!quad) return null
    return <SelectedQuad quad={quad} nodeById={nodeById} />
  }

  const pair = model.dihedralPairs.find((candidate) => candidate.id === selected.id)
  const metric = model.dihedralMetrics.find((candidate) => candidate.pairId === selected.id)
  if (!pair || !metric) return null
  const highlightedQuads = [model.quads.find((quad) => quad.id === pair.quadA), model.quads.find((quad) => quad.id === pair.quadB)].filter(Boolean) as LatticeQuad[]
  const sharedNodeIds = metric.sharedEdge.split(':')
  const nodeA = nodeById.get(sharedNodeIds[0])
  const nodeB = nodeById.get(sharedNodeIds[1])

  return (
    <group>
      {highlightedQuads.map((quad) => (
        <SelectedQuad key={quad.id} quad={quad} nodeById={nodeById} />
      ))}
      {nodeA && nodeB && <TubeSegment start={nodeA.currentPosition} end={nodeB.currentPosition} radius={0.04} color="#f5d84b" />}
    </group>
  )
}

function SelectedQuad({ quad, nodeById }: { quad: LatticeQuad; nodeById: Map<string, LatticeNode> }) {
  const geometry = useMemo(() => {
    const [n00, n10, n01, n11] = quad.nodeIds.map((id) => nodeById.get(id)?.currentPosition ?? ([0, 0, 0] as Vec3))
    const positions = new Float32Array([...n00, ...n10, ...n01, ...n10, ...n11, ...n01])
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    nextGeometry.computeVertexNormals()
    return nextGeometry
  }, [nodeById, quad])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#f5d84b" side={THREE.DoubleSide} transparent opacity={0.72} emissive="#f5d84b" emissiveIntensity={0.08} />
    </mesh>
  )
}

function TubeSegment({ start, end, radius, color }: { start: Vec3; end: Vec3; radius: number; color: string }) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const startVector = new THREE.Vector3(...start)
    const endVector = new THREE.Vector3(...end)
    const direction = new THREE.Vector3().subVectors(endVector, startVector)
    const segmentLength = direction.length()
    const segmentMidpoint = new THREE.Vector3().addVectors(startVector, endVector).multiplyScalar(0.5)
    const segmentQuaternion = new THREE.Quaternion()

    if (segmentLength > 0.0001) {
      segmentQuaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    }

    return { midpoint: segmentMidpoint, length: segmentLength, quaternion: segmentQuaternion }
  }, [end, start])

  if (length <= 0.0001) return null

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.42} />
    </mesh>
  )
}

function SceneGrid({ bounds }: { bounds: LatticeBounds }) {
  const size = Math.max(bounds.span[0], bounds.span[1], 4) * 1.35
  const z = bounds.min[2] - Math.max(size * 0.03, 0.08)

  return (
    <gridHelper
      args={[size, 24, '#c8bdb0', '#e1d8cd']}
      rotation={[Math.PI / 2, 0, 0]}
      position={[bounds.center[0], bounds.center[1], z]}
    />
  )
}

function AxisLabels({ bounds }: { bounds: LatticeBounds }) {
  const size = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2)
  const origin: Vec3 = [bounds.center[0] - size * 0.54, bounds.center[1] - size * 0.54, bounds.min[2]]

  return (
    <group>
      <TubeSegment start={origin} end={[origin[0] + size * 0.26, origin[1], origin[2]]} radius={0.012} color="#9c6150" />
      <TubeSegment start={origin} end={[origin[0], origin[1] + size * 0.26, origin[2]]} radius={0.012} color="#5f7b62" />
      <TubeSegment start={origin} end={[origin[0], origin[1], origin[2] + size * 0.26]} radius={0.012} color="#566f96" />
      <Text position={[origin[0] + size * 0.3, origin[1], origin[2]]} fontSize={0.14} color="#9c6150" anchorX="center" anchorY="middle">
        x
      </Text>
      <Text position={[origin[0], origin[1] + size * 0.3, origin[2]]} fontSize={0.14} color="#5f7b62" anchorX="center" anchorY="middle">
        y
      </Text>
      <Text position={[origin[0], origin[1], origin[2] + size * 0.3]} fontSize={0.14} color="#566f96" anchorX="center" anchorY="middle">
        z
      </Text>
    </group>
  )
}

function CameraRig({ bounds, viewRequest }: { bounds: LatticeBounds; viewRequest: CameraViewRequest }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return

    const maxSpan = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2)
    const distance = maxSpan * 1.75
    const target = new THREE.Vector3(...bounds.center)
    const position =
      viewRequest.view === 'top'
        ? new THREE.Vector3(bounds.center[0], bounds.center[1], bounds.center[2] + distance)
        : viewRequest.view === 'side'
          ? new THREE.Vector3(bounds.center[0], bounds.center[1] - distance, bounds.center[2] + distance * 0.16)
          : new THREE.Vector3(bounds.center[0] + distance * 0.95, bounds.center[1] - distance * 0.9, bounds.center[2] + distance * 0.55)

    camera.position.copy(position)
    if (viewRequest.view === 'top') {
      camera.up.set(0, 1, 0)
    } else {
      camera.up.set(0, 0, 1)
    }
    camera.lookAt(target)

    camera.near = 0.01
    camera.far = Math.max(distance * 8, 100)
    camera.updateProjectionMatrix()

    controlsRef.current?.target.copy(target)
    controlsRef.current?.update()
  }, [bounds, viewRequest.version, viewRequest.view])

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault up={[0, 0, 1]} fov={42} />
      <OrbitControls ref={controlsRef} makeDefault enablePan enableZoom enableRotate />
    </>
  )
}

function buildEdgeGeometry(model: LatticeModel, nodes: Map<string, LatticeNode>, metrics: Map<string, EdgeMetric>): THREE.BufferGeometry {
  const positions = new Float32Array(model.edges.length * 2 * 3)
  const colors = new Float32Array(model.edges.length * 2 * 3)

  model.edges.forEach((edge, index) => {
    const nodeA = nodes.get(edge.nodeA)
    const nodeB = nodes.get(edge.nodeB)
    const metric = metrics.get(edge.id)
    const color = new THREE.Color(metric ? colorForEdge(metric, model) : '#7d766d')

    writeVec(positions, index * 6, nodeA?.currentPosition ?? [0, 0, 0])
    writeVec(positions, index * 6 + 3, nodeB?.currentPosition ?? [0, 0, 0])
    writeColor(colors, index * 6, color)
    writeColor(colors, index * 6 + 3, color)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function buildRestGhostGeometry(model: LatticeModel, nodes: Map<string, LatticeNode>): THREE.BufferGeometry {
  const positions = new Float32Array(model.edges.length * 2 * 3)

  model.edges.forEach((edge, index) => {
    writeVec(positions, index * 6, nodes.get(edge.nodeA)?.restPosition ?? [0, 0, 0])
    writeVec(positions, index * 6 + 3, nodes.get(edge.nodeB)?.restPosition ?? [0, 0, 0])
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

function buildSurfaceGeometry(
  model: LatticeModel,
  nodes: Map<string, LatticeNode>,
  metrics: Map<string, QuadMetric>,
  dihedralByQuad: Map<string, number>,
): THREE.BufferGeometry {
  const positions = new Float32Array(model.quads.length * 6 * 3)
  const colors = new Float32Array(model.quads.length * 6 * 3)

  model.quads.forEach((quad, quadIndex) => {
    const [n00, n10, n01, n11] = quad.nodeIds.map((id) => nodes.get(id)?.currentPosition ?? ([0, 0, 0] as Vec3))
    const offset = quadIndex * 18
    const vertices = [n00, n10, n01, n10, n11, n01]
    const metric = metrics.get(quad.id)
    const color = new THREE.Color(metric ? colorForQuad(metric, model, dihedralByQuad.get(quad.id) ?? 0) : '#f7efe4')

    vertices.forEach((vertex, vertexIndex) => {
      writeVec(positions, offset + vertexIndex * 3, vertex)
      writeColor(colors, offset + vertexIndex * 3, color)
    })
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildDihedralByQuad(metrics: DihedralMetric[]): Map<string, number> {
  const map = new Map<string, number>()

  metrics.forEach((metric) => {
    map.set(metric.quadA, Math.max(map.get(metric.quadA) ?? 0, metric.dihedralDeg))
    map.set(metric.quadB, Math.max(map.get(metric.quadB) ?? 0, metric.dihedralDeg))
  })

  return map
}

function writeVec(array: Float32Array, offset: number, vector: Vec3): void {
  array[offset] = vector[0]
  array[offset + 1] = vector[1]
  array[offset + 2] = vector[2]
}

function writeColor(array: Float32Array, offset: number, color: THREE.Color): void {
  array[offset] = color.r
  array[offset + 1] = color.g
  array[offset + 2] = color.b
}
