class LocalResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback
  private observed = new Set<Element>()
  private frame = 0
  private timers: number[] = []

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    window.addEventListener('resize', this.schedule)
  }

  observe = (target: Element) => {
    this.observed.add(target)
    this.schedule()
    this.timers.push(window.setTimeout(this.measure, 80))
    this.timers.push(window.setTimeout(this.measure, 300))
  }

  unobserve = (target: Element) => {
    this.observed.delete(target)
  }

  disconnect = () => {
    this.observed.clear()
    window.cancelAnimationFrame(this.frame)
    this.timers.forEach((timer) => window.clearTimeout(timer))
    this.timers = []
    window.removeEventListener('resize', this.schedule)
  }

  private schedule = () => {
    window.cancelAnimationFrame(this.frame)
    this.frame = window.requestAnimationFrame(this.measure)
  }

  private measure = () => {
    if (this.observed.size === 0) return
    const entries = Array.from(this.observed).map((target) => ({
      target,
      contentRect: target.getBoundingClientRect(),
    }) as ResizeObserverEntry)
    this.callback(entries, this)
  }
}

export const canvasResizeObserver =
  typeof ResizeObserver === 'undefined' ? LocalResizeObserver : ResizeObserver

if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = LocalResizeObserver
}
