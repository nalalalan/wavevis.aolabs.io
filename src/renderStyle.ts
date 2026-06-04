export const linkageColor = '#2f3130'
export const emOffColor = '#b8b2aa'
export const cellBodyColor = '#4d4b46'
export const connectorColor = '#22d30f'

export function octagonHalfLegSide(plateSize: number, octagonFaceRatio: number): number {
  const apothem = plateSize / 2
  const ratio = Math.max(octagonFaceRatio, 0.05)
  const halfLegSide = (ratio * Math.SQRT2 * apothem) / (2 + ratio * Math.SQRT2)
  return Math.min(apothem * 0.92, Math.max(apothem * 0.04, halfLegSide))
}

export function linkageWidth(plateSize: number, octagonFaceRatio: number): number {
  return octagonHalfLegSide(plateSize, octagonFaceRatio) * 2
}
