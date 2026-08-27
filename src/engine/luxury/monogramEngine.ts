import { resolveLuxuryMotif } from './motifs'
import type {
  LuxuryFillerAnchor,
  LuxuryGeometryPreset,
  LuxuryMainAnchor,
  LuxuryMonogramData,
  LuxuryMotifInstance,
  LuxurySymmetry,
} from './types'

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const mod = (value: number, size: number) => ((value % size) + size) % size
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export type LuxurySeamlessMetrics = {
  columns: number
  rows: number
  stepX: number
  stepY: number
  columnCycle: number
  rowCycle: number
  rowPhaseCycle: number
  columnPhaseCycle: number
}

export function initialLuxuryMonogram(): LuxuryMonogramData {
  return {
    version: 2,
    tileWidth: 400,
    tileHeight: 400,
    layout: 'diamond',
    mainMotif: { motifId: 'quatrefoil-01', scale: 0.72, rotation: 0, mirrorX: false, mirrorY: false, enabled: true, colorRoles: { primary: 0, secondary: 1, accent: 2 } },
    fillerMotif: { motifId: 'tiny-diamond', scale: 0.24, rotation: 0, mirrorX: false, mirrorY: false, enabled: true, colorRoles: { primary: 2, secondary: 1, accent: 0 } },
    spacingX: 150,
    spacingY: 150,
    offsetX: 0,
    offsetY: 0,
    alternateRotation: 'none',
    mirrorRows: false,
    mirrorColumns: false,
    palette: ['#20362F', '#D5B15D', '#EFE4CD', '#7B2638'],
    backgroundMode: 'solid',
    backgroundColor: 2,
    exportLongSide: 4096,
    customShapes: [],
    geometryPreset: 'legacy',
    rowPhase: 0,
    columnPhase: 0,
    mainAnchor: 'origin',
    fillerAnchor: 'cell-center',
    symmetry: 'none',
    alternateMainScale: 1,
    alternateFillerScale: 1,
  }
}

function quantizePhase(value: number | undefined) {
  return clamp(Math.round((Number(value) || 0) * 8) / 8, -1, 1)
}

export function normalizeLuxuryMonogram(raw: LuxuryMonogramData): LuxuryMonogramData {
  const base = initialLuxuryMonogram()
  return {
    ...base,
    ...raw,
    version: 2,
    mainMotif: { ...base.mainMotif, ...raw.mainMotif, colorRoles: { ...base.mainMotif.colorRoles, ...(raw.mainMotif?.colorRoles ?? {}) } },
    fillerMotif: { ...base.fillerMotif, ...raw.fillerMotif, colorRoles: { ...base.fillerMotif.colorRoles, ...(raw.fillerMotif?.colorRoles ?? {}) } },
    palette: Array.isArray(raw.palette) && raw.palette.length ? [...raw.palette] : [...base.palette],
    customShapes: [...(raw.customShapes ?? [])],
    geometryPreset: raw.geometryPreset ?? 'legacy',
    rowPhase: quantizePhase(raw.rowPhase),
    columnPhase: quantizePhase(raw.columnPhase),
    mainAnchor: raw.mainAnchor ?? 'origin',
    fillerAnchor: raw.fillerAnchor ?? 'cell-center',
    symmetry: raw.symmetry ?? 'none',
    alternateMainScale: clamp(Number(raw.alternateMainScale) || 1, 0.25, 2),
    alternateFillerScale: clamp(Number(raw.alternateFillerScale) || 1, 0.25, 2),
  }
}

