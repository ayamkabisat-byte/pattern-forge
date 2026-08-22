export type RepeatMode = 'grid' | 'half-drop' | 'brick' | 'toss' | 'ceplok' | 'kawung'

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
  gapX: number
  gapY: number
  rotation: number
  randomRotation: number
  density: number
  seed: number
  showBoundary: boolean
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
}
