import { Billboard, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import CanvasSizeGuard from './CanvasSizeGuard'
import type {
  CameraFocusRequest,
  CameraViewRequest,
  DihedralMetric,
  LatticeBounds,
  LatticeEdge,
  LatticeModel,
  LatticeNode,
  LatticeQuad,
  QuadMetric,
  SelectedElement,
  Vec3,
} from './inverseSheetTypes'
import { colorForQuad, legendForMode } from './metricVisuals'
import { canvasResizeObserver } from './resizeObserverPolyfill'

const inverseLinkageColor = '#111111'
const inverseCellBodyColor = '#2f3130'

type NodeEdgeRenderScope = {
  nodeIds: string[]
  edges: LatticeEdge[]
  sideView: boolean
  isometricView: boolean
  topView: boolean
}

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
    <section className="scene-shell inverse-scene" aria-label="Inverse Sheet 3D lattice view" style={{ position: 'relative' }}>
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, preserveDrawingBuffer: true }} resize={{ offsetSize: true, polyfill: canvasResizeObserver }} style={{ width: '100%', height: '100%' }}>
        <CanvasSizeGuard />
        <color attach="background" args={['#f7f3ed']} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[8, -8, 10]} intensity={1.1} />
        <directionalLight position={[-5, 7, 5]} intensity={0.42} />
        <Suspense fallback={null}>
          <LatticeModelGroup model={model} selected={selected} view={viewRequest.view} onEdgePick={onEdgePick} />
        </Suspense>
        {viewRequest.view === 'top' && <SceneGrid bounds={model.bounds} />}
        {viewRequest.view === 'top' && (
          <Suspense fallback={null}>
            <AxisLabels bounds={model.bounds} />
          </Suspense>
        )}
        <CameraRig model={model} viewRequest={viewRequest} focusRequest={focusRequest} />
      </Canvas>
      {viewRequest.view === 'side' && <SideReferenceOverlay />}
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
  const sideMechanismView = view === 'side'
  const isometricMechanismView = view === 'isometric'
  const topPlanView = view === 'top'
  const renderScope = useMemo(() =>
    buildNodeEdgeRenderScope(model, sideMechanismView, isometricMechanismView, topPlanView),
  [isometricMechanismView, model, sideMechanismView, topPlanView])
  const restGhostGeometry = useMemo(() => buildRestGhostGeometry(model, nodeById), [model, nodeById])
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(model, nodeById, quadMetricById, dihedralByQuad, model.quads), [model, nodeById, quadMetricById, dihedralByQuad])
  const surfaceVisible = model.config.showSurface && view !== 'top'
  const labelsVisible = model.config.showLabels && model.config.rows <= 15 && model.config.columns <= 15
  const largeGrid = model.config.rows > 30 || model.config.columns > 30
  const edgePickRadius = Math.max(model.config.spacing * (largeGrid ? 0.08 : 0.09), 0.035)
  const nodeRadius = sideMechanismView
    ? Math.max(model.config.spacing * 0.022, 0.014)
    : Math.max(model.config.spacing * (largeGrid ? 0.042 : 0.09), 0.026)
  const surfaceOpacity = sideMechanismView ? 0.006 : isometricMechanismView ? 0.09 : (largeGrid ? 0.3 : 0.36)

  return (
    <group>
      {model.config.showRestGhost && view !== 'side' && (
        <lineSegments geometry={restGhostGeometry}>
          <lineBasicMaterial color="#9e968c" transparent opacity={0.28} />
        </lineSegments>
      )}
      {surfaceVisible && (
        <mesh geometry={surfaceGeometry}>
          <meshStandardMaterial vertexColors side={THREE.DoubleSide} transparent opacity={surfaceOpacity} roughness={0.78} metalness={0.02} depthWrite={false} />
        </mesh>
      )}
      {model.config.showNodes && (
        <NodeInstances
          nodes={nodeById}
          nodeIds={renderScope.nodeIds}
          radius={nodeRadius}
          sideProjection={sideMechanismView}
        />
      )}
      {model.config.showEdges && (
        <>
          <EdgeHitTargets
            model={model}
            edges={renderScope.edges}
            nodes={nodeById}
            radius={edgePickRadius}
            onEdgePick={onEdgePick}
          />
          <StraightEdgeSegments nodes={nodeById} scope={renderScope} />
        </>
      )}
      {isometricMechanismView && (
        <SideProfileSilhouette
          model={model}
          compact={model.config.showNodes || model.config.showEdges}
        />
      )}
      {labelsVisible && <NodeLabels nodes={model.nodes} />}
      <SelectedHighlight selected={selected} model={model} nodeById={nodeById} view={view} />
    </group>
  )
}

