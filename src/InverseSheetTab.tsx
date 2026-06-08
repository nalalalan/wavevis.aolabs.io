import { useMemo, useState, type ReactNode } from 'react'
import DeformationMetricsPanel from './DeformationMetricsPanel'
import { buildConfigJson, buildMetricsCsv, downloadTextFile, parseConfigJson } from './exportMetrics'
import LatticeViewer3D from './LatticeViewer3D'
import { buildInverseSheetModel, DEFAULT_INVERSE_SHEET_CONFIG, sanitizeInverseSheetConfig } from './latticeGeometry'
import SimulatorTabs, { type SimulatorTab } from './SimulatorTabs'
import TargetShapeControls from './TargetShapeControls'
import type { CameraFocusRequest, CameraView, CameraViewRequest, InverseSheetConfig, LatticeModel, SelectedElement, Vec3 } from './inverseSheetTypes'
import WorstElementsPanel from './WorstElementsPanel'

type InverseSheetTabProps = {
  activeTab: SimulatorTab
  onTabChange: (tab: SimulatorTab) => void
  resizeHandle: ReactNode
}

export default function InverseSheetTab({ activeTab, onTabChange, resizeHandle }: InverseSheetTabProps) {
  const [config, setConfig] = useState<InverseSheetConfig>(() => readInitialInverseSheetConfig())
  const [selected, setSelected] = useState<SelectedElement>(null)
  const [pickedEdges, setPickedEdges] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [viewRequest, setViewRequest] = useState<CameraViewRequest>(() => ({ view: readInitialInverseSheetView(), version: 0 }))
  const [focusRequest, setFocusRequest] = useState<CameraFocusRequest>({ selected: null, version: 0 })
  const model = useMemo(() => buildInverseSheetModel(config), [config])

  const updateConfig = (next: InverseSheetConfig) => {
    setConfig(sanitizeInverseSheetConfig(next))
    setStatus(null)
  }

  const resetDefaults = () => {
    setConfig(DEFAULT_INVERSE_SHEET_CONFIG)
    setSelected(null)
    setPickedEdges([])
    setStatus('Defaults restored.')
  }

  const requestView = (view: CameraView) => {
    setViewRequest((current) => ({ view, version: current.version + 1 }))
  }

  const exportCsv = () => {
    downloadTextFile('wavevis-inverse-sheet-metrics.csv', buildMetricsCsv(model), 'text/csv;charset=utf-8')
    setStatus('Metrics CSV exported.')
  }

  const exportJson = () => {
    downloadTextFile('wavevis-inverse-sheet-config.json', buildConfigJson(config), 'application/json;charset=utf-8')
    setStatus('Config JSON exported.')
  }

  const importConfig = (text: string) => {
    try {
      setConfig(parseConfigJson(text))
      setSelected(null)
      setPickedEdges([])
      setStatus('Config JSON imported and clamped.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Config import failed.')
    }
  }

  const pickEdge = (edgeId: string) => {
    setSelected({ kind: 'edge', id: edgeId })
    setPickedEdges((current) => [...current.filter((id) => id !== edgeId), edgeId].slice(-2))
    setStatus(null)
  }

  const focusWorstElement = (next: SelectedElement) => {
    setSelected(next)
    setPickedEdges((current) => {
      if (next?.kind !== 'edge') return []
      return [...current.filter((id) => id !== next.id), next.id].slice(-2)
    })
    setFocusRequest((current) => ({ selected: next, version: current.version + 1 }))
  }

  return (
    <>
      <aside className="control-panel inverse-panel">
        <header className="panel-header">
          <div className="brand-row">
            <span className="ao-dot" aria-hidden="true">
              ao
            </span>
            <img className="app-mark" src="./favicon.svg" alt="" aria-hidden="true" />
            <h1>wavevis.aolabs.io</h1>
          </div>
          <p>inverse deformation sheet</p>
          <a className="proof-link" href="./proofs/connector-contact-constraint-proof.pdf" target="_blank" rel="noreferrer">
            constraint proof PDF
          </a>
        </header>

        <SimulatorTabs activeTab={activeTab} onTabChange={onTabChange} />

        <TargetShapeControls
          config={config}
          onConfigChange={updateConfig}
          onRun={() => {
            setConfig((current) => sanitizeInverseSheetConfig(current))
            setStatus('Inverse sheet updated.')
          }}
          onReset={resetDefaults}
          onView={requestView}
          onExportCsv={exportCsv}
          onExportJson={exportJson}
          onImportConfigText={importConfig}
        />
        {status && <p className="control-status">{status}</p>}
        <EdgePickPanel model={model} pickedEdges={pickedEdges} />
        <DeformationMetricsPanel summary={model.summary} />
        <WorstElementsPanel model={model} selected={selected} onSelect={focusWorstElement} />
      </aside>
      {resizeHandle}
      <LatticeViewer3D
        model={model}
        selected={selected}
        pickedEdges={pickedEdges}
        viewRequest={viewRequest}
        focusRequest={focusRequest}
        onEdgePick={pickEdge}
      />
    </>
  )
}

