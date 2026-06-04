import type { LatticeModel } from './inverseSheetTypes'
import { legendForMode } from './metricVisuals'

type ColorLegendProps = {
  model: LatticeModel
}

export default function ColorLegend({ model }: ColorLegendProps) {
  const legend = legendForMode(model)

  return (
    <section className="legend-panel" aria-label="heatmap color legend">
      <div className="legend-header">
        <span>{legend.label}</span>
        <span>
          {formatLegendValue(legend.min)} to {formatLegendValue(legend.max)}
        </span>
      </div>
      <div className="legend-ramp" style={{ background: legend.gradient }} />
      <div className="legend-scale">
        <span>{formatLegendValue(legend.min)}</span>
        <span>{formatLegendValue(legend.max)}</span>
      </div>
    </section>
  )
}

function formatLegendValue(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < 1) return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return value.toFixed(1).replace(/\.0$/, '')
}