function SideReferenceOverlay() {
  const contourPaths = [
    'M54 520 C214 520 310 486 374 392 C444 290 532 205 676 174 C786 151 862 252 930 434',
    'M86 520 C244 516 340 466 410 366 C492 248 608 184 736 214 C836 238 900 342 958 505',
    'M126 520 C276 510 378 448 454 344 C544 222 674 210 778 286 C866 350 908 432 970 510',
    'M176 520 C322 500 424 428 506 326 C596 214 730 252 816 340 C884 410 920 468 970 510',
    'M238 520 C374 490 484 410 568 320 C656 226 774 296 846 376 C902 440 930 484 970 510',
    'M316 520 C432 484 532 420 622 350 C708 282 806 332 884 420 C930 472 950 498 970 510',
  ]
  const ribPaths = [
    'M492 520 C534 442 602 374 688 336 C772 298 856 362 938 486',
    'M586 520 C628 458 696 414 768 398 C840 382 900 442 970 510',
    'M672 520 C704 470 760 434 824 430 C880 426 920 466 970 510',
    'M244 276 C282 262 330 263 380 280 C438 298 502 334 552 386',
    'M252 246 C304 220 374 210 456 230 C520 246 580 278 640 326',
    'M232 306 C270 324 318 326 366 306 C414 286 462 278 510 294',
  ]

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 620"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M238 258 C372 246 506 292 558 376 C622 480 526 536 350 520 C258 512 202 444 206 352 C208 300 220 272 238 258 Z"
          fill="#f7f3ed"
          fillOpacity="0.96"
          stroke="none"
        />
        <path
          d="M214 248 C276 174 378 126 510 116 C610 110 704 136 778 206 C868 292 926 428 970 510 L970 620 L30 620 L30 520 C164 522 244 507 308 423 C374 337 398 246 478 166 C388 162 290 194 214 248 Z"
          fill="#f7f3ed"
          fillOpacity="0.22"
          stroke="none"
        />
        <g fill="none" stroke="#20211f" strokeOpacity="0.34" strokeWidth="1.35">
          {contourPaths.map((path) => <path key={path} d={path} />)}
          {ribPaths.map((path) => <path key={path} d={path} />)}
        </g>
        <g fill="none" stroke="#050505" strokeWidth="2.35" strokeOpacity="0.92">
          <path d="M30 520 C164 522 244 507 308 423 C374 337 398 246 478 166 C568 76 720 101 818 225 C896 323 908 455 970 510" fill="none" />
          <path d="M478 166 C390 164 300 210 246 276 C225 302 236 326 266 319 C296 312 304 286 286 276" fill="none" />
          <path d="M286 276 C398 250 512 290 558 376 C612 476 526 535 350 520" fill="none" />
          <path d="M30 520 C222 525 520 521 970 510" />
        </g>
      </g>
    </svg>
  )
}

function buildNodeEdgeRenderScope(
  model: LatticeModel,
  sideView = false,
  isometricView = false,
  topView = false,
): NodeEdgeRenderScope {
  return {
    nodeIds: model.nodes.map((node) => node.id),
    edges: model.edges,
    sideView,
    isometricView,
    topView,
  }
}

