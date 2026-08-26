import { luxuryMotifById } from './motifs'
import type { LuxuryMonogramData, LuxuryMotifInstance } from './types'

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

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

function anchorPosition(ix: number, iy: number, data: LuxuryMonogramData) {
  const sx = Math.max(40, data.spacingX)
  const sy = Math.max(40, data.spacingY)
  let x = ix * sx + data.offsetX
  let y = iy * sy + data.offsetY
  if (data.layout === 'brick') x += (Math.abs(iy) % 2) * sx * .5
  if (data.layout === 'diagonal') x += iy * sx * .5
  if (data.layout === 'diamond') {
    x = (ix + iy * .5) * sx + data.offsetX
    y = iy * sy * .72 + data.offsetY
  }
  return { x, y }
}

function fillerPosition(ix: number, iy: number, data: LuxuryMonogramData) {
  const a = anchorPosition(ix, iy, data)
  const b = anchorPosition(ix + 1, iy + 1, data)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function documentSize(data: LuxuryMonogramData) {
  const longSide = Math.max(256, Math.min(20000, Math.round(data.exportLongSide)))
  const logicalLong = Math.max(data.tileWidth, data.tileHeight) || 1
  const scale = longSide / logicalLong
  return { width: Math.round(data.tileWidth * scale), height: Math.round(data.tileHeight * scale) }
}

export function luxuryMonogramSvg(data: LuxuryMonogramData) {
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const dims = documentSize(data)
  const background = data.backgroundMode === 'solid'
    ? `<rect width="${width}" height="${height}" fill="${esc(data.palette[data.backgroundColor] ?? data.palette[0] ?? '#ffffff')}"/>`
    : ''

  const rangeX = Math.ceil(width / Math.max(40, data.spacingX)) + 3
  const rangeY = Math.ceil(height / Math.max(40, data.spacingY)) + 4
  const pieces: string[] = []

  for (let iy = -rangeY; iy <= rangeY; iy++) {
    for (let ix = -rangeX; ix <= rangeX; ix++) {
      const pos = anchorPosition(ix, iy, data)
      const mirrorX = data.mainMotif.mirrorX !== (data.mirrorColumns && Math.abs(ix) % 2 === 1)
      const mirrorY = data.mainMotif.mirrorY !== (data.mirrorRows && Math.abs(iy) % 2 === 1)
      pieces.push(motifGroup(data.mainMotif, pos.x, pos.y, rotationFor(ix, iy, data, data.mainMotif.rotation), mirrorX, mirrorY, data.palette, `main-${ix}-${iy}`))
      if (data.fillerMotif.enabled) {
        const filler = fillerPosition(ix, iy, data)
        pieces.push(motifGroup(data.fillerMotif, filler.x, filler.y, rotationFor(ix, iy, data, data.fillerMotif.rotation), data.fillerMotif.mirrorX, data.fillerMotif.mirrorY, data.palette, `filler-${ix}-${iy}`))
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${width} ${height}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="luxury-monogram"><defs><clipPath id="pf-luxury-tile"><rect width="${width}" height="${height}"/></clipPath></defs>${background}<g clip-path="url(#pf-luxury-tile)">${pieces.join('')}</g></svg>`
}

function innerSvg(svg: string) {
  const start = svg.indexOf('>')
  const end = svg.lastIndexOf('</svg>')
  return start >= 0 && end > start ? svg.slice(start + 1, end) : svg
}

export function luxuryMonogramProofSvg(data: LuxuryMonogramData, copies: number) {
  const count = Math.max(1, Math.min(8, Math.round(copies)))
  const tile = luxuryMonogramSvg({ ...data, exportLongSide: Math.max(data.tileWidth, data.tileHeight) })
  const body = innerSvg(tile)
  const width = data.tileWidth * count
  const height = data.tileHeight * count
  const groups: string[] = []
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) groups.push(`<g transform="translate(${x * data.tileWidth} ${y * data.tileHeight})">${body}</g>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${groups.join('')}</svg>`
}
