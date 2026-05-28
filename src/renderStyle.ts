export const linkageColor = '#f4a8bc'
export const emOffColor = '#b8b2aa'

export function octagonHalfLegSide(plateSize: number, octagonFaceRatio: number): number {
  const apothem = plateSize / 2
  const ratio = Math.max(octagonFaceRatio, 0.05)
  const halfLegSide = (ratio * Math.SQRT2 * apothem) / (2 + ratio * Math.SQRT2)
  return Math.min(apothem * 0.92, Math.max(apothem * 0.04, halfLegSide))
}

export function linkageWidth(plateSize: number, octagonFaceRatio: number): number {
  return octagonHalfLegSide(plateSize, octagonFaceRatio) * 2
}
