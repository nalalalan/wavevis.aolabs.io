import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useState } from 'react'
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

  return (
    <group>
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
  return params.constrainPerimeter && grid.length >= 5 && (grid[0]?.length ?? 0) >= 8 && hasInteriorActuation(grid)
}

function hasInteriorActuation(grid: CellGrid): boolean {
  for (let row = 1; row < grid.length - 1; row += 1) {
    for (let col = 1; col < (grid[row]?.length ?? 1) - 1; col += 1) {
      if (grid[row][col] !== CELL_STATES.OFF) return true
    }
  }

  return false
}
