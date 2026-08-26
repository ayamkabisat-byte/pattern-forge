import type { CamoEngine, CamoPatternData, CamoPreset, DigitalCamoSettings, OrganicCamoSettings } from './types'

export const DEFAULT_DIGITAL: DigitalCamoSettings = {
  resolution: 128,
  blockScale: 0.58,
  macroRegion: 0.72,
  mediumBreakup: 0.42,
  stairStep: 0.72,
  fragmentation: 0.36,
  islandAmount: 0.16,
  orthogonalCleanup: 0.68,
  colorWeights: [34, 26, 19, 13, 8],

  macroScale: 0.68,
  mediumScale: 0.46,
  microDetail: 0.28,
  density: 0.62,
  rectangularBias: 0.88,
  roughness: 0.32,
  smoothingPasses: 1,
}

export const DEFAULT_ORGANIC: OrganicCamoSettings = {
  tileSize: 512,
  fieldResolution: 96,
  macroScale: 0.72,
  mediumBreakup: 0.42,
  edgeComplexity: 0.36,
  branching: 0.48,
  islandAmount: 0.14,
  contourSmoothness: 0.7,
  direction: 'none',
  simplification: 0.32,
  detail: 'balanced',
  colorWeights: [34, 26, 19, 13, 8],
  spotAmount: 0.42,
  spotScale: 0.42,
  spotInnerScale: 0.5,
  hybridBlockAmount: 0.24,

  blobCount: 34,
  blobScale: 0.46,
  smoothness: 0.74,
  distortion: 0.38,
  elongation: 0.34,
  overlap: 0.46,
  coverage: 0.68,
}

const digital = (id: string, name: string, note: string, palette: string[], values: Partial<DigitalCamoSettings>): CamoPreset => ({ id, name, note, palette, mode: 'digital', engine: 'digital-region', digital: values })
const organic = (id: string, name: string, note: string, palette: string[], engine: Extract<CamoEngine, 'interlocking' | 'pebble' | 'hybrid'>, values: Partial<OrganicCamoSettings>): CamoPreset => ({ id, name, note, palette, mode: 'organic', engine, organic: values })

export const CAMO_PRESETS: CamoPreset[] = [
  digital('forest-digital', 'Forest Digital', 'Large connected orthogonal regions with restrained small islands.', ['#18251C','#344936','#68714A','#9B8C5B','#372F25'], { blockScale: .58, macroRegion: .78, mediumBreakup: .38, stairStep: .78, fragmentation: .32, islandAmount: .12, orthogonalCleanup: .78 }),
  digital('urban-digital', 'Urban Digital', 'Cool gray connected regions with stronger stair-step breakup.', ['#202428','#50575C','#7F878A','#B8BCBD','#DDDFDF'], { blockScale: .48, macroRegion: .68, mediumBreakup: .52, stairStep: .86, fragmentation: .46, islandAmount: .18, orthogonalCleanup: .72 }),
  digital('desert-digital', 'Desert Digital', 'Broad sand regions with sparse dark geometric breakup.', ['#DCC9A5','#B69D73','#8C724F','#62523B','#EEE0C3'], { blockScale: .64, macroRegion: .82, mediumBreakup: .34, stairStep: .72, fragmentation: .26, islandAmount: .1, orthogonalCleanup: .82 }),
  digital('snow-digital', 'Snow Digital', 'Open pale field with compact cool-gray digital regions.', ['#F0F3F2','#D8DEDF','#AAB6BA','#75858B','#4E5C62'], { blockScale: .6, macroRegion: .76, mediumBreakup: .38, stairStep: .8, fragmentation: .32, islandAmount: .1, orthogonalCleanup: .78 }),
  digital('jungle-digital', 'Jungle Digital', 'Denser connected blocks with more medium-scale branching.', ['#142419','#2E4C31','#56713E','#879055','#443926'], { blockScale: .44, macroRegion: .66, mediumBreakup: .58, stairStep: .82, fragmentation: .54, islandAmount: .22, orthogonalCleanup: .62 }),
  digital('midnight-digital', 'Midnight Digital', 'Dark block field with compact cool accents.', ['#0D1115','#1A2229','#2D3942','#4A5961','#738087'], { blockScale: .5, macroRegion: .72, mediumBreakup: .48, stairStep: .84, fragmentation: .42, islandAmount: .18, orthogonalCleanup: .7 }),

  organic('woodland-interlock', 'Woodland Interlock', 'Large interlocking green/earth regions with branching necks and coves.', ['#17231A','#3B4D32','#70724A','#9A8959','#392E23'], 'interlocking', { macroScale: .78, mediumBreakup: .46, edgeComplexity: .36, branching: .62, islandAmount: .12, contourSmoothness: .72 }),
  organic('urban-interlock', 'Urban Interlock', 'Interlocking grayscale regions with medium edge complexity.', ['#23272A','#555A5D','#858A8C','#B9B9B7','#DEDCDA'], 'interlocking', { macroScale: .7, mediumBreakup: .52, edgeComplexity: .42, branching: .56, islandAmount: .14, contourSmoothness: .68 }),
  organic('jungle-interlock', 'Jungle Interlock', 'Denser organic region field with more branching and smaller islands.', ['#132218','#2B472E','#53673B','#7D8549','#403528'], 'interlocking', { macroScale: .66, mediumBreakup: .58, edgeComplexity: .48, branching: .7, islandAmount: .2, contourSmoothness: .66 }),
  organic('desert-interlock', 'Desert Interlock', 'Broad warm organic regions with calm contours.', ['#DFCCAA','#BCA17A','#947653','#6A553E','#EFE1C5'], 'interlocking', { macroScale: .84, mediumBreakup: .34, edgeComplexity: .26, branching: .44, islandAmount: .08, contourSmoothness: .8 }),

  organic('desert-pebble', 'Desert Pebble', 'Macro organic field plus nested pebble/spot breakup inspired by two-scale desert camouflage.', ['#D8C39D','#A98B62','#6F5A41','#3E352C','#E9D6B8'], 'pebble', { macroScale: .84, mediumBreakup: .28, edgeComplexity: .24, branching: .38, islandAmount: .08, contourSmoothness: .82, spotAmount: .62, spotScale: .46, spotInnerScale: .48 }),
  organic('stone-pebble', 'Stone Pebble', 'Cool stone field with irregular nested micro-spots.', ['#D6D4CF','#A7A8A4','#797E7D','#4F5758','#2F3637'], 'pebble', { macroScale: .78, mediumBreakup: .34, edgeComplexity: .3, branching: .42, islandAmount: .1, contourSmoothness: .76, spotAmount: .56, spotScale: .4, spotInnerScale: .54 }),

  organic('organic-digital-hybrid', 'Organic + Digital', 'Smooth macro regions with restrained orthogonal breakup on top.', ['#19261D','#3A5036','#687248','#9A8B59','#362F25'], 'hybrid', { macroScale: .76, mediumBreakup: .44, edgeComplexity: .34, branching: .58, islandAmount: .12, contourSmoothness: .72, hybridBlockAmount: .3 }),
  organic('urban-hybrid', 'Urban Hybrid', 'Gray interlocking field with small digital breakup accents.', ['#23272A','#545A5F','#7B858A','#AFB6B8','#D8DDDE'], 'hybrid', { macroScale: .7, mediumBreakup: .48, edgeComplexity: .38, branching: .52, islandAmount: .14, contourSmoothness: .7, hybridBlockAmount: .36 }),
]

