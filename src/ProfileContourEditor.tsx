import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  DEFAULT_CUSTOM_PROFILE_POINTS,
  parseProfilePoints,
  serializeProfilePoints,
  type ProfileControlPoint,
} from './latticeGeometry'

type ProfileContourEditorProps = {
  value: string
  onApply: (value: string) => void
  label?: string
  ariaLabel?: string
  defaultValue?: string
  resetLabel?: string
  sliceLevel?: number
  onSliceLevelChange?: (value: number) => void
  sliceLevelLabel?: string
}

const editorWidth = 360
const editorHeight = 176
const editorPadX = 18
const editorPadY = 20

export default function ProfileContourEditor({
  value,
  onApply,
  label = 'profile',
  ariaLabel = 'Editable overhang side profile',
  defaultValue = DEFAULT_CUSTOM_PROFILE_POINTS,
  resetLabel = 'Reset Wave',
  sliceLevel,
  onSliceLevelChange,
  sliceLevelLabel = 'x y slice',
}: ProfileContourEditorProps) {
  const [points, setPoints] = useState<ProfileControlPoint[]>(() => parseProfilePoints(value))
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [activeSlice, setActiveSlice] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const path = useMemo(() => buildSmoothSvgPath(points), [points])
  const pointPositions = points.map(pointToSvg)
  const hasSliceMarker = typeof sliceLevel === 'number' && Boolean(onSliceLevelChange)
  const sliceMarkerY = hasSliceMarker ? sliceLevelToSvg(sliceLevel) : null

  const updatePointFromEvent = (index: number, event: ReactPointerEvent<SVGSVGElement | SVGCircleElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    const localX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * editorWidth
    const localY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * editorHeight
    const nextPoint = svgToPoint(localX, localY)

    setPoints((current) =>
      current.map((point, pointIndex) => {
        if (pointIndex !== index) return point
        if (pointIndex === 0) return { x: 0, z: 0 }
        if (pointIndex === current.length - 1) return { x: 1, z: 0 }
        return nextPoint
      }),
    )
  }

  const beginDrag = (index: number, event: ReactPointerEvent<SVGCircleElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveIndex(index)
    updatePointFromEvent(index, event)
  }

  const updateSliceFromEvent = (event: ReactPointerEvent<SVGSVGElement | SVGLineElement | SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || !onSliceLevelChange) return

    const localY = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * editorHeight
    onSliceLevelChange(svgYToLevel(localY))
  }

  const beginSliceDrag = (event: ReactPointerEvent<SVGLineElement | SVGRectElement>) => {
    if (!onSliceLevelChange) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveSlice(true)
    updateSliceFromEvent(event)
  }

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeIndex !== null) {
      updatePointFromEvent(activeIndex, event)
      return
    }
    if (activeSlice) updateSliceFromEvent(event)
  }

  const endDrag = () => {
    setActiveIndex(null)
    setActiveSlice(false)
  }

  const resetProfile = () => {
    const nextPoints = parseProfilePoints(defaultValue)
    setPoints(nextPoints)
    onApply(serializeProfilePoints(nextPoints))
  }

  return (
    <section className="profile-editor">
      <div className="section-heading">
        <h2>{label}</h2>
      </div>
      <svg
        ref={svgRef}
        className="profile-editor-canvas"
        viewBox={`0 0 ${editorWidth} ${editorHeight}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <line className="profile-ground-line" x1={editorPadX} y1={editorHeight - editorPadY} x2={editorWidth - editorPadX} y2={editorHeight - editorPadY} />
        <path className="profile-curve" d={path} />
        {hasSliceMarker && sliceMarkerY !== null && (
          <g className={activeSlice ? 'profile-slice active' : 'profile-slice'}>
            <rect
              className="profile-slice-hit"
              x={editorPadX}
              y={sliceMarkerY - 8}
              width={editorWidth - editorPadX * 2}
              height={16}
              onPointerDown={beginSliceDrag}
            />
            <line
              className="profile-slice-line"
              x1={editorPadX}
              y1={sliceMarkerY}
              x2={editorWidth - editorPadX}
              y2={sliceMarkerY}
              onPointerDown={beginSliceDrag}
            />
            <text className="profile-slice-label" x={editorWidth - editorPadX} y={sliceMarkerY - 6} textAnchor="end">
              {sliceLevelLabel}
            </text>
          </g>
        )}
        {pointPositions.map((position, index) => (
          <circle
            key={index}
            className={activeIndex === index ? 'profile-handle active' : 'profile-handle'}
            cx={position.x}
            cy={position.y}
            r={index === 0 || index === pointPositions.length - 1 ? 4.5 : 5.5}
            onPointerDown={(event) => beginDrag(index, event)}
            onPointerMove={(event) => {
              if (activeIndex === index) updatePointFromEvent(index, event)
            }}
          />
        ))}
      </svg>
      <div className="profile-editor-actions">
        <button type="button" className="primary" onClick={() => onApply(serializeProfilePoints(points))}>
          Render Geometry
        </button>
        <button type="button" className="secondary" onClick={resetProfile}>
          {resetLabel}
        </button>
      </div>
    </section>
  )
}

function pointToSvg(point: ProfileControlPoint): { x: number; y: number } {
  return {
    x: editorPadX + point.x * (editorWidth - editorPadX * 2),
    y: editorHeight - editorPadY - point.z * (editorHeight - editorPadY * 2),
  }
}

function svgToPoint(x: number, y: number): ProfileControlPoint {
  return {
    x: clampNumber((x - editorPadX) / Math.max(editorWidth - editorPadX * 2, 1), 0, 1),
    z: clampNumber((editorHeight - editorPadY - y) / Math.max(editorHeight - editorPadY * 2, 1), 0, 1),
  }
}

function sliceLevelToSvg(level: number): number {
  return editorHeight - editorPadY - clampNumber(level, 0.05, 0.95) * (editorHeight - editorPadY * 2)
}

function svgYToLevel(y: number): number {
  return clampNumber((editorHeight - editorPadY - y) / Math.max(editorHeight - editorPadY * 2, 1), 0.05, 0.95)
}

function buildSmoothSvgPath(points: ProfileControlPoint[]): string {
  if (!points.length) return ''
  const svgPoints = points.map(pointToSvg)
  if (svgPoints.length === 1) return `M ${svgPoints[0].x} ${svgPoints[0].y}`

  const commands = [`M ${formatSvgNumber(svgPoints[0].x)} ${formatSvgNumber(svgPoints[0].y)}`]

  for (let index = 0; index < svgPoints.length - 1; index += 1) {
    const previous = svgPoints[Math.max(0, index - 1)]
    const current = svgPoints[index]
    const next = svgPoints[index + 1]
    const after = svgPoints[Math.min(svgPoints.length - 1, index + 2)]
    const tension = 0.34
    const c1 = {
      x: current.x + (next.x - previous.x) * tension,
      y: current.y + (next.y - previous.y) * tension,
    }
    const c2 = {
      x: next.x - (after.x - current.x) * tension,
      y: next.y - (after.y - current.y) * tension,
    }

    commands.push(
      `C ${formatSvgNumber(c1.x)} ${formatSvgNumber(c1.y)} ${formatSvgNumber(c2.x)} ${formatSvgNumber(c2.y)} ${formatSvgNumber(next.x)} ${formatSvgNumber(next.y)}`,
    )
  }

  return commands.join(' ')
}

function formatSvgNumber(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
