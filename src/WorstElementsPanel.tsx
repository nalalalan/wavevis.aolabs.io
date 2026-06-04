import type { EdgeMetric, LatticeModel, NodeMetric, QuadMetric, SelectedElement } from './inverseSheetTypes'

type WorstElementsPanelProps = {
  model: LatticeModel
  selected: SelectedElement
  onSelect: (next: SelectedElement) => void
}

type WorstRow = {
  key: string
  label: string
  value: number
  detail: string
  selection: NonNullable<SelectedElement>
}

type WorstGroup = {
  title: string
  rows: WorstRow[]
}

export default function WorstElementsPanel({ model, selected, onSelect }: WorstElementsPanelProps) {
  const groups = buildWorstGroups(model)
  const detail = selected ? selectedDetail(model, selected) : null

  return (
    <section className="panel-section worst-panel">
      <div className="section-heading">
        <h2>worst elements</h2>
        <span>top 10</span>
      </div>
      {detail && (
        <div className="selected-readout">
          <strong>{detail.title}</strong>
          <span>{detail.body}</span>
        </div>
      )}
      <div className="worst-groups">
        {groups.map((group, index) => (
          <details key={group.title} open={index < 2}>
            <summary>{group.title}</summary>
            <div className="worst-table" role="table" aria-label={group.title}>
              {group.rows.map((row) => {
                const isSelected = selected?.kind === row.selection.kind && selected.id === row.selection.id

                return (
                  <button
                    type="button"
                    key={row.key}
                    className={isSelected ? 'worst-row selected' : 'worst-row'}
                    onClick={() => onSelect(row.selection)}
                  >
                    <span>{row.label}</span>
                    <strong>{formatValue(row.value)}</strong>
                    <small>{row.detail}</small>
                  </button>
                )
              })}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function buildWorstGroups(model: LatticeModel): WorstGroup[] {
  return [
    {
      title: 'tensile strain edges',
      rows: topEdges(model.edgeMetrics, (metric) => metric.strain, true).map((metric) => edgeRow(metric, metric.strain, model)),
    },
    {
      title: 'compressive strain edges',
      rows: topEdges(model.edgeMetrics, (metric) => metric.strain, false).map((metric) => edgeRow(metric, metric.strain, model)),
    },
    {
      title: 'edge rotation',
      rows: topEdges(model.edgeMetrics, (metric) => metric.edgeRotationDeg, true).map((metric) => edgeRow(metric, metric.edgeRotationDeg, model)),
    },
    {
      title: 'bend nodes',
      rows: topNodes(model.nodeMetrics, (metric) => metric.nodeBendDeg).map((metric) => nodeRow(metric, metric.nodeBendDeg)),
    },
    {
      title: 'shear nodes',
      rows: topNodes(model.nodeMetrics, (metric) => metric.shearDeg ?? 0).map((metric) => nodeRow(metric, metric.shearDeg ?? 0)),
    },
    {
      title: 'dihedral folds',
      rows: [...model.dihedralMetrics]
        .sort((a, b) => b.dihedralDeg - a.dihedralDeg)
        .slice(0, 10)
        .map((metric) => ({
          key: metric.pairId,
          label: metric.pairId,
          value: metric.dihedralDeg,
          detail: `${metric.quadA} / ${metric.quadB}`,
          selection: { kind: 'dihedral', id: metric.pairId },
        })),
    },
    {
      title: 'area-change quads',
      rows: [...model.quadMetrics]
        .sort((a, b) => Math.abs(b.areaChange) - Math.abs(a.areaChange))
        .slice(0, 10)
        .map((metric) => quadRow(metric, Math.abs(metric.areaChange))),
    },
  ]
}

function topEdges(metrics: EdgeMetric[], value: (metric: EdgeMetric) => number, descending: boolean): EdgeMetric[] {
  return [...metrics]
    .sort((a, b) => (descending ? value(b) - value(a) : value(a) - value(b)))
    .slice(0, 10)
}

function topNodes(metrics: NodeMetric[], value: (metric: NodeMetric) => number): NodeMetric[] {
  return [...metrics].sort((a, b) => value(b) - value(a)).slice(0, 10)
}

function edgeRow(metric: EdgeMetric, value: number, model: LatticeModel): WorstRow {
  const nodeA = model.nodes.find((node) => node.id === metric.nodeA)
  const nodeB = model.nodes.find((node) => node.id === metric.nodeB)
  const detail = nodeA && nodeB ? `(${nodeA.row},${nodeA.col}) to (${nodeB.row},${nodeB.col})` : `${metric.nodeA} to ${metric.nodeB}`

  return {
    key: metric.edgeId,
    label: metric.edgeId,
    value,
    detail,
    selection: { kind: 'edge', id: metric.edgeId },
  }
}

function nodeRow(metric: NodeMetric, value: number): WorstRow {
  return {
    key: metric.nodeId,
    label: metric.nodeId,
    value,
    detail: `row ${metric.row}, col ${metric.col}`,
    selection: { kind: 'node', id: metric.nodeId },
  }
}

function quadRow(metric: QuadMetric, value: number): WorstRow {
  return {
    key: metric.quadId,
    label: metric.quadId,
    value,
    detail: `row ${metric.row}, col ${metric.col}`,
    selection: { kind: 'quad', id: metric.quadId },
  }
}

function selectedDetail(model: LatticeModel, selected: NonNullable<SelectedElement>): { title: string; body: string } | null {
  if (selected.kind === 'edge') {
    const metric = model.edgeMetrics.find((edge) => edge.edgeId === selected.id)
    if (!metric) return null
    return {
      title: `${metric.edgeId} edge`,
      body: `${strainLabel(metric.strain)}, rotation ${formatValue(metric.edgeRotationDeg)} deg, length ${formatValue(metric.currentLength)}.`,
    }
  }

  if (selected.kind === 'node') {
    const metric = model.nodeMetrics.find((node) => node.nodeId === selected.id)
    if (!metric) return null
    return {
      title: `${metric.nodeId} node`,
      body: `bend ${formatValue(metric.nodeBendDeg)} deg, shear ${formatValue(metric.shearDeg ?? 0)} deg, displacement ${formatValue(metric.displacement)}.`,
    }
  }

  if (selected.kind === 'quad') {
    const metric = model.quadMetrics.find((quad) => quad.quadId === selected.id)
    if (!metric) return null
    return {
      title: `${metric.quadId} quad`,
      body: `area change ${formatValue(metric.areaChange)}, normal rotation ${formatValue(metric.normalRotationDeg)} deg, planarity ${formatValue(metric.planarityError)}.`,
    }
  }

  const metric = model.dihedralMetrics.find((dihedral) => dihedral.pairId === selected.id)
  if (!metric) return null
  return {
    title: `${metric.pairId} fold`,
    body: `dihedral ${formatValue(metric.dihedralDeg)} deg across ${metric.sharedEdge}.`,
  }
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(Math.abs(value) < 1 ? 4 : 2).replace(/0+$/, '').replace(/\.$/, '')
}

function strainLabel(value: number): string {
  if (!Number.isFinite(value)) return 'strain 0'
  const kind = value >= 0 ? 'tensile strain' : 'compressive strain'
  return `${kind} ${formatValue(value)}`
}