export function applyLuxuryGeometryPreset(raw: LuxuryMonogramData, preset: LuxuryGeometryPreset): LuxuryMonogramData {
  const data = normalizeLuxuryMonogram(raw)
  const avg = Math.max(60, (data.spacingX + data.spacingY) / 2)
  if (preset === 'legacy') return { ...data, geometryPreset: preset, rowPhase: 0, columnPhase: 0, mainAnchor: 'origin', fillerAnchor: 'cell-center', symmetry: 'none', alternateMainScale: 1, alternateFillerScale: 1 }
  if (preset === 'square-lattice') return { ...data, geometryPreset: preset, layout: 'grid', spacingX: avg, spacingY: avg, rowPhase: 0, columnPhase: 0, mainAnchor: 'origin', fillerAnchor: 'cell-center', symmetry: 'none', alternateMainScale: 1, alternateFillerScale: 1 }
  if (preset === 'diamond-lattice') return { ...data, geometryPreset: preset, layout: 'grid', spacingX: avg, spacingY: avg, rowPhase: .5, columnPhase: 0, mainAnchor: 'origin', fillerAnchor: 'cell-center', symmetry: 'none', alternateMainScale: 1, alternateFillerScale: 1 }
  if (preset === 'wide-rhombus') return { ...data, geometryPreset: preset, layout: 'grid', spacingX: avg * 1.35, spacingY: avg * .82, rowPhase: .5, columnPhase: 0, mainAnchor: 'origin', fillerAnchor: 'cell-center', symmetry: 'mirror-y', alternateMainScale: 1, alternateFillerScale: .9 }
  if (preset === 'tall-rhombus') return { ...data, geometryPreset: preset, layout: 'grid', spacingX: avg * .82, spacingY: avg * 1.35, rowPhase: .5, columnPhase: 0, mainAnchor: 'origin', fillerAnchor: 'cell-center', symmetry: 'mirror-x', alternateMainScale: 1, alternateFillerScale: .9 }
  if (preset === 'trellis') return { ...data, geometryPreset: preset, layout: 'grid', rowPhase: .5, columnPhase: 0, mainAnchor: 'origin', fillerAnchor: 'four-corners', symmetry: 'mirror-xy', alternateMainScale: 1, alternateFillerScale: .72 }
  if (preset === 'offset-trellis') return { ...data, geometryPreset: preset, layout: 'grid', rowPhase: .25, columnPhase: .25, mainAnchor: 'origin', fillerAnchor: 'edge-x', symmetry: 'half-turn', alternateMainScale: .86, alternateFillerScale: .72 }
  return { ...data, geometryPreset: 'cross-lattice', layout: 'grid', rowPhase: 0, columnPhase: 0, mainAnchor: 'alternate', fillerAnchor: 'edge-x', symmetry: 'quarter-turn', alternateMainScale: .72, alternateFillerScale: .66 }
}

function gcd(a: number, b: number) {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y) [x, y] = [y, x % y]
  return x || 1
}

function lcm(a: number, b: number) {
  return Math.abs(a * b) / gcd(a, b)
}

function phaseCycle(value: number | undefined) {
  const eighths = Math.abs(Math.round(quantizePhase(value) * 8))
  if (!eighths) return 1
  return 8 / gcd(eighths, 8)
}

function nearestCompatibleCount(total: number, targetSpacing: number, cycle: number) {
  const safeTotal = Math.max(1, total)
  const target = Math.max(20, targetSpacing)
  const safeCycle = Math.max(1, Math.round(cycle))
  const raw = safeTotal / target
  const center = Math.max(1, Math.round(raw / safeCycle))
  const candidates = new Set<number>()
  for (let delta = -2; delta <= 2; delta++) candidates.add(Math.max(safeCycle, (center + delta) * safeCycle))
  let best = safeCycle
  let bestError = Infinity
  for (const count of candidates) {
    const error = Math.abs(safeTotal / count - target)
    if (error < bestError || (Math.abs(error - bestError) < 1e-9 && count > best)) { best = count; bestError = error }
  }
  return Math.max(1, best)
}

function symmetryCycles(symmetry: LuxurySymmetry | undefined) {
  if (symmetry === 'quarter-turn') return { x: 4, y: 4 }
  if (symmetry === 'mirror-x') return { x: 2, y: 1 }
  if (symmetry === 'mirror-y') return { x: 1, y: 2 }
  if (symmetry === 'mirror-xy' || symmetry === 'half-turn') return { x: 2, y: 2 }
  if (symmetry === 'glide') return { x: 1, y: 2 }
  return { x: 1, y: 1 }
}

