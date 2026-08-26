export type MonogramLayout = 'grid' | 'brick' | 'diagonal' | 'diamond'
export type AlternateRotation = 'none' | '180' | '90'

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
}
