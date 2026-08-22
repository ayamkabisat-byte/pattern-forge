import type { SvgAsset } from '../types'

const BLOCKED_TAGS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'image'])
const NON_RENDERING_TAGS = new Set([
  'defs',
  'style',
  'title',
  'desc',
  'metadata',
  'clippath',
  'mask',
  'lineargradient',
  'radialgradient',
  'symbol',
  'pattern',
  'marker',
])

function numeric(value: string | null, fallback: number) {
  const n = Number.parseFloat(value || '')
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function readViewBox(root: Element) {
  const rawViewBox = root.getAttribute('viewBox')
  let width = numeric(root.getAttribute('width'), 100)
  let height = numeric(root.getAttribute('height'), 100)
  let viewBox = rawViewBox || `0 0 ${width} ${height}`

  if (rawViewBox) {
    const parts = rawViewBox.trim().split(/[ ,]+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      width = Math.abs(parts[2]) || width
      height = Math.abs(parts[3]) || height
      viewBox = parts.join(' ')
    }
  }

  return { viewBox, width, height }
}

async function visualViewBox(innerSvg: string, fallback: { viewBox: string; width: number; height: number }) {
  const ns = 'http://www.w3.org/2000/svg'
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '-100000px',
    width: '1000px',
    height: '1000px',
    visibility: 'hidden',
    pointerEvents: 'none',
    overflow: 'visible',
  })

  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', fallback.viewBox)
  svg.setAttribute('width', '1000')
  svg.setAttribute('height', '1000')
  svg.setAttribute('overflow', 'visible')
  svg.innerHTML = innerSvg

  const wrapper = document.createElementNS(ns, 'g')
  const children = Array.from(svg.children)
  for (const child of children) {
    if (!NON_RENDERING_TAGS.has(child.tagName.toLowerCase())) wrapper.appendChild(child)
  }
  svg.appendChild(wrapper)
  host.appendChild(svg)
  document.body.appendChild(host)

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const bbox = wrapper.getBBox()
    if (!Number.isFinite(bbox.x) || !Number.isFinite(bbox.y) || bbox.width <= 0 || bbox.height <= 0) {
      return { ...fallback, trimmed: false }
    }

    // Small safety margin protects strokes from being clipped after viewBox normalization.
    const margin = Math.max(0.5, Math.max(bbox.width, bbox.height) * 0.012)
    const x = bbox.x - margin
    const y = bbox.y - margin
    const width = bbox.width + margin * 2
    const height = bbox.height + margin * 2

    return {
      viewBox: `${x} ${y} ${width} ${height}`,
      width,
      height,
      trimmed: true,
    }
  } catch {
    return { ...fallback, trimmed: false }
  } finally {
    host.remove()
  }
}

export async function parseSvgAsset(text: string, name: string, id: string): Promise<SvgAsset> {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error(`${name} is not a valid SVG file.`)
  }

  root.querySelectorAll('*').forEach((el) => {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove()
      return
    }
    for (const attr of Array.from(el.attributes)) {
      const key = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (key.startsWith('on')) el.removeAttribute(attr.name)
      if ((key === 'href' || key.endsWith(':href')) && value && !value.startsWith('#')) el.removeAttribute(attr.name)
      if ((key === 'style' || key === 'fill' || key === 'stroke') && /url\(\s*https?:/i.test(value)) el.removeAttribute(attr.name)
    }
  })

  const prefix = `pf-${id}-`
  const idMap = new Map<string, string>()
  root.querySelectorAll('[id]').forEach((el) => {
    const oldId = el.id
    const nextId = `${prefix}${oldId}`
    idMap.set(oldId, nextId)
    el.id = nextId
  })
  root.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      let value = attr.value
      idMap.forEach((nextId, oldId) => {
        value = value.replaceAll(`url(#${oldId})`, `url(#${nextId})`).replaceAll(`#${oldId}`, `#${nextId}`)
      })
      if (value !== attr.value) el.setAttribute(attr.name, value)
    }
  })

  const fallback = readViewBox(root)
  const innerSvg = root.innerHTML
  const visual = await visualViewBox(innerSvg, fallback)

  return {
    id,
    name,
    viewBox: visual.viewBox,
    viewWidth: visual.width,
    viewHeight: visual.height,
    innerSvg,
    visualBoundsTrimmed: visual.trimmed,
  }
}
