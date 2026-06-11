import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

export default function CanvasSizeGuard() {
  const gl = useThree((state) => state.gl)
  const setSize = useThree((state) => state.setSize)

  useLayoutEffect(() => {
    const canvas = gl.domElement
    const measuredParent = canvas.parentElement
    if (!measuredParent) return

    let disposed = false
    const sync = () => {
      if (disposed) return
      const rect = measuredParent.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      if (width <= 1 || height <= 1) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8)
      gl.setPixelRatio(dpr)
      gl.setSize(width, height, false)
      setSize(width, height)
    }

    sync()
    const frame = window.requestAnimationFrame(sync)
    const timers = [80, 300, 800].map((delay) => window.setTimeout(sync, delay))
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    observer?.observe(measuredParent)
    window.addEventListener('resize', sync)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      timers.forEach((timer) => window.clearTimeout(timer))
      observer?.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [gl, setSize])

  return null
}
