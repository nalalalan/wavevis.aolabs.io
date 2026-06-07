import { Billboard, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type {
  CameraFocusRequest,
  CameraViewRequest,
  DihedralMetric,
  LatticeBounds,
  LatticeModel,
  LatticeNode,
  LatticeQuad,
  QuadMetric,
  SelectedElement,
  Vec3,
} from './inverseSheetTypes'
import { colorForQuad, legendForMode } from './metricVisuals'
import {
  buildRigidCellMechanism,
  rigidCellBodyThickness,
  type CellArmDirection,
  type RigidCellMechanism,
} from './rigidCellMechanism'

const inverseLinkageColor = '#111111'
const inverseCellBodyColor = '#2f3130'
const inverseConnectorColor = '#111111'

type LatticeViewer3DProps = {
  model: LatticeModel
  selected: SelectedElement
  pickedEdges: string[]
  viewRequest: CameraViewRequest
  focusRequest: CameraFocusRequest
  onEdgePick: (edgeId: string) => void
}

export default function LatticeViewer3D({ model, selected, pickedEdges, viewRequest, focusRequest, onEdgePick }: LatticeViewer3DProps) {
  void pickedEdges

  return (
    <section className="scene-shell inverse-scene" aria-label="Inverse Sheet 3D lattice view">
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#f7f3ed']} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[8, -8, 10]} intensity={1.1} />
        <directionalLight position={[-5, 7, 5]} intensity={0.42} />
        <Suspense fallback={null}>
          <LatticeModelGroup model={model} selected={selected} view={viewRequest.view} onEdgePick={onEdgePick} />
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
  view,
  onEdgePick,
}: {
  model: LatticeModel
  selected: SelectedElement
  view: CameraViewRequest['view']
  onEdgePick: (edgeId: string) => void
}) {
  const nodeById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes])
  const quadMetricById = useMemo(() => new Map(model.quadMetrics.map((metric) => [metric.quadId, metric])), [model.quadMetrics])
  const dihedralByQuad = useMemo(() => buildDihedralByQuad(model.dihedralMetrics), [model.dihedralMetrics])
  const mechanism = useMemo(() => buildRigidCellMechanism(model), [model])
  const restGhostGeometry = useMemo(() => buildRestGhostGeometry(model, nodeById), [model, nodeById])
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(model, nodeById, quadMetricById, dihedralByQuad), [model, nodeById, quadMetricById, dihedralByQuad])
  const labelsVisible = model.config.showLabels && model.config.rows <= 15 && model.config.columns <= 15
  const largeGrid = model.config.rows > 30 || model.config.columns > 30
  const sideProfileView = view === 'side'
  const edgePickRadius = Math.max(model.config.spacing * (largeGrid ? 0.08 : 0.09), 0.035)
  const connectorSize = Math.max(model.config.spacing * (largeGrid ? 0.052 : 0.12), 0.026)
  const surfaceOpacity = sideProfileView ? 0.34 : (largeGrid ? 0.3 : 0.42)

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
      {model.config.showNodes && <RigidCellGlyphs model={model} mechanism={mechanism} />}
      {model.config.showEdges && (
        <>
          <EdgeHitTargets
            model={model}
            mechanism={mechanism}
            nodes={nodeById}
            radius={edgePickRadius}
            onEdgePick={onEdgePick}
          />
          <ConnectorInstances model={model} mechanism={mechanism} radius={connectorSize} />
        </>
      )}
      {sideProfileView && !model.config.showNodes && !model.config.showEdges && <SideProfileSilhouette model={model} />}
      {labelsVisible && <NodeLabels nodes={model.nodes} />}
      <SelectedHighlight selected={selected} model={model} nodeById={nodeById} mechanism={mechanism} />
    </group>
  )
}

