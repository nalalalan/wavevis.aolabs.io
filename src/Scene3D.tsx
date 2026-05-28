import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useState } from 'react'
import * as THREE from 'three'
import DoubleLayerCell, { PlankSegment } from './DoubleLayerCell'
import { buildArrayLayout, layoutBounds, sideNodePositionFromLayout } from './geometry'
import { linkageColor, linkageWidth } from './renderStyle'
import { CELL_STATES, type CellGrid, type CellParams, type LayerName, type Vec3 } from './types'

type Scene3DProps = {
  grid: CellGrid
  params: CellParams
}

type Connector = {
  id: string
  start: Vec3
  end: Vec3
}

const connectorWidthHint: Vec3 = [0, 0, 1]

export default function Scene3D({ grid, params }: Scene3DProps) {
  const initialLayout = useMemo(() => buildArrayLayout(grid, params), [grid, params])
  const bounds = useMemo(() => layoutBounds(initialLayout), [initialLayout])
  const maxSpan = Math.max(bounds.span[0], bounds.span[1], bounds.span[2], params.cellPitch * 2)
  const maxHeight = Math.max(bounds.max[2], params.hOff * 2)
  const cameraDistance = Math.max(maxSpan, maxHeight)
  const overhangScene = isOverhangScene(grid, params)
  const cameraPosition: Vec3 = overhangScene
    ? [bounds.center[0] - cameraDistance * 0.12, bounds.center[1] - cameraDistance * 1.62, bounds.center[2] + cameraDistance * 0.16]
    : [cameraDistance * 1.25, -cameraDistance * 1.45, cameraDistance * 1.25]
  const cameraTarget: Vec3 = overhangScene
    ? [bounds.center[0], bounds.center[1], bounds.center[2] * 0.62]
    : [bounds.center[0], bounds.center[1], maxHeight * 0.45]

  return (
    <section className="scene-shell" aria-label="3D Sarrus array view">
      <Canvas dpr={[1, 1.8]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <PerspectiveCamera
          makeDefault
          position={cameraPosition}
          up={[0, 0, 1]}
          fov={overhangScene ? 50 : 38}
        />
        <color attach="background" args={['#f7f3ed']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[7, -7, 9]} intensity={1.15} />
        <directionalLight position={[-5, 6, 4]} intensity={0.35} />
        <Suspense fallback={null}>
          <ArrayModel grid={grid} params={params} />
        </Suspense>
        <gridHelper args={[Math.max(maxSpan * 1.45, 8), 24, '#c8bdb0', '#e1d8cd']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.08]} />
        <OrbitControls makeDefault enablePan enableZoom enableRotate target={cameraTarget} />
      </Canvas>
    </section>
  )
}

function ArrayModel({ grid, params }: Scene3DProps) {
  const [time, setTime] = useState(0)

  useFrame(() => {
    if (params.animate) setTime(performance.now() / 1000)
  })

  const layoutTime = params.animate ? time : 0
  const layout = useMemo(() => buildArrayLayout(grid, params, layoutTime), [grid, params, layoutTime])
  const connectors = useMemo(() => (params.connectorLength > 0.0001 ? buildConnectors(grid, layout) : []), [grid, layout, params.connectorLength])
  const showSkin = isOverhangScene(grid, params)
  const bounds = useMemo(() => layoutBounds(layout), [layout])

  return (
    <group>
      {showSkin && <SurfaceSkin grid={grid} params={params} bounds={bounds} />}
      {grid.map((row, rowIndex) =>
        row.map((state, colIndex) => (
          <DoubleLayerCell key={`${rowIndex}-${colIndex}`} row={rowIndex} col={colIndex} state={state} params={params} layout={layout[rowIndex][colIndex]} />
        )),
      )}
      {connectors.map((connector) => (
        <PlankSegment
          key={connector.id}
          start={connector.start}
          end={connector.end}
          width={linkageWidth(params.plateSize)}
          thickness={0.055}
          color={linkageColor}
          widthHint={connectorWidthHint}
        />
      ))}
    </group>
  )
}

