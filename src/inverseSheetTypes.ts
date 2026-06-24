export type Vec3 = [number, number, number]

export type TargetPreset = 'overhang'
export type RadiusMode = 'autoPreserveLength' | 'manual'
export type VerticalDirection = 'up' | 'down'
export type ProfileMode = 'custom' | 'generated'

export type ColorMode =
  | 'edgeStrain'
  | 'edgeRotation'
  | 'nodeBend'
  | 'shear'
  | 'dihedral'
  | 'areaChange'
  | 'displacement'
  | 'combinedCost'

export type LatticeParams = {
  rows: number
  columns: number
  spacing: number
  morph: number
}

export type TargetParams = {
  targetPreset: TargetPreset
  verticalDirection: VerticalDirection
  bendAngleDeg: number
  supportFraction: number
  radiusMode: RadiusMode
  bendRadius: number
  horizontalOffset: number
  overhangPosition: number
  steer: number
  height: number
  overhangWidth: number
  overhangAngleDeg: number
  conicRho: number
  curlRadius: number
  profileMode: ProfileMode
  profilePoints: string
  sectionPoints: string
  profileScale: number
  xySliceLevel: number
  smoothing: number
  lipSharpness: number
  wallSmoothness: number
  flatContribution: number
  widthScale: number
  strainWeight: number
  bendWeight: number
  shearWeight: number
  dihedralWeight: number
  showSurface: boolean
  showRestGhost: boolean
  showNodes: boolean
  showEdges: boolean
  showLabels: boolean
  showHeatmap: boolean
  colorMode: ColorMode
}

export type InverseSheetConfig = LatticeParams & TargetParams

export type LatticeNode = {
  id: string
  row: number
  col: number
  restPosition: Vec3
  targetPosition: Vec3
  currentPosition: Vec3
}

export type LatticeEdge = {
  id: string
  nodeA: string
  nodeB: string
  orientation: 'horizontal' | 'vertical'
}

export type LatticeQuad = {
  id: string
  row: number
  col: number
  nodeIds: [string, string, string, string]
}

export type DihedralPair = {
  id: string
  quadA: string
  quadB: string
  sharedEdge: string
}

export type EdgeMetric = {
  edgeId: string
  nodeA: string
  nodeB: string
  orientation: 'horizontal' | 'vertical'
  restLength: number
  currentLength: number
  strain: number
  edgeRotationDeg: number
  localCombinedCost: number
}

export type NodeMetric = {
  nodeId: string
  row: number
  col: number
  restX: number
  restY: number
  restZ: number
  currentX: number
  currentY: number
  currentZ: number
  displacement: number
  rowBendDeg: number | null
  colBendDeg: number | null
  nodeBendDeg: number
  shearDeg: number | null
  localCombinedCost: number
}

export type QuadMetric = {
  quadId: string
  row: number
  col: number
  areaRatio: number
  areaChange: number
  normalRotationDeg: number
  planarityError: number
  localCombinedCost: number
}

export type DihedralMetric = {
  pairId: string
  quadA: string
  quadB: string
  sharedEdge: string
  dihedralDeg: number
  localCombinedCost: number
}

export type MetricsSummary = {
  maxTensileStrain: number
  maxCompressiveStrain: number
  meanAbsStrain: number
  rmsStrain: number
  maxEdgeRotationDeg: number
  meanEdgeRotationDeg: number
  maxBendDeg: number
  meanBendDeg: number
  maxShearDeg: number
  meanShearDeg: number
  maxAreaExpansion: number
  maxAreaCompression: number
  meanAbsAreaChange: number
  maxNormalRotationDeg: number
  meanNormalRotationDeg: number
  maxPlanarityError: number
  overhangAmount: number
  maxHeight: number
  maxDihedralDeg: number
  meanDihedralDeg: number
  maxDisplacement: number
  meanDisplacement: number
  combinedCost: number
}

export type LatticeBounds = {
  min: Vec3
  max: Vec3
  center: Vec3
  span: Vec3
}

export type LatticeModel = {
  config: InverseSheetConfig
  nodes: LatticeNode[]
  edges: LatticeEdge[]
  quads: LatticeQuad[]
  dihedralPairs: DihedralPair[]
  edgeMetrics: EdgeMetric[]
  nodeMetrics: NodeMetric[]
  quadMetrics: QuadMetric[]
  dihedralMetrics: DihedralMetric[]
  summary: MetricsSummary
  bounds: LatticeBounds
}

export type SelectedElement =
  | { kind: 'edge'; id: string }
  | { kind: 'node'; id: string }
  | { kind: 'quad'; id: string }
  | { kind: 'dihedral'; id: string }
  | null

export type CameraView = 'isometric' | 'top' | 'side' | 'front'

export type CameraViewRequest = {
  view: CameraView
  version: number
}

export type CameraFocusRequest = {
  selected: SelectedElement
  version: number
}
