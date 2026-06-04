import { Billboard, Text } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { CELL_STATES, type CellParams, type CellState, type LayerName, type Vec3 } from './types'
import {
  SIDE_NAMES,
  type CellLayout,
  type ContactNodeOverrides,
  isLowerActuated,
  isUpperActuated,
  plateNormal,
  sideVectorFromLayout,
  sideNodePositionFromLayout,
  stateMeta,
} from './geometry'
import { cellBodyColor, connectorColor, emOffColor, linkageColor, linkageWidth, octagonHalfLegSide } from './renderStyle'

type DoubleLayerCellProps = {
  row: number
  col: number
  state: CellState
  params: CellParams
  layout: CellLayout
  contactNodes: ContactNodeOverrides
}

type SegmentProps = {
  start: Vec3
  end: Vec3
  radius?: number
  color: string
  opacity?: number
}

type PlankSegmentProps = {
  start: Vec3
  end: Vec3
  width: number
  thickness?: number
  color: string
  opacity?: number
  widthHint: Vec3
}

const plateMaterial = new THREE.MeshStandardMaterial({
  color: linkageColor,
  emissive: linkageColor,
  emissiveIntensity: 0.04,
  roughness: 0.7,
  metalness: 0.05,
})

const middlePlateMaterial = new THREE.MeshStandardMaterial({
  color: linkageColor,
  emissive: linkageColor,
  emissiveIntensity: 0.04,
  roughness: 0.75,
  metalness: 0.04,
})

const cellBodyMaterial = new THREE.MeshStandardMaterial({
  color: cellBodyColor,
  emissive: cellBodyColor,
  emissiveIntensity: 0.025,
  roughness: 0.68,
  metalness: 0.05,
})