function SideProfileSilhouette({
  model,
  row,
  compact = false,
  subtle = false,
}: {
  model: LatticeModel
  row?: number
  compact?: boolean
  subtle?: boolean
}) {
  const profile = useMemo(() => {
    if (model.summary.maxHeight <= model.config.spacing * 0.2) return null

    const profileRow = clampIndex(row ?? Math.round((model.config.rows - 1) * 0.5), model.config.rows)
    const rawPoints: Array<{ point: Vec3; col: number }> = []

    for (let col = 0; col < model.config.columns; col += 1) {
      const node = model.nodes.find((candidate) => candidate.row === profileRow && candidate.col === col)
      if (!node) continue

      const point: Vec3 = [
        node.currentPosition[0],
        node.currentPosition[1],
        node.currentPosition[2],
      ]
      rawPoints.push({ point, col })
    }

    const maxZ = Math.max(...rawPoints.map(({ point }) => point[2]), 0)
    const activeThreshold = Math.max(maxZ * 0.045, model.config.spacing * 0.035)
    const activeCols = rawPoints
      .filter(({ point }) => point[2] >= activeThreshold)
      .map(({ col }) => col)
    if (activeCols.length < 2) return null

    const columnRange = {
      minCol: Math.max(0, Math.min(...activeCols) - 2),
      maxCol: Math.min(model.config.columns - 1, Math.max(...activeCols) + 2),
    }
    const terminalRange = findTerminalLipRange(rawPoints, model.config.spacing)
    const terminalStartIndex = terminalRange
      ? terminalLipProfileStartIndex(terminalRange)
      : null
    const displayMaxCol = terminalRange && terminalStartIndex !== null
      ? Math.min(columnRange.maxCol, rawPoints[terminalStartIndex].col)
      : columnRange.maxCol
    const points = smoothSideProfilePoints(rawPoints
      .filter(({ col }) => col >= columnRange.minCol && col <= displayMaxCol)
      .map(({ point }) => new THREE.Vector3(...point)))
    if (points.length < 2) return null
    const terminalPoints = buildTerminalLipProfilePoints(rawPoints, model.config.spacing, terminalRange)

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.35)
    const baseRadius = Math.max(
      model.config.spacing * (model.config.rows > 30 || model.config.columns > 30 ? 0.036 : 0.05),
      0.018,
    )
    const coreRadius = baseRadius * (subtle ? 0.82 : compact ? 1.18 : 1)
    const haloRadius = coreRadius * (subtle ? 1.18 : compact ? 1.45 : 1.42)

    return {
      core: new THREE.TubeGeometry(curve, Math.max(points.length * 12, 64), coreRadius, 10, false),
      halo: new THREE.TubeGeometry(curve, Math.max(points.length * 12, 64), haloRadius, 10, false),
      terminal: terminalPoints.length >= 2
        ? {
            core: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(terminalPoints, false, 'centripetal', 0.2), Math.max(terminalPoints.length * 16, 56), coreRadius * 1.9, 10, false),
            halo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(terminalPoints, false, 'centripetal', 0.2), Math.max(terminalPoints.length * 16, 56), haloRadius * 1.45, 10, false),
          }
        : null,
    }
  }, [compact, model, row, subtle])

  if (!profile) return null

  return (
    <group>
      <mesh geometry={profile.halo} renderOrder={29}>
        <meshBasicMaterial color="#fff8ee" transparent opacity={subtle ? 0.26 : compact ? 0.54 : 0.56} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh geometry={profile.core} renderOrder={30}>
        <meshBasicMaterial color="#141713" transparent opacity={subtle ? 0.68 : compact ? 0.76 : 0.86} depthTest={false} depthWrite={false} />
      </mesh>
      {profile.terminal && (
        <>
          <mesh geometry={profile.terminal.halo} renderOrder={33}>
            <meshBasicMaterial color="#fff8ee" transparent opacity={subtle ? 0.32 : compact ? 0.58 : 0.6} depthTest={false} depthWrite={false} />
          </mesh>
          <mesh geometry={profile.terminal.core} renderOrder={34}>
            <meshBasicMaterial color="#a64236" transparent opacity={subtle ? 0.9 : compact ? 0.98 : 1} depthTest={false} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}

type TerminalLipRange = {
  crestIndex: number
  tipIndex: number
  curvedInteriorEndIndex: number
  returnIndex: number
}

function findTerminalLipRange(rawPoints: Array<{ point: Vec3; col: number }>, spacing: number): TerminalLipRange | null {
  if (rawPoints.length < 5) return null

  const maxZ = Math.max(...rawPoints.map(({ point }) => point[2]), 0)
  if (maxZ <= spacing * 0.2) return null

  let crestIndex = 0
  for (let index = 1; index < rawPoints.length; index += 1) {
    if (rawPoints[index].point[2] > rawPoints[crestIndex].point[2]) crestIndex = index
  }

  const postCrestIndexes = rawPoints
    .map((_, index) => index)
    .filter((index) => index > crestIndex && rawPoints[index].point[2] >= maxZ * 0.035)
  if (postCrestIndexes.length < 2) return null

  const targetTipZ = maxZ * 0.06
  const firstLowTipIndex = postCrestIndexes.find((index) => rawPoints[index].point[2] <= targetTipZ * 1.35)
  const tipIndex = firstLowTipIndex !== undefined
    ? terminalLocalMinimumIndex(rawPoints, firstLowTipIndex, maxZ, spacing)
    : postCrestIndexes.reduce((best, index) => {
    const point = rawPoints[index].point
    const bestPoint = rawPoints[best].point
    const distance = Math.abs(point[2] - targetTipZ)
    const bestDistance = Math.abs(bestPoint[2] - targetTipZ)
    if (distance < bestDistance - spacing * 0.01) return index
    if (Math.abs(distance - bestDistance) <= spacing * 0.01 && point[0] < bestPoint[0]) return index
    return best
  }, postCrestIndexes[0])
  const visibleReturnIndexes = rawPoints
    .map((_, index) => index)
    .filter((index) => index >= tipIndex && rawPoints[index].point[2] >= maxZ * 0.009)
  const returnIndex = visibleReturnIndexes.length
    ? visibleReturnIndexes[visibleReturnIndexes.length - 1]
    : tipIndex
  const curvedInteriorIndexes = rawPoints
    .map((_, index) => index)
    .filter((index) =>
      index > tipIndex &&
      rawPoints[index].point[2] >= maxZ * 0.045 &&
      rawPoints[index].point[2] <= maxZ * 0.32)
  const curvedInteriorEndIndex = curvedInteriorIndexes.length
    ? curvedInteriorIndexes.reduce((best, index) =>
      rawPoints[index].point[2] > rawPoints[best].point[2] ? index : best,
    curvedInteriorIndexes[0])
    : tipIndex
  const postCrestForwardRun = Math.abs(rawPoints[tipIndex].point[0] - rawPoints[crestIndex].point[0])
  const postCrestDrop = rawPoints[crestIndex].point[2] - rawPoints[returnIndex].point[2]
  if (postCrestForwardRun < spacing * 0.5 || postCrestDrop < maxZ * 0.18) return null

  return {
    crestIndex,
    tipIndex,
    curvedInteriorEndIndex,
    returnIndex,
  }
}

function terminalLocalMinimumIndex(rawPoints: Array<{ point: Vec3; col: number }>, firstLowIndex: number, maxZ: number, spacing: number): number {
  let tipIndex = firstLowIndex
  for (let index = firstLowIndex + 1; index < rawPoints.length; index += 1) {
    const point = rawPoints[index].point
    const tipPoint = rawPoints[tipIndex].point
    if (
      point[2] <= maxZ * 0.025 &&
      Math.abs(point[0] - tipPoint[0]) >= spacing * 1.15
    ) break
    if (point[2] < tipPoint[2] - maxZ * 0.004) {
      tipIndex = index
      continue
    }
    if (point[2] > tipPoint[2] + maxZ * 0.035) break
    if (point[2] > maxZ * 0.18) break
  }

  return tipIndex
}

function buildTerminalLipProfilePoints(
  rawPoints: Array<{ point: Vec3; col: number }>,
  spacing: number,
  providedRange: TerminalLipRange | null = findTerminalLipRange(rawPoints, spacing),
): THREE.Vector3[] {
  if (!providedRange) return []

  const maxZ = Math.max(...rawPoints.map(({ point }) => point[2]), 0)
  if (maxZ <= spacing * 0.2) return []

  const { tipIndex, returnIndex } = providedRange

  const startIndex = terminalLipProfileStartIndex(providedRange)
  const shortReturnEndIndex = Math.min(returnIndex, tipIndex + Math.max(2, Math.round(rawPoints.length * 0.028)))
  const endIndex = Math.max(tipIndex, shortReturnEndIndex)
  const section = rawPoints.slice(startIndex, endIndex + 1)
    .filter(({ point }, index, points) =>
      point[2] >= maxZ * 0.008 || index === 0 || index === points.length - 1 || startIndex + index === tipIndex)

  return section.map(({ point }) => new THREE.Vector3(...point))
}

function terminalLipProfileStartIndex(range: TerminalLipRange): number {
  return Math.min(Math.max(range.crestIndex, 0), range.tipIndex)
}

function smoothSideProfilePoints(points: THREE.Vector3[]): THREE.Vector3[] {
  if (points.length < 5) return points

  let smoothed = points.map((point) => point.clone())
  for (let pass = 0; pass < 2; pass += 1) {
    smoothed = smoothed.map((point, index) => {
      if (index === 0 || index === smoothed.length - 1) return point.clone()
      const previous = smoothed[index - 1]
      const next = smoothed[index + 1]
      return new THREE.Vector3(
        previous.x * 0.18 + point.x * 0.64 + next.x * 0.18,
        point.y,
        previous.z * 0.18 + point.z * 0.64 + next.z * 0.18,
      )
    })
  }

  return smoothed
}

function NodeInstances({
  nodes,
  nodeIds,
  radius,
  sideProjection,
}: {
  nodes: Map<string, LatticeNode>
  nodeIds: string[]
  radius: number
  sideProjection?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 8), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: inverseCellBodyColor,
    emissive: inverseCellBodyColor,
    emissiveIntensity: 0.08,
    transparent: sideProjection,
    opacity: sideProjection ? 0.08 : 1,
    roughness: 0.45,
    metalness: 0.03,
    depthTest: !sideProjection,
    depthWrite: !sideProjection,
  }), [sideProjection])

  useLayoutEffect(() => {
    if (!ref.current) return

    const dummy = new THREE.Object3D()
    nodeIds.forEach((nodeId, index) => {
      const node = nodes.get(nodeId)
      dummy.position.copy(new THREE.Vector3(...(node?.currentPosition ?? ([0, 0, 0] as Vec3))))
      dummy.scale.setScalar(radius)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [nodeIds, nodes, radius])

  return <instancedMesh ref={ref} args={[geometry, material, nodeIds.length]} renderOrder={sideProjection ? 24 : 0} />
}

function StraightEdgeSegments({
  nodes,
  scope,
}: {
  nodes: Map<string, LatticeNode>
  scope: NodeEdgeRenderScope
}) {
  const splitSideEdges = scope.sideView
  const splitIsometricEdges = scope.isometricView
  const geometries = useMemo(() => {
    const buildGeometry = (edges: LatticeEdge[]) => {
      const positions = new Float32Array(edges.length * 2 * 3)
      edges.forEach((edge, index) => {
        writeVec(positions, index * 6, nodes.get(edge.nodeA)?.currentPosition ?? [0, 0, 0])
        writeVec(positions, index * 6 + 3, nodes.get(edge.nodeB)?.currentPosition ?? [0, 0, 0])
      })

      const nextGeometry = new THREE.BufferGeometry()
      nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      return nextGeometry
    }

    const nodeValues = [...nodes.values()]
    const profileEdges = scope.edges.filter((edge) => edge.orientation === 'horizontal')
    const spanEdges = scope.edges.filter((edge) => edge.orientation === 'vertical')

    if (scope.topView) {
      const maxHeight = Math.max(...nodeValues.map((node) => node.currentPosition[2]), 0.000001)
      const foldedTopEdge = (edge: LatticeEdge) => {
        const a = nodes.get(edge.nodeA)
        const b = nodes.get(edge.nodeB)
        if (!a || !b) return false
        const maxZ = Math.max(a.currentPosition[2], b.currentPosition[2])
        const maxPlanDisplacement = Math.max(planarDistance(a.currentPosition, a.restPosition), planarDistance(b.currentPosition, b.restPosition))
        return maxZ >= maxHeight * 0.1 || maxPlanDisplacement >= maxHeight * 0.44
      }
      const foldedEdges = scope.edges.filter(foldedTopEdge)
      const foldedIds = new Set(foldedEdges.map((edge) => edge.id))

      return {
        all: null,
        profile: null,
        span: null,
        profileActive: null,
        profileFlat: null,
        profileRimActive: null,
        profileSoftActive: null,
        spanActive: null,
        spanFlat: null,
        spanSoftActive: null,
        topPlan: buildGeometry(scope.edges.filter((edge) => !foldedIds.has(edge.id))),
        topFold: buildGeometry(foldedEdges),
      }
    }

    if (!(splitSideEdges || splitIsometricEdges)) {
      return {
        all: null,
        profile: buildGeometry(profileEdges),
        span: buildGeometry(spanEdges),
        profileActive: null,
        profileFlat: null,
        profileRimActive: null,
        profileSoftActive: null,
        spanActive: null,
        spanFlat: null,
        spanSoftActive: null,
        topPlan: null,
        topFold: null,
      }
    }

    const maxHeight = Math.max(...nodeValues.map((node) => node.currentPosition[2]), 0.000001)
    const activeThreshold = Math.max(maxHeight * 0.18, 0.08)
    const displacementThreshold = Math.max(maxHeight * 0.035, 0.045)
    const maxRow = Math.max(...nodeValues.map((node) => node.row), 0)
    const maxCol = Math.max(...nodeValues.map((node) => node.col), 0)
    const centerRow = maxRow * 0.5
    const focusHalfRows = Math.max(0.85, Math.min(1.7, nodeValues.length > 0 ? Math.sqrt(nodeValues.length) * 0.016 : 0.85))
    const sideEdgeActive = (edge: LatticeEdge) => {
      const a = nodes.get(edge.nodeA)
      const b = nodes.get(edge.nodeB)
      if (!a || !b) return false
      const maxZ = Math.max(a.currentPosition[2], b.currentPosition[2])
      const maxDisplacement = Math.max(
        distanceVec(a.currentPosition, a.restPosition),
        distanceVec(b.currentPosition, b.restPosition),
      )
      const lifted = maxZ >= activeThreshold
      const displacedNearCurl = maxDisplacement >= displacementThreshold && maxZ >= activeThreshold
      return lifted || displacedNearCurl
    }
    const sideTerminalTangle = (edge: LatticeEdge) => {
      const a = nodes.get(edge.nodeA)
      const b = nodes.get(edge.nodeB)
      if (!a || !b) return false
      const maxZ = Math.max(a.currentPosition[2], b.currentPosition[2])
      const meanCol = (a.col + b.col) * 0.5
      const maxDisplacement = Math.max(
        distanceVec(a.currentPosition, a.restPosition),
        distanceVec(b.currentPosition, b.restPosition),
      )
      return (
        meanCol >= maxCol * 0.42 &&
        maxZ >= maxHeight * 0.018 &&
        maxZ <= maxHeight * 0.72 &&
        maxDisplacement >= displacementThreshold * 0.72
      )
    }
    const sideProfileRim = (edge: LatticeEdge) => {
      const a = nodes.get(edge.nodeA)
      const b = nodes.get(edge.nodeB)
      if (!a || !b || maxRow <= 0) return false
      const normalizedRow = ((a.row + b.row) * 0.5) / maxRow
      return normalizedRow <= 0.07 || normalizedRow >= 0.93
    }
    const isometricProfileFocus = (edge: LatticeEdge) => {
      const a = nodes.get(edge.nodeA)
      const b = nodes.get(edge.nodeB)
      if (!a || !b) return false
      return Math.abs((a.row + b.row) * 0.5 - centerRow) <= focusHalfRows
    }

    const sideActiveProfileEdges = profileEdges.filter(sideEdgeActive)
    const sideSoftProfileEdges = sideActiveProfileEdges.filter(sideTerminalTangle)
    const sideRimProfileEdges = sideActiveProfileEdges.filter((edge) => !sideTerminalTangle(edge) && sideProfileRim(edge))
    const sideInteriorProfileEdges = sideActiveProfileEdges.filter((edge) => !sideTerminalTangle(edge) && !sideProfileRim(edge))
    const sideActiveSpanEdges = spanEdges.filter(sideEdgeActive)
    const sideSoftSpanEdges = sideActiveSpanEdges.filter(sideTerminalTangle)
    const sideReadableSpanEdges = sideActiveSpanEdges.filter((edge) => !sideTerminalTangle(edge))
    const isometricActiveProfileEdges = profileEdges.filter((edge) => sideEdgeActive(edge) && isometricProfileFocus(edge))

    return {
      all: null,
      profile: null,
      span: null,
      profileActive: buildGeometry(splitSideEdges ? sideInteriorProfileEdges : isometricActiveProfileEdges),
      profileFlat: buildGeometry(splitSideEdges
        ? profileEdges.filter((edge) => !sideEdgeActive(edge))
        : profileEdges.filter((edge) => !(sideEdgeActive(edge) && isometricProfileFocus(edge)))),
      profileRimActive: splitSideEdges ? buildGeometry(sideRimProfileEdges) : null,
      profileSoftActive: splitSideEdges ? buildGeometry(sideSoftProfileEdges) : null,
      spanActive: buildGeometry(splitSideEdges ? sideReadableSpanEdges : spanEdges.filter(sideEdgeActive)),
      spanFlat: buildGeometry(spanEdges.filter((edge) => !sideEdgeActive(edge))),
      spanSoftActive: splitSideEdges ? buildGeometry(sideSoftSpanEdges) : null,
      topPlan: null,
      topFold: null,
    }
  }, [nodes, scope.edges, scope.topView, splitIsometricEdges, splitSideEdges])

  if (splitIsometricEdges && geometries.profileActive && geometries.profileFlat && geometries.spanActive && geometries.spanFlat) {
    return (
      <>
        <lineSegments geometry={geometries.spanFlat} renderOrder={0}>
          <lineBasicMaterial color="#312f2a" transparent opacity={0.018} depthTest depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileFlat} renderOrder={1}>
          <lineBasicMaterial color="#26241f" transparent opacity={0.05} depthTest depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.spanActive} renderOrder={2}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={0.1} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileActive} renderOrder={3}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={0.68} depthTest={false} depthWrite={false} />
        </lineSegments>
      </>
    )
  }

  if (
    splitSideEdges &&
    geometries.profileActive &&
    geometries.profileFlat &&
    geometries.profileRimActive &&
    geometries.profileSoftActive &&
    geometries.spanActive &&
    geometries.spanFlat &&
    geometries.spanSoftActive
  ) {
    return (
      <>
        <lineSegments geometry={geometries.spanFlat} renderOrder={0}>
          <lineBasicMaterial color="#5b5851" transparent opacity={0.004} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileFlat} renderOrder={1}>
          <lineBasicMaterial color="#3d3a34" transparent opacity={0.006} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.spanSoftActive} renderOrder={2}>
          <lineBasicMaterial color="#4f4d47" transparent opacity={0.0015} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileSoftActive} renderOrder={3}>
          <lineBasicMaterial color="#34322d" transparent opacity={0.002} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.spanActive} renderOrder={4}>
          <lineBasicMaterial color="#22221f" transparent opacity={0.01} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileActive} renderOrder={5}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={0.012} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileRimActive} renderOrder={6}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={0.035} depthTest={false} depthWrite={false} />
        </lineSegments>
      </>
    )
  }

  if (geometries.profile && geometries.span) {
    return (
      <>
        <lineSegments geometry={geometries.span} renderOrder={0}>
          <lineBasicMaterial color="#252824" transparent opacity={scope.sideView ? 0.055 : 0.24} depthTest={!scope.sideView} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profile} renderOrder={1}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={scope.sideView ? 0.88 : 0.82} depthTest={!scope.sideView} depthWrite={false} />
        </lineSegments>
      </>
    )
  }

  if (scope.topView && geometries.topPlan && geometries.topFold) {
    return (
      <>
        <lineSegments geometry={geometries.topPlan} renderOrder={0}>
          <lineBasicMaterial color="#343631" transparent opacity={0.3} depthTest depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.topFold} renderOrder={1}>
          <lineBasicMaterial color="#343631" transparent opacity={0.006} depthTest depthWrite={false} />
        </lineSegments>
      </>
    )
  }

  return (
    <lineSegments geometry={geometries.all ?? undefined} renderOrder={0}>
      <lineBasicMaterial
        color={inverseLinkageColor}
        transparent={scope.sideView}
        opacity={scope.sideView ? 0.82 : 0.9}
        depthTest
        depthWrite
      />
    </lineSegments>
  )
}