export function luxuryMonogramMetrics(raw: LuxuryMonogramData): LuxurySeamlessMetrics {
  const data = normalizeLuxuryMonogram(raw)
  const layoutRowCycle = data.layout === 'diagonal' ? 4 : data.layout === 'grid' ? 1 : 2
  const orientationCycle = data.alternateRotation === 'none' ? 1 : 2
  const rowPhaseCycle = phaseCycle(data.rowPhase)
  const columnPhaseCycle = phaseCycle(data.columnPhase)
  const symmetry = symmetryCycles(data.symmetry)
  const anchorCycle = data.mainAnchor === 'alternate' || data.fillerAnchor === 'alternate-cells' ? 2 : 1
  const scaleCycle = Math.abs((data.alternateMainScale ?? 1) - 1) > .001 || Math.abs((data.alternateFillerScale ?? 1) - 1) > .001 ? 2 : 1
  const columnCycle = lcm(columnPhaseCycle, lcm(symmetry.x, lcm(data.mirrorColumns ? 2 : 1, lcm(orientationCycle, lcm(anchorCycle, scaleCycle)))))
  const rowCycle = lcm(layoutRowCycle, lcm(rowPhaseCycle, lcm(symmetry.y, lcm(data.mirrorRows ? 2 : 1, lcm(orientationCycle, lcm(anchorCycle, scaleCycle))))))
  const columns = nearestCompatibleCount(data.tileWidth, data.spacingX, columnCycle)
  const rows = nearestCompatibleCount(data.tileHeight, data.spacingY, rowCycle)
  return { columns, rows, stepX: data.tileWidth / columns, stepY: data.tileHeight / rows, columnCycle, rowCycle, rowPhaseCycle, columnPhaseCycle }
}

function roleColor(instance: LuxuryMotifInstance, role: string, palette: string[]) {
  const index = instance.colorRoles[role] ?? 0
  return palette[index] ?? palette[0] ?? '#000000'
}

function motifBody(instance: LuxuryMotifInstance, palette: string[], data: LuxuryMonogramData) {
  const motif = resolveLuxuryMotif(instance.motifId, data.customShapes ?? [])
  let body = motif.body
  for (const role of motif.roles) body = body.replaceAll(`{{${role}}}`, esc(roleColor(instance, role, palette)))
  body = body.replaceAll('{{primary}}', esc(roleColor(instance, 'primary', palette)))
  return body
}

function rotationFor(indexX: number, indexY: number, data: LuxuryMonogramData, base: number) {
  if (data.alternateRotation === 'none') return base
  const odd = Math.abs(indexX + indexY) % 2 === 1
  if (!odd) return base
  return base + (data.alternateRotation === '180' ? 180 : 90)
}

function symmetryFor(ix: number, iy: number, symmetry: LuxurySymmetry | undefined) {
  const parity = mod(ix + iy, 2)
  if (symmetry === 'mirror-x') return { rotation: 0, mirrorX: mod(ix, 2) === 1, mirrorY: false }
  if (symmetry === 'mirror-y') return { rotation: 0, mirrorX: false, mirrorY: mod(iy, 2) === 1 }
  if (symmetry === 'mirror-xy') return { rotation: 0, mirrorX: mod(ix, 2) === 1, mirrorY: mod(iy, 2) === 1 }
  if (symmetry === 'half-turn') return { rotation: parity ? 180 : 0, mirrorX: false, mirrorY: false }
  if (symmetry === 'quarter-turn') return { rotation: mod(ix + iy, 4) * 90, mirrorX: false, mirrorY: false }
  if (symmetry === 'glide') return { rotation: 0, mirrorX: mod(iy, 2) === 1, mirrorY: false }
  return { rotation: 0, mirrorX: false, mirrorY: false }
}

function motifGroup(instance: LuxuryMotifInstance, x: number, y: number, rotation: number, mirrorX: boolean, mirrorY: boolean, palette: string[], key: string, data: LuxuryMonogramData, scaleMultiplier = 1) {
  if (!instance.enabled) return ''
  const sx = instance.scale * scaleMultiplier * (mirrorX ? -1 : 1)
  const sy = instance.scale * scaleMultiplier * (mirrorY ? -1 : 1)
  return `<g data-instance="${key}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rotation.toFixed(3)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-50 -50)">${motifBody(instance, palette, data)}</g>`
}