export function presetById(id: string) {
  return CAMO_PRESETS.find((preset) => preset.id === id) ?? CAMO_PRESETS[0]
}

function defaultEngine(mode: 'digital' | 'organic'): CamoEngine {
  return mode === 'digital' ? 'digital-region' : 'interlocking'
}

export function normalizeCamoData(input: Partial<CamoPatternData> | null | undefined): CamoPatternData {
  const base = initialCamoData(false)
  if (!input) return base
  const mode = input.mode === 'organic' ? 'organic' : 'digital'
  const engine = input.engine ?? defaultEngine(mode)
  const digital = { ...DEFAULT_DIGITAL, ...(input.digital ?? {}), colorWeights: [...(input.digital?.colorWeights ?? DEFAULT_DIGITAL.colorWeights)] }
  const organic = { ...DEFAULT_ORGANIC, ...(input.organic ?? {}), colorWeights: [...(input.organic?.colorWeights ?? DEFAULT_ORGANIC.colorWeights)] }
  const palette = input.palette?.length ? [...input.palette] : [...base.palette]
  return {
    ...base,
    ...input,
    mode,
    engine,
    generatorVersion: 2,
    palette,
    digital,
    organic,
    backgroundColor: Math.max(0, Math.min(palette.length - 1, Number(input.backgroundColor ?? 0))),
    tileWidth: mode === 'digital' ? digital.resolution : organic.tileSize,
    tileHeight: mode === 'digital' ? digital.resolution : organic.tileSize,
  }
}

export function initialCamoData(withNormalize = true): CamoPatternData {
  const preset = CAMO_PRESETS[0]
  const raw: CamoPatternData = {
    mode: 'digital',
    engine: preset.engine,
    generatorVersion: 2,
    presetId: preset.id,
    tileWidth: DEFAULT_DIGITAL.resolution,
    tileHeight: DEFAULT_DIGITAL.resolution,
    palette: [...preset.palette],
    backgroundMode: 'solid',
    backgroundColor: 0,
    seed: 582934,
    exportLongSide: 4096,
    digital: { ...DEFAULT_DIGITAL, colorWeights: [...DEFAULT_DIGITAL.colorWeights], ...(preset.digital ?? {}) },
    organic: { ...DEFAULT_ORGANIC, colorWeights: [...DEFAULT_ORGANIC.colorWeights] },
  }
  return withNormalize ? raw : raw
}
