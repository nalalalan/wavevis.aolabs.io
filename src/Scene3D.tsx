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

  return (
    <group>
      {!showSkin && grid.map((row, rowIndex) =>
        row.map((state, colIndex) => (
          <DoubleLayerCell key={`${rowIndex}-${colIndex}`} row={rowIndex} col={colIndex} state={state} params={params} layout={layout[rowIndex][colIndex]} />
        )),
      )}
      {!showSkin && connectors.map((connector) => (
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
      {showSkin && <OverhangEnvelope layout={layout} params={params} />}
    </group>
  )
}

function OverhangEnvelope({ layout, params }: { layout: ReturnType<typeof buildArrayLayout>; params: CellParams }) {
  const shell = useMemo(() => {
    const rows = 24
    const columns = 108
    const bounds = layoutBounds(layout)
    const length = Math.max(bounds.span[0], params.cellPitch * 16)
    const width = Math.max(bounds.span[1] + params.cellPitch * 1.8, params.cellPitch * 5.5)
    const baseZ = Math.max(bounds.min[2] + 0.18, 0.18)
    const crestHeight = Math.max(params.hOff * 5.6, length * 0.38)
    const curlDepth = Math.max(params.cellPitch * 10.5, length * 0.62)
    const drop = crestHeight * 1.04
    const thickness = Math.max(params.plateSize * 0.16, 0.26)
    const topVertices: number[] = []
    const undersideVertices: number[] = []
    const topIndices: number[] = []
    const undersideIndices: number[] = []
    const edgeIndices: number[] = []
    const vertexCount = rows * columns

    // The overhang preset uses a continuous skin envelope instead of showing
    // every internal linkage. It is still generated from the actuated array
    // dimensions, but avoids impossible-looking visual holes between cells.
    for (let row = 0; row < rows; row += 1) {
      const v = row / Math.max(rows - 1, 1)
      const side = v * 2 - 1
      const rowEnvelope = Math.pow(Math.max(0, 1 - Math.abs(side) ** 2.6), 0.72)

      for (let col = 0; col < columns; col += 1) {
        const u = col / Math.max(columns - 1, 1)
        const endEnvelope = smoothStep01(0.02, 0.16, u) * (1 - smoothStep01(0.86, 0.99, u))
        const envelope = rowEnvelope * endEnvelope
        const rise = smoothStep01(0.12, 0.52, u)
        const fall = smoothStep01(0.52, 0.9, u)
        const lip = smoothStep01(0.38, 0.7, u)
        const lipRound = Math.sin(Math.PI * smoothStep01(0.42, 0.9, u))
        const baseX = bounds.center[0] - length * 0.5 + length * u
        const topX = baseX - curlDepth * lip * envelope
        const topY = bounds.center[1] + side * width * 0.5
        const topZ = baseZ + (crestHeight * rise - drop * fall + crestHeight * 0.18 * lipRound) * envelope
        const undersideDrop = thickness + crestHeight * 0.1 * envelope

        topVertices.push(topX, topY, topZ)
        undersideVertices.push(topX, topY, topZ - undersideDrop)
      }
    }

    const cellIndex = (row: number, col: number) => row * columns + col

    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < columns - 1; col += 1) {
        const a = cellIndex(row, col)
        const b = a + 1
        const c = a + columns
        const d = c + 1
        topIndices.push(a, c, b, b, c, d)
        undersideIndices.push(a, b, c, b, d, c)
      }
    }

    const addEdgeQuad = (a: number, b: number) => {
      const au = a + vertexCount
      const bu = b + vertexCount
      edgeIndices.push(a, b, au, b, bu, au)
    }

    for (let col = 0; col < columns - 1; col += 1) {
      addEdgeQuad(cellIndex(0, col), cellIndex(0, col + 1))
      addEdgeQuad(cellIndex(rows - 1, col + 1), cellIndex(rows - 1, col))
    }

    for (let row = 0; row < rows - 1; row += 1) {
      addEdgeQuad(cellIndex(row + 1, 0), cellIndex(row, 0))
      addEdgeQuad(cellIndex(row, columns - 1), cellIndex(row + 1, columns - 1))
    }

    const makeGeometry = (vertices: number[], indices: number[]) => {
      const nextGeometry = new THREE.BufferGeometry()
      nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      nextGeometry.setIndex(indices)
      nextGeometry.computeVertexNormals()
      return nextGeometry
    }

    return {
      top: makeGeometry(topVertices, topIndices),
      underside: makeGeometry(undersideVertices, undersideIndices),
      edges: makeGeometry([...topVertices, ...undersideVertices], edgeIndices),
    }
  }, [layout, params.cellPitch, params.hOff, params.plateSize])

  return (
    <group>
      <mesh geometry={shell.top} renderOrder={20}>
        <meshStandardMaterial color="#ffc0d2" side={THREE.DoubleSide} roughness={0.64} metalness={0.02} />
      </mesh>
      <mesh geometry={shell.underside} renderOrder={21}>
        <meshStandardMaterial color="#c96f91" side={THREE.DoubleSide} roughness={0.72} metalness={0.02} />
      </mesh>
      <mesh geometry={shell.edges} renderOrder={22}>
        <meshStandardMaterial color="#e897ad" side={THREE.DoubleSide} roughness={0.68} metalness={0.02} />
      </mesh>
    </group>
  )
}

function smoothStep01(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(edge1 - edge0, 0.0001)))
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