function phaseOffset(index: number, phase: number | undefined) {
  const q = quantizePhase(phase)
  if (!q) return 0
  return mod(index * q, 1)
}

function latticeOrigin(ix: number, iy: number, data: LuxuryMonogramData, metrics: LuxurySeamlessMetrics) {
  let x = ix * metrics.stepX + data.offsetX
  let y = iy * metrics.stepY + data.offsetY
  if (data.layout === 'brick' || data.layout === 'diamond') x += mod(iy, 2) * metrics.stepX * .5
  if (data.layout === 'diagonal') x += mod(iy, 4) * metrics.stepX * .25
  x += phaseOffset(iy, data.rowPhase) * metrics.stepX
  y += phaseOffset(ix, data.columnPhase) * metrics.stepY
  if (data.symmetry === 'glide' && mod(iy, 2) === 1) x += metrics.stepX * .5
  return { x, y }
}

function mainPosition(ix: number, iy: number, data: LuxuryMonogramData, metrics: LuxurySeamlessMetrics) {
  const p = latticeOrigin(ix, iy, data, metrics)
  const anchor: LuxuryMainAnchor = data.mainAnchor ?? 'origin'
  if (anchor === 'cell-center') return { x: p.x + metrics.stepX * .5, y: p.y + metrics.stepY * .5 }
  if (anchor === 'edge-x') return { x: p.x + metrics.stepX * .5, y: p.y }
  if (anchor === 'edge-y') return { x: p.x, y: p.y + metrics.stepY * .5 }
  if (anchor === 'alternate' && mod(ix + iy, 2) === 1) return { x: p.x + metrics.stepX * .5, y: p.y + metrics.stepY * .5 }
  return p
}

function fillerPositions(ix: number, iy: number, data: LuxuryMonogramData, metrics: LuxurySeamlessMetrics) {
  const p = latticeOrigin(ix, iy, data, metrics)
  const anchor: LuxuryFillerAnchor = data.fillerAnchor ?? 'cell-center'
  if (anchor === 'edge-x') return [{ x: p.x + metrics.stepX * .5, y: p.y }]
  if (anchor === 'edge-y') return [{ x: p.x, y: p.y + metrics.stepY * .5 }]
  if (anchor === 'alternate-cells') return mod(ix + iy, 2) === 1 ? [{ x: p.x + metrics.stepX * .5, y: p.y + metrics.stepY * .5 }] : []
  if (anchor === 'four-corners') return [
    { x: p.x + metrics.stepX * .25, y: p.y + metrics.stepY * .25 },
    { x: p.x + metrics.stepX * .75, y: p.y + metrics.stepY * .25 },
    { x: p.x + metrics.stepX * .25, y: p.y + metrics.stepY * .75 },
    { x: p.x + metrics.stepX * .75, y: p.y + metrics.stepY * .75 },
  ]
  return [{ x: p.x + metrics.stepX * .5, y: p.y + metrics.stepY * .5 }]
}

function documentSize(data: LuxuryMonogramData) {
  const longSide = Math.max(256, Math.min(20000, Math.round(data.exportLongSide)))
  const logicalLong = Math.max(data.tileWidth, data.tileHeight) || 1
  const scale = longSide / logicalLong
  return { width: Math.round(data.tileWidth * scale), height: Math.round(data.tileHeight * scale) }
}

function backgroundRect(data: LuxuryMonogramData, width: number, height: number) {
  if (data.backgroundMode !== 'solid') return ''
  return `<rect width="${width}" height="${height}" fill="${esc(data.palette[data.backgroundColor] ?? data.palette[0] ?? '#ffffff')}"/>`
}

