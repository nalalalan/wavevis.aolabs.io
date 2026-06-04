export type SimulatorTab = 'sarrus' | 'inverse'

type SimulatorTabsProps = {
  activeTab: SimulatorTab
  onTabChange: (tab: SimulatorTab) => void
}

export default function SimulatorTabs({ activeTab, onTabChange }: SimulatorTabsProps) {
  return (
    <nav className="sim-tabs" aria-label="WaveVis simulator tabs">
      <button
        type="button"
        className={activeTab === 'sarrus' ? 'active' : ''}
        onClick={() => onTabChange('sarrus')}
      >
        Double-Layer Sarrus
      </button>
      <button
        type="button"
        className={activeTab === 'inverse' ? 'active' : ''}
        onClick={() => onTabChange('inverse')}
      >
        Inverse Sheet
      </button>
    </nav>
  )
}
