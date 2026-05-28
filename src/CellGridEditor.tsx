import { nextCellState, stateMeta } from './geometry'
import type { CellGrid } from './types'

type CellGridEditorProps = {
  grid: CellGrid
  showLabels: boolean
  onCellClick: (row: number, col: number) => void
}

export default function CellGridEditor({ grid, showLabels, onCellClick }: CellGridEditorProps) {
  const rows = grid.length
  const columns = grid[0]?.length ?? 0

  return (
    <section className="grid-editor" aria-label="cell actuation grid">
      <div
        className="cell-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(32px, 1fr))`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((state, colIndex) => {
            const meta = stateMeta(state)
            const nextMeta = stateMeta(nextCellState(state))

            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                className="grid-cell"
                style={{ '--cell-color': meta.color } as React.CSSProperties}
                aria-label={`row ${rowIndex + 1}, column ${colIndex + 1}, ${meta.label}; next ${nextMeta.label}`}
                title={`${rowIndex + 1}, ${colIndex + 1}: ${meta.label}; next ${nextMeta.label}`}
                onClick={() => onCellClick(rowIndex, colIndex)}
              >
                {showLabels ? meta.shortLabel : ''}
              </button>
            )
          }),
        )}
      </div>
      <p className="grid-count">
        {rows} x {columns} cells
      </p>
    </section>
  )
}
