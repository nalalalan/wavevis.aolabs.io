import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import ControlPanel from './ControlPanel'
import InverseSheetTab from './InverseSheetTab'
import Scene3D from './Scene3D'
import type { SimulatorTab } from './SimulatorTabs'
import { CELL_STATES, type CellGrid, type CellParams, type CellState } from './types'
import {
  DEFAULT_COLUMNS,
  DEFAULT_PARAMS,
  DEFAULT_ROWS,
  createGrid,
  nextCellState,
  randomGrid,
  resizeGrid,
  sanitizeParams,
} from './geometry'

function App() {
  const [initialConfig] = useState(() => readInitialConfig())
  const [draftParams, setDraftParams] = useState<CellParams>(initialConfig.params)
  const [draftGrid, setDraftGrid] = useState(() => initialConfig.grid)
  const [appliedParams, setAppliedParams] = useState<CellParams>(initialConfig.params)
  const [appliedGrid, setAppliedGrid] = useState(() => initialConfig.grid)
  const [panelWidth, setPanelWidth] = useState(390)
  const [activeTab, setActiveTab] = useState<SimulatorTab>(() => readInitialTab())

  const safeDraftParams = useMemo(() => sanitizeParams(draftParams), [draftParams])
  const hasPendingChanges = stateKey(safeDraftParams, draftGrid) !== stateKey(appliedParams, appliedGrid)
  const appStyle = { '--panel-width': `${panelWidth}px` } as CSSProperties

  const applyDraftToScene = () => {
    const nextParams = sanitizeParams(draftParams)
    setDraftParams(nextParams)
    setAppliedParams(nextParams)
    setAppliedGrid(draftGrid.map((row) => [...row]))
  }

  const updateGridSize = (rows: number, columns: number) => {
    setDraftGrid((current) => resizeGrid(current, rows, columns))
  }

  const updateCell = (row: number, col: number) => {
    setDraftGrid((current) =>
      current.map((cellRow, rowIndex) =>
        cellRow.map((state, colIndex) => (rowIndex === row && colIndex === col ? nextCellState(state) : state)),
      ),
    )
  }

  const resetAllOff = () => {
    const nextGrid = createGrid(DEFAULT_ROWS, DEFAULT_COLUMNS, CELL_STATES.OFF)
    setDraftParams(DEFAULT_PARAMS)
    setAppliedParams(DEFAULT_PARAMS)
    setDraftGrid(nextGrid)
    setAppliedGrid(nextGrid)
  }

  const setDefault = () => {
    const nextGrid = createGrid(DEFAULT_ROWS, DEFAULT_COLUMNS, CELL_STATES.OFF)
    setDraftParams(DEFAULT_PARAMS)
    setAppliedParams(DEFAULT_PARAMS)
    setDraftGrid(nextGrid)
    setAppliedGrid(nextGrid)
  }

  const randomize = () => {
    const rows = draftGrid.length
    const columns = draftGrid[0]?.length ?? 1
    setDraftGrid(randomGrid(rows, columns))
  }

  const startPanelResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth

    const updateWidth = (moveEvent: PointerEvent) => {
      const viewportWidth = window.innerWidth || 1280
      const maxWidth = Math.max(390, Math.min(920, viewportWidth - 360))
      const nextWidth = Math.min(maxWidth, Math.max(320, startWidth + moveEvent.clientX - startX))
      setPanelWidth(nextWidth)
    }

    const stopResize = () => {
      window.removeEventListener('pointermove', updateWidth)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
      document.body.classList.remove('resizing-panel')
    }

    document.body.classList.add('resizing-panel')
    window.addEventListener('pointermove', updateWidth)
    window.addEventListener('pointerup', stopResize)
    window.addEventListener('pointercancel', stopResize)
  }

  const resizeHandle = (
    <button
      type="button"
      className="panel-resize-handle"
      aria-label="Resize controls panel"
      title="Resize controls panel"
      onPointerDown={startPanelResize}
    />
  )

  return (
    <main className="app-shell" style={appStyle}>
      {activeTab === 'inverse' ? (
        <InverseSheetTab activeTab={activeTab} onTabChange={setActiveTab} resizeHandle={resizeHandle} />
      ) : (
        <>
          <ControlPanel
            grid={draftGrid}
            params={safeDraftParams}
            hasPendingChanges={hasPendingChanges}
            onParamsChange={setDraftParams}
            onRowsColumnsChange={updateGridSize}
            onCellClick={updateCell}
            onRun={applyDraftToScene}
            onReset={resetAllOff}
            onRandomize={randomize}
            onDefault={setDefault}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          {resizeHandle}
          <Scene3D grid={appliedGrid} params={appliedParams} />
        </>
      )}
    </main>
  )
}

export default App

function readInitialConfig(): { params: CellParams; grid: CellGrid } {
  if (typeof window === 'undefined') {
    return { params: DEFAULT_PARAMS, grid: createGrid(DEFAULT_ROWS, DEFAULT_COLUMNS) }
  }

  const search = new URLSearchParams(window.location.search)
  const rows = readIntegerParam(search, 'rows', DEFAULT_ROWS, 1, 100)
  const columns = readIntegerParam(search, 'cols', DEFAULT_COLUMNS, 1, 100)
  const params = sanitizeParams({
    ...DEFAULT_PARAMS,
    hOff: readNumberParam(search, 'hOff', DEFAULT_PARAMS.hOff),
    hOn: readNumberParam(search, 'hOn', DEFAULT_PARAMS.hOn),
    linkLength: readNumberParam(search, 'linkLength', DEFAULT_PARAMS.linkLength),
    plateSize: readNumberParam(search, 'plateSize', DEFAULT_PARAMS.plateSize),
    octagonFaceRatio: readNumberParam(search, 'octagonFaceRatio', DEFAULT_PARAMS.octagonFaceRatio),
    constrainPerimeter: search.get('constrainPerimeter') === '1',
  })
  const grid = createGrid(rows, columns)
  const states = search.get('states') ?? ''

  for (let index = 0; index < Math.min(states.length, rows * columns); index += 1) {
    const state = Number(states[index])
    if (state >= CELL_STATES.OFF && state <= CELL_STATES.EXPAND) {
      grid[Math.floor(index / columns)][index % columns] = state as CellState
    }
  }

  return { params, grid }
}

function readIntegerParam(search: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  if (!search.has(name)) return fallback
  const value = Number(search.get(name))
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function readNumberParam(search: URLSearchParams, name: string, fallback: number): number {
  if (!search.has(name)) return fallback
  const value = Number(search.get(name))
  return Number.isFinite(value) ? value : fallback
}

function readInitialTab(): SimulatorTab {
  if (typeof window === 'undefined') return 'inverse'
  const search = new URLSearchParams(window.location.search)
  return search.get('tab') === 'sarrus' ? 'sarrus' : 'inverse'
}

function stateKey(params: CellParams, grid: CellState[][]): string {
  return [
    params.hOff,
    params.hOn,
    params.linkLength,
    params.plateSize,
    params.octagonFaceRatio,
    params.showLabels,
    params.animate,
    params.constrainPerimeter,
    grid.map((row) => row.join(',')).join(';'),
  ].join('|')
}
