import { useMemo, useState, type ReactNode } from 'react'
import ColorLegend from './ColorLegend'
import DeformationMetricsPanel from './DeformationMetricsPanel'
import { buildConfigJson, buildMetricsCsv, downloadTextFile, parseConfigJson } from './exportMetrics'
import LatticeViewer3D from './LatticeViewer3D'
import { buildInverseSheetModel, DEFAULT_INVERSE_SHEET_CONFIG, sanitizeInverseSheetConfig } from './latticeGeometry'
import SimulatorTabs, { type SimulatorTab } from './SimulatorTabs'
import TargetShapeControls from './TargetShapeControls'
import type { CameraView, CameraViewRequest, InverseSheetConfig, SelectedElement } from './inverseSheetTypes'
import WorstElementsPanel from './WorstElementsPanel'

type InverseSheetTabProps = {
  activeTab: SimulatorTab
  onTabChange: (tab: SimulatorTab) => void
  resizeHandle: ReactNode
}

export default function InverseSheetTab({ activeTab, onTabChange, resizeHandle }: InverseSheetTabProps) {
  const [config, setConfig] = useState<InverseSheetConfig>(() => DEFAULT_INVERSE_SHEET_CONFIG)
  const [selected, setSelected] = useState<SelectedElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [viewRequest, setViewRequest] = useState<CameraViewRequest>({ view: 'isometric', version: 0 })
  const model = useMemo(() => buildInverseSheetModel(config), [config])

  const updateConfig = (next: InverseSheetConfig) => {
    setConfig(sanitizeInverseSheetConfig(next))
    setStatus(null)
  }

  const resetDefaults = () => {
    setConfig(DEFAULT_INVERSE_SHEET_CONFIG)
    setSelected(null)
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
      setStatus('Config JSON imported and clamped.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Config import failed.')
    }
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
        <ColorLegend model={model} />
        <DeformationMetricsPanel summary={model.summary} />
        <WorstElementsPanel model={model} selected={selected} onSelect={setSelected} />
      </aside>
      {resizeHandle}
      <LatticeViewer3D model={model} selected={selected} viewRequest={viewRequest} />
    </>
  )
}
