import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import { CELL_STATES, type CellParams, type CellState, type LayerName, type SideName, type Vec3 } from './types'
import { isLowerActuated, isUpperActuated, layerStack, sideDirection, sideNodeLocalPosition, stateMeta } from './geometry'

type DoubleLayerCellProps = {
  row: number
  col: number
  state: CellState
  params: CellParams
}

type SegmentProps = {
  start: Vec3
  end: Vec3
  radius?: number
  color: string
  opacity?: number
}

const sides: SideName[] = ['px', 'nx', 'py', 'ny']

const plateMaterial = new THREE.MeshStandardMaterial({
  color: '#f5f1e8',
  roughness: 0.7,
  metalness: 0.05,
})

const middlePlateMaterial = new THREE.MeshStandardMaterial({
  color: '#d7ddd4',
  roughness: 0.75,
  metalness: 0.04,
})

const nodeMaterial = new THREE.MeshStandardMaterial({
  color: '#1f2c31',
  roughness: 0.55,
  metalness: 0.1,
})

export function CylinderSegment({ start, end, radius = 0.026, color, opacity = 1 }: SegmentProps) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const startVector = new THREE.Vector3(...start)
    const endVector = new THREE.Vector3(...end)
    const direction = new THREE.Vector3().subVectors(endVector, startVector)
    const lengthValue = direction.length()
    const midpointValue = new THREE.Vector3().addVectors(startVector, endVector).multiplyScalar(0.5)
    const quaternionValue = new THREE.Quaternion()

    if (lengthValue > 0.0001) {
      quaternionValue.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    }

    return {
      midpoint: midpointValue,
      length: lengthValue,
      quaternion: quaternionValue,
    }
  }, [start, end])

  if (length <= 0.0001) return null

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} roughness={0.55} metalness={0.05} />
    </mesh>
  )
}

export default function DoubleLayerCell({ row, col, state, params }: DoubleLayerCellProps) {
  const [time, setTime] = useState(0)

  useFrame(() => {
    if (params.animate) setTime(performance.now() / 1000 + row * 0.2 + col * 0.17)
  })

  const stack = layerStack(state, params, time)
  const plateHalf = params.plateSize / 2
  const plateThickness = 0.1
  const meta = stateMeta(state)
  const upperOn = isUpperActuated(state)
  const lowerOn = isLowerActuated(state)

  return (
    <group position={[col * params.cellPitch, row * params.cellPitch, 0]}>
      <mesh position={[0, 0, stack.bottomZ]}>
        <boxGeometry args={[params.plateSize, params.plateSize, plateThickness]} />
        <primitive object={plateMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0, stack.middleZ]}>
        <boxGeometry args={[params.plateSize * 1.04, params.plateSize * 1.04, plateThickness]} />
        <primitive object={middlePlateMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 0, stack.topZ]}>
        <boxGeometry args={[params.plateSize, params.plateSize, plateThickness]} />
        <primitive object={plateMaterial} attach="material" />
      </mesh>

      <LayerLinks layer="lower" lowZ={stack.bottomZ} highZ={stack.middleZ} state={state} params={params} time={time} plateHalf={plateHalf} />
      <LayerLinks layer="upper" lowZ={stack.middleZ} highZ={stack.topZ} state={state} params={params} time={time} plateHalf={plateHalf} />

      <CylinderSegment start={[0, 0, stack.bottomZ]} end={[0, 0, stack.middleZ]} radius={0.052} color={lowerOn ? '#ff8a2a' : '#85827b'} />
      <CylinderSegment start={[0, 0, stack.middleZ]} end={[0, 0, stack.topZ]} radius={0.052} color={upperOn ? '#ff8a2a' : '#85827b'} />

      {params.showLabels && (
        <Billboard position={[0, 0, stack.topZ + 0.35]}>
          <Text fontSize={0.24} color="#1f2328" anchorX="center" anchorY="middle">
            {`${row + 1},${col + 1} ${meta.shortLabel}`}
          </Text>
        </Billboard>
      )}

      {state !== CELL_STATES.OFF && (
        <mesh position={[0, 0, -0.055]}>
          <boxGeometry args={[params.plateSize * 1.15, params.plateSize * 1.15, 0.018]} />
          <meshBasicMaterial color={meta.color} transparent opacity={0.32} />
        </mesh>
      )}
    </group>
  )
}

function LayerLinks({
  layer,
  lowZ,
  highZ,
  state,
  params,
  time,
  plateHalf,
}: {
  layer: LayerName
  lowZ: number
  highZ: number
  state: CellState
  params: CellParams
  time: number
  plateHalf: number
}) {
  return (
    <>
      {sides.map((side) => {
        const [dx, dy] = sideDirection(side)
        const node = sideNodeLocalPosition(state, layer, side, params, time)
        const lowAnchor: Vec3 = [dx * plateHalf, dy * plateHalf, lowZ]
        const highAnchor: Vec3 = [dx * plateHalf, dy * plateHalf, highZ]

        return (
          <group key={`${layer}-${side}`}>
            <CylinderSegment start={lowAnchor} end={node} color="#38474d" />
            <CylinderSegment start={node} end={highAnchor} color="#38474d" />
            <mesh position={node}>
              <sphereGeometry args={[0.07, 18, 18]} />
              <primitive object={nodeMaterial} attach="material" />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
