export type MonogramLayout = 'grid' | 'brick' | 'diagonal' | 'diamond'
export type AlternateRotation = 'none' | '180' | '90'
export type LuxuryGeometryPreset = 'legacy' | 'square-lattice' | 'diamond-lattice' | 'wide-rhombus' | 'tall-rhombus' | 'trellis' | 'offset-trellis' | 'cross-lattice'
export type LuxuryMainAnchor = 'origin' | 'cell-center' | 'edge-x' | 'edge-y' | 'alternate'
export type LuxuryFillerAnchor = 'cell-center' | 'edge-x' | 'edge-y' | 'alternate-cells' | 'four-corners'
export type LuxurySymmetry = 'none' | 'mirror-x' | 'mirror-y' | 'mirror-xy' | 'half-turn' | 'quarter-turn' | 'glide'
export type LuxuryShapeCategory = 'main' | 'filler' | 'border' | 'corner' | 'medallion' | 'strip'

export type LuxuryReusableShape = {
  id: string
  name: string
  category: LuxuryShapeCategory
  roles: string[]
  body: string
  originalColors?: string[]
  sourceViewBox?: string
}

export type LuxuryCustomShape = LuxuryReusableShape & {
  originalColors: string[]
  sourceViewBox: string
}

export type LuxuryMotifInstance = {
  motifId: string
  scale: number
  rotation: number
  mirrorX: boolean
  mirrorY: boolean
  enabled: boolean
  colorRoles: Record<string, number>
}

export type LuxuryMonogramData = {
  version: 1 | 2
  tileWidth: number
  tileHeight: number
  layout: MonogramLayout
  mainMotif: LuxuryMotifInstance
  fillerMotif: LuxuryMotifInstance
  spacingX: number
  spacingY: number
  offsetX: number
  offsetY: number
  alternateRotation: AlternateRotation
  mirrorRows: boolean
  mirrorColumns: boolean
  palette: string[]
  backgroundMode: 'solid' | 'transparent'
  backgroundColor: number
  exportLongSide: number
  customShapes?: LuxuryReusableShape[]

  geometryPreset?: LuxuryGeometryPreset
  rowPhase?: number
  columnPhase?: number
  mainAnchor?: LuxuryMainAnchor
  fillerAnchor?: LuxuryFillerAnchor
  symmetry?: LuxurySymmetry
  alternateMainScale?: number
  alternateFillerScale?: number
}

export type ScarfCenterMode = 'empty' | 'pattern' | 'sparse-pattern' | 'medallion' | 'pattern-medallion'
export type ScarfCornerMode = 'rotate' | 'mirror' | 'same'
export type ScarfSide = 'top' | 'right' | 'bottom' | 'left'
export type ScarfSideLinkMode = 'all' | 'opposite' | 'independent'
export type ScarfSideSymmetry = 'copy' | 'rotate' | 'mirror' | 'alternate'
export type ScarfCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'
export type ScarfCornerLinkMode = 'all' | 'independent'
export type ScarfFrameSource = 'solid' | 'global-pattern' | 'custom-pattern'

export type ScarfSidePattern = {
  enabled: boolean
  sourceSvg?: string
  sourceName?: string
  scale: number
  spacing: number
  offset: number
  opacity: number
  rotation: number
  mirrorX: boolean
  mirrorY: boolean
  bandWidth: number
  inset: number
}

export type ScarfFrameLayer = {
  id: 'outer' | 'inner' | 'accent'
  name: string
  enabled: boolean
  inset: number
  width: number
  color: number
  source: ScarfFrameSource
  patternSvg?: string
  patternName?: string
  patternScale: number
  opacity: number
}

export type ScarfCornerSlot = {
  enabled: boolean
  shapeId: string
  scale: number
  inset: number
  rotation: number
  mirrorX: boolean
  mirrorY: boolean
  colorRoles: Record<string, number>
}

export type ScarfBorderScatter = {
  enabled: boolean
  depth: number
  rows: number
  density: number
  baseOpacity: number
  scaleFalloff: number
  opacityFalloff: number
}

export type LuxuryScarfData = {
  version: 1 | 2
  mode: 'scarf'
  product: 'scarf' | 'hijab'
  canvasSize: number
  physicalSizeCm: number
  palette: string[]
  backgroundColor: number
  exportLongSide: number
  outerBorderWidth: number
  outerBorderColor: number
  innerBorderWidth: number
  innerBorderColor: number
  borderPatternEnabled: boolean
  sourcePatternSvg?: string
  sourcePatternName?: string
  centerMode: ScarfCenterMode
  patternScale: number
  centerPatternOpacity: number
  safeMargin: number
  centerCalmness: number
  cornerEnabled: boolean
  cornerShapeId: string
  cornerScale: number
  cornerInset: number
  cornerMode: ScarfCornerMode
  cornerColorRoles: Record<string, number>
  medallionEnabled: boolean
  medallionShapeId: string
  medallionScale: number
  medallionColorRoles: Record<string, number>
  customShapes?: LuxuryReusableShape[]

  sideLinkMode?: ScarfSideLinkMode
  sideSymmetry?: ScarfSideSymmetry
  sides?: Record<ScarfSide, ScarfSidePattern>
  frames?: ScarfFrameLayer[]
  cornerLinkMode?: ScarfCornerLinkMode
  corners?: Record<ScarfCorner, ScarfCornerSlot>
  scatter?: ScarfBorderScatter
}

export type LuxuryPatternData = LuxuryMonogramData | LuxuryScarfData

export function isLuxuryScarf(data: LuxuryPatternData | undefined): data is LuxuryScarfData {
  return Boolean(data && 'mode' in data && data.mode === 'scarf')
}