function SideProfileSilhouette({ model }: { model: LatticeModel }) {
  const profile = useMemo(() => {
    if (model.summary.maxHeight <= model.config.spacing * 0.2) return null

    const lowerRow = Math.floor((model.config.rows - 1) / 2)
    const upperRow = Math.ceil((model.config.rows - 1) / 2)
    const frontY = model.bounds.min[1] - model.config.spacing * 0.16
    const rawPoints: Vec3[] = []
    const activeFlags: boolean[] = []

    for (let col = 0; col < model.config.columns; col += 1) {
      const lowerA = model.nodes.find((node) => node.row === lowerRow && node.col === col)
      const upperA = model.nodes.find((node) => node.row === upperRow && node.col === col)
      if (!lowerA || !upperA) continue

      const point: Vec3 = [
        (lowerA.currentPosition[0] + upperA.currentPosition[0]) * 0.5,
        frontY,
        (lowerA.currentPosition[2] + upperA.currentPosition[2]) * 0.5 + model.config.spacing * 0.12,
      ]
      const displacement = Math.max(
        Math.hypot(
          lowerA.currentPosition[0] - lowerA.restPosition[0],
          lowerA.currentPosition[1] - lowerA.restPosition[1],
          lowerA.currentPosition[2] - lowerA.restPosition[2],
        ),
        Math.hypot(
          upperA.currentPosition[0] - upperA.restPosition[0],
          upperA.currentPosition[1] - upperA.restPosition[1],
          upperA.currentPosition[2] - upperA.restPosition[2],
        ),
      )

      rawPoints.push(point)
      activeFlags.push(point[2] > model.summary.maxHeight * 0.055 || displacement > model.config.spacing * 1.6)
    }

    const firstActive = activeFlags.findIndex(Boolean)
    const lastActive = activeFlags.length - 1 - [...activeFlags].reverse().findIndex(Boolean)
    if (firstActive < 0 || lastActive <= firstActive) return null

    const start = Math.max(0, firstActive - 1)
    const end = Math.min(rawPoints.length - 1, lastActive + 1)
    const points = rawPoints.slice(start, end + 1).map((point) => new THREE.Vector3(...point))
    if (points.length < 2) return null

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.35)
    const coreRadius = Math.max(model.config.spacing * (model.config.rows > 30 || model.config.columns > 30 ? 0.032 : 0.045), 0.022)
    const haloRadius = coreRadius * 1.75

    return {
      core: new THREE.TubeGeometry(curve, Math.max(points.length * 12, 64), coreRadius, 10, false),
      halo: new THREE.TubeGeometry(curve, Math.max(points.length * 12, 64), haloRadius, 10, false),
    }
  }, [model])

  if (!profile) return null

  return (
    <group>
      <mesh geometry={profile.halo} renderOrder={19}>
        <meshBasicMaterial color="#fff8ee" transparent opacity={0.62} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh geometry={profile.core} renderOrder={20}>
        <meshBasicMaterial color="#141713" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function RigidCellGlyphs({
  model,
  mechanism,
}: {
  model: LatticeModel
  mechanism: RigidCellMechanism
}) {
  const armRef = useRef<THREE.InstancedMesh>(null)
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const bodyGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const armGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, model.config.rows > 30 || model.config.columns > 30 ? 7 : 10), [model.config.columns, model.config.rows])
  const rodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: inverseLinkageColor, roughness: 0.62, metalness: 0.04 }), [])
  const bodyMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: inverseCellBodyColor, roughness: 0.7, metalness: 0.04 }), [])

  useLayoutEffect(() => {
    const armMesh = armRef.current
    const bodyMesh = bodyRef.current
    if (!armMesh || !bodyMesh) return

    const largeGrid = model.config.rows > 30 || model.config.columns > 30
    const rodWidth = Math.max(model.config.spacing * (largeGrid ? 0.016 : 0.048), 0.01)
    const bodySize = model.config.spacing * (largeGrid ? 0.18 : 0.34)
    const bodyThickness = rigidCellBodyThickness(model.config.spacing)
    const matrix = new THREE.Matrix4()
    const dummy = new THREE.Object3D()
    let armIndex = 0

    mechanism.frames.forEach((frame, index) => {
      const center = toThree(frame.center)
      const directions: CellArmDirection[] = ['east', 'west', 'north', 'south']

      setBoxInstance(matrix, bodyMesh, index, center, toThree(frame.xAxis), toThree(frame.yAxis), toThree(frame.zAxis), bodySize, bodySize, bodyThickness)
      directions.forEach((direction) => {
        const connectedEndpoint = frame.armEndpoints[direction]
        setCylinderInstance(dummy, armMesh, armIndex, center, connectedEndpoint ? toThree(connectedEndpoint) : center, rodWidth)
        armIndex += 1
      })
    })

    armMesh.instanceMatrix.needsUpdate = true
    bodyMesh.instanceMatrix.needsUpdate = true
  }, [mechanism, model])

  return (
    <>
      <instancedMesh ref={armRef} args={[armGeometry, rodMaterial, model.nodes.length * 4]} />
      <instancedMesh ref={bodyRef} args={[bodyGeometry, bodyMaterial, model.nodes.length]} />
    </>
  )
}

