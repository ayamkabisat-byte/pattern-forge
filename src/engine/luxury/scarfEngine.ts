import { resolveLuxuryMotif } from './motifs'
import type { LuxuryMotifInstance, LuxuryScarfData } from './types'

const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export function initialLuxuryScarf(): LuxuryScarfData {
  return {
    version: 1,
    mode: 'scarf',
    product: 'hijab',
    canvasSize: 1000,
    physicalSizeCm: 110,
    palette: ['#20362F', '#D5B15D', '#EFE4CD', '#7B2638'],
    backgroundColor: 2,
    exportLongSide: 8000,
    outerBorderWidth: 108,
    outerBorderColor: 0,
    innerBorderWidth: 18,
    innerBorderColor: 1,
    borderPatternEnabled: true,
    sourcePatternSvg: undefined,
    sourcePatternName: undefined,
    centerMode: 'sparse-pattern',
    patternScale: 170,
    centerPatternOpacity: .42,
    safeMargin: 275,
    centerCalmness: .78,
    cornerEnabled: true,
    cornerShapeId: 'rosette-01',
    cornerScale: 1.05,
    cornerInset: 78,
    cornerMode: 'rotate',
    cornerColorRoles: { primary: 1, secondary: 0, accent: 2 },
    medallionEnabled: false,
    medallionShapeId: 'quatrefoil-01',
    medallionScale: 2.4,
    medallionColorRoles: { primary: 0, secondary: 1, accent: 1 },
    customShapes: [],
  }
}

function roleColor(roleMap: Record<string, number>, role: string, data: LuxuryScarfData) {
  const index = roleMap[role] ?? 0
  return data.palette[index] ?? data.palette[0] ?? '#000000'
}

function shapeBody(shapeId: string, roles: Record<string, number>, data: LuxuryScarfData) {
  const motif = resolveLuxuryMotif(shapeId, data.customShapes ?? [])
  let body = motif.body
  for (const role of motif.roles) body = body.replaceAll(`{{${role}}}`, esc(roleColor(roles, role, data)))
  return body.replaceAll('{{primary}}', esc(roleColor(roles, 'primary', data)))
}

function shapeGroup(shapeId: string, x: number, y: number, scale: number, rotation: number, roleMap: Record<string, number>, data: LuxuryScarfData) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(-50 -50)">${shapeBody(shapeId, roleMap, data)}</g>`
}

function sourceParts(svg: string, prefix: string) {
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] ?? '0 0 100 100'
  let inner = svg.replace(/^[\s\S]*?<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')
  const ids = Array.from(inner.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)).map((match) => match[1])
  for (const id of ids) {
    const safe = `${prefix}-${id}`
    inner = inner.replaceAll(`id="${id}"`, `id="${safe}"`).replaceAll(`id='${id}'`, `id='${safe}'`)
    inner = inner.replaceAll(`url(#${id})`, `url(#${safe})`).replaceAll(`href="#${id}"`, `href="#${safe}"`).replaceAll(`href='#${id}'`, `href='#${safe}'`)
  }
  return { viewBox: vb, inner }
}

function patternDef(svg: string | undefined, id: string, size: number) {
  if (!svg?.trim()) return ''
  const parts = sourceParts(svg, id)
  const safeSize = Math.max(40, size)
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${safeSize}" height="${safeSize}" viewBox="${parts.viewBox}" preserveAspectRatio="xMidYMid meet">${parts.inner}</pattern>`
}

function borderRects(size: number, width: number, fill: string) {
  const w = Math.max(0, Math.min(size / 2, width))
  if (!w) return ''
  return `<path fill="${fill}" d="M0 0H${size}V${w}H0ZM0 ${size - w}H${size}V${size}H0ZM0 ${w}H${w}V${size - w}H0ZM${size - w} ${w}H${size}V${size - w}H${size - w}Z"/>`
}

function cornerRotation(index: number, mode: LuxuryScarfData['cornerMode']) {
  if (mode === 'same') return 0
  if (mode === 'mirror') return index % 2 ? 90 : 0
  return index * 90
}

function documentSize(data: LuxuryScarfData) {
  const longSide = Math.max(512, Math.min(20000, Math.round(data.exportLongSide)))
  return { width: longSide, height: longSide }
}

