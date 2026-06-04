import { useState } from 'react'
import type { CameraView, InverseSheetConfig } from './inverseSheetTypes'

type TargetShapeControlsProps = {
  config: InverseSheetConfig
  onConfigChange: (next: InverseSheetConfig) => void
  onRun: () => void
  onReset: () => void
  onView: (view: CameraView) => void
  onExportCsv: () => void
  onExportJson: () => void
  onImportConfigText: (text: string) => void
}

type NumberKey = 'rows' | 'columns' | 'morph' | 'horizontalOffset'
type BooleanKey = 'showSurface' | 'showRestGhost' | 'showNodes' | 'showEdges'

export default function TargetShapeControls({
  config,
  onConfigChange,
  onRun,
  onReset,
  onView,
  onExportCsv,
  onExportJson,
  onImportConfigText,
}: TargetShapeControlsProps) {
  const update = (patch: Partial<InverseSheetConfig>) => {
    onConfigChange({ ...config, ...patch })
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
          <NumberInput label="columns" value={config.columns} min={2} max={72} step={1} onChange={(value) => setNumber('columns', value)} />
          <NumberInput
            label="overhang amount"
            value={config.horizontalOffset}
            min={0}
            max={24}
            step={0.25}
            onChange={(value) => setNumber('horizontalOffset', value)}
          />
          <button type="button" className="primary compact-primary" onClick={onRun}>
            Run / Update
          </button>
        </div>

        <RangeInput label="morph" value={config.morph} min={0} max={1} step={0.01} onChange={(value) => setNumber('morph', value)} />

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

        <div className="view-buttons">
          <button type="button" className="secondary" onClick={() => onView('isometric')}>
            Isometric View
          </button>
          <button type="button" className="secondary" onClick={() => onView('top')}>
            Top View
          </button>
          <button type="button" className="secondary" onClick={() => onView('side')}>
            Side View
          </button>
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

function displayToggleLabel(key: BooleanKey): string {
  if (key === 'showSurface') return 'surface'
  if (key === 'showRestGhost') return 'flat grid'
  if (key === 'showNodes') return 'nodes'
  return 'edges'
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

function RangeInput({
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
  return (
    <label className="range-label">
      <span>
        {label} <strong>{value.toFixed(2)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}
