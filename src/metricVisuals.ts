import type { EdgeMetric, LatticeModel, NodeMetric, QuadMetric } from './inverseSheetTypes'

export type LegendInfo = {
  label: string
  min: number
  max: number
  gradient: string
}

const NEUTRAL = '#f0ede7'
const BLUE = '#0638ff'
const CYAN = '#00c4ff'
const GREEN = '#49df43'
const YELLOW = '#fff233'
const RED = '#ef2400'
const ORANGE = '#f28a2e'

export function legendForMode(model: LatticeModel): LegendInfo {
  switch (model.config.colorMode) {
    case 'edgeStrain':
      return {
        label: 'local strain',
        min: 0,
        max: strainColorClamp(model),
        gradient: rainbowGradient(),
      }
    case 'edgeRotation':
      return { label: 'edge rotation deg', min: 0, max: Math.max(model.summary.maxEdgeRotationDeg, 1), gradient: heatGradient() }
    case 'nodeBend':
      return { label: 'node bend deg', min: 0, max: Math.max(model.summary.maxBendDeg, 1), gradient: heatGradient() }
    case 'shear':
      return { label: 'shear deg', min: 0, max: Math.max(model.summary.maxShearDeg, 1), gradient: heatGradient() }
    case 'dihedral':
      return { label: 'dihedral deg', min: 0, max: Math.max(model.summary.maxDihedralDeg, 1), gradient: heatGradient() }
    case 'areaChange':
      return { label: 'absolute area change', min: 0, max: Math.max(Math.abs(model.summary.maxAreaExpansion), Math.abs(model.summary.maxAreaCompression), 0.01), gradient: heatGradient() }
    case 'displacement':
      return { label: 'URES', min: 0, max: Math.max(model.summary.maxDisplacement, 0.01), gradient: rainbowGradient() }
    case 'combinedCost':
      return { label: 'local combined cost', min: 0, max: maxLocalCost(model), gradient: heatGradient() }
  }
}

export function colorForEdge(metric: EdgeMetric, model: LatticeModel): string {
  if (!model.config.showHeatmap) return '#5d554f'

  if (model.config.colorMode === 'edgeStrain') return rainbowColor(Math.abs(metric.strain), strainColorClamp(model))
  if (model.config.colorMode === 'edgeRotation') return heatColor(metric.edgeRotationDeg, Math.max(model.summary.maxEdgeRotationDeg, 1))
  if (model.config.colorMode === 'displacement') return rainbowColor(edgeDisplacement(metric, model), Math.max(model.summary.maxDisplacement, 0.01))
  if (model.config.colorMode === 'combinedCost') return heatColor(metric.localCombinedCost, maxLocalCost(model))
  return '#5d554f'
}

export function colorForNode(metric: NodeMetric, model: LatticeModel): string {
  if (!model.config.showHeatmap) return '#565f62'

  if (model.config.colorMode === 'nodeBend') return heatColor(metric.nodeBendDeg, Math.max(model.summary.maxBendDeg, 1))
  if (model.config.colorMode === 'shear') return heatColor(metric.shearDeg ?? 0, Math.max(model.summary.maxShearDeg, 1))
  if (model.config.colorMode === 'displacement') return rainbowColor(metric.displacement, Math.max(model.summary.maxDisplacement, 0.01))
  if (model.config.colorMode === 'combinedCost') return heatColor(metric.localCombinedCost, maxLocalCost(model))
  return '#565f62'
}

export function colorForQuad(metric: QuadMetric, model: LatticeModel, dihedralContribution = 0): string {
  if (!model.config.showHeatmap) return '#f7efe4'

  if (model.config.colorMode === 'edgeStrain') {
    return rainbowColor(quadBoundaryStrain(metric, model), strainColorClamp(model))
  }

  if (model.config.colorMode === 'areaChange') {
    return heatColor(Math.abs(metric.areaChange), Math.max(Math.abs(model.summary.maxAreaExpansion), Math.abs(model.summary.maxAreaCompression), 0.01))
  }

  if (model.config.colorMode === 'dihedral') {
    return heatColor(dihedralContribution, Math.max(model.summary.maxDihedralDeg, 1))
  }

  if (model.config.colorMode === 'displacement') {
    return rainbowColor(quadDisplacement(metric, model), Math.max(model.summary.maxDisplacement, 0.01))
  }

  if (model.config.colorMode === 'combinedCost') return heatColor(metric.localCombinedCost, maxLocalCost(model))
  return '#f7efe4'
}