function readInitialInverseSheetConfig(): InverseSheetConfig {
  if (typeof window === 'undefined') return DEFAULT_INVERSE_SHEET_CONFIG

  const search = new URLSearchParams(window.location.search)
  const config: Partial<InverseSheetConfig> = {}
  readIntegerConfigParam(search, config, 'rows', 'rows', 2, 72)
  readIntegerConfigParam(search, config, 'cols', 'columns', 2, 120)
  readIntegerConfigParam(search, config, 'columns', 'columns', 2, 120)
  readNumberConfigParam(search, config, 'morph', 'morph')
  readNumberConfigParam(search, config, 'height', 'height')
  readNumberConfigParam(search, config, 'overhang', 'horizontalOffset')
  readNumberConfigParam(search, config, 'horizontalOffset', 'horizontalOffset')
  readNumberConfigParam(search, config, 'position', 'overhangPosition')
  readNumberConfigParam(search, config, 'overhangPosition', 'overhangPosition')
  readNumberConfigParam(search, config, 'steer', 'steer')
  readNumberConfigParam(search, config, 'steerYaw', 'steer')
  readNumberConfigParam(search, config, 'lipDip', 'overhangAngleDeg')
  readNumberConfigParam(search, config, 'overhangAngleDeg', 'overhangAngleDeg')
  readNumberConfigParam(search, config, 'width', 'overhangWidth')
  readNumberConfigParam(search, config, 'overhangWidth', 'overhangWidth')
  readNumberConfigParam(search, config, 'lipSharpness', 'lipSharpness')
  readNumberConfigParam(search, config, 'groundTransition', 'smoothing')
  readNumberConfigParam(search, config, 'smoothing', 'smoothing')
  readNumberConfigParam(search, config, 'wallSmoothness', 'wallSmoothness')
  readNumberConfigParam(search, config, 'flatContribution', 'flatContribution')

  return sanitizeInverseSheetConfig(config)
}

function readInitialInverseSheetView(): CameraView {
  if (typeof window === 'undefined') return 'isometric'
  const view = new URLSearchParams(window.location.search).get('view')
  return view === 'side' || view === 'slice' || view === 'top' || view === 'isometric' ? view : 'isometric'
}

function readNumberConfigParam<Key extends keyof InverseSheetConfig>(
  search: URLSearchParams,
  config: Partial<InverseSheetConfig>,
  param: string,
  key: Key,
): void {
  if (!search.has(param)) return
  const value = Number(search.get(param))
  if (Number.isFinite(value)) {
    config[key] = value as InverseSheetConfig[Key]
  }
}

function readIntegerConfigParam<Key extends keyof InverseSheetConfig>(
  search: URLSearchParams,
  config: Partial<InverseSheetConfig>,
  param: string,
  key: Key,
  min: number,
  max: number,
): void {
  if (!search.has(param)) return
  const value = Number(search.get(param))
  if (Number.isFinite(value)) {
    config[key] = Math.min(max, Math.max(min, Math.round(value))) as InverseSheetConfig[Key]
  }
}

function EdgePickPanel({ model, pickedEdges }: { model: LatticeModel; pickedEdges: string[] }) {
  const details = pickedEdges
    .map((edgeId) => {
      const edge = model.edges.find((candidate) => candidate.id === edgeId)
      const metric = model.edgeMetrics.find((candidate) => candidate.edgeId === edgeId)
      if (!edge || !metric) return null

      const nodeA = model.nodes.find((node) => node.id === edge.nodeA)
      const nodeB = model.nodes.find((node) => node.id === edge.nodeB)
      const label = nodeA && nodeB ? `(${nodeA.row},${nodeA.col}) to (${nodeB.row},${nodeB.col})` : `${edge.nodeA} to ${edge.nodeB}`

      return { edge, metric, label }
    })
    .filter(Boolean) as Array<{
    edge: LatticeModel['edges'][number]
    metric: LatticeModel['edgeMetrics'][number]
    label: string
  }>

  if (!details.length) return null

  const angle =
    details.length === 2
      ? edgeAngle(model, details[0].edge.id, details[1].edge.id)
      : null

  return (
    <section className="panel-section edge-pick-panel">
      <div className="section-heading">
        <h2>picked edges</h2>
        {angle !== null && <span>angle {formatAngle(angle)}</span>}
      </div>
      <div className="edge-pick-list">
        {details.map((detail, index) => (
          <div key={detail.edge.id} className={index === 0 ? 'edge-pick-row first' : 'edge-pick-row second'}>
            <span>{detail.label}</span>
            <strong>{formatPercent(detail.metric.strain)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function edgeAngle(model: LatticeModel, edgeAId: string, edgeBId: string): number | null {
  const edgeA = model.edges.find((edge) => edge.id === edgeAId)
  const edgeB = model.edges.find((edge) => edge.id === edgeBId)
  if (!edgeA || !edgeB) return null

  const vectorA = edgeVector(model, edgeA.nodeA, edgeA.nodeB)
  const vectorB = edgeVector(model, edgeB.nodeA, edgeB.nodeB)
  const lengthProduct = lengthVec(vectorA) * lengthVec(vectorB)
  if (lengthProduct <= 0.000001) return null

  const cosine = Math.min(1, Math.max(-1, dotVec(vectorA, vectorB) / lengthProduct))
  return (Math.acos(cosine) * 180) / Math.PI
}

function edgeVector(model: LatticeModel, nodeAId: string, nodeBId: string): Vec3 {
  const nodeA = model.nodes.find((node) => node.id === nodeAId)
  const nodeB = model.nodes.find((node) => node.id === nodeBId)
  if (!nodeA || !nodeB) return [0, 0, 0]
  return [
    nodeB.currentPosition[0] - nodeA.currentPosition[0],
    nodeB.currentPosition[1] - nodeA.currentPosition[1],
    nodeB.currentPosition[2] - nodeA.currentPosition[2],
  ]
}

function lengthVec(vector: Vec3): number {
  return Math.hypot(vector[0], vector[1], vector[2])
}

function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  const percent = value * 100
  const sign = percent > 0 ? '+' : ''
  const kind = value >= 0 ? 'tensile' : 'compressive'
  return `${kind} ${sign}${percent.toFixed(1).replace(/\.0$/, '')}%`
}

function formatAngle(value: number): string {
  if (!Number.isFinite(value)) return '0 deg'
  return `${value.toFixed(1).replace(/\.0$/, '')} deg`
}
