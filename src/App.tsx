import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import ControlPanel from './ControlPanel'
import Scene3D from './Scene3D'
import { CELL_STATES, type CellParams, type CellState } from './types'
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
  const [draftParams, setDraftParams] = useState<CellParams>(DEFAULT_PARAMS)
  const [draftGrid, setDraftGrid] = useState(() => createGrid(DEFAULT_ROWS, DEFAULT_COLUMNS))
  const [appliedParams, setAppliedParams] = useState<CellParams>(DEFAULT_PARAMS)
  const [appliedGrid, setAppliedGrid] = useState(() => createGrid(DEFAULT_ROWS, DEFAULT_COLUMNS))
  const [panelWidth, setPanelWidth] = useState(390)

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

  return (
    <main className="app-shell" style={appStyle}>
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
      />
      <button
        type="button"
        className="panel-resize-handle"
        aria-label="Resize controls panel"
        title="Resize controls panel"
        onPointerDown={startPanelResize}
      />
      <Scene3D grid={appliedGrid} params={appliedParams} />
    </main>
  )
}

export default App

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
