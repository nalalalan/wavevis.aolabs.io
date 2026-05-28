import { Billboard, Text } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { CELL_STATES, type CellParams, type CellState, type LayerName, type Vec3 } from './types'
import {
  SIDE_NAMES,
  type CellLayout,
  isLowerActuated,
  isUpperActuated,
  plateNormal,
  sideVectorFromLayout,
  sideNodePositionFromLayout,
  stateMeta,
} from './geometry'

type DoubleLayerCellProps = {
  row: number
  col: number
  state: CellState
  params: CellParams
  layout: CellLayout
}

type SegmentProps = {
  start: Vec3
  end: Vec3
  radius?: number
  color: string
  opacity?: number
}

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

export default function DoubleLayerCell({ row, col, state, params, layout }: DoubleLayerCellProps) {
  const plateHalf = params.plateSize / 2
  const plateThickness = 0.1
  const meta = stateMeta(state)
  const upperOn = isUpperActuated(state)
  const lowerOn = isLowerActuated(state)
  const highlightCenter: Vec3 = [layout.bottom[0], layout.bottom[1], layout.bottom[2] - 0.055]

  return (
    <group>
      <Plate center={layout.bottom} normal={plateNormal(layout, 'bottom')} size={params.plateSize} thickness={plateThickness} material={plateMaterial} />
      <Plate
        center={layout.middle}
        normal={plateNormal(layout, 'middle')}
        size={params.plateSize * 1.04}
        thickness={plateThickness}
        material={middlePlateMaterial}
      />
      <Plate center={layout.top} normal={plateNormal(layout, 'top')} size={params.plateSize} thickness={plateThickness} material={plateMaterial} />

      <LayerLinks layer="lower" lowCenter={layout.bottom} highCenter={layout.middle} layout={layout} plateHalf={plateHalf} />
      <LayerLinks layer="upper" lowCenter={layout.middle} highCenter={layout.top} layout={layout} plateHalf={plateHalf} />

      <CylinderSegment start={layout.bottom} end={layout.middle} radius={0.052} color={lowerOn ? '#ff8a2a' : '#85827b'} />
      <CylinderSegment start={layout.middle} end={layout.top} radius={0.052} color={upperOn ? '#ff8a2a' : '#85827b'} />

      {params.showLabels && (
        <Billboard position={[layout.top[0], layout.top[1], layout.top[2] + 0.35]}>
          <Text fontSize={0.24} color="#1f2328" anchorX="center" anchorY="middle">
            {`${row + 1},${col + 1} ${meta.shortLabel}`}
          </Text>
        </Billboard>
      )}

      {state !== CELL_STATES.OFF && (
        <mesh position={highlightCenter}>
          <boxGeometry args={[params.plateSize * 1.15, params.plateSize * 1.15, 0.018]} />
          <meshBasicMaterial color={meta.color} transparent opacity={0.32} />
        </mesh>
      )}
    </group>
  )
}

function Plate({
  center,
  normal,
  size,
  thickness,
  material,
}: {
  center: Vec3
  normal: Vec3
  size: number
  thickness: number
  material: THREE.MeshStandardMaterial
}) {
  const quaternion = useMemo(() => {
    const target = new THREE.Vector3(...normal).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), target)
  }, [normal])

  return (
    <mesh position={center} quaternion={quaternion}>
      <boxGeometry args={[size, size, thickness]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function LayerLinks({
  layer,
  lowCenter,
  highCenter,
  layout,
  plateHalf,
}: {
  layer: LayerName
  lowCenter: Vec3
  highCenter: Vec3
  layout: CellLayout
  plateHalf: number
}) {
  return (
    <>
      {SIDE_NAMES.map((side) => {
        const sideVector = sideVectorFromLayout(layout, side)
        const node = sideNodePositionFromLayout(layout, layer, side)
        const lowAnchor: Vec3 = [
          lowCenter[0] + sideVector[0] * plateHalf,
          lowCenter[1] + sideVector[1] * plateHalf,
          lowCenter[2] + sideVector[2] * plateHalf,
        ]
        const highAnchor: Vec3 = [
          highCenter[0] + sideVector[0] * plateHalf,
          highCenter[1] + sideVector[1] * plateHalf,
          highCenter[2] + sideVector[2] * plateHalf,
        ]
        const isDepthSide = side === 'py' || side === 'ny'

        return (
          <group key={`${layer}-${side}`}>
            <CylinderSegment start={lowAnchor} end={node} radius={isDepthSide ? 0.018 : 0.026} color="#38474d" opacity={isDepthSide ? 0.56 : 1} />
            <CylinderSegment start={node} end={highAnchor} radius={isDepthSide ? 0.018 : 0.026} color="#38474d" opacity={isDepthSide ? 0.56 : 1} />
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
