import type { CamoPatternData, CamoPreset, DigitalCamoSettings, OrganicCamoSettings } from './types'

export const DEFAULT_DIGITAL: DigitalCamoSettings = {
  resolution: 128,
  macroScale: 0.68,
  mediumScale: 0.46,
  microDetail: 0.28,
  density: 0.62,
  fragmentation: 0.38,
  rectangularBias: 0.88,
  roughness: 0.32,
  smoothingPasses: 1,
  colorWeights: [35, 25, 18, 14, 8],
}

export const DEFAULT_ORGANIC: OrganicCamoSettings = {
  tileSize: 512,
  blobCount: 34,
  blobScale: 0.46,
  smoothness: 0.74,
  edgeComplexity: 0.48,
  distortion: 0.38,
  elongation: 0.34,
  overlap: 0.46,
  coverage: 0.68,
  direction: 'none',
  simplification: 0.42,
  detail: 'balanced',
  colorWeights: [34, 25, 18, 15, 8],
}

export const CAMO_PRESETS: CamoPreset[] = [
  { id: 'forest-digital', name: 'Forest Digital', mode: 'digital', note: 'Dense green block breakup with medium macro clusters.', palette: ['#15241F','#304A35','#66744A','#A4925C','#372F25'], digital: { macroScale: .68, mediumScale: .46, microDetail: .28, density: .64, fragmentation: .38, roughness: .28, rectangularBias: .92 } },
  { id: 'desert-digital', name: 'Desert Digital', mode: 'digital', note: 'Warm sand blocks with restrained dark accents.', palette: ['#D8C39C','#B49A6D','#88704C','#5F513A','#E8D9B9'], digital: { macroScale: .72, mediumScale: .5, microDetail: .2, density: .58, fragmentation: .32, roughness: .24, rectangularBias: .94 } },
  { id: 'urban-digital', name: 'Urban Digital', mode: 'digital', note: 'Cool grayscale and blue-gray geometric breakup.', palette: ['#202429','#4A5158','#7B858C','#B5BDC1','#E1E4E5'], digital: { macroScale: .58, mediumScale: .5, microDetail: .34, density: .66, fragmentation: .48, roughness: .38, rectangularBias: .9 } },
  { id: 'snow-digital', name: 'Snow Digital', mode: 'digital', note: 'Light field with sparse cool gray pixel clusters.', palette: ['#F3F5F4','#DDE4E4','#AFBCC1','#77878D','#4F5C62'], digital: { macroScale: .62, mediumScale: .44, microDetail: .22, density: .5, fragmentation: .34, roughness: .26, rectangularBias: .9 } },
  { id: 'navy-digital', name: 'Navy Digital', mode: 'digital', note: 'Dark navy, slate and muted teal blocks.', palette: ['#101A24','#1D3141','#355160','#60747A','#182428'], digital: { macroScale: .64, mediumScale: .5, microDetail: .3, density: .67, fragmentation: .4, roughness: .3, rectangularBias: .9 } },
  { id: 'jungle-digital', name: 'Jungle Digital', mode: 'digital', note: 'High-contrast humid green palette with small breakup.', palette: ['#14261A','#295236','#4F7340','#889653','#493C27'], digital: { macroScale: .6, mediumScale: .45, microDetail: .42, density: .72, fragmentation: .52, roughness: .4, rectangularBias: .86 } },
  { id: 'earth-digital', name: 'Earth Digital', mode: 'digital', note: 'Brown, olive and stone block pattern.', palette: ['#2A2A22','#554D35','#7A6947','#A18A60','#C5B287'], digital: { macroScale: .7, mediumScale: .48, microDetail: .25, density: .6, fragmentation: .36, roughness: .28, rectangularBias: .92 } },
  { id: 'midnight-digital', name: 'Midnight Digital', mode: 'digital', note: 'Near-black digital pattern with cool muted accents.', palette: ['#0B0F13','#171E25','#28333D','#3C4A54','#66727A'], digital: { macroScale: .6, mediumScale: .46, microDetail: .38, density: .7, fragmentation: .5, roughness: .36, rectangularBias: .9 } },

  { id: 'woodland-organic', name: 'Woodland Organic', mode: 'organic', note: 'Layered irregular green and earth blobs.', palette: ['#17271C','#35523A','#6A7544','#9A8D59','#3B3023'], organic: { blobCount: 36, blobScale: .48, smoothness: .76, edgeComplexity: .5, distortion: .4, elongation: .38, overlap: .52, coverage: .72 } },
  { id: 'desert-organic', name: 'Desert Blotch', mode: 'organic', note: 'Broad warm blotches with low contour aggression.', palette: ['#E2D0AA','#BDA477','#927650','#67543B','#F0E2C5'], organic: { blobCount: 28, blobScale: .58, smoothness: .82, edgeComplexity: .38, distortion: .3, elongation: .34, overlap: .5, coverage: .68 } },
  { id: 'jungle-organic', name: 'Jungle Organic', mode: 'organic', note: 'Denser foliage-like abstract camouflage.', palette: ['#102219','#24452D','#4D6B37','#7F8A49','#3B3224'], organic: { blobCount: 42, blobScale: .42, smoothness: .68, edgeComplexity: .62, distortion: .52, elongation: .44, overlap: .58, coverage: .78 } },
  { id: 'urban-organic', name: 'Urban Blotch', mode: 'organic', note: 'Irregular grayscale blotches with medium contrast.', palette: ['#202428','#4A5055','#777F84','#AEB4B7','#D9DDDE'], organic: { blobCount: 34, blobScale: .46, smoothness: .72, edgeComplexity: .52, distortion: .42, elongation: .28, overlap: .48, coverage: .7 } },
  { id: 'snow-organic', name: 'Snow Organic', mode: 'organic', note: 'Pale cool organic patches with sparse darker forms.', palette: ['#F2F5F4','#DCE4E5','#B7C4C8','#819198','#56656B'], organic: { blobCount: 27, blobScale: .52, smoothness: .84, edgeComplexity: .34, distortion: .26, elongation: .3, overlap: .4, coverage: .56 } },
  { id: 'earth-organic', name: 'Earth Mud', mode: 'organic', note: 'Low-saturation soil and stone organic field.', palette: ['#28271F','#514A37','#76664B','#9C835D','#C0AA82'], organic: { blobCount: 32, blobScale: .5, smoothness: .74, edgeComplexity: .48, distortion: .38, elongation: .42, overlap: .5, coverage: .7 } },
  { id: 'moss-organic', name: 'Moss Organic', mode: 'organic', note: 'Soft moss-green blobs with subtle dark breakup.', palette: ['#1B281B','#3D5531','#667443','#8E9663','#53452F'], organic: { blobCount: 38, blobScale: .44, smoothness: .78, edgeComplexity: .44, distortion: .36, elongation: .28, overlap: .55, coverage: .75 } },
  { id: 'retro-organic', name: 'Retro Organic', mode: 'organic', note: 'Bold warm vintage abstract camouflage.', palette: ['#24342B','#66704D','#B59A5C','#8B4D3D','#D2B77B'], organic: { blobCount: 26, blobScale: .6, smoothness: .86, edgeComplexity: .32, distortion: .28, elongation: .48, overlap: .48, coverage: .66 } },
]

export function presetById(id: string) {
  return CAMO_PRESETS.find((preset) => preset.id === id) ?? CAMO_PRESETS[0]
}

export function initialCamoData(): CamoPatternData {
  const preset = CAMO_PRESETS[0]
  return {
    mode: 'digital',
    generatorVersion: 1,
    presetId: preset.id,
    tileWidth: DEFAULT_DIGITAL.resolution,
    tileHeight: DEFAULT_DIGITAL.resolution,
    palette: [...preset.palette],
    backgroundMode: 'solid',
    backgroundColor: 0,
    seed: 582934,
    exportLongSide: 4096,
    digital: { ...DEFAULT_DIGITAL, colorWeights: [...DEFAULT_DIGITAL.colorWeights], ...preset.digital },
    organic: { ...DEFAULT_ORGANIC, colorWeights: [...DEFAULT_ORGANIC.colorWeights] },
  }
}
