export type RepeatMode =
  | 'grid'
  | 'brick-row'
  | 'brick-column'
  | 'hex-row'
  | 'hex-column'
  | 'toss'
  | 'ceplok'
  | 'kawung'

export type BrickOffset = '1/4' | '1/3' | '1/2' | '2/3' | '3/4'
export type OverlapX = 'left' | 'right'
export type OverlapY = 'top' | 'bottom'

export type SvgAsset = {
  id: string
  name: string
  viewBox: string
  viewWidth: number
  viewHeight: number
  innerSvg: string
}

export type PatternSettings = {
  tileWidth: number
  tileHeight: number
  background: string
  motifSize: number
  repeatWidth: number
  repeatHeight: number
  sizeTileToArt: boolean
  hSpacing: number
  vSpacing: number
  brickOffset: BrickOffset
  overlapX: OverlapX
  overlapY: OverlapY
  rotation: number
  randomRotation: number
  density: number
  seed: number
  copies: number
  dimCopies: boolean
  dimCopiesPercent: number
  showBoundary: boolean
  showSwatchBounds: boolean
}

export type PatternInstance = {
  key: string
  assetIndex: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipX?: boolean
  flipY?: boolean
  order?: number
}
