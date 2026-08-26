export type CamoMode = 'digital' | 'organic'
export type CamoBackgroundMode = 'solid' | 'transparent'
export type OrganicDirection = 'none' | 'horizontal' | 'vertical' | 'diagonal'
export type OrganicSvgDetail = 'clean' | 'balanced' | 'detailed'
export type DigitalResolution = 32 | 64 | 128 | 256

export type DigitalCamoSettings = {
  resolution: DigitalResolution
  macroScale: number
  mediumScale: number
  microDetail: number
  density: number
  fragmentation: number
  rectangularBias: number
  roughness: number
  smoothingPasses: number
  colorWeights: number[]
}

export type OrganicCamoSettings = {
  tileSize: 256 | 512 | 1024
  blobCount: number
  blobScale: number
  smoothness: number
  edgeComplexity: number
  distortion: number
  elongation: number
  overlap: number
  coverage: number
  direction: OrganicDirection
  simplification: number
  detail: OrganicSvgDetail
  colorWeights: number[]
}

export type CamoPatternData = {
  mode: CamoMode
  generatorVersion: 1
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
  note: string
  palette: string[]
  digital?: Partial<DigitalCamoSettings>
  organic?: Partial<OrganicCamoSettings>
}
