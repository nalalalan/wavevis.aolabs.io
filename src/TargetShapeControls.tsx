import { useState } from 'react'
import type { CameraView, InverseSheetConfig } from './inverseSheetTypes'
import { getInverseSheetUsableRanges } from './latticeGeometry'

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

type NumberKey =
  | 'rows'
  | 'columns'
  | 'morph'
  | 'horizontalOffset'
  | 'overhangPosition'
  | 'height'
  | 'overhangWidth'
  | 'overhangAngleDeg'
  | 'smoothing'
  | 'lipSharpness'
  | 'wallSmoothness'
  | 'flatContribution'
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
  const ranges = getInverseSheetUsableRanges(config)

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
          <NumberInput label="columns" value={config.columns} min={2} max={72} step={1} onChange={(value) => setNumber('columns', value)} />
        </div>

        <div className="slider-stack">
          <RangeInput label="morph" value={config.morph} min={0} max={1} step={0.01} onChange={(value) => setNumber('morph', value)} />
          <RangeInput label="height" value={config.height} min={0} max={ranges.heightMax} step={0.25} onChange={(value) => setNumber('height', value)} />
          <RangeInput label="overhang" value={config.horizontalOffset} min={0} max={ranges.horizontalOffsetMax} step={0.25} onChange={(value) => setNumber('horizontalOffset', value)} />
          <RangeInput label="position" value={config.overhangPosition} min={-1} max={1} step={0.01} onChange={(value) => setNumber('overhangPosition', value)} />
          <RangeInput
            label="lip dip"
            value={config.overhangAngleDeg}
            min={40}
            max={120}
            step={1}
            formatValue={(value) => `${Math.round(value)} deg`}
            onChange={(value) => setNumber('overhangAngleDeg', value)}
          />
          <RangeInput label="width" value={config.overhangWidth} min={0} max={ranges.overhangWidthMax} step={0.5} onChange={(value) => setNumber('overhangWidth', value)} />
          <RangeInput label="lip sharpness" value={config.lipSharpness} min={0} max={1} step={0.01} onChange={(value) => setNumber('lipSharpness', value)} />
          <RangeInput label="ground transition" value={config.smoothing} min={0} max={1} step={0.01} onChange={(value) => setNumber('smoothing', value)} />
          <RangeInput label="wall smoothness" value={config.wallSmoothness} min={0} max={1} step={0.01} onChange={(value) => setNumber('wallSmoothness', value)} />
          <RangeInput label="flat contribution" value={config.flatContribution} min={0} max={1} step={0.01} onChange={(value) => setNumber('flatContribution', value)} />
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

function clampToUsableRanges(config: InverseSheetConfig): InverseSheetConfig {
  const ranges = getInverseSheetUsableRanges(config)

  return {
    ...config,
    height: clampNumber(config.height, 0, ranges.heightMax),
    horizontalOffset: clampNumber(config.horizontalOffset, 0, ranges.horizontalOffsetMax),
    overhangPosition: clampNumber(config.overhangPosition, -1, 1),
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
