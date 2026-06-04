import type { EdgeMetric, LatticeModel, NodeMetric, QuadMetric } from './inverseSheetTypes'

export type LegendInfo = {
  label: string
  min: number
  max: number
  gradient: string
}

const NEUTRAL = '#f0ede7'
const BLUE = '#2f74d0'
const ORANGE = '#f28a2e'
const RED = '#d95757'

export function legendForMode(model: LatticeModel): LegendInfo {
  switch (model.config.colorMode) {
    case 'edgeStrain':
      return { label: 'edge strain', min: -0.25, max: 0.25, gradient: `linear-gradient(90deg, ${BLUE}, ${NEUTRAL}, ${RED})` }
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
      return { label: 'node displacement', min: 0, max: Math.max(model.summary.maxDisplacement, 0.01), gradient: heatGradient() }
    case 'combinedCost':
      return { label: 'local combined cost', min: 0, max: maxLocalCost(model), gradient: heatGradient() }
  }
}

export function colorForEdge(metric: EdgeMetric, model: LatticeModel): string {
  if (!model.config.showHeatmap) return '#7d766d'

  if (model.config.colorMode === 'edgeStrain') return signedColor(metric.strain, 0.25)
  if (model.config.colorMode === 'edgeRotation') return heatColor(metric.edgeRotationDeg, Math.max(model.summary.maxEdgeRotationDeg, 1))
  if (model.config.colorMode === 'combinedCost') return heatColor(metric.localCombinedCost, maxLocalCost(model))
  return '#7d766d'
}

export function colorForNode(metric: NodeMetric, model: LatticeModel): string {
  if (!model.config.showHeatmap) return '#f2f1ee'

  if (model.config.colorMode === 'nodeBend') return heatColor(metric.nodeBendDeg, Math.max(model.summary.maxBendDeg, 1))
  if (model.config.colorMode === 'shear') return heatColor(metric.shearDeg ?? 0, Math.max(model.summary.maxShearDeg, 1))
  if (model.config.colorMode === 'displacement') return heatColor(metric.displacement, Math.max(model.summary.maxDisplacement, 0.01))
  if (model.config.colorMode === 'combinedCost') return heatColor(metric.localCombinedCost, maxLocalCost(model))
  return '#f2f1ee'
}

export function colorForQuad(metric: QuadMetric, model: LatticeModel, dihedralContribution = 0): string {
  if (!model.config.showHeatmap) return '#f7efe4'

  if (model.config.colorMode === 'areaChange') {
    return heatColor(Math.abs(metric.areaChange), Math.max(Math.abs(model.summary.maxAreaExpansion), Math.abs(model.summary.maxAreaCompression), 0.01))
  }

  if (model.config.colorMode === 'dihedral') {
    return heatColor(dihedralContribution, Math.max(model.summary.maxDihedralDeg, 1))
  }

  if (model.config.colorMode === 'combinedCost') return heatColor(metric.localCombinedCost, maxLocalCost(model))
  return '#f7efe4'
}

function signedColor(value: number, clamp: number): string {
  const safeClamp = Math.max(clamp, 0.000001)
  if (value < 0) return mixHex(NEUTRAL, BLUE, Math.min(Math.abs(value) / safeClamp, 1))
  return mixHex(NEUTRAL, RED, Math.min(value / safeClamp, 1))
}

function heatColor(value: number, max: number): string {
  const t = Math.min(Math.max(value / Math.max(max, 0.000001), 0), 1)
  return t < 0.65 ? mixHex(NEUTRAL, ORANGE, t / 0.65) : mixHex(ORANGE, RED, (t - 0.65) / 0.35)
}

function heatGradient(): string {
  return `linear-gradient(90deg, ${NEUTRAL}, ${ORANGE}, ${RED})`
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