const connectorMaterial = new THREE.MeshStandardMaterial({
  color: connectorColor,
  emissive: connectorColor,
  emissiveIntensity: 0.1,
  roughness: 0.5,
  metalness: 0.03,
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

export function PlankSegment({ start, end, width, thickness = 0.045, color, opacity = 1, widthHint }: PlankSegmentProps) {
  const { midpoint, length, quaternion } = useMemo(() => {
    const startVector = new THREE.Vector3(...start)
    const endVector = new THREE.Vector3(...end)
    const direction = new THREE.Vector3().subVectors(endVector, startVector)
    const lengthValue = direction.length()
    const midpointValue = new THREE.Vector3().addVectors(startVector, endVector).multiplyScalar(0.5)
    const quaternionValue = new THREE.Quaternion()

    if (lengthValue > 0.0001) {
      const yAxis = direction.normalize()
      const xAxis = new THREE.Vector3(...widthHint).addScaledVector(yAxis, -new THREE.Vector3(...widthHint).dot(yAxis))

      if (xAxis.length() <= 0.0001) {
        xAxis.set(1, 0, 0).addScaledVector(yAxis, -yAxis.x)
      }

      xAxis.normalize()
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize()
      const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      quaternionValue.setFromRotationMatrix(matrix)
    }

    return {
      midpoint: midpointValue,
      length: lengthValue,
      quaternion: quaternionValue,
    }
  }, [start, end, widthHint])

  if (length <= 0.0001) return null

  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <boxGeometry args={[width, length, thickness]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.035} transparent={opacity < 1} opacity={opacity} roughness={0.62} metalness={0.06} />
    </mesh>
  )
}

export default function DoubleLayerCell({ row, col, state, params, layout, contactNodes }: DoubleLayerCellProps) {
  const plateHalf = params.plateSize / 2
  const plateThickness = 0.1
  const plateXAxis = sideVectorFromLayout(layout, 'px')
  const meta = stateMeta(state)
  const upperOn = isUpperActuated(state)
  const lowerOn = isLowerActuated(state)
  const highlightCenter: Vec3 = [layout.bottom[0], layout.bottom[1], layout.bottom[2] - 0.055]

  return (
    <group>
      <Plate center={layout.bottom} normal={plateNormal(layout, 'bottom')} xAxis={plateXAxis} size={params.plateSize} faceRatio={params.octagonFaceRatio} thickness={plateThickness} material={plateMaterial} />
      <Plate
        center={layout.middle}
        normal={plateNormal(layout, 'middle')}
        xAxis={plateXAxis}
        size={params.plateSize}
        faceRatio={params.octagonFaceRatio}
        thickness={plateThickness}
        material={middlePlateMaterial}
      />
      <Plate center={layout.top} normal={plateNormal(layout, 'top')} xAxis={plateXAxis} size={params.plateSize} faceRatio={params.octagonFaceRatio} thickness={plateThickness} material={plateMaterial} />
      <RigidCrossCell layout={layout} params={params} />

      <LayerLinks
        layer="lower"
        lowCenter={layout.bottom}
        highCenter={layout.middle}
        layout={layout}
        contactNodes={contactNodes}
        plateHalf={plateHalf}
        plankWidth={linkageWidth(params.plateSize, params.octagonFaceRatio)}
      />
      <LayerLinks
        layer="upper"
        lowCenter={layout.middle}
        highCenter={layout.top}
        layout={layout}
        contactNodes={contactNodes}
        plateHalf={plateHalf}
        plankWidth={linkageWidth(params.plateSize, params.octagonFaceRatio)}
      />

      <CylinderSegment start={layout.bottom} end={layout.middle} radius={0.052} color={lowerOn ? '#ff8a2a' : emOffColor} />
      <CylinderSegment start={layout.middle} end={layout.top} radius={0.052} color={upperOn ? '#ff8a2a' : emOffColor} />
      <ConnectorMarkers layout={layout} contactNodes={contactNodes} params={params} />

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

function RigidCrossCell({ layout, params }: { layout: CellLayout; params: CellParams }) {
  const normal = plateNormal(layout, 'middle')
  const xAxis = sideVectorFromLayout(layout, 'px')
  const yAxis = sideVectorFromLayout(layout, 'py')
  const lift = params.plateSize * 0.09
  const center = addVec(layout.middle, scaleVec(normal, lift))
  const rodLength = params.plateSize * 1.72
  const rodRadius = Math.max(params.plateSize * 0.034, 0.018)
  const blockSize = params.plateSize * 0.44
  const blockThickness = Math.max(params.plateSize * 0.13, 0.055)

  return (
    <group>
      <CylinderSegment start={addVec(center, scaleVec(xAxis, -rodLength / 2))} end={addVec(center, scaleVec(xAxis, rodLength / 2))} radius={rodRadius} color={linkageColor} />
      <CylinderSegment start={addVec(center, scaleVec(yAxis, -rodLength / 2))} end={addVec(center, scaleVec(yAxis, rodLength / 2))} radius={rodRadius} color={linkageColor} />
      <OrientedBox
        center={addVec(center, scaleVec(normal, blockThickness * 0.18))}
        xAxis={xAxis}
        yAxis={yAxis}
        zAxis={normal}
        size={[blockSize, blockSize, blockThickness]}
        material={cellBodyMaterial}
      />
    </group>
  )
}

function ConnectorMarkers({
  layout,
  contactNodes,
  params,
}: {
  layout: CellLayout
  contactNodes: ContactNodeOverrides
  params: CellParams
}) {
  const radius = Math.max(params.plateSize * 0.095, 0.045)

  return (
    <>
      {(['lower', 'upper'] as const).flatMap((layer) =>
        SIDE_NAMES.map((side) => {
          const node = contactNodes[layer][side] ?? sideNodePositionFromLayout(layout, layer, side)
          return (
            <mesh key={`${layer}-${side}`} position={node}>
              <sphereGeometry args={[radius, 16, 10]} />
              <primitive object={connectorMaterial} attach="material" />
            </mesh>
          )
        }),
      )}
    </>
  )
}

function Plate({
  center,
  normal,
  xAxis,
  size,
  faceRatio,
  thickness,
  material,
}: {
  center: Vec3
  normal: Vec3
  xAxis: Vec3
  size: number
  faceRatio: number
  thickness: number
  material: THREE.MeshStandardMaterial
}) {
  const geometry = useMemo(() => makeOctagonalPlateGeometry(size, faceRatio, thickness), [size, faceRatio, thickness])
  const quaternion = useMemo(() => {
    const zAxis = new THREE.Vector3(...normal).normalize()
    const xBasis = new THREE.Vector3(...xAxis)
    const xProjected = xBasis.addScaledVector(zAxis, -xBasis.dot(zAxis))

    if (xProjected.length() <= 0.0001) {
      xProjected.set(1, 0, 0).addScaledVector(zAxis, -zAxis.x)
    }

    xProjected.normalize()
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xProjected).normalize()
    const matrix = new THREE.Matrix4().makeBasis(xProjected, yAxis, zAxis)
    return new THREE.Quaternion().setFromRotationMatrix(matrix)
  }, [normal, xAxis])

  return (
    <mesh position={center} quaternion={quaternion}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function OrientedBox({
  center,
  xAxis,
  yAxis,
  zAxis,
  size,
  material,
}: {
  center: Vec3
  xAxis: Vec3
  yAxis: Vec3
  zAxis: Vec3
  size: Vec3
  material: THREE.MeshStandardMaterial
}) {
  const quaternion = useMemo(() => {
    const x = new THREE.Vector3(...xAxis).normalize()
    const y = new THREE.Vector3(...yAxis).normalize()
    const z = new THREE.Vector3(...zAxis).normalize()
    const matrix = new THREE.Matrix4().makeBasis(x, y, z)
    return new THREE.Quaternion().setFromRotationMatrix(matrix)
  }, [xAxis, yAxis, zAxis])

  return (
    <mesh position={center} quaternion={quaternion}>
      <boxGeometry args={size} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

function LayerLinks({
  layer,
  lowCenter,
  highCenter,
  layout,
  contactNodes,
  plateHalf,
  plankWidth,
}: {
  layer: LayerName
  lowCenter: Vec3
  highCenter: Vec3
  layout: CellLayout
  contactNodes: ContactNodeOverrides
  plateHalf: number
  plankWidth: number
}) {
  const layerAxis = normalizeVec(subtractVec(highCenter, lowCenter))

  return (
    <>
      {SIDE_NAMES.map((side) => {
        const sideVector = sideVectorFromLayout(layout, side)
        const node = contactNodes[layer][side] ?? sideNodePositionFromLayout(layout, layer, side)
        const widthHint = normalizeVec(crossVec(layerAxis, sideVector))
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
        return (
          <group key={`${layer}-${side}`}>
            <PlankSegment start={lowAnchor} end={node} width={plankWidth} thickness={0.044} widthHint={widthHint} color={linkageColor} />
            <PlankSegment start={node} end={highAnchor} width={plankWidth} thickness={0.044} widthHint={widthHint} color={linkageColor} />
          </group>
        )
      })}
    </>
  )
}

function makeOctagonalPlateGeometry(size: number, faceRatio: number, thickness: number): THREE.ExtrudeGeometry {
  const apothem = size / 2
  const halfLegSide = octagonHalfLegSide(size, faceRatio)
  const inset = apothem - halfLegSide
  const shape = new THREE.Shape([
    new THREE.Vector2(apothem, -halfLegSide),
    new THREE.Vector2(apothem, halfLegSide),
    new THREE.Vector2(halfLegSide, apothem),
    new THREE.Vector2(-halfLegSide, apothem),
    new THREE.Vector2(-apothem, halfLegSide),
    new THREE.Vector2(-apothem, -halfLegSide),
    new THREE.Vector2(-halfLegSide, -apothem),
    new THREE.Vector2(halfLegSide, -apothem),
  ])
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geometry.userData.legSideLength = halfLegSide * 2
  geometry.userData.chamferSideLength = Math.hypot(inset, inset)
  geometry.translate(0, 0, -thickness / 2)
  return geometry
}

function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function crossVec(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalizeVec(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  if (length <= 0.0001) return [0, 1, 0]
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scaleVec(vector: Vec3, scalar: number): Vec3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
}
