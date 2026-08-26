export type ExportPreset = {
  id: string
  label: string
  group: string
  width: number
  height: number
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: 'logo-512', label: 'Logo 512', group: 'Logo', width: 512, height: 512 },
  { id: 'logo-1024', label: 'Logo 1024', group: 'Logo', width: 1024, height: 1024 },
  { id: 'logo-2000', label: 'Logo 2000', group: 'Logo', width: 2000, height: 2000 },

  { id: 'web-hd', label: 'Web Full HD', group: 'Web', width: 1920, height: 1080 },
  { id: 'web-wide', label: 'Web Banner', group: 'Web', width: 1920, height: 600 },
  { id: 'web-1440', label: 'Web 1440×900', group: 'Web', width: 1440, height: 900 },
  { id: '4k', label: '4K UHD', group: 'Web', width: 3840, height: 2160 },

  { id: 'ig-square', label: 'Instagram Square', group: 'Social', width: 1080, height: 1080 },
  { id: 'ig-portrait', label: 'Instagram Portrait', group: 'Social', width: 1080, height: 1350 },
  { id: 'story', label: 'Story / Reel', group: 'Social', width: 1080, height: 1920 },

  { id: 'stock-4000', label: 'Stock Square 4000', group: 'Stock', width: 4000, height: 4000 },
  { id: 'stock-5000', label: 'Stock Square 5000', group: 'Stock', width: 5000, height: 5000 },
  { id: 'stock-6000', label: 'Stock Square 6000', group: 'Stock', width: 6000, height: 6000 },

  { id: 'a4-300', label: 'A4 @300dpi', group: 'Print', width: 2480, height: 3508 },
]

export const SPACING_PRESETS = [
  { id: 'exact', label: 'Exact Tile', h: 0, v: 0, px: 0, py: 0 },
  { id: 'airy', label: 'Airy', h: 24, v: 24, px: 10, py: 10 },
  { id: 'balanced', label: 'Balanced', h: 8, v: 8, px: 8, py: 8 },
  { id: 'micro', label: 'Micro Gap', h: 2, v: 2, px: 5, py: 5 },
  { id: 'flush', label: 'Flush', h: 0, v: 0, px: 2, py: 2 },
  { id: 'overlap', label: 'Overlap', h: -8, v: -8, px: 5, py: 5 },
  { id: 'interlock', label: 'Interlock', h: -20, v: -20, px: 4, py: 4 },
] as const
