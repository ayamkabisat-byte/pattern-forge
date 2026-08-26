import type { DirectionalMotifData } from './types'

const BLOCKED_TAGS = new Set(['script','foreignobject','iframe','object','embed','audio','video','image'])
const NON_RENDERING_TAGS = new Set(['defs','style','title','desc','metadata','clippath','mask','lineargradient','radialgradient','symbol','pattern','marker'])

function numeric(value: string | null, fallback: number) {
  const parsed = Number.parseFloat(value || '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readViewBox(root: Element) {
  const raw = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number)
  if (raw && raw.length === 4 && raw.every(Number.isFinite) && raw[2] !== 0 && raw[3] !== 0) {
    return { viewBox: raw.join(' '), width: Math.abs(raw[2]), height: Math.abs(raw[3]) }
  }
  const width = numeric(root.getAttribute('width'), 100)
  const height = numeric(root.getAttribute('height'), 100)
  return { viewBox: `0 0 ${width} ${height}`, width, height }
}

function sanitize(root: Element, prefix: string) {
  root.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) { el.remove(); return }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on')) el.removeAttribute(attr.name)
      if ((name === 'href' || name.endsWith(':href')) && value && !value.startsWith('#')) el.removeAttribute(attr.name)
      if ((name === 'style' || name === 'fill' || name === 'stroke') && /url\(\s*https?:/i.test(value)) el.removeAttribute(attr.name)
    }
  })

  const idMap = new Map<string,string>()
  root.querySelectorAll('[id]').forEach((el) => {
    const oldId = el.id
    const next = `${prefix}${oldId}`
    idMap.set(oldId, next)
    el.id = next
  })
  root.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      let value = attr.value
      idMap.forEach((next, old) => { value = value.replaceAll(`url(#${old})`, `url(#${next})`).replaceAll(`#${old}`, `#${next}`) })
      if (value !== attr.value) el.setAttribute(attr.name, value)
    }
  })
}

async function visualBounds(innerSvg: string, fallback: { viewBox: string; width: number; height: number }) {
  const ns = 'http://www.w3.org/2000/svg'
  const host = document.createElement('div')
  Object.assign(host.style, { position:'fixed', left:'-100000px', top:'-100000px', width:'1200px', height:'1200px', visibility:'hidden', pointerEvents:'none', overflow:'visible' })
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', fallback.viewBox)
  svg.setAttribute('width', '1200')
  svg.setAttribute('height', '1200')
  svg.setAttribute('overflow', 'visible')
  svg.innerHTML = innerSvg
  const wrapper = document.createElementNS(ns, 'g')
  for (const child of Array.from(svg.children)) if (!NON_RENDERING_TAGS.has(child.tagName.toLowerCase())) wrapper.appendChild(child)
  svg.appendChild(wrapper)
  host.appendChild(svg)
  document.body.appendChild(host)
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const bbox = wrapper.getBBox()
    if (!Number.isFinite(bbox.x) || !Number.isFinite(bbox.y) || bbox.width <= 0 || bbox.height <= 0) return { ...fallback, trimmed:false }
    return { viewBox:`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`, width:bbox.width, height:bbox.height, trimmed:true }
  } catch {
    return { ...fallback, trimmed:false }
  } finally {
    host.remove()
  }
}

export async function parseDirectionalSvg(text: string, name: string): Promise<DirectionalMotifData> {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error(`${name} is not a valid SVG file.`)
  sanitize(root, `pf-dir-${crypto.randomUUID().replaceAll('-', '').slice(0,10)}-`)
  const original = readViewBox(root)
  const innerSvg = root.innerHTML
  const tight = await visualBounds(innerSvg, original)
  return {
    name,
    innerSvg,
    originalViewBox: original.viewBox,
    originalWidth: original.width,
    originalHeight: original.height,
    tightViewBox: tight.viewBox,
    tightWidth: tight.width,
    tightHeight: tight.height,
    tightTrimmed: tight.trimmed,
  }
}