function SurfaceSkin({ grid, params, bounds }: { grid: CellGrid; params: CellParams; bounds: ReturnType<typeof layoutBounds> }) {
  const geometry = useMemo(() => {
    const surfaceRows = 18
    const surfaceColumns = 72
    const gridColumns = grid[0]?.length ?? 0
    const active = activeColumnSpan(grid)
    const activeStart = active.start / Math.max(gridColumns - 1, 1)
    const activeEnd = active.end / Math.max(gridColumns - 1, 1)
    const widthX = Math.max(bounds.span[0] * 0.92, params.cellPitch * Math.max(gridColumns - 1, 1))
    const widthY = Math.max(bounds.span[1] * 0.78, params.cellPitch * Math.max(grid.length - 1, 1))
    const baseZ = params.hOff * 2 + 0.22
    const waveHeight = widthX * 0.32 * active.strength
    const curlDepth = widthX * 0.78 * active.strength
    const vertices: number[] = []
    const indices: number[] = []

    for (let row = 0; row < surfaceRows; row += 1) {
      const v = row / (surfaceRows - 1)
      const widthEnvelope = Math.pow(Math.sin(v * Math.PI), 0.58)
      const y = (v - 0.5) * widthY

      for (let col = 0; col < surfaceColumns; col += 1) {
        const u = col / (surfaceColumns - 1)
        const baseX = (u - 0.5) * widthX
        const activeEnvelope = smoothStep(activeStart - 0.04, activeStart + 0.12, u) * (1 - smoothStep(activeEnd - 0.12, activeEnd + 0.04, u))
        const localU = clampNumber((u - activeStart) / Math.max(activeEnd - activeStart, 0.0001), 0, 1)
        const rise = smoothStep(0.02, 0.48, localU)
        const lip = smoothStep(0.34, 0.86, localU)
        const fall = smoothStep(0.62, 1, localU)
        const curledX = baseX - curlDepth * lip * activeEnvelope
        const curledZ = baseZ + waveHeight * (rise - fall * 0.92) * activeEnvelope
        const x = baseX + (curledX - baseX) * widthEnvelope
        const z = baseZ + (curledZ - baseZ) * widthEnvelope
        vertices.push(x, y, z)
      }
    }

    for (let row = 0; row < surfaceRows - 1; row += 1) {
      for (let col = 0; col < surfaceColumns - 1; col += 1) {
        const a = row * surfaceColumns + col
        const b = a + 1
        const c = a + surfaceColumns
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    nextGeometry.setIndex(indices)
    nextGeometry.computeVertexNormals()
    return nextGeometry
  }, [bounds.span, grid, params.cellPitch, params.hOff])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#ffc0d2" side={THREE.FrontSide} transparent opacity={0.34} roughness={0.62} metalness={0.02} depthWrite={false} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#be6f89" side={THREE.BackSide} transparent opacity={0.58} roughness={0.72} metalness={0.02} depthWrite={false} />
      </mesh>
    </group>
  )
}

function activeColumnSpan(grid: CellGrid): { start: number; end: number; strength: number } {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  let start = columns - 1
  let end = 0
  let active = 0
  let possible = 0

  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < columns - 1; col += 1) {
      possible += 1
      if (grid[row][col] !== CELL_STATES.OFF) {
        start = Math.min(start, col)
        end = Math.max(end, col)
        active += 1
      }
    }
  }

  if (active === 0) return { start: 1, end: columns - 2, strength: 1 }
  return { start, end, strength: Math.min(1, Math.max(0.42, active / Math.max(possible * 0.45, 1))) }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = clampNumber((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1)
  return t * t * (3 - 2 * t)
}

function buildConnectors(grid: CellGrid, layout: ReturnType<typeof buildArrayLayout>): Connector[] {
  const connectors: Connector[] = []
  const rows = grid.length
  const columns = grid[0]?.length ?? 0

  const addPair = (id: string, start: Vec3, end: Vec3) => {
    connectors.push({ id, start, end })
  }

  const addLayerPair = (axis: 'x' | 'y', layer: LayerName, row: number, col: number) => {
    if (axis === 'x') {
      addPair(
        `x-${layer}-${row}-${col}`,
        sideNodePositionFromLayout(layout[row][col], layer, 'px'),
        sideNodePositionFromLayout(layout[row][col + 1], layer, 'nx'),
      )
    } else {
      addPair(
        `y-${layer}-${row}-${col}`,
        sideNodePositionFromLayout(layout[row][col], layer, 'py'),
        sideNodePositionFromLayout(layout[row + 1][col], layer, 'ny'),
      )
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns - 1; col += 1) {
      addLayerPair('x', 'upper', row, col)
      addLayerPair('x', 'lower', row, col)
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      addLayerPair('y', 'upper', row, col)
      addLayerPair('y', 'lower', row, col)
    }
  }

  return connectors
}

function isOverhangScene(grid: CellGrid, params: CellParams): boolean {
  return params.constrainPerimeter && grid.length >= 5 && (grid[0]?.length ?? 0) >= 8
}
