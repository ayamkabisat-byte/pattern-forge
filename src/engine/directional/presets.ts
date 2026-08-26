import type { DirectionalPatternData, DirectionalPresetId } from './types'

export type DirectionalPreset = { id: DirectionalPresetId; name: string; note: string; patch: Partial<DirectionalPatternData> }

export const DIRECTIONAL_PRESETS: DirectionalPreset[] = [
  { id:'parang-row', name:'Parang Interlock Rows', note:'Best for a paired Parang SVG that is already diagonal. Keeps the artwork orientation, overlaps rows, and half-phases every lane.', patch:{ targetAngle:0, motifLongSide:210, alongGap:-26, laneGap:-48, lanePhase:.5, rotateWithLane:false, alternateLaneFlip:false, alternateMotifFlip:false, alternateMotifRotation:0, tileWidth:800, tileHeight:800 } },
  { id:'parang-diagonal', name:'Parang Diagonal Lane', note:'For a single motif that should travel along a diagonal toroidal lane. Turn Rotate SVG with lane on if the artwork itself is not already angled.', patch:{ targetAngle:-45, motifLongSide:210, alongGap:-24, laneGap:-30, lanePhase:.5, rotateWithLane:false, alternateLaneFlip:false, alternateMotifFlip:false, alternateMotifRotation:0, tileWidth:800, tileHeight:800 } },
  { id:'horizontal-row', name:'Horizontal Textile Row', note:'For uploaded Pucuk Rabung, Itik Pulang Patang, border, or other straight-row motifs.', patch:{ targetAngle:0, motifLongSide:190, alongGap:8, laneGap:22, lanePhase:0, rotateWithLane:false, alternateLaneFlip:false, alternateMotifFlip:false, alternateMotifRotation:0, tileWidth:900, tileHeight:600 } },
  { id:'vertical-strip', name:'Vertical Ornament Strip', note:'Vertical repeating lanes for strip or border motifs.', patch:{ targetAngle:90, motifLongSide:190, alongGap:8, laneGap:22, lanePhase:0, rotateWithLane:false, alternateLaneFlip:false, alternateMotifFlip:false, alternateMotifRotation:0, tileWidth:600, tileHeight:900 } },
  { id:'ornament-row', name:'Alternating Ornament Row', note:'Horizontal lanes with alternate motif rotation for rhythmic repeats.', patch:{ targetAngle:0, motifLongSide:170, alongGap:4, laneGap:18, lanePhase:.5, rotateWithLane:false, alternateLaneFlip:false, alternateMotifFlip:false, alternateMotifRotation:180, tileWidth:900, tileHeight:600 } },
  { id:'sweater-row', name:'Sweater / Nordic Row', note:'Compact repeated rows with alternating lane mirror.', patch:{ targetAngle:0, motifLongSide:150, alongGap:2, laneGap:12, lanePhase:.5, rotateWithLane:false, alternateLaneFlip:true, alternateMotifFlip:false, alternateMotifRotation:0, tileWidth:900, tileHeight:600 } },
  { id:'custom', name:'Custom Direction', note:'Start neutral and tune the toroidal lane structure yourself.', patch:{ targetAngle:-35, motifLongSide:180, alongGap:0, laneGap:0, lanePhase:0, rotateWithLane:false, alternateLaneFlip:false, alternateMotifFlip:false, alternateMotifRotation:0, tileWidth:800, tileHeight:800 } },
]

export function initialDirectionalPattern(): DirectionalPatternData {
  return {
    version:1,
    presetId:'parang-row',
    motif:null,
    tileWidth:800,
    tileHeight:800,
    targetAngle:0,
    motifLongSide:210,
    motifRotationOffset:0,
    rotateWithLane:false,
    alongGap:-26,
    laneGap:-48,
    lanePhase:.5,
    trimArtwork:true,
    trimPaddingPercent:1,
    alternateLaneFlip:false,
    alternateMotifFlip:false,
    alternateMotifRotation:0,
    backgroundMode:'transparent',
    backgroundColor:'#F2EBDD',
    exportLongSide:4096,
  }
}

export function applyDirectionalPreset(current: DirectionalPatternData, id: DirectionalPresetId) {
  const preset = DIRECTIONAL_PRESETS.find((item) => item.id === id)
  return preset ? { ...current, ...preset.patch, presetId:id, motif:current.motif } : current
}
