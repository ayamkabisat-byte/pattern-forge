import type { LuxuryCustomShape, LuxuryShapeCategory } from './types'

const KEY = 'patternforge.luxury-shapes.v1'
const EVENT = 'patternforge:luxury-shapes-changed'
const ROLE_ORDER = ['primary','secondary','accent','highlight','shadow','detail','detail2','detail3']

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function uid() {
  return `custom-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function notify() {
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function luxuryShapeLibraryEvent() { return EVENT }

export function loadLuxuryShapeLibrary(): LuxuryCustomShape[] {
  if (typeof window === 'undefined') return []
  const items = safeParse<LuxuryCustomShape[]>(localStorage.getItem(KEY), [])
  return Array.isArray(items) ? items : []
}

export function saveLuxuryShape(shape: LuxuryCustomShape) {
  const items = loadLuxuryShapeLibrary()
  const next = [shape, ...items.filter((item) => item.id !== shape.id)]
  localStorage.setItem(KEY, JSON.stringify(next))
  notify()
  return shape
}

export function deleteLuxuryShape(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadLuxuryShapeLibrary().filter((item) => item.id !== id)))
  notify()
}

function numericAttr(root: Element, name: string, fallback: number) {
  const value = Number.parseFloat(root.getAttribute(name) || '')
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function readViewBox(root: Element) {
  const raw = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number)
  if (raw && raw.length === 4 && raw.every(Number.isFinite) && raw[2] !== 0 && raw[3] !== 0) return raw as [number, number, number, number]
  return [0, 0, numericAttr(root, 'width', 100), numericAttr(root, 'height', 100)] as [number, number, number, number]
}

function isPaint(value: string) {
  const v = value.trim()
  if (!v || v === 'none' || v === 'transparent' || v === 'currentColor' || v.startsWith('url(') || v.startsWith('var(')) return false
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/i.test(v) || /^hsla?\(/i.test(v) || /^[a-z]+$/i.test(v)
}

function cleanPaint(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function sanitizeDocument(doc: Document) {
  doc.querySelectorAll('script,foreignObject,iframe,object,embed,image,video,audio').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on')) node.removeAttribute(attr.name)
      if ((name === 'href' || name.endsWith(':href')) && value && !value.startsWith('#')) node.removeAttribute(attr.name)
      if (name === 'style' && /(?:url\s*\(|@import|javascript:)/i.test(value)) node.removeAttribute(attr.name)
    }
  })
  doc.querySelectorAll('style').forEach((node) => {
    if (/(?:url\s*\(|@import|javascript:)/i.test(node.textContent || '')) node.remove()
  })
}

function collectPaints(root: Element) {
  const paints: string[] = []
  const push = (value: string) => {
    if (!isPaint(value)) return
    const normalized = cleanPaint(value)
    if (!paints.includes(normalized)) paints.push(normalized)
  }
  root.querySelectorAll('*').forEach((node) => {
    push(node.getAttribute('fill') || '')
    push(node.getAttribute('stroke') || '')
    const style = node.getAttribute('style') || ''
    for (const match of style.matchAll(/(?:fill|stroke)\s*:\s*([^;]+)/gi)) push(match[1])
  })
  return paints.slice(0, ROLE_ORDER.length)
}

function replacePaints(root: Element, paints: string[]) {
  const roleFor = new Map(paints.map((paint, index) => [paint, ROLE_ORDER[index]]))
  root.querySelectorAll('*').forEach((node) => {
    for (const attrName of ['fill','stroke']) {
      const raw = node.getAttribute(attrName)
      if (!raw) continue
      const role = roleFor.get(cleanPaint(raw))
      if (role) node.setAttribute(attrName, `{{${role}}}`)
      else if (raw.trim() === 'currentColor') node.setAttribute(attrName, '{{primary}}')
    }
    const style = node.getAttribute('style')
    if (style) {
      let next = style
      for (const [paint, role] of roleFor) next = next.replaceAll(paint, `{{${role}}}`)
      next = next.replace(/currentColor/gi, '{{primary}}')
      node.setAttribute('style', next)
    }
  })
}

export function parseLuxurySvgShape(svg: string, name: string, category: LuxuryShapeCategory): LuxuryCustomShape {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.tagName.toLowerCase() !== 'svg') throw new Error('The file is not a valid SVG document.')
  sanitizeDocument(doc)
  const root = doc.documentElement
  const [x, y, width, height] = readViewBox(root)
  const paints = collectPaints(root)
  replacePaints(root, paints)
  const serializer = new XMLSerializer()
  const inner = Array.from(root.childNodes).map((node) => serializer.serializeToString(node)).join('')
  if (!inner.trim()) throw new Error('The SVG does not contain reusable vector artwork.')
  const scale = 100 / Math.max(Math.abs(width), Math.abs(height), 1)
  const drawW = Math.abs(width) * scale
  const drawH = Math.abs(height) * scale
  const dx = (100 - drawW) / 2
  const dy = (100 - drawH) / 2
  const body = `<g transform="translate(${dx.toFixed(4)} ${dy.toFixed(4)}) scale(${scale.toFixed(6)}) translate(${-x} ${-y})">${inner}</g>`
  const roles = paints.length ? paints.map((_, index) => ROLE_ORDER[index]) : ['primary']
  return {
    id: uid(),
    name: name.trim() || 'Custom SVG Shape',
    category,
    roles,
    body,
    originalColors: paints,
    sourceViewBox: `${x} ${y} ${width} ${height}`,
  }
}