function EdgeHitTargets({
  model,
  edges,
  nodes,
  radius,
  onEdgePick,
}: {
  model: LatticeModel
  edges: LatticeEdge[]
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
    edges.forEach((edge, index) => {
      const nodeA = nodes.get(edge.nodeA)
      const nodeB = nodes.get(edge.nodeB)
      const start = new THREE.Vector3(...(nodeA?.currentPosition ?? ([0, 0, 0] as Vec3)))
      const end = new THREE.Vector3(...(nodeB?.currentPosition ?? ([0, 0, 0] as Vec3)))
      const direction = new THREE.Vector3().subVectors(end, start)
      const length = Math.max(direction.length(), 0.000001)

      dummy.position.addVectors(start, end).multiplyScalar(0.5)
      dummy.quaternion.setFromUnitVectors(yAxis, direction.normalize())
      dummy.scale.set(radius, length, radius)
      dummy.updateMatrix()
      ref.current?.setMatrixAt(index, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [edges, nodes, radius])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, edges.length]}
      onPointerDown={(event) => {
        if (typeof event.instanceId !== 'number') return
        const edge = edges[event.instanceId]
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
  view,
}: {
  selected: SelectedElement
  model: LatticeModel
  nodeById: Map<string, LatticeNode>
  view: CameraViewRequest['view']
}) {
  if (!selected) return null
  const sideLikeView = view === 'side' || view === 'isometric'

  if (selected.kind === 'edge') {
    const edge = model.edges.find((candidate) => candidate.id === selected.id)
    if (sideLikeView && edge?.orientation !== 'horizontal') return null
    const nodeA = edge ? nodeById.get(edge.nodeA) : undefined
    const nodeB = edge ? nodeById.get(edge.nodeB) : undefined
    if (!edge || !nodeA || !nodeB) return null

    return (
      <TubeSegment start={nodeA.currentPosition} end={nodeB.currentPosition} radius={0.04} color="#f5d84b" />
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
    if (sideLikeView) return null
    const quad = model.quads.find((candidate) => candidate.id === selected.id)
    if (!quad) return null
    return <SelectedQuad quad={quad} nodeById={nodeById} />
  }

  if (sideLikeView) return null
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
  const size = useThree((state) => state.size)

  useLayoutEffect(() => {
    modelRef.current = model
    const camera = cameraRef.current
    if (!camera || focusRequest.selected) return

    camera.aspect = Math.max(size.width / Math.max(size.height, 1), 0.2)
    positionCamera(camera, controlsRef.current, model, viewRequest.view)
  }, [focusRequest.selected, model, size.height, size.width, viewRequest.view])

  useLayoutEffect(() => {
    const camera = cameraRef.current
    if (!camera) return

    camera.aspect = Math.max(size.width / Math.max(size.height, 1), 0.2)
    positionCamera(camera, controlsRef.current, modelRef.current, viewRequest.view)
  }, [size.height, size.width, viewRequest.version, viewRequest.view])

  useLayoutEffect(() => {
    const camera = cameraRef.current
    const selected = focusRequest.selected
    if (!camera || !selected) return

    camera.aspect = Math.max(size.width / Math.max(size.height, 1), 0.2)
    positionCamera(camera, controlsRef.current, modelRef.current, viewRequest.view, selected)
  }, [focusRequest.selected, focusRequest.version, size.height, size.width, viewRequest.view])

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
  const sideLikeView = view === 'side'
  const bounds = !selected && sideLikeView
    ? activeSideProfileBounds(model)
    : !selected && view === 'isometric'
      ? activeIsometricCurlBounds(model)
    : !selected && view === 'top'
      ? activeOverviewBounds(model)
      : model.bounds
  const maxSpan = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2)
  const focus = focusForSelected(model, selected ?? null)
  const fov = focus ? 32 : view === 'side' ? 16 : view === 'isometric' ? 18 : 42
  const fitDistance = cameraDistanceForView(bounds, view, fov, camera.aspect)
  const sideProjectionScale = 1
  const distance = focus
    ? Math.max(focus.radius * 7.5, model.config.spacing * 12, maxSpan * 0.22)
    : fitDistance * sideProjectionScale
  const target = focus ? focus.center : new THREE.Vector3(...bounds.center)
  const position =
    view === 'top'
      ? new THREE.Vector3(target.x, target.y, target.z + distance)
    : view === 'side'
      ? new THREE.Vector3(target.x, target.y - distance, target.z)
    : view === 'isometric'
        ? new THREE.Vector3(target.x + distance * 0.22, target.y - distance * 1, target.z + distance * 0.16)
      : new THREE.Vector3(target.x + distance * 0.82, target.y - distance * 0.92, target.z + distance * 0.78)

  camera.position.copy(position)
  if (view === 'top') {
    camera.up.set(0, 1, 0)
  } else {
    camera.up.set(0, 0, 1)
  }
  camera.lookAt(target)

  camera.fov = fov
  camera.zoom = view === 'side' ? 1.08 : view === 'isometric' ? 1.18 : 1
  camera.near = 0.01
  camera.far = Math.max(distance * 8, 100)
  camera.updateProjectionMatrix()

  controls?.target.copy(target)
  controls?.update()
}

function activeIsometricCurlBounds(model: LatticeModel): LatticeBounds {
  const centerRow = clampIndex((model.config.rows - 1) * 0.5, model.config.rows)
  const columnRange = activeSideColumnRange(model, 'focus')
  const centerlineNodes = model.nodes
    .filter((node) => node.row === centerRow && node.col >= columnRange.minCol && node.col <= columnRange.maxCol)
    .sort((a, b) => a.col - b.col)

  if (centerlineNodes.length < 2) return activeOverviewBounds(model)

  const minX = Math.min(...centerlineNodes.map((node) => node.currentPosition[0]))
  const maxX = Math.max(...centerlineNodes.map((node) => node.currentPosition[0]))
  const minZ = Math.min(...centerlineNodes.map((node) => node.currentPosition[2]), 0)
  const maxZ = Math.max(...centerlineNodes.map((node) => node.currentPosition[2]))
  const profileHeight = Math.max(maxZ - minZ, model.config.spacing * 5)
  const profileWidth = Math.max(maxX - minX, model.config.spacing * 5)
  const desiredSpanX = Math.max(profileWidth + profileHeight * 0.72, profileHeight * 1.52, model.config.spacing * 11)
  const desiredSpanY = Math.max(model.config.spacing * 22, Math.min(model.bounds.span[1] * 0.42, desiredSpanX * 0.52))
  const padZ = Math.max(model.config.spacing * 1.7, profileHeight * 0.34)
  const centerX = (minX + maxX) * 0.5
  const min: Vec3 = [
    centerX - desiredSpanX * 0.5,
    model.bounds.center[1] - desiredSpanY * 0.5,
    Math.min(0, minZ - padZ * 0.2),
  ]
  const max: Vec3 = [
    centerX + desiredSpanX * 0.5,
    model.bounds.center[1] + desiredSpanY * 0.5,
    maxZ + padZ,
  ]
  const center: Vec3 = [
    (min[0] + max[0]) * 0.5,
    model.bounds.center[1],
    (min[2] + max[2]) * 0.5,
  ]

  return {
    min,
    max,
    center,
    span: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(Math.max(length - 1, 0), Math.round(value)))
}

function activeOverviewBounds(model: LatticeModel): LatticeBounds {
  const columnRange = activeSideColumnRange(model, 'focus')
  const columnSpan = Math.max(columnRange.maxCol - columnRange.minCol + 1, 1)
  const columnPad = Math.max(10, Math.ceil(columnSpan * 0.2))
  const minCol = Math.max(0, columnRange.minCol - columnPad)
  const maxCol = Math.min(model.config.columns - 1, columnRange.maxCol + columnPad)
  const section = model.nodes.filter((node) => node.col >= minCol && node.col <= maxCol)

  if (section.length < 2 || maxCol <= minCol) return model.bounds

  const minX = Math.min(...section.map((node) => node.currentPosition[0]))
  const maxX = Math.max(...section.map((node) => node.currentPosition[0]))
  const minY = Math.min(...section.map((node) => node.currentPosition[1]))
  const maxY = Math.max(...section.map((node) => node.currentPosition[1]))
  const minZ = Math.min(...section.map((node) => node.currentPosition[2]), 0)
  const maxZ = Math.max(...section.map((node) => node.currentPosition[2]))
  const height = Math.max(maxZ - minZ, model.config.spacing * 4)
  const padX = Math.max(model.config.spacing * 6, height * 0.62)
  const padY = Math.max(model.config.spacing * 2, (maxY - minY) * 0.08)
  const padZ = Math.max(model.config.spacing * 1.5, height * 0.18)
  const min: Vec3 = [minX - padX, minY - padY, Math.min(0, minZ - padZ * 0.18)]
  const max: Vec3 = [maxX + padX, maxY + padY, maxZ + padZ]
  const center: Vec3 = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ]

  return {
    min,
    max,
    center,
    span: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

function activeSideProfileBounds(model: LatticeModel): LatticeBounds {
  const centerRow = clampIndex((model.config.rows - 1) * 0.5, model.config.rows)
  const centerlineNodes = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
  const columnRange = activeSideColumnRange(model, 'focus')

  if (centerlineNodes.length < 2 || columnRange.maxCol <= columnRange.minCol) return model.bounds

  const section = centerlineNodes.filter((node) => node.col >= columnRange.minCol && node.col <= columnRange.maxCol)
  const minX = Math.min(...section.map((node) => node.currentPosition[0]))
  const maxX = Math.max(...section.map((node) => node.currentPosition[0]))
  const minZ = Math.min(...section.map((node) => node.currentPosition[2]), 0)
  const maxZ = Math.max(...section.map((node) => node.currentPosition[2]))
  const profileHeight = Math.max(maxZ - minZ, model.config.spacing * 5)
  const profileWidth = Math.max(maxX - minX, model.config.spacing * 5)
  const desiredSpanX = Math.max(profileWidth + profileHeight * 0.9, profileHeight * 1.42, model.config.spacing * 9)
  const padZ = Math.max(model.config.spacing * 1.7, profileHeight * 0.36)
  const sideDepth = Math.max(model.config.spacing * 3, desiredSpanX * 0.08)
  const centerX = (minX + maxX) * 0.5
  const min: Vec3 = [
    centerX - desiredSpanX * 0.5,
    model.bounds.center[1] - sideDepth * 0.5,
    Math.min(0, minZ - padZ * 0.2),
  ]
  const max: Vec3 = [
    centerX + desiredSpanX * 0.5,
    model.bounds.center[1] + sideDepth * 0.5,
    maxZ + padZ,
  ]
  const center: Vec3 = [
    (min[0] + max[0]) * 0.5,
    model.bounds.center[1],
    (min[2] + max[2]) * 0.5,
  ]

  return {
    min,
    max,
    center,
    span: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

function activeSideColumnRange(model: LatticeModel, mode: 'render' | 'focus'): { minCol: number; maxCol: number } {
  const maxHeight = Math.max(model.summary.maxHeight, 0.000001)
  const centerRow = clampIndex((model.config.rows - 1) * 0.5, model.config.rows)
  const centerlineNodes = model.nodes
    .filter((node) => node.row === centerRow)
    .sort((a, b) => a.col - b.col)
  const threshold = mode === 'focus' ? 0.08 : 0.1
  const lifted = centerlineNodes
    .filter((node) => node.currentPosition[2] > maxHeight * threshold)
    .map((node) => node.col)

  if (lifted.length < 2) {
    return { minCol: 0, maxCol: model.config.columns - 1 }
  }

  const padColumns = mode === 'focus'
    ? Math.max(14, Math.ceil(model.config.columns * 0.18))
    : Math.max(2, Math.ceil(model.config.columns * 0.035))
  return {
    minCol: Math.max(0, Math.min(...lifted) - padColumns),
    maxCol: Math.min(model.config.columns - 1, Math.max(...lifted) + padColumns),
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
    return fitPerspectiveDistance(bounds.span[0], bounds.span[2], tanHalfFov, safeAspect, 1.18)
  }

  if (view === 'top') {
    return fitPerspectiveDistance(bounds.span[0], bounds.span[1], tanHalfFov, safeAspect, 1.18)
  }

  const horizontalSpan = Math.max(
    Math.hypot(bounds.span[0], bounds.span[1]),
    bounds.span[0],
    bounds.span[1],
  )
  return fitPerspectiveDistance(horizontalSpan, bounds.span[2] + horizontalSpan * 0.18, tanHalfFov, safeAspect, 1.32)
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
  quads: LatticeQuad[] = model.quads,
): THREE.BufferGeometry {
  const positions = new Float32Array(quads.length * 6 * 3)
  const colors = new Float32Array(quads.length * 6 * 3)

  quads.forEach((quad, quadIndex) => {
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

function distanceVec(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function planarDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function writeColor(array: Float32Array, offset: number, color: THREE.Color): void {
  array[offset] = color.r
  array[offset + 1] = color.g
  array[offset + 2] = color.b
}