export function luxuryScarfSvg(data: LuxuryScarfData) {
  const size = Math.max(400, data.canvasSize)
  const dims = documentSize(data)
  const bg = esc(data.palette[data.backgroundColor] ?? '#ffffff')
  const outer = esc(data.palette[data.outerBorderColor] ?? data.palette[0] ?? '#000000')
  const inner = esc(data.palette[data.innerBorderColor] ?? data.palette[1] ?? '#b99a52')
  const source = data.sourcePatternSvg?.trim()
  const sparseScale = data.centerMode === 'sparse-pattern' ? data.patternScale * 1.65 : data.patternScale
  const defs = [
    patternDef(source, 'pf-scarf-border-pattern', Math.max(80, data.patternScale * .72)),
    patternDef(source, 'pf-scarf-center-pattern', sparseScale),
  ].join('')

  const outerFill = data.borderPatternEnabled && source ? 'url(#pf-scarf-border-pattern)' : outer
  const pieces: string[] = [`<rect width="${size}" height="${size}" fill="${bg}"/>`, borderRects(size, data.outerBorderWidth, outerFill)]

  const innerInset = Math.max(0, data.outerBorderWidth + data.innerBorderWidth / 2)
  if (data.innerBorderWidth > 0) pieces.push(`<rect x="${innerInset}" y="${innerInset}" width="${Math.max(0, size - innerInset * 2)}" height="${Math.max(0, size - innerInset * 2)}" fill="none" stroke="${inner}" stroke-width="${data.innerBorderWidth}"/>`)

  const fieldInset = Math.min(size / 2 - 10, Math.max(data.outerBorderWidth + data.innerBorderWidth + 14, 0))
  const fieldSize = Math.max(0, size - fieldInset * 2)
  const usesPattern = data.centerMode === 'pattern' || data.centerMode === 'sparse-pattern' || data.centerMode === 'pattern-medallion'
  if (usesPattern && source) pieces.push(`<rect x="${fieldInset}" y="${fieldInset}" width="${fieldSize}" height="${fieldSize}" fill="url(#pf-scarf-center-pattern)" opacity="${Math.max(0, Math.min(1, data.centerPatternOpacity))}"/>`)

  if (data.centerCalmness > 0 && data.safeMargin < size / 2) {
    const quiet = Math.max(fieldInset, Math.min(size / 2 - 10, data.safeMargin))
    pieces.push(`<rect x="${quiet}" y="${quiet}" width="${Math.max(0, size - quiet * 2)}" height="${Math.max(0, size - quiet * 2)}" fill="${bg}" opacity="${Math.max(0, Math.min(1, data.centerCalmness))}"/>`)
  }

  if (data.cornerEnabled) {
    const p = Math.max(25, Math.min(size / 2 - 25, data.cornerInset))
    const points: Array<[number, number]> = [[p,p],[size-p,p],[size-p,size-p],[p,size-p]]
    points.forEach(([x,y], index) => pieces.push(shapeGroup(data.cornerShapeId, x, y, data.cornerScale, cornerRotation(index, data.cornerMode), data.cornerColorRoles, data)))
  }

  const usesMedallion = data.medallionEnabled || data.centerMode === 'medallion' || data.centerMode === 'pattern-medallion'
  if (usesMedallion) pieces.push(shapeGroup(data.medallionShapeId, size / 2, size / 2, data.medallionScale, 0, data.medallionColorRoles, data))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${size} ${size}" data-patternforge-source="luxury-scarf-hijab" data-patternforge-product="${data.product}" data-patternforge-physical-size-cm="${data.physicalSizeCm}"><defs>${defs}</defs>${pieces.join('')}</svg>`
}

export function luxuryScarfTemplate(data: LuxuryScarfData, template: 'calm-hijab' | 'full-scarf' | 'medallion' | 'monogram-border'): LuxuryScarfData {
  if (template === 'full-scarf') return { ...data, product: 'scarf', physicalSizeCm: 90, outerBorderWidth: 88, innerBorderWidth: 14, centerMode: 'pattern', centerPatternOpacity: .82, safeMargin: 470, centerCalmness: 0, medallionEnabled: false, cornerEnabled: true }
  if (template === 'medallion') return { ...data, product: 'scarf', physicalSizeCm: 90, outerBorderWidth: 92, innerBorderWidth: 20, centerMode: 'pattern-medallion', centerPatternOpacity: .34, safeMargin: 315, centerCalmness: .68, medallionEnabled: true, cornerEnabled: true }
  if (template === 'monogram-border') return { ...data, outerBorderWidth: 138, innerBorderWidth: 18, borderPatternEnabled: true, centerMode: 'empty', safeMargin: 300, centerCalmness: 1, medallionEnabled: false, cornerEnabled: true }
  return { ...data, product: 'hijab', physicalSizeCm: 110, outerBorderWidth: 108, innerBorderWidth: 18, centerMode: 'sparse-pattern', centerPatternOpacity: .42, safeMargin: 275, centerCalmness: .78, medallionEnabled: false, cornerEnabled: true }
}