function ConnectorInstances({
  model,
  mechanism,
  radius,
}: {
  model: LatticeModel
  mechanism: RigidCellMechanism
  radius: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, model.config.rows > 30 || model.config.columns > 30 ? 8 : 14, 8), [model.config.columns, model.config.rows])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: inverseConnectorColor, emissive: inverseConnectorColor, emissiveIntensity: 0.08, roughness: 0.45, metalness: 0.03 }), [])

  useLayoutEffect(() => {
    if (!ref.current) return

    const dummy = new THREE.Object3D()
    model.edges.forEach((edge, index) => {
      dummy.position.copy(toThree(mechanism.connectorByEdgeId.get(edge.id) ?? [0, 0, 0]))
      dummy.scale.setScalar(radius)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [mechanism, model.edges, radius])

  return <instancedMesh ref={ref} args={[geometry, material, model.edges.length]} />
}

function EdgeHitTargets({
  model,
  mechanism,
  nodes,
  radius,
  onEdgePick,
}: {
  model: LatticeModel
  mechanism: RigidCellMechanism
  nodes: Map<string, LatticeNode>
  radius: number
  onEdgePick: (edgeId: string) => void
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, model.config.rows > 30 || model.config.columns > 30 ? 7 : 10), [model.config.columns, model.config.rows])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }), [])

  useLayoutEffect(() => {
    if (!ref.current) return

    const dummy = new THREE.Object3D()
    const yAxis = new THREE.Vector3(0, 1, 0)
    model.edges.forEach((edge, index) => {
      const nodeA = nodes.get(edge.nodeA)
      const nodeB = nodes.get(edge.nodeB)
      const frameA = mechanism.frameByNodeId.get(edge.nodeA)
      const frameB = mechanism.frameByNodeId.get(edge.nodeB)
      const start = new THREE.Vector3(...(frameA?.center ?? nodeA?.currentPosition ?? ([0, 0, 0] as Vec3)))
      const end = new THREE.Vector3(...(frameB?.center ?? nodeB?.currentPosition ?? ([0, 0, 0] as Vec3)))
      const direction = new THREE.Vector3().subVectors(end, start)
      const length = Math.max(direction.length(), 0.000001)

      dummy.position.addVectors(start, end).multiplyScalar(0.5)
      dummy.quaternion.setFromUnitVectors(yAxis, direction.normalize())
      dummy.scale.set(radius, length, radius)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [mechanism, model, nodes, radius])

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
  mechanism,
}: {
  selected: SelectedElement
  model: LatticeModel
  nodeById: Map<string, LatticeNode>
  mechanism: RigidCellMechanism
}) {
  if (!selected) return null

  if (selected.kind === 'edge') {
    const edge = model.edges.find((candidate) => candidate.id === selected.id)
    const nodeA = edge ? nodeById.get(edge.nodeA) : undefined
    const nodeB = edge ? nodeById.get(edge.nodeB) : undefined
    if (!edge || !nodeA || !nodeB) return null
    const frameA = mechanism.frameByNodeId.get(nodeA.id)
    const frameB = mechanism.frameByNodeId.get(nodeB.id)
    const endpoints = mechanism.endpointsByEdgeId.get(edge.id)
    if (!frameA || !frameB || !endpoints) return null

    return (
      <>
        <TubeSegment start={frameA.center} end={endpoints.endpointA} radius={0.04} color="#f5d84b" />
        <TubeSegment start={frameB.center} end={endpoints.endpointB} radius={0.04} color="#f5d84b" />
      </>
    )
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
  const bounds = !selected && view === 'side' ? activeSideProfileBounds(model) : model.bounds
  const maxSpan = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2)
  const focus = focusForSelected(model, selected ?? null)
  const fov = focus ? 32 : view === 'side' ? 34 : 42
  const distance = focus
    ? Math.max(focus.radius * 7.5, model.config.spacing * 12, maxSpan * 0.22)
    : cameraDistanceForView(bounds, view, fov, camera.aspect)
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

  camera.fov = fov
  camera.near = 0.01
  camera.far = Math.max(distance * 8, 100)
  camera.updateProjectionMatrix()

  controls?.target.copy(target)
  controls?.update()
}

function activeSideProfileBounds(model: LatticeModel): LatticeBounds {
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const activeNodes = model.nodes.filter((node) => {
    const displacement = Math.hypot(
      node.currentPosition[0] - node.restPosition[0],
      node.currentPosition[1] - node.restPosition[1],
      node.currentPosition[2] - node.restPosition[2],
    )

    return node.currentPosition[2] > maxHeight * 0.06 ||
      displacement > Math.max(model.config.spacing * 2.4, model.summary.overhangAmount * 0.42)
  })

  if (activeNodes.length < 2) return model.bounds

  const minX = Math.min(...activeNodes.map((node) => node.currentPosition[0]))
  const maxX = Math.max(...activeNodes.map((node) => node.currentPosition[0]))
  const minZ = Math.min(...activeNodes.map((node) => node.currentPosition[2]), 0)
  const maxZ = Math.max(...activeNodes.map((node) => node.currentPosition[2]))
  const padX = Math.max(model.config.spacing * 3.4, (maxX - minX) * 0.18)
  const padZ = Math.max(model.config.spacing * 1.4, (maxZ - minZ) * 0.34)
  const min: Vec3 = [minX - padX, model.bounds.min[1], Math.min(0, minZ - padZ * 0.34)]
  const max: Vec3 = [maxX + padX, model.bounds.max[1], maxZ + padZ]
  const center: Vec3 = [
    (min[0] + max[0]) * 0.5,
    model.bounds.center[1],
    (min[2] + max[2]) * 0.5,
  ]

  return {
    min,
    max,
    center,
    span: [max[0] - min[0], model.bounds.span[1], max[2] - min[2]],
  }
}

function cameraDistanceForView(
  bounds: LatticeBounds,
  view: CameraViewRequest['view'],
  fovDeg: number,
  aspect: number,
): number {
  const safeAspect = Math.max(aspect || 1, 0.2)
  const fov = THREE.MathUtils.degToRad(fovDeg)
  const tanHalfFov = Math.tan(fov / 2)

  if (view === 'side') {
    return fitPerspectiveDistance(bounds.span[0], bounds.span[2], tanHalfFov, safeAspect, 1.34)
  }

  if (view === 'top') {
    return fitPerspectiveDistance(bounds.span[0], bounds.span[1], tanHalfFov, safeAspect, 1.18)
  }

  return Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2) * 1.75
}