function renderPatternPieces(raw: LuxuryMonogramData, renderWidth: number, renderHeight: number, metrics: LuxurySeamlessMetrics) {
  const data = normalizeLuxuryMonogram(raw)
  const pieces: string[] = []
  const maxScale = Math.max(data.mainMotif.scale * (data.alternateMainScale ?? 1), data.fillerMotif.scale * (data.alternateFillerScale ?? 1), 1)
  const reach = 220 * maxScale
  const marginX = Math.ceil((Math.abs(data.offsetX) + reach + metrics.stepX) / Math.max(1, metrics.stepX)) + 3
  const marginY = Math.ceil((Math.abs(data.offsetY) + reach + metrics.stepY) / Math.max(1, metrics.stepY)) + 3
  const maxX = Math.ceil(renderWidth / Math.max(1, metrics.stepX)) + marginX
  const maxY = Math.ceil(renderHeight / Math.max(1, metrics.stepY)) + marginY

  for (let iy = -marginY; iy <= maxY; iy++) {
    for (let ix = -marginX; ix <= maxX; ix++) {
      const sym = symmetryFor(ix, iy, data.symmetry)
      const pos = mainPosition(ix, iy, data, metrics)
      const mirrorX = data.mainMotif.mirrorX !== (data.mirrorColumns && mod(ix, 2) === 1) !== sym.mirrorX
      const mirrorY = data.mainMotif.mirrorY !== (data.mirrorRows && mod(iy, 2) === 1) !== sym.mirrorY
      const odd = mod(ix + iy, 2) === 1
      const mainScale = odd ? (data.alternateMainScale ?? 1) : 1
      pieces.push(motifGroup(data.mainMotif, pos.x, pos.y, rotationFor(ix, iy, data, data.mainMotif.rotation) + sym.rotation, mirrorX, mirrorY, data.palette, `main-${ix}-${iy}`, data, mainScale))
      if (data.fillerMotif.enabled) {
        const fillerScale = odd ? (data.alternateFillerScale ?? 1) : 1
        fillerPositions(ix, iy, data, metrics).forEach((filler, index) => {
          pieces.push(motifGroup(data.fillerMotif, filler.x, filler.y, rotationFor(ix, iy, data, data.fillerMotif.rotation) + sym.rotation, data.fillerMotif.mirrorX !== sym.mirrorX, data.fillerMotif.mirrorY !== sym.mirrorY, data.palette, `filler-${ix}-${iy}-${index}`, data, fillerScale))
        })
      }
    }
  }
  return pieces.join('')
}

export function luxuryMonogramSvg(raw: LuxuryMonogramData) {
  const data = normalizeLuxuryMonogram(raw)
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const dims = documentSize(data)
  const metrics = luxuryMonogramMetrics(data)
  const body = renderPatternPieces(data, width, height, metrics)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${width} ${height}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="luxury-monogram" data-patternforge-columns="${metrics.columns}" data-patternforge-rows="${metrics.rows}" data-patternforge-step-x="${metrics.stepX.toFixed(4)}" data-patternforge-step-y="${metrics.stepY.toFixed(4)}" data-patternforge-row-cycle="${metrics.rowCycle}" data-patternforge-column-cycle="${metrics.columnCycle}"><defs><clipPath id="pf-luxury-tile"><rect width="${width}" height="${height}"/></clipPath></defs>${backgroundRect(data, width, height)}<g clip-path="url(#pf-luxury-tile)">${body}</g></svg>`
}

export function luxuryMonogramProofSvg(raw: LuxuryMonogramData, copies: number) {
  const data = normalizeLuxuryMonogram(raw)
  const count = Math.max(1, Math.min(8, Math.round(copies)))
  const tileWidth = Math.max(100, data.tileWidth)
  const tileHeight = Math.max(100, data.tileHeight)
  const width = tileWidth * count
  const height = tileHeight * count
  const metrics = luxuryMonogramMetrics(data)
  const body = renderPatternPieces(data, width, height, metrics)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-patternforge-proof="continuous-lattice"><defs><clipPath id="pf-luxury-proof"><rect width="${width}" height="${height}"/></clipPath></defs>${backgroundRect(data, width, height)}<g clip-path="url(#pf-luxury-proof)">${body}</g></svg>`
}
