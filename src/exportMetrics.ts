import type { InverseSheetConfig, LatticeModel } from './inverseSheetTypes'
import { sanitizeInverseSheetConfig } from './latticeGeometry'

export function buildMetricsCsv(model: LatticeModel): string {
  const rows: string[][] = []

  rows.push(['section', 'metric', 'value'])
  Object.entries(model.summary).forEach(([metric, value]) => {
    rows.push(['global_summary', metric, formatNumber(value)])
  })

  rows.push([])
  rows.push(['section', 'edgeId', 'nodeA', 'nodeB', 'orientation', 'restLength', 'currentLength', 'strain', 'edgeRotationDeg', 'localCombinedCost'])
  model.edgeMetrics.forEach((metric) => {
    rows.push([
      'edge_metrics',
      metric.edgeId,
      metric.nodeA,
      metric.nodeB,
      metric.orientation,
      formatNumber(metric.restLength),
      formatNumber(metric.currentLength),
      formatNumber(metric.strain),
      formatNumber(metric.edgeRotationDeg),
      formatNumber(metric.localCombinedCost),
    ])
  })

  rows.push([])
  rows.push([
    'section',
    'nodeId',
    'row',
    'col',
    'restX',
    'restY',
    'restZ',
    'currentX',
    'currentY',
    'currentZ',
    'displacement',
    'rowBendDeg',
    'colBendDeg',
    'nodeBendDeg',
    'shearDeg',
    'localCombinedCost',
  ])
  model.nodeMetrics.forEach((metric) => {
    rows.push([
      'node_metrics',
      metric.nodeId,
      String(metric.row),
      String(metric.col),
      formatNumber(metric.restX),
      formatNumber(metric.restY),
      formatNumber(metric.restZ),
      formatNumber(metric.currentX),
      formatNumber(metric.currentY),
      formatNumber(metric.currentZ),
      formatNumber(metric.displacement),
      formatNullable(metric.rowBendDeg),
      formatNullable(metric.colBendDeg),
      formatNumber(metric.nodeBendDeg),
      formatNullable(metric.shearDeg),
      formatNumber(metric.localCombinedCost),
    ])
  })

  rows.push([])
  rows.push(['section', 'quadId', 'row', 'col', 'areaRatio', 'areaChange', 'normalRotationDeg', 'planarityError', 'localCombinedCost'])
  model.quadMetrics.forEach((metric) => {
    rows.push([
      'quad_metrics',
      metric.quadId,
      String(metric.row),
      String(metric.col),
      formatNumber(metric.areaRatio),
      formatNumber(metric.areaChange),
      formatNumber(metric.normalRotationDeg),
      formatNumber(metric.planarityError),
      formatNumber(metric.localCombinedCost),
    ])
  })

  rows.push([])
  rows.push(['section', 'pairId', 'quadA', 'quadB', 'sharedEdge', 'dihedralDeg', 'localCombinedCost'])
  model.dihedralMetrics.forEach((metric) => {
    rows.push([
      'dihedral_metrics',
      metric.pairId,
      metric.quadA,
      metric.quadB,
      metric.sharedEdge,
      formatNumber(metric.dihedralDeg),
      formatNumber(metric.localCombinedCost),
    ])
  })

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

export function buildConfigJson(config: InverseSheetConfig): string {
  return `${JSON.stringify(sanitizeInverseSheetConfig(config), null, 2)}\n`
}

export function parseConfigJson(text: string): InverseSheetConfig {
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config JSON must be an object.')
  }

  return sanitizeInverseSheetConfig(parsed as Record<string, unknown>)
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = href
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

function formatNullable(value: number | null): string {
  return value === null ? '' : formatNumber(value)
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(Math.round(value * 1_000_000) / 1_000_000)
}

function escapeCsvCell(cell: string): string {
  if (!/[",\n\r]/.test(cell)) return cell
  return `"${cell.replaceAll('"', '""')}"`
}