function heatColor(value: number, max: number): string {
  const t = Math.min(Math.max(value / Math.max(max, 0.000001), 0), 1)
  return t < 0.65 ? mixHex(NEUTRAL, ORANGE, t / 0.65) : mixHex(ORANGE, RED, (t - 0.65) / 0.35)
}

function rainbowColor(value: number, max: number): string {
  const t = Math.min(Math.max(value / Math.max(max, 0.000001), 0), 1)
  if (t < 0.25) return mixHex(BLUE, CYAN, t / 0.25)
  if (t < 0.5) return mixHex(CYAN, GREEN, (t - 0.25) / 0.25)
  if (t < 0.75) return mixHex(GREEN, YELLOW, (t - 0.5) / 0.25)
  return mixHex(YELLOW, RED, (t - 0.75) / 0.25)
}

function heatGradient(): string {
  return `linear-gradient(90deg, ${NEUTRAL}, ${ORANGE}, ${RED})`
}

function rainbowGradient(): string {
  return `linear-gradient(0deg, ${BLUE} 0%, ${CYAN} 25%, ${GREEN} 50%, ${YELLOW} 75%, ${RED} 100%)`
}

function strainColorClamp(model: LatticeModel): number {
  return Math.max(
    Math.abs(model.summary.maxTensileStrain),
    Math.abs(model.summary.maxCompressiveStrain),
    0.01,
  )
}

function maxLocalCost(model: LatticeModel): number {
  const values = [
    ...model.edgeMetrics.map((metric) => metric.localCombinedCost),
    ...model.nodeMetrics.map((metric) => metric.localCombinedCost),
    ...model.quadMetrics.map((metric) => metric.localCombinedCost),
    ...model.dihedralMetrics.map((metric) => metric.localCombinedCost),
  ]
  return Math.max(...values, 0.000001)
}

function edgeDisplacement(metric: EdgeMetric, model: LatticeModel): number {
  const nodeA = model.nodeMetrics.find((nodeMetric) => nodeMetric.nodeId === metric.nodeA)
  const nodeB = model.nodeMetrics.find((nodeMetric) => nodeMetric.nodeId === metric.nodeB)
  return ((nodeA?.displacement ?? 0) + (nodeB?.displacement ?? 0)) * 0.5
}

function quadDisplacement(metric: QuadMetric, model: LatticeModel): number {
  const quad = model.quads.find((candidate) => candidate.id === metric.quadId)
  if (!quad) return 0

  const displacements = quad.nodeIds.map((nodeId) => model.nodeMetrics.find((nodeMetric) => nodeMetric.nodeId === nodeId)?.displacement ?? 0)
  return displacements.reduce((sum, value) => sum + value, 0) / displacements.length
}

function quadBoundaryStrain(metric: QuadMetric, model: LatticeModel): number {
  const edgeIds = [
    `e-h-${metric.row}-${metric.col}`,
    `e-h-${metric.row + 1}-${metric.col}`,
    `e-v-${metric.row}-${metric.col}`,
    `e-v-${metric.row}-${metric.col + 1}`,
  ]
  return edgeIds.reduce((max, edgeId) => {
    const edgeMetric = model.edgeMetrics.find((candidate) => candidate.edgeId === edgeId)
    return Math.max(max, Math.abs(edgeMetric?.strain ?? 0))
  }, 0)
}

function mixHex(a: string, b: string, t: number): string {
  const start = hexToRgb(a)
  const end = hexToRgb(b)
  const mix = start.map((channel, index) => Math.round(channel + (end[index] - channel) * t))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ]
}
