export type MonogramLayout = 'grid' | 'brick' | 'diagonal' | 'diamond'
export type AlternateRotation = 'none' | '180' | '90'
export type LuxuryShapeCategory = 'main' | 'filler' | 'border' | 'corner' | 'medallion' | 'strip'

export type LuxuryCustomShape = {
  id: string
  name: string
  category: LuxuryShapeCategory
  roles: string[]
  body: string
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
  version: 1
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
  customShapes?: LuxuryCustomShape[]
}

export type ScarfCenterMode = 'empty' | 'pattern' | 'sparse-pattern' | 'medallion' | 'pattern-medallion'
export type ScarfCornerMode = 'rotate' | 'mirror' | 'same'

export type LuxuryScarfData = {
  version: 1
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
  customShapes?: LuxuryCustomShape[]
}

export type LuxuryPatternData = LuxuryMonogramData | LuxuryScarfData

export function isLuxuryScarf(data: LuxuryPatternData | undefined): data is LuxuryScarfData {
  return Boolean(data && 'mode' in data && data.mode === 'scarf')
}
