import type { MetricsSummary } from './inverseSheetTypes'

type DeformationMetricsPanelProps = {
  summary: MetricsSummary
}

const metricRows: Array<{ key: keyof MetricsSummary; label: string; format: 'strain' | 'deg' | 'length' | 'cost' }> = [
  { key: 'maxTensileStrain', label: 'max tensile strain', format: 'strain' },
  { key: 'maxCompressiveStrain', label: 'max compressive strain', format: 'strain' },
  { key: 'meanAbsStrain', label: 'mean abs strain', format: 'strain' },
  { key: 'rmsStrain', label: 'RMS strain', format: 'strain' },
  { key: 'maxEdgeRotationDeg', label: 'max edge rotation', format: 'deg' },
  { key: 'meanEdgeRotationDeg', label: 'mean edge rotation', format: 'deg' },
  { key: 'maxBendDeg', label: 'max bend angle', format: 'deg' },
  { key: 'meanBendDeg', label: 'mean bend angle', format: 'deg' },
  { key: 'maxShearDeg', label: 'max shear error', format: 'deg' },
  { key: 'meanShearDeg', label: 'mean shear error', format: 'deg' },
  { key: 'maxDihedralDeg', label: 'max dihedral angle', format: 'deg' },
  { key: 'meanDihedralDeg', label: 'mean dihedral angle', format: 'deg' },
  { key: 'maxAreaExpansion', label: 'max area change', format: 'strain' },
  { key: 'meanAbsAreaChange', label: 'mean abs area change', format: 'strain' },
  { key: 'maxDisplacement', label: 'max displacement', format: 'length' },
  { key: 'meanDisplacement', label: 'mean displacement', format: 'length' },
  { key: 'combinedCost', label: 'combined cost', format: 'cost' },
]

export default function DeformationMetricsPanel({ summary }: DeformationMetricsPanelProps) {
  return (
    <section className="panel-section inverse-metrics">
      <div className="section-heading">
        <h2>metrics</h2>
      </div>
      <p className="inverse-note">Inverse Sheet prescribes a target 3D shape and measures the deformation required. It is not a physics solver.</p>
      <div className="metric-table" aria-label="deformation metrics">
        {metricRows.map((row) => (
          <div key={row.key} className="metric-row">
            <span>{row.label}</span>
            <strong>{formatMetric(summary[row.key], row.format)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatMetric(value: number, format: (typeof metricRows)[number]['format']): string {
  if (!Number.isFinite(value)) return '0'

  if (format === 'deg') return `${value.toFixed(1).replace(/\.0$/, '')} deg`
  if (format === 'length') return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  if (format === 'cost') return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
