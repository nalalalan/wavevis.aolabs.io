import { Billboard, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type {
  CameraFocusRequest,
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
import { colorForEdge, colorForNode, colorForQuad, legendForMode } from './metricVisuals'

type LatticeViewer3DProps = {
  model: LatticeModel
  selected: SelectedElement
  pickedEdges: string[]
  viewRequest: CameraViewRequest
  focusRequest: CameraFocusRequest
  onEdgePick: (edgeId: string) => void
}

export default function LatticeViewer3D({ model, selected, pickedEdges, viewRequest, focusRequest, onEdgePick }: LatticeViewer3DProps) {
  return (
    <section className="scene-shell inverse-scene" aria-label="Inverse Sheet 3D lattice view">
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#f7f3ed']} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[8, -8, 10]} intensity={1.1} />
        <directionalLight position={[-5, 7, 5]} intensity={0.42} />
        <Suspense fallback={null}>
          <LatticeModelGroup model={model} selected={selected} pickedEdges={pickedEdges} onEdgePick={onEdgePick} />
        </Suspense>
        <SceneGrid bounds={model.bounds} />
        <AxisLabels bounds={model.bounds} />
        <CameraRig model={model} viewRequest={viewRequest} focusRequest={focusRequest} />
      </Canvas>
      {model.config.showHeatmap && <SceneColorBar model={model} />}
    </section>
  )
}

function LatticeModelGroup({
  model,
  selected,
  pickedEdges,
  onEdgePick,
}: {
  model: LatticeModel
  selected: SelectedElement
  pickedEdges: string[]
  onEdgePick: (edgeId: string) => void
}) {
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes])
  const edgeMetricById = useMemo(() => new Map(model.edgeMetrics.map((metric) => [metric.edgeId, metric])), [model.edgeMetrics])
  const nodeMetricById = useMemo(() => new Map(model.nodeMetrics.map((metric) => [metric.nodeId, metric])), [model.nodeMetrics])
  const quadMetricById = useMemo(() => new Map(model.quadMetrics.map((metric) => [metric.quadId, metric])), [model.quadMetrics])
  const dihedralByQuad = useMemo(() => buildDihedralByQuad(model.dihedralMetrics), [model.dihedralMetrics])
  const restGhostGeometry = useMemo(() => buildRestGhostGeometry(model, nodeById), [model, nodeById])
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(model, nodeById, quadMetricById, dihedralByQuad), [model, nodeById, quadMetricById, dihedralByQuad])
  const labelsVisible = model.config.showLabels && model.config.rows <= 15 && model.config.columns <= 15
  const largeGrid = model.config.rows > 30 || model.config.columns > 30
  const nodeSize = Math.max(model.config.spacing * (largeGrid ? 0.085 : 0.075), 0.026)
  const edgeRadius = Math.max(model.config.spacing * (largeGrid ? 0.032 : 0.026), 0.014)
  const surfaceOpacity = largeGrid ? 0.3 : 0.42

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
        <EdgeInstances
          model={model}
          nodes={nodeById}
          metrics={edgeMetricById}
          radius={edgeRadius}
          pickedEdges={pickedEdges}
          onEdgePick={onEdgePick}
        />
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
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.58, metalness: 0.04 }), [])

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

function EdgeInstances({
  model,
  nodes,
  metrics,
  radius,
  pickedEdges,
  onEdgePick,
}: {
  model: LatticeModel
  nodes: Map<string, LatticeNode>
  metrics: Map<string, EdgeMetric>
  radius: number
  pickedEdges: string[]
  onEdgePick: (edgeId: string) => void
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const pickedEdgeSet = useMemo(() => new Set(pickedEdges), [pickedEdges])
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, model.config.rows > 30 || model.config.columns > 30 ? 7 : 10), [model.config.columns, model.config.rows])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true }), [])

  useLayoutEffect(() => {
    if (!ref.current) return

    const dummy = new THREE.Object3D()
    const yAxis = new THREE.Vector3(0, 1, 0)
    model.edges.forEach((edge, index) => {
      const nodeA = nodes.get(edge.nodeA)
      const nodeB = nodes.get(edge.nodeB)
      const start = new THREE.Vector3(...(nodeA?.currentPosition ?? ([0, 0, 0] as Vec3)))
      const end = new THREE.Vector3(...(nodeB?.currentPosition ?? ([0, 0, 0] as Vec3)))
      const direction = new THREE.Vector3().subVectors(end, start)
      const length = Math.max(direction.length(), 0.000001)
      const metric = metrics.get(edge.id)
      const color = pickedEdgeSet.has(edge.id)
        ? new THREE.Color(pickedEdges[0] === edge.id ? '#f5d84b' : '#ff66b3')
        : new THREE.Color(metric ? colorForEdge(metric, model) : '#5d554f')

      dummy.position.addVectors(start, end).multiplyScalar(0.5)
      dummy.quaternion.setFromUnitVectors(yAxis, direction.normalize())
      dummy.scale.set(radius, length, radius)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
      ref.current?.setColorAt(index, color)
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [metrics, model, nodes, pickedEdgeSet, pickedEdges, radius])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, model.edges.length]}
      onPointerDown={(event) => {
        if (typeof event.instanceId !== 'number') return
        const edge = model.edges[event.instanceId]
        if (!edge) return
        event.stopPropagation()
        onEdgePick(edge.id)
      }}
    />
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

function CameraRig({
  model,
  viewRequest,
  focusRequest,
}: {
  model: LatticeModel
  viewRequest: CameraViewRequest
  focusRequest: CameraFocusRequest
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const modelRef = useRef(model)

  useEffect(() => {
    modelRef.current = model
  }, [model])

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return

    positionCamera(camera, controlsRef.current, modelRef.current, viewRequest.view)
  }, [viewRequest.version, viewRequest.view])

  useEffect(() => {
    const camera = cameraRef.current
    const selected = focusRequest.selected
    if (!camera || !selected) return

    positionCamera(camera, controlsRef.current, modelRef.current, viewRequest.view, selected)
  }, [focusRequest.selected, focusRequest.version, viewRequest.view])

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault up={[0, 0, 1]} fov={42} />
      <OrbitControls ref={controlsRef} makeDefault enablePan enableZoom enableRotate />
    </>
  )
}

function positionCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsImpl | null,
  model: LatticeModel,
  view: CameraViewRequest['view'],
  selected?: SelectedElement,
): void {
  const { bounds } = model
  const maxSpan = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2)
  const focus = focusForSelected(model, selected ?? null)
  const distance = focus
    ? Math.max(focus.radius * 7.5, model.config.spacing * 12, maxSpan * 0.22)
    : maxSpan * 1.75
  const target = focus ? focus.center : new THREE.Vector3(...bounds.center)
  const position =
    view === 'top'
      ? new THREE.Vector3(target.x, target.y, target.z + distance)
      : view === 'side'
        ? new THREE.Vector3(target.x, target.y - distance, target.z)
        : new THREE.Vector3(target.x + distance * 0.95, target.y - distance * 0.9, target.z + distance * 0.55)

  camera.position.copy(position)
  if (view === 'top') {
    camera.up.set(0, 1, 0)
  } else {
    camera.up.set(0, 0, 1)
  }
  camera.lookAt(target)

  camera.fov = focus ? 32 : view === 'side' ? 34 : 42
  camera.near = 0.01
  camera.far = Math.max(distance * 8, 100)
  camera.updateProjectionMatrix()

  controls?.target.copy(target)
  controls?.update()
}

function SceneColorBar({ model }: { model: LatticeModel }) {
  const legend = legendForMode(model)
  const mid = legend.min + (legend.max - legend.min) * 0.5

  return (
    <div className="scene-colorbar" aria-label={`${legend.label} colorbar`}>
      <div className="scene-colorbar-label">{legend.label}</div>
      <div className="scene-colorbar-body">
        <div className="scene-colorbar-ramp" style={{ background: legend.gradient }} />
        <div className="scene-colorbar-ticks">
          <span>{formatLegendValue(legend.max)}</span>
          <span>{formatLegendValue(mid)}</span>
          <span>{formatLegendValue(legend.min)}</span>
        </div>
      </div>
    </div>
  )
}

function formatLegendValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < 1) return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function focusForSelected(
  model: LatticeModel,
  selected: SelectedElement,
): { center: THREE.Vector3; radius: number } | null {
  if (!selected) return null

  const nodeById = new Map(model.nodes.map((node) => [node.id, node]))
  let positions: Vec3[]

  if (selected.kind === 'node') {
    const node = nodeById.get(selected.id)
    positions = node ? [node.currentPosition] : []
  } else if (selected.kind === 'edge') {
    const edge = model.edges.find((candidate) => candidate.id === selected.id)
    const nodeA = edge ? nodeById.get(edge.nodeA) : undefined
    const nodeB = edge ? nodeById.get(edge.nodeB) : undefined
    positions = nodeA && nodeB ? [nodeA.currentPosition, nodeB.currentPosition] : []
  } else if (selected.kind === 'quad') {
    const quad = model.quads.find((candidate) => candidate.id === selected.id)
    positions = quad ? quad.nodeIds.map((id) => nodeById.get(id)?.currentPosition).filter(Boolean) as Vec3[] : []
  } else {
    const pair = model.dihedralPairs.find((candidate) => candidate.id === selected.id)
    const quads = pair
      ? [model.quads.find((quad) => quad.id === pair.quadA), model.quads.find((quad) => quad.id === pair.quadB)]
      : []
    positions = quads
      .filter(Boolean)
      .flatMap((quad) => (quad as LatticeQuad).nodeIds)
      .map((id) => nodeById.get(id)?.currentPosition)
      .filter(Boolean) as Vec3[]
  }

  if (!positions.length) return null

  const center = positions
    .map((position) => new THREE.Vector3(...position))
    .reduce((sum, position) => sum.add(position), new THREE.Vector3())
    .multiplyScalar(1 / positions.length)
  const radius = Math.max(
    ...positions.map((position) => new THREE.Vector3(...position).distanceTo(center)),
    model.config.spacing * 1.25,
  )

  return { center, radius }
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
