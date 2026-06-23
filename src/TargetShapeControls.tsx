import { useState } from 'react'
import type { CameraView, InverseSheetConfig } from './inverseSheetTypes'
import { getInverseSheetUsableRanges } from './latticeGeometry'

type TargetShapeControlsProps = {
  config: InverseSheetConfig
  currentView: CameraView
  onConfigChange: (next: InverseSheetConfig) => void
  onRun: () => void
  onReset: () => void
  onView: (view: CameraView) => void
  onExportCsv: () => void
  onExportJson: () => void
  onImportConfigText: (text: string) => void
}

type NumberKey =
  | 'rows'
  | 'columns'
  | 'morph'
  | 'horizontalOffset'
  | 'overhangPosition'
  | 'steer'
  | 'height'
  | 'overhangWidth'
  | 'overhangAngleDeg'
  | 'profileScale'
  | 'smoothing'
  | 'lipSharpness'
  | 'wallSmoothness'
  | 'flatContribution'
type BooleanKey = 'showSurface' | 'showRestGhost' | 'showNodes' | 'showEdges'

export default function TargetShapeControls({
  config,
  currentView,
  onConfigChange,
  onRun,
  onReset,
  onView,
  onExportCsv,
  onExportJson,
  onImportConfigText,
}: TargetShapeControlsProps) {
  const update = (patch: Partial<InverseSheetConfig>) => {
    onConfigChange(clampToUsableRanges({ ...config, ...patch }))
  }

  const setNumber = (key: NumberKey, value: number) => {
    update({ [key]: value } as Partial<InverseSheetConfig>)
  }

  const setBoolean = (key: BooleanKey, value: boolean) => {
    update({ [key]: value })
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    onImportConfigText(await file.text())
  }

  return (
    <>
      <section className="panel-section">
        <div className="section-heading">
          <h2>basic</h2>
        </div>
        <div className="two-col">
          <NumberInput label="rows" value={config.rows} min={2} max={72} step={1} onChange={(value) => setNumber('rows', value)} />
          <NumberInput label="columns" value={config.columns} min={112} max={120} step={1} onChange={(value) => setNumber('columns', value)} />
        </div>

        <div className="view-buttons">
          <button type="button" className={currentView === 'isometric' ? 'secondary active' : 'secondary'} aria-pressed={currentView === 'isometric'} onClick={() => onView('isometric')}>
            3D
          </button>
          <button type="button" className={currentView === 'top' ? 'secondary active' : 'secondary'} aria-pressed={currentView === 'top'} onClick={() => onView('top')}>
            Top
          </button>
          <button type="button" className={currentView === 'side' ? 'secondary active' : 'secondary'} aria-pressed={currentView === 'side'} onClick={() => onView('side')}>
            Side
          </button>
        </div>

        <div className="slider-stack">
          <RangeInput label="scale" value={config.profileScale} min={0.35} max={1.55} step={0.01} onChange={(value) => setNumber('profileScale', value)} />
          <RangeInput label="morph" value={config.morph} min={0} max={1} step={0.01} onChange={(value) => setNumber('morph', value)} />
          <RangeInput label="position" value={config.overhangPosition} min={-1} max={1} step={0.01} onChange={(value) => setNumber('overhangPosition', value)} />
          <RangeInput label="steer" value={config.steer} min={-1} max={1} step={0.01} onChange={(value) => setNumber('steer', value)} />
        </div>

        <button type="button" className="primary compact-primary" onClick={onRun}>
          Run / Update
        </button>

        <div className="display-mode-group" aria-label="result display">
          <span>results display</span>
          <div className="segmented-buttons">
            <button type="button" className={!config.showHeatmap ? 'active' : ''} onClick={() => update({ showHeatmap: false })}>
              off
            </button>
            <button
              type="button"
              className={config.showHeatmap && config.colorMode === 'edgeStrain' ? 'active' : ''}
              onClick={() => update({ showHeatmap: true, colorMode: 'edgeStrain' })}
            >
              local strain
            </button>
            <button
              type="button"
              className={config.showHeatmap && config.colorMode === 'displacement' ? 'active' : ''}
              onClick={() => update({ showHeatmap: true, colorMode: 'displacement' })}
            >
              URES
            </button>
          </div>
        </div>

        <div className="toggle-grid quiet-toggle-grid">
          {(['showSurface', 'showRestGhost', 'showNodes', 'showEdges'] as BooleanKey[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={config[key]} onChange={(event) => setBoolean(key, event.target.checked)} />
              {displayToggleLabel(key)}
            </label>
          ))}
        </div>

      </section>

      <section className="button-row inverse-export-row">
        <button type="button" className="secondary" onClick={onReset}>
          Reset Defaults
        </button>
        <button type="button" className="secondary" onClick={onExportCsv}>
          Export Metrics CSV
        </button>
        <button type="button" className="secondary" onClick={onExportJson}>
          Export Config JSON
        </button>
        <label className="secondary import-button">
          Import Config JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void importFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
      </section>
    </>
  )
}

function clampToUsableRanges(config: InverseSheetConfig): InverseSheetConfig {
  const ranges = getInverseSheetUsableRanges(config)

  return {
    ...config,
    height: clampNumber(config.height, 0, ranges.heightMax),
    horizontalOffset: clampNumber(config.horizontalOffset, 0, ranges.horizontalOffsetMax),
    overhangPosition: clampNumber(config.overhangPosition, -1, 1),
    steer: clampNumber(config.steer, -1, 1),
    profileScale: clampNumber(config.profileScale, 0.35, 1.55),
    xySliceLevel: clampNumber(config.xySliceLevel, 0.05, 0.95),
    overhangWidth: clampNumber(config.overhangWidth, 0, ranges.overhangWidthMax),
  }
}

function displayToggleLabel(key: BooleanKey): string {
  if (key === 'showSurface') return 'surface'
  if (key === 'showRestGhost') return 'flat grid'
  if (key === 'showNodes') return 'cells'
  return 'connectors'
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(formatInputValue(value))
  const [editing, setEditing] = useState(false)
  const displayValue = editing ? draft : formatInputValue(value)

  const commitDraft = (nextDraft: string, forceClamp = false) => {
    const numeric = Number(nextDraft)
    if (!Number.isFinite(numeric)) {
      if (forceClamp) setDraft(formatInputValue(value))
      return
    }

    if (!forceClamp && (numeric < min || numeric > max)) return
    const nextValue = forceClamp ? Math.min(max, Math.max(min, numeric)) : numeric
    onChange(nextValue)
    setDraft(formatInputValue(nextValue))
  }

  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onFocus={() => {
          setDraft(formatInputValue(value))
          setEditing(true)
        }}
        onBlur={() => {
          setEditing(false)
          commitDraft(draft, true)
        }}
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          commitDraft(nextDraft)
        }}
      />
    </label>
  )
}

function formatInputValue(value: number): string {
  if (!Number.isFinite(value)) return ''
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  onChange: (value: number) => void
}) {
  const safeValue = clampNumber(value, min, max)

  return (
    <label className="range-label">
      <span>
        {label} <strong>{formatValue ? formatValue(safeValue) : safeValue.toFixed(2)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={safeValue} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}
