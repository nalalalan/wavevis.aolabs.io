import CellGridEditor from './CellGridEditor'
import { DEFAULT_COLUMNS, DEFAULT_PARAMS, DEFAULT_ROWS, STATE_META, defaultCellPitch, roundForInput, stateMeta } from './geometry'
import type { CellGrid, CellParams, CellState } from './types'

type ControlPanelProps = {
  grid: CellGrid
  params: CellParams
  selectedMode: CellState
  hasPendingChanges: boolean
  onParamsChange: (next: CellParams) => void
  onRowsColumnsChange: (rows: number, columns: number) => void
  onModeChange: (mode: CellState) => void
  onCellClick: (row: number, col: number) => void
  onRun: () => void
  onReset: () => void
  onRandomize: () => void
  onDefault: () => void
}

const numericInputs: Array<{
  key: keyof Pick<CellParams, 'hOff' | 'hOn' | 'linkLength' | 'plateSize' | 'cellPitch' | 'connectorLength'>
  label: string
  step: number
  min: number
}> = [
  { key: 'hOff', label: 'hOff', step: 0.1, min: 0.25 },
  { key: 'hOn', label: 'hOn', step: 0.1, min: 0.15 },
  { key: 'linkLength', label: 'linkLength', step: 0.1, min: 0.25 },
  { key: 'plateSize', label: 'plateSize', step: 0.1, min: 0.25 },
  { key: 'cellPitch', label: 'cellPitch', step: 0.05, min: 0.5 },
  { key: 'connectorLength', label: 'connectorLength', step: 0.05, min: 0 },
]

export default function ControlPanel({
  grid,
  params,
  selectedMode,
  hasPendingChanges,
  onParamsChange,
  onRowsColumnsChange,
  onModeChange,
  onCellClick,
  onRun,
  onReset,
  onRandomize,
  onDefault,
}: ControlPanelProps) {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0
  const selectedMeta = stateMeta(selectedMode)
  const fittedPitch = defaultCellPitch(params)

  const setNumber = (key: (typeof numericInputs)[number]['key'], value: number) => {
    onParamsChange({ ...params, [key]: value })
  }

  return (
    <aside className="control-panel">
      <header className="panel-header">
        <div className="brand-row">
          <span className="ao-dot" aria-hidden="true">
            ao
          </span>
          <span className="app-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <h1>wavevis.aolabs.io</h1>
        </div>
        <p>double-layer Sarrus cell array</p>
      </header>

      <section className="panel-section">
        <div className="section-heading">
          <h2>array</h2>
          <span>{hasPendingChanges ? 'pending 3D update' : '3D current'}</span>
        </div>
        <div className="two-col">
          <label>
            rows
            <input
              type="number"
              min={1}
              max={12}
              step={1}
              value={rows}
              onChange={(event) => onRowsColumnsChange(Number(event.target.value), columns)}
            />
          </label>
          <label>
            columns
            <input
              type="number"
              min={1}
              max={12}
              step={1}
              value={columns}
              onChange={(event) => onRowsColumnsChange(rows, Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>mode</h2>
          <span>{selectedMeta.label}</span>
        </div>
        <div className="mode-selector" role="radiogroup" aria-label="cell state">
          {STATE_META.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={mode.value === selectedMode ? 'selected' : ''}
              style={{ '--mode-color': mode.color } as React.CSSProperties}
              aria-pressed={mode.value === selectedMode}
              onClick={() => onModeChange(mode.value)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      <CellGridEditor grid={grid} selectedMode={selectedMode} showLabels={params.showLabels} onCellClick={onCellClick} />

      <section className="panel-section">
        <div className="section-heading">
          <h2>geometry</h2>
          <span>pitch fit {roundForInput(fittedPitch)}</span>
        </div>
        <div className="param-grid">
          {numericInputs.map((input) => (
            <label key={input.key}>
              {input.label}
              <input
                type="number"
                min={input.min}
                step={input.step}
                value={params[input.key]}
                onChange={(event) => setNumber(input.key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="secondary wide"
          onClick={() => onParamsChange({ ...params, cellPitch: fittedPitch })}
        >
          fit cellPitch from connectorLength
        </button>
      </section>

      <section className="panel-section toggles">
        <label>
          <input
            type="checkbox"
            checked={params.showLabels}
            onChange={(event) => onParamsChange({ ...params, showLabels: event.target.checked })}
          />
          showLabels
        </label>
        <label>
          <input
            type="checkbox"
            checked={params.animate}
            onChange={(event) => onParamsChange({ ...params, animate: event.target.checked })}
          />
          animate
        </label>
      </section>

      <section className="button-row">
        <button type="button" className="primary" onClick={onRun}>
          Run / Update 3D
        </button>
        <button type="button" className="secondary" onClick={onReset}>
          Reset all OFF
        </button>
        <button type="button" className="secondary" onClick={onRandomize}>
          Randomize
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            onParamsChange(DEFAULT_PARAMS)
            onDefault()
          }}
        >
          Default {DEFAULT_ROWS}x{DEFAULT_COLUMNS}
        </button>
      </section>
    </aside>
  )
}
