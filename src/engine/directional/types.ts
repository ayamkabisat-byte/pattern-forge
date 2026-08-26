export type DirectionalPresetId = 'parang-row' | 'parang-diagonal' | 'horizontal-row' | 'vertical-strip' | 'ornament-row' | 'sweater-row' | 'custom'

export type DirectionalMotifData = {
  name: string
  innerSvg: string
  originalViewBox: string
  originalWidth: number
  originalHeight: number
  tightViewBox: string
  tightWidth: number
  tightHeight: number
  tightTrimmed: boolean
}

export type DirectionalPatternData = {
  version: 1
  presetId: DirectionalPresetId
  motif: DirectionalMotifData | null
  tileWidth: number
  tileHeight: number
  targetAngle: number
  motifLongSide: number
  motifRotationOffset: number
  rotateWithLane: boolean
  alongGap: number
  laneGap: number
  lanePhase: number
  trimArtwork: boolean
  trimPaddingPercent: number
  alternateLaneFlip: boolean
  alternateMotifFlip: boolean
  alternateMotifRotation: 0 | 180
  backgroundMode: 'solid' | 'transparent'
  backgroundColor: string
  exportLongSide: number
}

export type DirectionalMetrics = {
  windingX: number
  windingY: number
  effectiveAngle: number
  stepsPerLoop: number
  laneCount: number
  alongStep: number
  laneSeparation: number
  alongExtent: number
  crossExtent: number
  effectiveAlongGap: number
  effectiveLaneGap: number
  motifWidth: number
  motifHeight: number
  laneAxis: 'x' | 'y'
}
