import { Billboard, OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
import { buildRigidCellMechanism } from './rigidCellMechanism'
import { buildConnectedXCellMechanism, type ConnectedXCellFrame } from './xCellMechanism'

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
  const referenceProjectionVisible = false
  const surfaceReferenceOnly = readableSurfaceReferenceOnly(model)

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
        {viewRequest.view === 'top' && !surfaceReferenceOnly && <SceneGrid bounds={model.bounds} />}
        {viewRequest.view === 'top' && !surfaceReferenceOnly && (
          <Suspense fallback={null}>
            <AxisLabels bounds={model.bounds} />
          </Suspense>
        )}
        <CameraRig model={model} viewRequest={viewRequest} focusRequest={focusRequest} />
      </Canvas>
      {referenceProjectionVisible && <ReferenceProjectionOverlay view={viewRequest.view as 'isometric' | 'side' | 'front'} />}
      {model.config.showHeatmap && <SceneColorBar model={model} />}
    </section>
  )
}

function ReferenceProjectionOverlay({ view }: { view: 'isometric' | 'side' | 'front' }) {
  const isoBaseGrid = [
    'M178 466 L520 566',
    'M260 430 L600 532',
    'M342 394 L680 496',
    'M424 358 L760 460',
    'M506 322 L840 424',
    'M178 466 L486 322',
    'M258 490 L566 346',
    'M338 514 L646 370',
    'M418 538 L726 394',
    'M498 562 L806 418',
  ]
  const isoWaveContours = [
    'M248 438 C290 330 382 238 524 210 C648 186 768 238 824 330 C858 386 824 446 744 454',
    'M292 452 C340 350 426 270 548 250 C662 232 758 278 800 354 C828 406 798 444 736 456',
    'M344 466 C398 374 476 312 576 300 C674 290 750 328 784 386 C804 424 782 450 730 460',
    'M404 482 C458 414 522 374 600 370 C678 366 734 396 768 438',
    'M482 500 C536 454 590 430 652 432 C708 434 744 450 768 466',
  ]
  const isoWaveRibs = [
    'M330 444 C378 340 452 246 544 210',
    'M418 472 C452 360 518 258 618 222',
    'M506 502 C526 388 584 292 704 262',
    'M594 522 C602 426 650 346 776 326',
    'M676 528 C684 454 718 404 806 396',
    'M748 286 C704 330 676 390 674 456',
    'M808 342 C760 372 720 420 704 474',
  ]
  const sideContourPaths = [
    'M95 500 C240 498 330 450 404 350 C492 232 604 180 718 220 C814 254 858 356 822 432',
    'M145 500 C282 492 374 430 448 330 C532 220 640 202 728 252 C800 292 832 360 806 422',
    'M205 500 C330 482 430 414 510 326 C596 232 688 248 756 306 C812 354 828 394 806 422',
    'M282 500 C394 474 492 420 578 350 C658 286 726 302 782 360 C814 392 820 410 806 422',
    'M374 500 C470 464 560 414 642 372 C714 335 764 365 806 422',
  ]
  const sideRibPaths = [
    'M330 500 C358 410 414 300 506 228',
    'M410 500 C438 408 508 282 626 208',
    'M500 500 C524 424 586 326 714 250',
    'M594 500 C614 438 666 366 786 330',
    'M692 500 C700 450 734 404 806 422',
    'M758 236 C708 282 674 338 664 408',
    'M810 294 C758 326 714 376 690 438',
  ]
  const frontContourPaths = [
    'M164 500 C196 374 284 272 410 230 C514 196 642 210 742 276 C830 334 876 420 900 500',
    'M230 500 C260 386 332 306 436 274 C532 246 638 258 720 318 C790 370 828 438 846 500',
    'M310 500 C336 410 394 350 474 326 C552 304 634 316 700 366 C754 408 784 456 798 500',
    'M404 500 C426 436 468 394 528 378 C588 362 652 374 706 418 C744 450 762 478 772 500',
  ]
  const frontRibPaths = [
    'M500 500 C492 430 492 336 510 226',
    'M410 500 C420 424 454 324 510 226',
    'M590 500 C578 424 552 324 510 226',
    'M314 500 C352 420 418 322 510 226',
    'M702 500 C668 420 600 322 510 226',
    'M210 500 C292 418 400 316 510 226',
    'M852 500 C760 418 620 316 510 226',
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
        background: '#f7f3ed',
      }}
    >
      {view === 'isometric' ? (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#d5d0c8" strokeWidth="1.05" strokeOpacity="0.72">
            <path d="M96 496 L500 612 L916 430 L492 292 Z" />
            {isoBaseGrid.map((path) => <path key={path} d={path} />)}
          </g>
          <g stroke="#c3beb6" strokeWidth="1.18" strokeOpacity="0.78">
            {isoWaveContours.map((path) => <path key={path} d={path} />)}
            {isoWaveRibs.map((path) => <path key={path} d={path} />)}
          </g>
          <g stroke="#746f67" strokeWidth="1.7" strokeOpacity="0.78">
            <path d="M220 454 C270 316 390 202 550 174 C686 150 818 218 872 332 C902 396 872 462 790 486 C736 502 676 484 654 438 C636 400 662 366 710 368 C754 370 782 396 784 430" />
            <path d="M784 430 C724 386 622 388 556 456 C506 506 402 528 250 492" />
          </g>
        </g>
      ) : view === 'side' ? (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#c8c2ba" strokeWidth="1.15" strokeOpacity="0.82">
            {sideContourPaths.map((path) => <path key={path} d={path} />)}
            {sideRibPaths.map((path) => <path key={path} d={path} />)}
          </g>
          <g stroke="#6f6a63" strokeWidth="1.75" strokeOpacity="0.84">
            <path d="M80 500 C224 502 330 462 408 352 C500 222 628 150 746 210 C844 260 870 368 826 430 C804 462 754 458 748 430 C742 404 772 394 798 402" />
            <path d="M798 402 C720 350 610 352 536 424 C470 488 358 502 80 500" />
            <path d="M80 500 C304 504 600 502 920 500" />
          </g>
        </g>
      ) : (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g stroke="#c8c2ba" strokeWidth="1.15" strokeOpacity="0.82">
            {frontContourPaths.map((path) => <path key={path} d={path} />)}
            {frontRibPaths.map((path) => <path key={path} d={path} />)}
          </g>
          <g stroke="#6f6a63" strokeWidth="1.75" strokeOpacity="0.82">
            <path d="M140 500 C180 348 286 232 428 202 C542 178 674 206 770 296 C842 364 884 438 920 500" />
            <path d="M422 242 C482 192 608 198 674 256 C682 332 620 374 540 360 C472 348 426 306 422 242" />
            <path d="M456 304 C512 342 600 342 652 286" />
            <path d="M140 500 C340 504 660 504 920 500" />
          </g>
        </g>
      )}
    </svg>
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
  const frontMechanismView = view === 'front'
  const isometricMechanismView = view === 'isometric' || frontMechanismView
  const topPlanView = view === 'top'
  const renderScope = useMemo(() =>
    buildNodeEdgeRenderScope(model, sideMechanismView, isometricMechanismView, topPlanView),
  [isometricMechanismView, model, sideMechanismView, topPlanView])
  const restGhostGeometry = useMemo(() => buildRestGhostGeometry(model, nodeById), [model, nodeById])
  const surfaceGeometry = useMemo(() => buildSurfaceGeometry(model, nodeById, quadMetricById, dihedralByQuad, model.quads), [model, nodeById, quadMetricById, dihedralByQuad])
  const surfaceVisible = model.config.showSurface
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
      {surfaceVisible && !model.config.showHeatmap && (
        <ReadableWaveSurface model={model} view={view} />
      )}
      {surfaceVisible && model.config.showHeatmap && (
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
          <StraightEdgeSegments model={model} nodes={nodeById} scope={renderScope} view={view} />
          <XCellCenterPivots model={model} scope={renderScope} view={view} />
          <XCellConnectorJoints model={model} scope={renderScope} view={view} />
        </>
      )}
      {view === 'isometric' && model.config.showHeatmap && (
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

type ReadableWaveProfilePoint = { x: number; z: number }
type ReadableWaveFrame = {
  profile: {
    points: ReadableWaveProfilePoint[]
    distances: number[]
    totalDistance: number
    maxZ: number
  }
  isometricProfile: {
    points: ReadableWaveProfilePoint[]
    distances: number[]
    totalDistance: number
    maxZ: number
  }
  minX: number
  maxX: number
  centerY: number
  halfSpan: number
  height: number
  progress: number
}

const readableWaveUSegments = 104
const readableWaveVSegments = 54
const readableReferenceProfilePoints =
  '0,0;0.035,0.02;0.075,0.07;0.118,0.17;0.17,0.32;0.225,0.5;0.295,0.68;0.375,0.82;0.47,0.92;0.565,0.97;0.66,0.96;0.74,0.88;0.805,0.74;0.85,0.56;0.855,0.43;0.828,0.39;0.792,0.4;0.772,0.43;0.79,0.47;0.825,0.48;0.79,0.58;0.725,0.68;0.65,0.73;0.58,0.72;0.525,0.64;0.5,0.52;0.505,0.4;0.55,0.27;0.625,0.17;0.73,0.09;0.85,0.045;0.96,0.018;1,0'
const readableIsometricProfilePoints =
  '0,0;0.035,0.018;0.08,0.07;0.13,0.17;0.188,0.322;0.265,0.528;0.36,0.724;0.468,0.874;0.565,0.958;0.654,0.982;0.718,0.938;0.756,0.85;0.782,0.724;0.776,0.592;0.746,0.492;0.694,0.438;0.636,0.442;0.588,0.492;0.54,0.532;0.506,0.514;0.49,0.456;0.506,0.346;0.566,0.238;0.66,0.138;0.772,0.076;0.895,0.032;0.972,0.012;1,0'

function readableSurfaceReferenceOnly(model: LatticeModel): boolean {
  return model.config.showSurface && readableWaveReferenceDisplay(model)
}

function readableWaveReferenceDisplay(model: LatticeModel): boolean {
  return !model.config.showHeatmap && !model.config.showNodes
}

function ReadableWaveSurface({ model, view }: { model: LatticeModel; view: CameraViewRequest['view'] }) {
  const surfaceGeometry = useMemo(() => buildReadableWaveSurfaceGeometry(model, view), [model, view])
  const wireGeometry = useMemo(() => buildReadableWaveWireGeometry(model, view), [model, view])
  const outlineGeometry = useMemo(() => buildReadableWaveOutlineGeometry(model, view), [model, view])
  const sideThroatGeometry = useMemo(() => view === 'side' ? buildReadableWaveSideThroatGeometry(model) : null, [model, view])
  const throatGeometry = useMemo(() => view === 'isometric' ? buildReadableWaveThroatGeometry(model) : null, [model, view])
  const surfaceOpacity = view === 'side' ? 0.2 : view === 'front' ? 0.72 : view === 'top' ? 0.18 : 0.28
  const wireOpacity = view === 'side' ? 0.34 : view === 'front' ? 0.21 : view === 'top' ? 0.34 : 0.26
  const outlineOpacity = view === 'side' ? 0.16 : view === 'front' ? 0.1 : view === 'top' ? 0.045 : 0.03

  return (
    <group renderOrder={-2}>
      <mesh geometry={surfaceGeometry} renderOrder={-2}>
        {view === 'front' ? (
          <meshStandardMaterial color="#ffffff" emissive="#fbfaf6" emissiveIntensity={0.52} roughness={0.92} metalness={0} side={THREE.DoubleSide} transparent opacity={0.38} depthWrite polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        ) : view === 'isometric' ? (
          <meshStandardMaterial color="#ffffff" emissive="#fbfaf6" emissiveIntensity={0.82} roughness={1} metalness={0} side={THREE.DoubleSide} transparent opacity={surfaceOpacity} depthWrite polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        ) : (
          <meshBasicMaterial color="#fbfaf6" side={THREE.DoubleSide} transparent opacity={surfaceOpacity} depthWrite={view === 'side'} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        )}
      </mesh>
      <lineSegments geometry={wireGeometry} renderOrder={-1}>
        <lineBasicMaterial color="#b8b3ab" transparent opacity={wireOpacity} depthTest depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={outlineGeometry} renderOrder={0}>
        <lineBasicMaterial color={view === 'side' ? '#9d978f' : '#77726a'} transparent opacity={outlineOpacity} depthTest={view !== 'side'} depthWrite={false} />
      </lineSegments>
      {sideThroatGeometry && (
        <lineSegments geometry={sideThroatGeometry} renderOrder={1}>
          <lineBasicMaterial color="#6f6a63" transparent opacity={0.22} depthTest={false} depthWrite={false} />
        </lineSegments>
      )}
      {throatGeometry && (
        <lineSegments geometry={throatGeometry} renderOrder={1}>
          <lineBasicMaterial color="#7b766f" transparent opacity={0} depthTest={false} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  )
}

function buildReadableWaveSurfaceGeometry(model: LatticeModel, view: CameraViewRequest['view']): THREE.BufferGeometry {
  const frame = readableWaveFrame(model)
  const vertexCount = (readableWaveUSegments + 1) * (readableWaveVSegments + 1)
  const positions = new Float32Array(vertexCount * 3)
  const indices: number[] = []

  for (let vIndex = 0; vIndex <= readableWaveVSegments; vIndex += 1) {
    const s = -1 + (vIndex / readableWaveVSegments) * 2
    for (let uIndex = 0; uIndex <= readableWaveUSegments; uIndex += 1) {
      const t = uIndex / readableWaveUSegments
      const offset = (vIndex * (readableWaveUSegments + 1) + uIndex) * 3
      writeVec(positions, offset, readableWaveDisplayPoint(frame, view, t, s))
    }
  }

  for (let vIndex = 0; vIndex < readableWaveVSegments; vIndex += 1) {
    for (let uIndex = 0; uIndex < readableWaveUSegments; uIndex += 1) {
      const rowStride = readableWaveUSegments + 1
      const a = vIndex * rowStride + uIndex
      const b = a + 1
      const c = a + rowStride
      const d = c + 1
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function buildReadableWaveWireGeometry(model: LatticeModel, view: CameraViewRequest['view']): THREE.BufferGeometry {
  const frame = readableWaveFrame(model)
  const positions: number[] = []
  const pushSegment = (a: Vec3, b: Vec3) => {
    positions.push(...a, ...b)
  }
  const spanLineStep = view === 'top' ? 1 : view === 'side' ? 6 : view === 'front' ? 2 : 2
  const profileLineStep = view === 'top' ? 3 : view === 'side' ? 5 : view === 'front' ? 4 : 3

  for (let vIndex = 0; vIndex <= readableWaveVSegments; vIndex += spanLineStep) {
    const s = -1 + (vIndex / readableWaveVSegments) * 2
    for (let uIndex = 0; uIndex < readableWaveUSegments; uIndex += 1) {
      const t0 = uIndex / readableWaveUSegments
      const t1 = (uIndex + 1) / readableWaveUSegments
      if (view === 'side' && Math.abs(s) > 0.16 && t0 > 0.58 && t1 < 0.9) continue
      pushSegment(
        readableWaveDisplayPoint(frame, view, t0, s),
        readableWaveDisplayPoint(frame, view, t1, s),
      )
    }
  }

  for (let uIndex = 0; uIndex < readableWaveUSegments; uIndex += profileLineStep) {
    const t = uIndex / readableWaveUSegments
    if (view === 'side' && t > 0.61 && t < 0.87) continue
    for (let vIndex = 0; vIndex < readableWaveVSegments; vIndex += 1) {
      pushSegment(
        readableWaveDisplayPoint(frame, view, t, -1 + (vIndex / readableWaveVSegments) * 2),
        readableWaveDisplayPoint(frame, view, t, -1 + ((vIndex + 1) / readableWaveVSegments) * 2),
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function buildReadableWaveOutlineGeometry(model: LatticeModel, view: CameraViewRequest['view']): THREE.BufferGeometry {
  const frame = readableWaveFrame(model)
  const positions: number[] = []
  const pushPolyline = (points: Vec3[]) => {
    for (let index = 0; index < points.length - 1; index += 1) {
      positions.push(...points[index], ...points[index + 1])
    }
  }
  const samples = 128
  const sampleProfileLine = (s: number) =>
    Array.from({ length: samples + 1 }, (_, index) => readableWaveDisplayPoint(frame, view, index / samples, s))
  const sampleSpanLine = (t: number) =>
    Array.from({ length: 65 }, (_, index) => readableWaveDisplayPoint(frame, view, t, -1 + (index / 64) * 2))

  if (view === 'side') {
    pushPolyline(sampleOuterSideProfileLine(frame, samples))
  } else if (view === 'front') {
    ;[0.58, 0.72, 0.86, 0.94].forEach((t) => pushPolyline(sampleSpanLine(t)))
    ;[-0.72, -0.36, 0, 0.36, 0.72].forEach((s) => pushPolyline(sampleProfileLine(s)))
  } else if (view === 'top') {
    ;[-0.72, -0.42, -0.18, 0, 0.18, 0.42, 0.72].forEach((s) =>
      pushPolyline(sampleProfileLine(s)),
    )
    ;[0, 0.66, 0.76, 0.86, 0.94].forEach((t) =>
      pushPolyline(sampleSpanLine(t)),
    )
  } else {
    ;[-0.72, -0.42, -0.18, 0, 0.18, 0.42, 0.72].forEach((s) => pushPolyline(sampleProfileLine(s)))
    ;[0, 0.66, 0.78].forEach((t) => pushPolyline(sampleSpanLine(t)))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function buildReadableWaveThroatGeometry(model: LatticeModel): THREE.BufferGeometry {
  const frame = readableWaveFrame(model)
  const positions: number[] = []
  const pushPolyline = (points: Vec3[]) => {
    for (let index = 0; index < points.length - 1; index += 1) {
      positions.push(...points[index], ...points[index + 1])
    }
  }
  const samples = 80
  const points = Array.from({ length: samples + 1 }, (_, index) =>
    readableWavePoint(frame, lerpNumber(0.58, 0.94, index / samples), 0),
  )

  pushPolyline(points)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function buildReadableWaveSideThroatGeometry(model: LatticeModel): THREE.BufferGeometry {
  const frame = readableWaveFrame(model)
  const positions: number[] = []
  const samples = 72
  const points = Array.from({ length: samples + 1 }, (_value, index) =>
    readableWaveSidePoint(frame, lerpNumber(0.58, 0.98, index / samples), 0),
  )

  for (let index = 0; index < points.length - 1; index += 1) {
    positions.push(...points[index], ...points[index + 1])
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function sampleOuterSideProfileLine(frame: ReadableWaveFrame, samples: number): Vec3[] {
  const points = Array.from({ length: samples + 1 }, (_, index) => readableWavePoint(frame, index / samples, 0))
  let crestIndex = 0
  for (let index = 1; index < points.length; index += 1) {
    if (points[index][2] > points[crestIndex][2]) crestIndex = index
  }

  for (let index = crestIndex + 2; index < points.length - 1; index += 1) {
    const previous = points[index - 1][2]
    const current = points[index][2]
    const next = points[index + 1][2]
    if (current <= previous && current <= next && current < frame.height * 0.34) {
      return points.slice(0, index + 1)
    }
  }

  return points
}

function readableWaveFrame(model: LatticeModel): ReadableWaveFrame {
  const profile = buildReadableWaveProfile(readableReferenceProfilePoints)
  const isometricProfile = buildReadableWaveProfile(readableIsometricProfilePoints)
  const sideBounds = activeSideProfileBounds(model)
  const height = Math.max(model.summary.maxHeight * 1.42, model.config.height * Math.max(model.config.profileScale, 1.14), model.config.spacing * 12.8)
  const waveWidth = Math.min(sideBounds.span[0] * 0.82, height * 2.03)
  const minX = sideBounds.center[0] - waveWidth * 0.48
  const maxX = sideBounds.center[0] + waveWidth * 0.52
  const visualHalfSpan = waveWidth * 0.31

  return {
    profile,
    isometricProfile,
    minX,
    maxX,
    centerY: model.bounds.center[1],
    halfSpan: visualHalfSpan,
    height,
    progress: clampUnit(model.config.morph),
  }
}

function buildReadableWaveProfile(source: string): ReadableWaveFrame['profile'] {
  const points = parseReadableWaveProfilePoints(source)
  const safePoints = points.length >= 2 ? points : parseReadableWaveProfilePoints(readableReferenceProfilePoints)
  const distances = [0]
  let totalDistance = 0
  let maxZ = 0

  for (let index = 1; index < safePoints.length; index += 1) {
    const previous = safePoints[index - 1]
    const current = safePoints[index]
    totalDistance += Math.hypot(current.x - previous.x, current.z - previous.z)
    distances.push(totalDistance)
    maxZ = Math.max(maxZ, previous.z, current.z)
  }

  return {
    points: safePoints,
    distances,
    totalDistance: Math.max(totalDistance, 0.000001),
    maxZ: Math.max(maxZ, 0.000001),
  }
}

function parseReadableWaveProfilePoints(source: string): ReadableWaveProfilePoint[] {
  return source
    .split(';')
    .map((entry) => {
      const [x, z] = entry.split(',').map((value) => Number(value.trim()))
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null
      return { x: clampUnit(x), z: Math.max(0, z) }
    })
    .filter((point): point is ReadableWaveProfilePoint => Boolean(point))
}

function readableWavePoint(frame: ReadableWaveFrame, t: number, s: number): Vec3 {
  const waveWidth = frame.maxX - frame.minX
  const envelope = readableLateralEnvelope(s)
  const baseFoldBlend = Math.pow(envelope, 1.18)
  const liftBlend = Math.pow(envelope, 1.08)
  const growth = Math.sin(frame.progress * Math.PI * 0.5)
  const curlBlend = smoothStep(0.22, 1, frame.progress)
  const profilePoint = sampleReadableWaveProfile(frame.profile, t)
  const lateralCurlBlend = curlBlend * Math.pow(envelope, 1.45)
  const baseX = lerpNumber(frame.minX, frame.maxX, t)
  const baseY = frame.centerY + s * frame.halfSpan
  const moundLift = Math.sin(Math.PI * t) ** 1.18
  const moundX = baseX - waveWidth * 0.035 * moundLift
  const moundZ = frame.height * 0.72 * moundLift
  const curledX = frame.minX + waveWidth * profilePoint.x
  const curledZ = frame.height * (profilePoint.z / frame.profile.maxZ)
  const centerX = lerpNumber(moundX, curledX, lateralCurlBlend)
  const offCenterCurlRelief = smoothStep(0.36, 0.92, t) * frame.progress * (1 - Math.pow(envelope, 0.32)) * 0.75
  const centerZ = lerpNumber(moundZ, curledZ, lateralCurlBlend) * growth * (1 - offCenterCurlRelief)
  const curlShoulder = smoothStep(0.44, 0.72, t) * (1 - smoothStep(0.88, 1, t))
  const lipTip = smoothStep(0.7, 1, t)
  const lipBody = smoothStep(0.62, 0.94, t)
  const capLocalization = frame.progress * smoothStep(0.44, 0.82, t)
  const shoulderFoldBlend = lerpNumber(baseFoldBlend, Math.pow(envelope, 2.45), capLocalization * curlShoulder * 0.68)
  const terminalLocalization = frame.progress * lipTip
  const foldBlend = lerpNumber(shoulderFoldBlend, Math.pow(envelope, 2.85), terminalLocalization * 0.82)
  const terminalLipEnvelope = lerpNumber(Math.pow(envelope, 1.22), Math.pow(envelope, 7.2), terminalLocalization * 0.92)
  const crestLiftBlend = lerpNumber(liftBlend, Math.pow(envelope, 3.85), capLocalization * curlShoulder * 0.7)
  const lipLiftBlend = lerpNumber(crestLiftBlend, terminalLipEnvelope, frame.progress * lipBody * 0.82)
  const pinchEnvelope = Math.pow(envelope, 0.42)
  const curlPinch = Math.min(0.66, frame.progress * pinchEnvelope * (0.04 * curlShoulder + 0.54 * lipTip))
  const yPinch = s * frame.halfSpan * curlPinch

  return [
    lerpNumber(baseX, centerX, foldBlend),
    baseY - yPinch,
    Math.max(0, centerZ * lipLiftBlend),
  ]
}

function readableWaveDisplayPoint(frame: ReadableWaveFrame, view: CameraViewRequest['view'], t: number, s: number): Vec3 {
  if (view === 'top') return readableWaveTopPlanPoint(frame, t, s)
  if (view === 'front') return readableWaveFrontPoint(frame, t, s)
  if (view === 'isometric') return readableWaveIsometricPoint(frame, t, s)
  if (view === 'side') return readableWaveSidePoint(frame, t, s)
  return readableWavePoint(frame, t, s)
}

function buildReadableWaveXCellCenterOverrides(model: LatticeModel, view: CameraViewRequest['view']): Map<string, Vec3> {
  const frame = readableWaveFrame(model)
  const rowDenominator = Math.max(model.config.rows - 1, 1)
  const columnDenominator = Math.max(model.config.columns - 1, 1)

  return new Map(model.nodes.map((node) => [
    node.id,
    readableWaveDisplayPoint(
      frame,
      view,
      node.col / columnDenominator,
      -1 + (node.row / rowDenominator) * 2,
    ),
  ] as const))
}

function readableWaveSidePoint(frame: ReadableWaveFrame, t: number, s: number): Vec3 {
  const point = readableWavePoint(frame, t, s)

  return point
}

function readableWaveIsometricPoint(frame: ReadableWaveFrame, t: number, s: number): Vec3 {
  const waveWidth = frame.maxX - frame.minX
  const envelope = readableLateralEnvelope(s)
  const lipAdvance = frame.progress *
    smoothStep(0.46, 0.82, t) *
    (1 - smoothStep(0.92, 0.995, t)) *
    Math.pow(envelope, 1.32) *
    0.068
  const profileT = clampUnit(t + lipAdvance)
  const point = readableWavePoint(frame, profileT, s)
  const center = Math.pow(envelope, 2.22)
  const lipFace = smoothStep(0.62, 0.8, t) * (1 - smoothStep(0.92, 0.985, t))
  const lowerLip = smoothStep(0.7, 0.88, t) * (1 - smoothStep(0.94, 0.995, t))
  const throat = smoothStep(0.52, 0.66, t) * (1 - smoothStep(0.78, 0.9, t))
  const openThroat = frame.progress * center
  const facePinch = smoothStep(0.6, 0.82, t) * (1 - smoothStep(0.93, 0.995, t)) * Math.pow(envelope, 0.36)
  const roundedProfilePoint = sampleReadableWaveProfile(frame.isometricProfile, profileT)
  const roundedLipBlend = frame.progress *
    smoothStep(0.5, 0.82, t) *
    (1 - smoothStep(0.92, 0.995, t)) *
    Math.pow(envelope, 2.24) *
    0.92
  const displayPoint: Vec3 = [
    lerpNumber(point[0], frame.minX + waveWidth * roundedProfilePoint.x, roundedLipBlend),
    point[1],
    lerpNumber(
      point[2],
      frame.height * (roundedProfilePoint.z / frame.isometricProfile.maxZ) * Math.pow(envelope, 4.45),
      roundedLipBlend,
    ),
  ]
  const heightFocusBand = frame.progress *
    smoothStep(0.24, 0.78, t) *
    (1 - smoothStep(0.93, 0.995, t)) *
    0.9
  const lateralHeightFocus = lerpNumber(0.22, 1, Math.pow(envelope, 1.28))
  const focusedZ = lerpNumber(displayPoint[2], displayPoint[2] * lateralHeightFocus, heightFocusBand)
  const terminalTipTaper = frame.progress *
    smoothStep(0.62, 0.9, t) *
    (1 - smoothStep(0.96, 0.995, t)) *
    (1 - Math.pow(envelope, 0.9)) *
    0.1

  return [
    displayPoint[0] + waveWidth * openThroat * (0.15 * lipFace - 0.252 * lowerLip - 0.064 * throat - 0.026 * facePinch) - waveWidth * terminalTipTaper,
    displayPoint[1],
    Math.max(0, focusedZ + frame.height * openThroat * (0.154 * throat - 0.282 * lowerLip - 0.068 * facePinch)),
  ]
}

function readableWaveFrontPoint(frame: ReadableWaveFrame, t: number, s: number): Vec3 {
  const wavePoint = readableWavePoint(frame, t, s)
  const waveWidth = frame.maxX - frame.minX
  const frontDepthCenter = (frame.minX + frame.maxX) * 0.5
  const envelope = readableLateralEnvelope(s)
  const bodyBand = smoothStep(0.04, 0.56, t) * (1 - smoothStep(0.94, 1, t))
  const bodyArch = frame.height * 0.78 *
    (Math.sin(Math.PI * clampUnit(t * 0.9 + 0.03)) ** 1.04) *
    Math.pow(envelope, 0.72) *
    bodyBand
  const capBand = smoothStep(0.5, 0.68, t) * (1 - smoothStep(0.93, 1, t))
  const lipReturnBand = smoothStep(0.78, 0.9, t) * (1 - smoothStep(0.95, 1, t))
  const centralLipMask = lipReturnBand * Math.pow(envelope, 0.9)
  const bodyPinch = 0.26 * bodyBand * Math.pow(envelope, 0.4)
  const capShoulder = Math.pow(envelope, 0.24) * capBand
  const capArch = frame.height * 0.82 * capShoulder
  const tuckedLip = frame.height * (0.58 - 0.19 * Math.pow(envelope, 0.58))
  const domeHeight = Math.max(wavePoint[2] * 0.16, bodyArch * (1 - 0.34 * capBand), capArch)
  const spanPinch = clampUnit(
    bodyPinch +
    0.24 * capBand * Math.pow(envelope, 0.34) +
    0.18 * centralLipMask,
  )

  return [
    lerpNumber(frontDepthCenter, wavePoint[0], 0.07) + waveWidth * 0.32 * centralLipMask,
    frame.centerY + s * frame.halfSpan * (1 - spanPinch),
    lerpNumber(domeHeight, tuckedLip, clampUnit(0.84 * centralLipMask)),
  ]
}

function readableWaveTopPlanPoint(frame: ReadableWaveFrame, t: number, s: number): Vec3 {
  const wavePoint = readableWavePoint(frame, t, s)
  const waveWidth = frame.maxX - frame.minX
  const planMaxX = frame.maxX + waveWidth * 0.16
  const planWidth = planMaxX - frame.minX
  const planHalfSpan = planWidth * 0.5
  const baseX = lerpNumber(frame.minX, frame.maxX, t)
  const envelope = readableLateralEnvelope(s)
  const bodyRegion = smoothStep(0.08, 0.64, t) * (1 - smoothStep(0.92, 1, t))
  const shoulderLobe = Math.exp(-Math.pow((t - 0.62) / 0.28, 2)) * (1 - smoothStep(0.9, 1, t))
  const terminalNose = Math.exp(-Math.pow((t - 0.82) / 0.16, 2)) * (1 - smoothStep(0.94, 1, t))
  const teardropLobe = shoulderLobe * Math.pow(envelope, 1.02)
  const shoulderRound = shoulderLobe * Math.pow(envelope, 0.48) * (1 - Math.pow(envelope, 2.25))
  const edgeReturn = smoothStep(0.7, 0.96, t)
  const bodyPush = waveWidth * (
    0.024 * bodyRegion * Math.pow(envelope, 1.06) +
    0.118 * teardropLobe +
    0.058 * shoulderRound
  ) * (1 - 0.92 * edgeReturn)
  const terminalInset = waveWidth * (
    0.004 * terminalNose * Math.pow(envelope, 2.2) *
    smoothStep(0.74, 0.94, t)
  )
  const terminalPlanRelease = smoothStep(0.66, 0.94, t)
  const planPinch = clampUnit(
    0.014 * bodyRegion * Math.pow(envelope, 1.02) +
    0.024 * teardropLobe * (1 - 0.78 * terminalPlanRelease),
  )
  const planX = baseX + bodyPush - terminalInset
  const planY = frame.centerY + s * planHalfSpan * (1 - planPinch)
  return [
    planX,
    planY,
    wavePoint[2] * 0.025,
  ]
}

function readableLateralEnvelope(s: number): number {
  const absolute = clampUnit(Math.abs(s))
  return Math.pow(Math.cos(absolute * Math.PI * 0.5), 2.18)
}

function sampleReadableWaveProfile(profile: ReadableWaveFrame['profile'], t: number): ReadableWaveProfilePoint {
  const distance = clampUnit(t) * profile.totalDistance
  const segmentIndex = profile.distances.findIndex((entry) => entry >= distance)
  const nextIndex = segmentIndex <= 0 ? 1 : segmentIndex
  const previousIndex = Math.max(nextIndex - 1, 0)
  const previousDistance = profile.distances[previousIndex] ?? 0
  const nextDistance = profile.distances[nextIndex] ?? profile.totalDistance
  const localAmount = (distance - previousDistance) / Math.max(nextDistance - previousDistance, 0.000001)
  const previous = profile.points[previousIndex] ?? profile.points[0]
  const next = profile.points[nextIndex] ?? profile.points[profile.points.length - 1]
  const beforePrevious = profile.points[Math.max(previousIndex - 1, 0)] ?? previous
  const afterNext = profile.points[Math.min(nextIndex + 1, profile.points.length - 1)] ?? next
  const amount = clampUnit(localAmount)

  return {
    x: clampUnit(catmullRomNumber(beforePrevious.x, previous.x, next.x, afterNext.x, amount)),
    z: Math.max(0, catmullRomNumber(beforePrevious.z, previous.z, next.z, afterNext.z, amount)),
  }
}

function lerpNumber(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function catmullRomNumber(a: number, b: number, c: number, d: number, amount: number): number {
  const t = clampUnit(amount)
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const amount = clampUnit((value - edge0) / Math.max(edge1 - edge0, 0.000001))
  return amount * amount * (3 - 2 * amount)
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
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
  model,
  nodes,
  scope,
  view,
}: {
  model: LatticeModel
  nodes: Map<string, LatticeNode>
  scope: NodeEdgeRenderScope
  view: CameraViewRequest['view']
}) {
  const splitSideEdges = scope.sideView
  const splitIsometricEdges = scope.isometricView
  const readableSurfaceMode = readableSurfaceReferenceOnly(model)
  const readableReferenceMode = readableWaveReferenceDisplay(model)
  const geometries = useMemo(() => {
    const nodeValues = [...nodes.values()]
    const centerOverrides = readableReferenceMode ? buildReadableWaveXCellCenterOverrides(model, view) : undefined
    const mechanism = buildConnectedXCellMechanism(model, centerOverrides)
    const buildXCellGeometry = (frames: ConnectedXCellFrame[]) => {
      const positions = new Float32Array(frames.length * 4 * 3)
      let segmentIndex = 0

      frames.forEach((frame) => {
        const { ne, sw, nw, se } = frame.endpoints

        if (sw && ne) {
          writeVec(positions, segmentIndex * 6, sw)
          writeVec(positions, segmentIndex * 6 + 3, ne)
          segmentIndex += 1
        }
        if (se && nw) {
          writeVec(positions, segmentIndex * 6, se)
          writeVec(positions, segmentIndex * 6 + 3, nw)
          segmentIndex += 1
        }
      })

      const nextGeometry = new THREE.BufferGeometry()
      nextGeometry.setAttribute('position', new THREE.BufferAttribute(
        segmentIndex === frames.length * 2 ? positions : positions.slice(0, segmentIndex * 6),
        3,
      ))
      return nextGeometry
    }

    if (scope.topView) {
      if (readableReferenceMode) {
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
          topPlan: buildXCellGeometry(mechanism.frames),
          topFold: buildXCellGeometry([]),
        }
      }

      const maxHeight = Math.max(...nodeValues.map((node) => node.currentPosition[2]), 0.000001)
      const foldedTopFrame = (frame: ConnectedXCellFrame) => {
        const node = nodes.get(frame.nodeId)
        if (!node) return false
        const maxZ = frame.center[2]
        const maxPlanDisplacement = planarDistance(node.currentPosition, node.restPosition)
        return maxZ >= maxHeight * 0.1 || maxPlanDisplacement >= maxHeight * 0.44
      }
      const foldedFrames = mechanism.frames.filter(foldedTopFrame)
      const foldedIds = new Set(foldedFrames.map((frame) => frame.nodeId))

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
        topPlan: buildXCellGeometry(mechanism.frames.filter((frame) => !foldedIds.has(frame.nodeId))),
        topFold: buildXCellGeometry(foldedFrames),
      }
    }

    if (!(splitSideEdges || splitIsometricEdges)) {
      return {
        all: buildXCellGeometry(mechanism.frames),
        profile: null,
        span: null,
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
    const sideFrameActive = (frame: ConnectedXCellFrame) => {
      const node = nodes.get(frame.nodeId)
      if (!node) return false
      const maxZ = frame.center[2]
      const maxDisplacement = distanceVec(node.currentPosition, node.restPosition)
      const lifted = maxZ >= activeThreshold
      const displacedNearCurl = maxDisplacement >= displacementThreshold && maxZ >= activeThreshold
      return lifted || displacedNearCurl
    }
    const sideTerminalTangle = (frame: ConnectedXCellFrame) => {
      const node = nodes.get(frame.nodeId)
      if (!node) return false
      const maxZ = frame.center[2]
      const meanCol = node.col
      const maxDisplacement = distanceVec(node.currentPosition, node.restPosition)
      return (
        meanCol >= maxCol * 0.42 &&
        maxZ >= maxHeight * 0.018 &&
        maxZ <= maxHeight * 0.72 &&
        maxDisplacement >= displacementThreshold * 0.72
      )
    }
    const frameProfileRim = (frame: ConnectedXCellFrame) => {
      const node = nodes.get(frame.nodeId)
      if (!node || maxRow <= 0) return false
      const normalizedRow = node.row / maxRow
      return normalizedRow <= 0.07 || normalizedRow >= 0.93
    }
    const sideActiveXFrames = mechanism.frames.filter(sideFrameActive)
    const sideSoftXFrames = sideActiveXFrames.filter(sideTerminalTangle)
    const sideRimXFrames = sideActiveXFrames.filter((frame) => !sideTerminalTangle(frame) && frameProfileRim(frame))
    const sideInteriorXFrames = sideActiveXFrames.filter((frame) => !sideTerminalTangle(frame) && !frameProfileRim(frame))
    const sideFlatXFrames = mechanism.frames.filter((frame) => !sideFrameActive(frame))
    const isometricActiveXFrames = mechanism.frames.filter((frame) => {
      const node = nodes.get(frame.nodeId)
      return node ? sideFrameActive(frame) && Math.abs(node.row - centerRow) <= focusHalfRows + 0.5 : false
    })
    const isometricActiveIds = new Set(isometricActiveXFrames.map((frame) => frame.nodeId))
    const isometricFlatXFrames = mechanism.frames.filter((frame) => !isometricActiveIds.has(frame.nodeId))

    return {
      all: null,
      profile: null,
      span: null,
      profileActive: buildXCellGeometry(splitSideEdges ? sideInteriorXFrames : isometricActiveXFrames),
      profileFlat: buildXCellGeometry(splitSideEdges ? sideFlatXFrames : isometricFlatXFrames),
      profileRimActive: splitSideEdges ? buildXCellGeometry(sideRimXFrames) : null,
      profileSoftActive: splitSideEdges ? buildXCellGeometry(sideSoftXFrames) : null,
      spanActive: buildXCellGeometry([]),
      spanFlat: buildXCellGeometry([]),
      spanSoftActive: splitSideEdges ? buildXCellGeometry([]) : null,
      topPlan: null,
      topFold: null,
    }
  }, [model, nodes, readableReferenceMode, scope.edges, scope.topView, splitIsometricEdges, splitSideEdges, view])

  if (splitIsometricEdges && geometries.profileActive && geometries.profileFlat && geometries.spanActive && geometries.spanFlat) {
    return (
      <>
        <lineSegments geometry={geometries.spanFlat} renderOrder={0}>
          <lineBasicMaterial color="#312f2a" transparent opacity={readableSurfaceMode ? 0.01 : 0.018} depthTest depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileFlat} renderOrder={1}>
          <lineBasicMaterial color="#26241f" transparent opacity={readableSurfaceMode ? 0.02 : 0.052} depthTest depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.spanActive} renderOrder={2}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={readableSurfaceMode ? 0.022 : 0.052} depthTest={false} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileActive} renderOrder={3}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={readableSurfaceMode ? 0.074 : 0.18} depthTest={false} depthWrite={false} />
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
          <lineBasicMaterial color="#5b5851" transparent opacity={readableSurfaceMode ? 0.006 : 0.003} depthTest={readableSurfaceMode} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileFlat} renderOrder={1}>
          <lineBasicMaterial color="#3d3a34" transparent opacity={readableSurfaceMode ? 0.018 : 0.045} depthTest={readableSurfaceMode} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.spanSoftActive} renderOrder={2}>
          <lineBasicMaterial color="#4f4d47" transparent opacity={readableSurfaceMode ? 0.004 : 0.001} depthTest={readableSurfaceMode} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileSoftActive} renderOrder={3}>
          <lineBasicMaterial color="#34322d" transparent opacity={readableSurfaceMode ? 0.012 : 0.058} depthTest={readableSurfaceMode} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.spanActive} renderOrder={4}>
          <lineBasicMaterial color="#22221f" transparent opacity={readableSurfaceMode ? 0.009 : 0.006} depthTest={readableSurfaceMode} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileActive} renderOrder={5}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={readableSurfaceMode ? 0.072 : 0.17} depthTest={readableSurfaceMode} depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.profileRimActive} renderOrder={6}>
          <lineBasicMaterial color={inverseLinkageColor} transparent opacity={readableSurfaceMode ? 0.054 : 0.105} depthTest={readableSurfaceMode} depthWrite={false} />
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
          <lineBasicMaterial color="#252722" transparent opacity={readableSurfaceMode ? 0.048 : 0.36} depthTest depthWrite={false} />
        </lineSegments>
        <lineSegments geometry={geometries.topFold} renderOrder={1}>
          <lineBasicMaterial color="#343631" transparent opacity={readableSurfaceMode ? 0.026 : 0.07} depthTest depthWrite={false} />
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

function XCellConnectorJoints({
  model,
  scope,
  view,
}: {
  model: LatticeModel
  scope: NodeEdgeRenderScope
  view: CameraViewRequest['view']
}) {
  const readableReferenceMode = readableWaveReferenceDisplay(model)
  const readableSurfaceMode = readableSurfaceReferenceOnly(model)
  const jointPositions = useMemo(() => {
    const centerOverrides = readableReferenceMode ? buildReadableWaveXCellCenterOverrides(model, view) : undefined
    const mechanism = buildConnectedXCellMechanism(model, centerOverrides)
    return [...mechanism.connectorByDiagonalId.values()]
  }, [model, readableReferenceMode, view])
  const geometry = useMemo(() => {
    const positions = new Float32Array(jointPositions.length * 3)
    jointPositions.forEach((position, index) => writeVec(positions, index * 3, position))
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return nextGeometry
  }, [jointPositions])

  if (jointPositions.length <= 0) return null

  const haloSize = readableSurfaceMode
    ? scope.topView ? 2.05 : scope.sideView ? 3.15 : 3.05
    : scope.topView ? 2.4 : scope.sideView ? 2.44 : 2.36
  const coreSize = readableSurfaceMode
    ? scope.topView ? 1.12 : scope.sideView ? 1.85 : 1.78
    : scope.topView ? 1.25 : scope.sideView ? 1.28 : 1.22
  const coreOpacity = readableSurfaceMode
    ? scope.topView ? 0.48 : scope.sideView ? 0.78 : 0.76
    : scope.topView ? 0.86 : scope.sideView ? 0.76 : 0.74

  return (
    <>
      <points geometry={geometry} renderOrder={19}>
        <pointsMaterial
          color="#f7f3ed"
          transparent
          opacity={readableSurfaceMode ? (scope.topView ? 0.22 : scope.sideView ? 0.46 : 0.44) : scope.topView ? 0.48 : 0.48}
          size={haloSize}
          sizeAttenuation={false}
          depthTest={readableSurfaceMode ? false : !scope.topView}
          depthWrite={false}
        />
      </points>
      <points geometry={geometry} renderOrder={20}>
        <pointsMaterial
          color="#151712"
          transparent
          opacity={coreOpacity}
          size={coreSize}
          sizeAttenuation={false}
          depthTest={readableSurfaceMode ? false : !scope.topView}
          depthWrite={false}
        />
      </points>
    </>
  )
}

function XCellCenterPivots({
  model,
  scope,
  view,
}: {
  model: LatticeModel
  scope: NodeEdgeRenderScope
  view: CameraViewRequest['view']
}) {
  const readableReferenceMode = readableWaveReferenceDisplay(model)
  const readableSurfaceMode = readableSurfaceReferenceOnly(model)
  const pivotPositions = useMemo(() => {
    const centerOverrides = readableReferenceMode ? buildReadableWaveXCellCenterOverrides(model, view) : undefined
    const mechanism = buildConnectedXCellMechanism(model, centerOverrides)
    return mechanism.frames.map((frame) => frame.center)
  }, [model, readableReferenceMode, view])
  const geometry = useMemo(() => {
    const positions = new Float32Array(pivotPositions.length * 3)
    pivotPositions.forEach((position, index) => writeVec(positions, index * 3, position))
    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return nextGeometry
  }, [pivotPositions])

  if (pivotPositions.length <= 0) return null

  const size = readableSurfaceMode
    ? scope.topView ? 0.38 : scope.sideView ? 0.78 : 0.82
    : scope.topView ? 0.92 : scope.sideView ? 0.84 : 0.84
  const opacity = readableSurfaceMode
    ? scope.topView ? 0.06 : scope.sideView ? 0.26 : 0.28
    : scope.topView ? 0.55 : scope.sideView ? 0.42 : 0.42

  return (
    <points geometry={geometry} renderOrder={18}>
      <pointsMaterial
        color="#34342f"
        transparent
        opacity={opacity}
        size={size}
        sizeAttenuation={false}
        depthTest={!scope.topView}
        depthWrite={false}
      />
    </points>
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
  const mechanism = useMemo(() => buildRigidCellMechanism(model), [model])
  if (!selected) return null
  const sideLikeView = view === 'side' || view === 'isometric' || view === 'front'

  if (selected.kind === 'edge') {
    const edge = model.edges.find((candidate) => candidate.id === selected.id)
    if (sideLikeView && edge?.orientation !== 'horizontal') return null
    const frameA = edge ? mechanism.frameByNodeId.get(edge.nodeA) : undefined
    const frameB = edge ? mechanism.frameByNodeId.get(edge.nodeB) : undefined
    const connector = edge ? mechanism.connectorByEdgeId.get(edge.id) : undefined
    if (!edge || !frameA || !frameB || !connector) return null

    return (
      <group>
        <TubeSegment start={frameA.center} end={connector} radius={0.04} color="#f5d84b" />
        <TubeSegment start={frameB.center} end={connector} radius={0.04} color="#f5d84b" />
      </group>
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

  useEffect(() => {
    let innerFrame = 0
    const outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        const camera = cameraRef.current
        if (!camera) return

        camera.aspect = Math.max(size.width / Math.max(size.height, 1), 0.2)
        positionCamera(camera, controlsRef.current, modelRef.current, viewRequest.view, focusRequest.selected ?? undefined)
      })
    })

    return () => {
      window.cancelAnimationFrame(outerFrame)
      if (innerFrame) window.cancelAnimationFrame(innerFrame)
    }
  }, [focusRequest.selected, focusRequest.version, size.height, size.width, viewRequest.version, viewRequest.view])

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
  const readableReferenceBounds = !selected && readableWaveReferenceDisplay(model) && (model.config.showSurface || model.config.showEdges)
  const bounds = readableReferenceBounds && view === 'front'
    ? activeReadableWaveBounds(model, 'front')
    : readableReferenceBounds
    ? activeReadableWaveBounds(model, view)
    : !selected && view === 'side'
    ? activeSideProfileBounds(model)
    : !selected && view === 'front'
      ? activeFrontCurlBounds(model)
    : !selected && view === 'isometric'
      ? activeIsometricCurlBounds(model)
    : !selected && view === 'top'
      ? activeOverviewBounds(model)
      : model.bounds
  const maxSpan = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], 2)
  const focus = focusForSelected(model, selected ?? null)
  const fov = focus ? 32 : view === 'side' ? 16 : view === 'isometric' || view === 'front' ? 18 : 42
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
    : view === 'front'
      ? new THREE.Vector3(target.x + distance, target.y, target.z)
    : view === 'isometric'
        ? new THREE.Vector3(target.x + distance * 0.58, target.y - distance * 0.58, target.z + distance * 0.34)
      : new THREE.Vector3(target.x + distance * 0.82, target.y - distance * 0.92, target.z + distance * 0.78)

  camera.position.copy(position)
  if (view === 'top') {
    camera.up.set(0, 1, 0)
  } else {
    camera.up.set(0, 0, 1)
  }
  camera.lookAt(target)

  camera.fov = fov
  camera.zoom = view === 'side' ? 1.08 : view === 'isometric' ? 1.24 : view === 'front' ? 1.12 : 1
  camera.near = 0.01
  camera.far = Math.max(distance * 8, 100)
  camera.updateProjectionMatrix()

  controls?.target.copy(target)
  controls?.update()
}

function activeReadableWaveBounds(model: LatticeModel, view: CameraViewRequest['view'] = 'isometric'): LatticeBounds {
  const frame = readableWaveFrame(model)
  const points: Vec3[] = []
  const uSamples = 56
  const vSamples = 32

  for (let uIndex = 0; uIndex <= uSamples; uIndex += 1) {
    const t = uIndex / uSamples
    for (let vIndex = 0; vIndex <= vSamples; vIndex += 1) {
      points.push(readableWaveDisplayPoint(frame, view, t, -1 + (vIndex / vSamples) * 2))
    }
  }

  if (points.length < 2) return model.bounds

  const minX = Math.min(...points.map((point) => point[0]))
  const maxX = Math.max(...points.map((point) => point[0]))
  const minY = Math.min(...points.map((point) => point[1]))
  const maxY = Math.max(...points.map((point) => point[1]))
  const minZ = Math.min(...points.map((point) => point[2]), 0)
  const maxZ = Math.max(...points.map((point) => point[2]))
  const spanX = Math.max(maxX - minX, model.config.spacing * 6)
  const spanY = Math.max(maxY - minY, model.config.spacing * 6)
  const spanZ = Math.max(maxZ - minZ, model.config.spacing * 4)
  const padX = Math.max(model.config.spacing * 1.2, spanX * 0.055)
  const padY = Math.max(model.config.spacing * 1.2, spanY * 0.055)
  const padZ = Math.max(model.config.spacing * 0.8, spanZ * 0.1)
  const min: Vec3 = [minX - padX, minY - padY, Math.min(0, minZ - padZ * 0.2)]
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

function activeFrontCurlBounds(model: LatticeModel): LatticeBounds {
  const overview = activeOverviewBounds(model)
  const curlBounds = activeIsometricCurlBounds(model)
  const depth = Math.max(model.config.spacing * 6, curlBounds.span[0], overview.span[0] * 0.18)
  const padY = Math.max(model.config.spacing * 2, overview.span[1] * 0.04)
  const padZ = Math.max(model.config.spacing * 1.5, curlBounds.span[2] * 0.18, overview.span[2] * 0.22)
  const min: Vec3 = [
    curlBounds.center[0] - depth * 0.5,
    overview.min[1] - padY,
    Math.min(0, curlBounds.min[2] - padZ * 0.12),
  ]
  const max: Vec3 = [
    curlBounds.center[0] + depth * 0.5,
    overview.max[1] + padY,
    Math.max(overview.max[2], curlBounds.max[2]) + padZ,
  ]
  const center: Vec3 = [
    curlBounds.center[0],
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

  if (view === 'front') {
    return fitPerspectiveDistance(bounds.span[1], bounds.span[2], tanHalfFov, safeAspect, 1.22)
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
