import { resolveLuxuryMotif } from './motifs'
import type {
  LuxuryScarfData,
  ScarfBorderScatter,
  ScarfCorner,
  ScarfCornerSlot,
  ScarfFrameLayer,
  ScarfSide,
  ScarfSidePattern,
} from './types'

const SIDES: ScarfSide[] = ['top', 'right', 'bottom', 'left']
const CORNERS: ScarfCorner[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']
const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function defaultSide(): ScarfSidePattern {
  return { enabled: false, scale: 112, spacing: 0, offset: 0, opacity: 1, rotation: 0, mirrorX: false, mirrorY: false, bandWidth: 70, inset: 42 }
}

function defaultFrame(id: ScarfFrameLayer['id'], name: string, inset: number, width: number, color: number, source: ScarfFrameLayer['source']): ScarfFrameLayer {
  return { id, name, enabled: width > 0, inset, width, color, source, patternScale: 92, opacity: 1 }
}

function defaultCorner(shapeId = 'rosette-01'): ScarfCornerSlot {
  return { enabled: true, shapeId, scale: 1.05, inset: 78, rotation: 0, mirrorX: false, mirrorY: false, colorRoles: { primary: 1, secondary: 0, accent: 2 } }
}

function defaultScatter(): ScarfBorderScatter {
  return { enabled: false, depth: 150, rows: 4, density: .72, baseOpacity: .34, scaleFalloff: .38, opacityFalloff: .78 }
}

export function initialLuxuryScarf(): LuxuryScarfData {
  const side = defaultSide()
  const corner = defaultCorner()
  return {
    version: 2,
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
    sideLinkMode: 'all',
    sideSymmetry: 'rotate',
    sides: { top: { ...side }, right: { ...side }, bottom: { ...side }, left: { ...side } },
    frames: [
      defaultFrame('outer', 'Outer Frame', 0, 108, 0, 'global-pattern'),
      defaultFrame('inner', 'Inner Frame', 108, 18, 1, 'solid'),
      defaultFrame('accent', 'Accent Frame', 134, 4, 3, 'solid'),
    ],
    cornerLinkMode: 'all',
    corners: {
      topLeft: { ...corner }, topRight: { ...corner }, bottomRight: { ...corner }, bottomLeft: { ...corner },
    },
    scatter: defaultScatter(),
  }
}

export function normalizeLuxuryScarf(input: LuxuryScarfData): LuxuryScarfData {
  const base = initialLuxuryScarf()
  const legacyCorner = defaultCorner(input.cornerShapeId)
  legacyCorner.enabled = input.cornerEnabled
  legacyCorner.scale = input.cornerScale
  legacyCorner.inset = input.cornerInset
  legacyCorner.colorRoles = { ...input.cornerColorRoles }

  const sides = Object.fromEntries(SIDES.map((side) => [side, { ...defaultSide(), ...(input.sides?.[side] ?? {}) }])) as Record<ScarfSide, ScarfSidePattern>
  const frames = input.frames?.length ? input.frames.map((frame) => ({ ...frame })) : [
    defaultFrame('outer', 'Outer Frame', 0, input.outerBorderWidth, input.outerBorderColor, input.borderPatternEnabled ? 'global-pattern' : 'solid'),
    defaultFrame('inner', 'Inner Frame', input.outerBorderWidth, input.innerBorderWidth, input.innerBorderColor, 'solid'),
    defaultFrame('accent', 'Accent Frame', input.outerBorderWidth + input.innerBorderWidth + 8, 0, 3, 'solid'),
  ]
  const corners = Object.fromEntries(CORNERS.map((corner) => [corner, { ...legacyCorner, ...(input.corners?.[corner] ?? {}) }])) as Record<ScarfCorner, ScarfCornerSlot>

  return {
    ...base,
    ...input,
    version: 2,
    palette: [...input.palette],
    customShapes: [...(input.customShapes ?? [])],
    sideLinkMode: input.sideLinkMode ?? 'all',
    sideSymmetry: input.sideSymmetry ?? 'rotate',
    sides,
    frames,
    cornerLinkMode: input.cornerLinkMode ?? 'all',
    corners,
    scatter: { ...defaultScatter(), ...(input.scatter ?? {}) },
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

function shapeGroup(shapeId: string, x: number, y: number, scale: number, rotation: number, roleMap: Record<string, number>, data: LuxuryScarfData, mirrorX = false, mirrorY = false) {
  const sx = scale * (mirrorX ? -1 : 1)
  const sy = scale * (mirrorY ? -1 : 1)
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${sx} ${sy}) translate(-50 -50)">${shapeBody(shapeId, roleMap, data)}</g>`
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

function patternDef(svg: string | undefined, id: string, size: number, transform = '') {
  if (!svg?.trim()) return ''
  const parts = sourceParts(svg, id)
  const safeSize = Math.max(24, size)
  const patternTransform = transform ? ` patternTransform="${transform}"` : ''
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${safeSize}" height="${safeSize}" viewBox="${parts.viewBox}" preserveAspectRatio="xMidYMid meet"${patternTransform}>${parts.inner}</pattern>`
}

function ringPath(size: number, inset: number, width: number) {
  const outer = clamp(inset, 0, size / 2)
  const inner = clamp(outer + width, outer, size / 2)
  const outerSize = Math.max(0, size - outer * 2)
  const innerSize = Math.max(0, size - inner * 2)
  if (!outerSize || width <= 0) return ''
  return `M${outer} ${outer}H${size - outer}V${size - outer}H${outer}Z M${inner} ${inner}V${size - inner}H${size - inner}V${inner}Z`
}

function sideAuto(side: ScarfSide, data: LuxuryScarfData) {
  const mode = data.sideSymmetry ?? 'rotate'
  const index = SIDES.indexOf(side)
  if (mode === 'copy') return { rotation: 0, mirrorX: false, mirrorY: false }
  if (mode === 'rotate') return { rotation: index * 90, mirrorX: false, mirrorY: false }
  if (mode === 'mirror') {
    if (side === 'top') return { rotation: 0, mirrorX: false, mirrorY: false }
    if (side === 'right') return { rotation: 90, mirrorX: true, mirrorY: false }
    if (side === 'bottom') return { rotation: 0, mirrorX: false, mirrorY: true }
    return { rotation: 90, mirrorX: false, mirrorY: true }
  }
  return { rotation: index * 90, mirrorX: index % 2 === 1, mirrorY: false }
}

function sideTransform(side: ScarfSide, config: ScarfSidePattern, data: LuxuryScarfData) {
  const auto = sideAuto(side, data)
  const mx = config.mirrorX !== auto.mirrorX ? -1 : 1
  const my = config.mirrorY !== auto.mirrorY ? -1 : 1
  const translate = side === 'top' || side === 'bottom' ? `${config.offset} 0` : `0 ${config.offset}`
  return `translate(${translate}) rotate(${auto.rotation + config.rotation}) scale(${mx} ${my})`
}

function sideRect(side: ScarfSide, size: number, config: ScarfSidePattern) {
  const inset = clamp(config.inset, 0, size / 2 - 1)
  const band = clamp(config.bandWidth, 1, size / 2 - inset)
  if (side === 'top') return { x: inset, y: inset, width: Math.max(0, size - inset * 2), height: band }
  if (side === 'bottom') return { x: inset, y: size - inset - band, width: Math.max(0, size - inset * 2), height: band }
  if (side === 'left') return { x: inset, y: inset, width: band, height: Math.max(0, size - inset * 2) }
  return { x: size - inset - band, y: inset, width: band, height: Math.max(0, size - inset * 2) }
}

function frameSource(frame: ScarfFrameLayer, data: LuxuryScarfData) {
  if (frame.source === 'custom-pattern') return frame.patternSvg
  if (frame.source === 'global-pattern') return data.sourcePatternSvg
  return undefined
}

function cornerAuto(index: number, data: LuxuryScarfData) {
  if (data.cornerMode === 'same') return { rotation: 0, mirrorX: false, mirrorY: false }
  if (data.cornerMode === 'rotate') return { rotation: index * 90, mirrorX: false, mirrorY: false }
  if (index === 0) return { rotation: 0, mirrorX: false, mirrorY: false }
  if (index === 1) return { rotation: 0, mirrorX: true, mirrorY: false }
  if (index === 2) return { rotation: 0, mirrorX: true, mirrorY: true }
  return { rotation: 0, mirrorX: false, mirrorY: true }
}

function documentSize(data: LuxuryScarfData) {
  const longSide = clamp(Math.round(data.exportLongSide), 512, 20000)
  return { width: longSide, height: longSide }
}

export function luxuryScarfSvg(raw: LuxuryScarfData) {
  const data = normalizeLuxuryScarf(raw)
  const size = Math.max(400, data.canvasSize)
  const dims = documentSize(data)
  const bg = esc(data.palette[data.backgroundColor] ?? '#ffffff')
  const source = data.sourcePatternSvg?.trim()
  const defs: string[] = []
  const pieces: string[] = [`<rect width="${size}" height="${size}" fill="${bg}"/>`]

  // Frames: each layer can be solid, global pattern, or its own uploaded SVG.
  data.frames?.forEach((frame, index) => {
    if (!frame.enabled || frame.width <= 0) return
    const patternSvg = frameSource(frame, data)
    const patternId = `pf-scarf-frame-${index}`
    if (patternSvg) defs.push(patternDef(patternSvg, patternId, frame.patternScale))
    const fill = patternSvg ? `url(#${patternId})` : esc(data.palette[frame.color] ?? data.palette[0] ?? '#000000')
    const d = ringPath(size, frame.inset, frame.width)
    if (d) pieces.push(`<path d="${d}" fill="${fill}" fill-rule="evenodd" opacity="${clamp(frame.opacity, 0, 1)}"/>`)
  })

  // Side zones: four independent pattern bands with link/symmetry handled by the document model.
  SIDES.forEach((side, index) => {
    const config = data.sides?.[side] ?? defaultSide()
    if (!config.enabled) return
    const sideSource = config.sourceSvg?.trim() || source
    if (!sideSource) return
    const id = `pf-scarf-side-${index}`
    const cell = Math.max(24, config.scale + config.spacing)
    defs.push(patternDef(sideSource, id, cell, sideTransform(side, config, data)))
    const rect = sideRect(side, size, config)
    pieces.push(`<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="url(#${id})" opacity="${clamp(config.opacity, 0, 1)}"/>`)
  })

  // Border scatter: deterministic concentric breakup that becomes larger/sparser and softer toward center.
  const scatter = data.scatter ?? defaultScatter()
  if (scatter.enabled && source) {
    const enabledFrames = (data.frames ?? []).filter((frame) => frame.enabled)
    const startInset = Math.max(0, ...enabledFrames.map((frame) => frame.inset + frame.width), 0)
    const rows = clamp(Math.round(scatter.rows), 1, 8)
    const step = clamp(scatter.depth, 20, size / 2) / rows
    for (let index = 0; index < rows; index++) {
      const t = rows === 1 ? 0 : index / (rows - 1)
      const scale = Math.max(36, data.patternScale * (1 + t * scatter.scaleFalloff * 1.8) / clamp(scatter.density, .2, 1.5))
      const opacity = clamp(scatter.baseOpacity * (1 - t * scatter.opacityFalloff), 0, 1)
      const id = `pf-scarf-scatter-${index}`
      defs.push(patternDef(source, id, scale, `translate(${index * scale * .21} ${index * scale * .13})`))
      const d = ringPath(size, startInset + index * step, step * .88)
      if (d) pieces.push(`<path d="${d}" fill="url(#${id})" fill-rule="evenodd" opacity="${opacity}"/>`)
    }
  }

  // Center field.
  const sparseScale = data.centerMode === 'sparse-pattern' ? data.patternScale * 1.65 : data.patternScale
  if (source && (data.centerMode === 'pattern' || data.centerMode === 'sparse-pattern' || data.centerMode === 'pattern-medallion')) {
    const id = 'pf-scarf-center-pattern'
    defs.push(patternDef(source, id, sparseScale))
    const enabledFrames = (data.frames ?? []).filter((frame) => frame.enabled)
    const fieldInset = clamp(Math.max(0, ...enabledFrames.map((frame) => frame.inset + frame.width), 0) + 10, 0, size / 2 - 10)
    pieces.push(`<rect x="${fieldInset}" y="${fieldInset}" width="${Math.max(0, size - fieldInset * 2)}" height="${Math.max(0, size - fieldInset * 2)}" fill="url(#${id})" opacity="${clamp(data.centerPatternOpacity, 0, 1)}"/>`)
  }

  if (data.centerCalmness > 0 && data.safeMargin < size / 2) {
    const quiet = clamp(data.safeMargin, 0, size / 2 - 10)
    pieces.push(`<rect x="${quiet}" y="${quiet}" width="${Math.max(0, size - quiet * 2)}" height="${Math.max(0, size - quiet * 2)}" fill="${bg}" opacity="${clamp(data.centerCalmness, 0, 1)}"/>`)
  }

  // Corners: one linked motif or four independent slots.
  const points: Array<[number, number]> = [[0, 0], [size, 0], [size, size], [0, size]]
  CORNERS.forEach((cornerName, index) => {
    const slot = data.corners?.[cornerName] ?? defaultCorner(data.cornerShapeId)
    if (!slot.enabled) return
    const inset = clamp(slot.inset, 20, size / 2 - 20)
    const x = points[index][0] === 0 ? inset : size - inset
    const y = points[index][1] === 0 ? inset : size - inset
    const auto = cornerAuto(index, data)
    pieces.push(shapeGroup(slot.shapeId, x, y, slot.scale, slot.rotation + auto.rotation, slot.colorRoles, data, slot.mirrorX !== auto.mirrorX, slot.mirrorY !== auto.mirrorY))
  })

  const usesMedallion = data.medallionEnabled || data.centerMode === 'medallion' || data.centerMode === 'pattern-medallion'
  if (usesMedallion) pieces.push(shapeGroup(data.medallionShapeId, size / 2, size / 2, data.medallionScale, 0, data.medallionColorRoles, data))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${size} ${size}" data-patternforge-source="scarf-studio" data-patternforge-version="2" data-patternforge-product="${data.product}" data-patternforge-physical-size-cm="${data.physicalSizeCm}"><defs>${defs.join('')}</defs>${pieces.join('')}</svg>`
}

export type ScarfTemplate = 'calm-hijab' | 'full-scarf' | 'medallion' | 'monogram-border' | 'four-side' | 'mirror-frame' | 'scatter-border'

export function luxuryScarfTemplate(raw: LuxuryScarfData, template: ScarfTemplate): LuxuryScarfData {
  const data = normalizeLuxuryScarf(raw)
  const patchAllSides = (patch: Partial<ScarfSidePattern>) => ({
    top: { ...data.sides!.top, ...patch }, right: { ...data.sides!.right, ...patch }, bottom: { ...data.sides!.bottom, ...patch }, left: { ...data.sides!.left, ...patch },
  })
  if (template === 'full-scarf') return { ...data, product: 'scarf', physicalSizeCm: 90, centerMode: 'pattern', centerPatternOpacity: .82, safeMargin: 470, centerCalmness: 0, medallionEnabled: false, sides: patchAllSides({ enabled: false }), scatter: { ...data.scatter!, enabled: false } }
  if (template === 'medallion') return { ...data, product: 'scarf', physicalSizeCm: 90, centerMode: 'pattern-medallion', centerPatternOpacity: .30, safeMargin: 315, centerCalmness: .72, medallionEnabled: true, sides: patchAllSides({ enabled: false }) }
  if (template === 'monogram-border') return { ...data, centerMode: 'empty', safeMargin: 300, centerCalmness: 1, medallionEnabled: false, frames: data.frames!.map((frame) => frame.id === 'outer' ? { ...frame, enabled: true, width: 138, source: 'global-pattern' } : frame), sides: patchAllSides({ enabled: false }), scatter: { ...data.scatter!, enabled: false } }
  if (template === 'four-side') return { ...data, sideLinkMode: 'all', sideSymmetry: 'rotate', sides: patchAllSides({ enabled: true, scale: 105, spacing: 4, bandWidth: 82, inset: 34, opacity: 1 }), centerMode: 'empty', centerCalmness: 1, scatter: { ...data.scatter!, enabled: false } }
  if (template === 'mirror-frame') return { ...data, sideLinkMode: 'all', sideSymmetry: 'mirror', cornerMode: 'mirror', sides: patchAllSides({ enabled: true, scale: 118, spacing: 0, bandWidth: 76, inset: 40 }), centerMode: 'sparse-pattern', centerPatternOpacity: .22, centerCalmness: .86, scatter: { ...data.scatter!, enabled: false } }
  if (template === 'scatter-border') return { ...data, sideLinkMode: 'all', sideSymmetry: 'rotate', sides: patchAllSides({ enabled: true, scale: 108, bandWidth: 64, inset: 38 }), centerMode: 'empty', centerCalmness: .92, scatter: { ...data.scatter!, enabled: true, depth: 190, rows: 5, density: .68, baseOpacity: .38, scaleFalloff: .48, opacityFalloff: .82 } }
  return { ...data, product: 'hijab', physicalSizeCm: 110, centerMode: 'sparse-pattern', centerPatternOpacity: .36, safeMargin: 275, centerCalmness: .82, medallionEnabled: false, sideLinkMode: 'all', sideSymmetry: 'rotate', sides: patchAllSides({ enabled: false }), scatter: { ...data.scatter!, enabled: false } }
}
