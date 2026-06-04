import { COLOR_MODES } from './latticeGeometry'
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

type NumberKey =
  | 'rows'
  | 'columns'
  | 'spacing'
  | 'morph'
  | 'bendAngleDeg'
  | 'supportFraction'
  | 'bendRadius'
  | 'horizontalOffset'
  | 'smoothing'
  | 'widthScale'
  | 'strainWeight'
  | 'bendWeight'
  | 'shearWeight'
  | 'dihedralWeight'

type BooleanKey = 'showSurface' | 'showRestGhost' | 'showNodes' | 'showEdges' | 'showLabels' | 'showHeatmap'

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
  const labelsAutoHidden = config.showLabels && (config.rows > 15 || config.columns > 15)

  const update = (patch: Partial<InverseSheetConfig>) => {
    onConfigChange({ ...config, ...patch })
  }

  const setNumber = (key: NumberKey, value: number) => {
    update({ [key]: value })
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
          <NumberInput label="spacing" value={config.spacing} min={0.05} max={20} step={0.05} onChange={(value) => setNumber('spacing', value)} />
          <label>
            target preset
            <select value={config.targetPreset} onChange={() => update({ targetPreset: 'overhang' })}>
              <option value="overhang">Overhang</option>
            </select>
          </label>
        </div>

        <RangeInput label="morph" value={config.morph} min={0} max={1} step={0.01} onChange={(value) => setNumber('morph', value)} />

        <div className="two-col">
          <label>
            vertical direction
            <select
              value={config.verticalDirection}
              onChange={(event) => update({ verticalDirection: event.target.value === 'up' ? 'up' : 'down' })}
            >
              <option value="down">down</option>
              <option value="up">up</option>
            </select>
          </label>
          <NumberInput label="bend angle deg" value={config.bendAngleDeg} min={-180} max={180} step={1} onChange={(value) => setNumber('bendAngleDeg', value)} />
          <NumberInput label="left flat water" value={config.supportFraction} min={0.06} max={0.5} step={0.01} onChange={(value) => setNumber('supportFraction', value)} />
          <button type="button" className="primary compact-primary" onClick={onRun}>
            Run / Update
          </button>
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

      <section className="panel-section">
        <div className="section-heading">
          <h2>advanced</h2>
          {labelsAutoHidden && <span>labels hidden above 15x15</span>}
        </div>

        <div className="two-col">
          <label>
            radius mode
            <select
              value={config.radiusMode}
              onChange={(event) => update({ radiusMode: event.target.value === 'manual' ? 'manual' : 'autoPreserveLength' })}
            >
              <option value="autoPreserveLength">autoPreserveLength</option>
              <option value="manual">manual</option>
            </select>
          </label>
          <NumberInput label="bend radius" value={config.bendRadius} min={0.1} max={100} step={0.1} onChange={(value) => setNumber('bendRadius', value)} />
          <NumberInput label="horizontal offset" value={config.horizontalOffset} min={-100} max={100} step={0.1} onChange={(value) => setNumber('horizontalOffset', value)} />
          <NumberInput label="smoothing" value={config.smoothing} min={0} max={1} step={0.01} onChange={(value) => setNumber('smoothing', value)} />
          <NumberInput label="width scale" value={config.widthScale} min={0.2} max={3} step={0.05} onChange={(value) => setNumber('widthScale', value)} />
          <label>
            color mode
            <select value={config.colorMode} onChange={(event) => update({ colorMode: event.target.value as InverseSheetConfig['colorMode'] })}>
              {COLOR_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <NumberInput label="strain weight" value={config.strainWeight} min={0} max={100} step={0.01} onChange={(value) => setNumber('strainWeight', value)} />
          <NumberInput label="bend weight" value={config.bendWeight} min={0} max={100} step={0.01} onChange={(value) => setNumber('bendWeight', value)} />
          <NumberInput label="shear weight" value={config.shearWeight} min={0} max={100} step={0.01} onChange={(value) => setNumber('shearWeight', value)} />
          <NumberInput label="dihedral weight" value={config.dihedralWeight} min={0} max={100} step={0.01} onChange={(value) => setNumber('dihedralWeight', value)} />
        </div>

        <div className="toggle-grid">
          {(['showSurface', 'showRestGhost', 'showNodes', 'showEdges', 'showLabels', 'showHeatmap'] as BooleanKey[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={config[key]} onChange={(event) => setBoolean(key, event.target.checked)} />
              {key}
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
  return (
    <label>
      {label}
      <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
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
