import CellGridEditor from './CellGridEditor'
import { DEFAULT_COLUMNS, DEFAULT_PARAMS, DEFAULT_ROWS, STATE_META } from './geometry'
import SimulatorTabs, { type SimulatorTab } from './SimulatorTabs'
import type { CellGrid, CellParams } from './types'

type ControlPanelProps = {
  grid: CellGrid
  params: CellParams
  hasPendingChanges: boolean
  onParamsChange: (next: CellParams) => void
  onRowsColumnsChange: (rows: number, columns: number) => void
  onCellClick: (row: number, col: number) => void
  onRun: () => void
  onReset: () => void
  onRandomize: () => void
  onDefault: () => void
  activeTab: SimulatorTab
  onTabChange: (tab: SimulatorTab) => void
}

const numericInputs: Array<{
  key: keyof Pick<CellParams, 'hOff' | 'hOn' | 'linkLength' | 'plateSize' | 'octagonFaceRatio'>
  label: string
  step: number
  min: number
  max?: number
}> = [
  { key: 'hOff', label: 'hOff', step: 0.1, min: 0.25 },
  { key: 'hOn', label: 'hOn', step: 0.1, min: 0.15 },
  { key: 'linkLength', label: 'linkLength', step: 0.1, min: 0.25 },
  { key: 'plateSize', label: 'plateSize', step: 0.1, min: 0.25 },
  { key: 'octagonFaceRatio', label: 'octagonFaceRatio', step: 0.05, min: 0.1, max: 4 },
]

export default function ControlPanel({
  grid,
  params,
  hasPendingChanges,
  onParamsChange,
  onRowsColumnsChange,
  onCellClick,
  onRun,
  onReset,
  onRandomize,
  onDefault,
  activeTab,
  onTabChange,
}: ControlPanelProps) {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0

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
          <img className="app-mark" src="./favicon.svg" alt="" aria-hidden="true" />
          <h1>wavevis.aolabs.io</h1>
        </div>
        <p>double-layer Sarrus cell array</p>
        <a className="proof-link" href="./proofs/connector-contact-constraint-proof.pdf" target="_blank" rel="noreferrer">
          constraint proof PDF
        </a>
      </header>

      <SimulatorTabs activeTab={activeTab} onTabChange={onTabChange} />

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
              max={100}
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
              max={100}
              step={1}
              value={columns}
              onChange={(event) => onRowsColumnsChange(rows, Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>states</h2>
          <span>click cell to cycle</span>
        </div>
        <div className="mode-legend" aria-label="cell color legend">
          {STATE_META.map((mode) => (
            <div
              key={mode.value}
              className="mode-item"
              style={{ '--mode-color': mode.color } as React.CSSProperties}
            >
              <span className="mode-swatch" aria-hidden="true" />
              {mode.label}
            </div>
          ))}
        </div>
      </section>

      <CellGridEditor grid={grid} showLabels={params.showLabels} onCellClick={onCellClick} />

      <section className="run-row">
        <button type="button" className="primary" onClick={onRun}>
          Run / Update 3D
        </button>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>geometry</h2>
        </div>
        <div className="param-grid">
          {numericInputs.map((input) => (
            <label key={input.key}>
              {input.label}
              <input
                type="number"
                min={input.min}
                max={input.max}
                step={input.step}
                value={params[input.key]}
                onChange={(event) => setNumber(input.key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
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
