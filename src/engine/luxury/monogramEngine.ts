import { luxuryMotifById } from './motifs'
import type { LuxuryMonogramData, LuxuryMotifInstance } from './types'

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const mod = (value: number, size: number) => ((value % size) + size) % size

export type LuxurySeamlessMetrics = {
  columns: number
  rows: number
  stepX: number
  stepY: number
  columnCycle: number
  rowCycle: number
}

export function initialLuxuryMonogram(): LuxuryMonogramData {
  return {
    version: 1,
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
  }
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
    if (error < bestError || (Math.abs(error - bestError) < 1e-9 && count > best)) {
      best = count
      bestError = error
    }
  }
  return Math.max(1, best)
}

export function luxuryMonogramMetrics(data: LuxuryMonogramData): LuxurySeamlessMetrics {
  const layoutRowCycle = data.layout === 'diagonal' ? 4 : data.layout === 'grid' ? 1 : 2
  const orientationCycle = data.alternateRotation === 'none' ? 1 : 2
  const columnCycle = lcm(data.mirrorColumns ? 2 : 1, orientationCycle)
  const rowCycle = lcm(layoutRowCycle, lcm(data.mirrorRows ? 2 : 1, orientationCycle))
  const columns = nearestCompatibleCount(data.tileWidth, data.spacingX, columnCycle)
  const rows = nearestCompatibleCount(data.tileHeight, data.spacingY, rowCycle)
  return {
    columns,
    rows,
    stepX: data.tileWidth / columns,
    stepY: data.tileHeight / rows,
    columnCycle,
    rowCycle,
  }
}

function roleColor(instance: LuxuryMotifInstance, role: string, palette: string[]) {
  const index = instance.colorRoles[role] ?? 0
  return palette[index] ?? palette[0] ?? '#000000'
}

function motifBody(instance: LuxuryMotifInstance, palette: string[]) {
  const motif = luxuryMotifById(instance.motifId)
  let body = motif.body
  for (const role of motif.roles) body = body.replaceAll(`{{${role}}}`, esc(roleColor(instance, role, palette)))
  return body
}

function rotationFor(indexX: number, indexY: number, data: LuxuryMonogramData, base: number) {
  if (data.alternateRotation === 'none') return base
  const odd = Math.abs(indexX + indexY) % 2 === 1
  if (!odd) return base
  return base + (data.alternateRotation === '180' ? 180 : 90)
}

function motifGroup(instance: LuxuryMotifInstance, x: number, y: number, rotation: number, mirrorX: boolean, mirrorY: boolean, palette: string[], key: string) {
  if (!instance.enabled) return ''
  const sx = instance.scale * (mirrorX ? -1 : 1)
  const sy = instance.scale * (mirrorY ? -1 : 1)
  return `<g data-instance="${key}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rotation.toFixed(3)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-50 -50)">${motifBody(instance, palette)}</g>`
}

function anchorPosition(ix: number, iy: number, data: LuxuryMonogramData, metrics: LuxurySeamlessMetrics) {
  let x = ix * metrics.stepX + data.offsetX
  const y = iy * metrics.stepY + data.offsetY
  if (data.layout === 'brick' || data.layout === 'diamond') x += mod(iy, 2) * metrics.stepX * .5
  if (data.layout === 'diagonal') x += mod(iy, 4) * metrics.stepX * .25
  return { x, y }
}

function fillerPosition(ix: number, iy: number, data: LuxuryMonogramData, metrics: LuxurySeamlessMetrics) {
  const a = anchorPosition(ix, iy, data, metrics)
  return { x: a.x + metrics.stepX * .5, y: a.y + metrics.stepY * .5 }
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

function renderPatternPieces(data: LuxuryMonogramData, renderWidth: number, renderHeight: number, metrics: LuxurySeamlessMetrics) {
  const pieces: string[] = []
  const marginX = Math.ceil((Math.abs(data.offsetX) + 180) / Math.max(1, metrics.stepX)) + 3
  const marginY = Math.ceil((Math.abs(data.offsetY) + 180) / Math.max(1, metrics.stepY)) + 3
  const maxX = Math.ceil(renderWidth / Math.max(1, metrics.stepX)) + marginX
  const maxY = Math.ceil(renderHeight / Math.max(1, metrics.stepY)) + marginY

  for (let iy = -marginY; iy <= maxY; iy++) {
    for (let ix = -marginX; ix <= maxX; ix++) {
      const pos = anchorPosition(ix, iy, data, metrics)
      const mirrorX = data.mainMotif.mirrorX !== (data.mirrorColumns && mod(ix, 2) === 1)
      const mirrorY = data.mainMotif.mirrorY !== (data.mirrorRows && mod(iy, 2) === 1)
      pieces.push(motifGroup(data.mainMotif, pos.x, pos.y, rotationFor(ix, iy, data, data.mainMotif.rotation), mirrorX, mirrorY, data.palette, `main-${ix}-${iy}`))
      if (data.fillerMotif.enabled) {
        const filler = fillerPosition(ix, iy, data, metrics)
        pieces.push(motifGroup(data.fillerMotif, filler.x, filler.y, rotationFor(ix, iy, data, data.fillerMotif.rotation), data.fillerMotif.mirrorX, data.fillerMotif.mirrorY, data.palette, `filler-${ix}-${iy}`))
      }
    }
  }
  return pieces.join('')
}

export function luxuryMonogramSvg(data: LuxuryMonogramData) {
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const dims = documentSize(data)
  const metrics = luxuryMonogramMetrics(data)
  const body = renderPatternPieces(data, width, height, metrics)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${width} ${height}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="luxury-monogram" data-patternforge-columns="${metrics.columns}" data-patternforge-rows="${metrics.rows}" data-patternforge-step-x="${metrics.stepX.toFixed(4)}" data-patternforge-step-y="${metrics.stepY.toFixed(4)}"><defs><clipPath id="pf-luxury-tile"><rect width="${width}" height="${height}"/></clipPath></defs>${backgroundRect(data, width, height)}<g clip-path="url(#pf-luxury-tile)">${body}</g></svg>`
}

export function luxuryMonogramProofSvg(data: LuxuryMonogramData, copies: number) {
  const count = Math.max(1, Math.min(8, Math.round(copies)))
  const tileWidth = Math.max(100, data.tileWidth)
  const tileHeight = Math.max(100, data.tileHeight)
  const width = tileWidth * count
  const height = tileHeight * count
  const metrics = luxuryMonogramMetrics(data)
  const body = renderPatternPieces(data, width, height, metrics)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" data-patternforge-proof="continuous-lattice"><defs><clipPath id="pf-luxury-proof"><rect width="${width}" height="${height}"/></clipPath></defs>${backgroundRect(data, width, height)}<g clip-path="url(#pf-luxury-proof)">${body}</g></svg>`
}
