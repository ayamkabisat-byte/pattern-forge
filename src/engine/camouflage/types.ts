export type CamoMode = 'digital' | 'organic'
export type CamoEngine = 'digital-region' | 'interlocking' | 'pebble' | 'hybrid'
export type CamoBackgroundMode = 'solid' | 'transparent'
export type OrganicDirection = 'none' | 'horizontal' | 'vertical' | 'diagonal'
export type OrganicSvgDetail = 'clean' | 'balanced' | 'detailed'
export type DigitalResolution = 32 | 64 | 128 | 256
export type OrganicFieldResolution = 48 | 64 | 96 | 128

export type DigitalCamoSettings = {
  resolution: DigitalResolution
  blockScale: number
  macroRegion: number
  mediumBreakup: number
  stairStep: number
  fragmentation: number
  islandAmount: number
  orthogonalCleanup: number
  colorWeights: number[]

  // v1.2 compatibility fields. The v1.3 engine maps these into region controls.
  macroScale: number
  mediumScale: number
  microDetail: number
  density: number
  rectangularBias: number
  roughness: number
  smoothingPasses: number
}

export type OrganicCamoSettings = {
  tileSize: 256 | 512 | 1024
  fieldResolution: OrganicFieldResolution
  macroScale: number
  mediumBreakup: number
  edgeComplexity: number
  branching: number
  islandAmount: number
  contourSmoothness: number
  direction: OrganicDirection
  simplification: number
  detail: OrganicSvgDetail
  colorWeights: number[]

  // Pebble / hybrid controls.
  spotAmount: number
  spotScale: number
  spotInnerScale: number
  hybridBlockAmount: number

  // v1.2 compatibility fields. Kept so old Pattern JSON remains editable.
  blobCount: number
  blobScale: number
  smoothness: number
  distortion: number
  elongation: number
  overlap: number
  coverage: number
}

export type CamoPatternData = {
  mode: CamoMode
  engine: CamoEngine
  generatorVersion: 1 | 2
  presetId: string
  tileWidth: number
  tileHeight: number
  palette: string[]
  backgroundMode: CamoBackgroundMode
  backgroundColor: number
  seed: number
  exportLongSide: number
  digital: DigitalCamoSettings
  organic: OrganicCamoSettings
}

export type CamoPreset = {
  id: string
  name: string
  mode: CamoMode
  engine: CamoEngine
  note: string
  palette: string[]
  digital?: Partial<DigitalCamoSettings>
  organic?: Partial<OrganicCamoSettings>
}
