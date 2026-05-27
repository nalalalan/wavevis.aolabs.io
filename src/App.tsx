import { useMemo, useState } from 'react'
import ControlPanel from './ControlPanel'
import Scene3D from './Scene3D'
import { CELL_STATES, type CellParams, type CellState } from './types'
import { DEFAULT_PARAMS, createGrid, randomGrid, resizeGrid, sanitizeParams } from './geometry'

function App() {
  const [draftParams, setDraftParams] = useState<CellParams>(DEFAULT_PARAMS)
  const [draftGrid, setDraftGrid] = useState(() => createGrid(2, 2))
  const [selectedMode, setSelectedMode] = useState<CellState>(CELL_STATES.OFF)
  const [appliedParams, setAppliedParams] = useState<CellParams>(DEFAULT_PARAMS)
  const [appliedGrid, setAppliedGrid] = useState(() => createGrid(2, 2))

  const safeDraftParams = useMemo(() => sanitizeParams(draftParams), [draftParams])
  const hasPendingChanges = stateKey(safeDraftParams, draftGrid) !== stateKey(appliedParams, appliedGrid)

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
        cellRow.map((state, colIndex) => (rowIndex === row && colIndex === col ? selectedMode : state)),
      ),
    )
  }

  const resetAllOff = () => {
    const rows = draftGrid.length
    const columns = draftGrid[0]?.length ?? 1
    const nextGrid = createGrid(rows, columns, CELL_STATES.OFF)
    setDraftGrid(nextGrid)
    setAppliedGrid(nextGrid)
  }

  const setDefault = () => {
    const nextGrid = createGrid(2, 2, CELL_STATES.OFF)
    setDraftParams(DEFAULT_PARAMS)
    setAppliedParams(DEFAULT_PARAMS)
    setDraftGrid(nextGrid)
    setAppliedGrid(nextGrid)
    setSelectedMode(CELL_STATES.OFF)
  }

  const randomize = () => {
    const rows = draftGrid.length
    const columns = draftGrid[0]?.length ?? 1
    setDraftGrid(randomGrid(rows, columns))
  }

  return (
    <main className="app-shell">
      <ControlPanel
        grid={draftGrid}
        params={safeDraftParams}
        selectedMode={selectedMode}
        hasPendingChanges={hasPendingChanges}
        onParamsChange={setDraftParams}
        onRowsColumnsChange={updateGridSize}
        onModeChange={setSelectedMode}
        onCellClick={updateCell}
        onRun={applyDraftToScene}
        onReset={resetAllOff}
        onRandomize={randomize}
        onDefault={setDefault}
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
    params.cellPitch,
    params.connectorLength,
    params.showLabels,
    params.animate,
    grid.map((row) => row.join(',')).join(';'),
  ].join('|')
}