function fitPerspectiveDistance(
  horizontalSpan: number,
  verticalSpan: number,
  tanHalfFov: number,
  aspect: number,
  padding: number,
): number {
  const horizontalDistance = horizontalSpan / Math.max(2 * tanHalfFov * aspect, 0.000001)
  const verticalDistance = verticalSpan / Math.max(2 * tanHalfFov, 0.000001)

  return Math.max(horizontalDistance, verticalDistance, 2) * padding
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

function setBoxInstance(
  matrix: THREE.Matrix4,
  mesh: THREE.InstancedMesh,
  index: number,
  center: THREE.Vector3,
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  zAxis: THREE.Vector3,
  width: number,
  height: number,
  depth: number,
): void {
  matrix.makeBasis(
    xAxis.clone().multiplyScalar(width),
    yAxis.clone().multiplyScalar(height),
    zAxis.clone().multiplyScalar(depth),
  )
  matrix.setPosition(center)
  mesh.setMatrixAt(index, matrix)
}

function setCylinderInstance(
  dummy: THREE.Object3D,
  mesh: THREE.InstancedMesh,
  index: number,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
): void {
  const direction = new THREE.Vector3().subVectors(end, start)
  const length = direction.length()

  if (length <= 0.0001) {
    dummy.position.copy(start)
    dummy.scale.setScalar(0.000001)
  } else {
    dummy.position.addVectors(start, end).multiplyScalar(0.5)
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    dummy.scale.set(radius, length, radius)
  }

  dummy.updateMatrix()
  mesh.setMatrixAt(index, dummy.matrix)
}

function toThree(vector: Vec3): THREE.Vector3 {
  return new THREE.Vector3(...vector)
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
