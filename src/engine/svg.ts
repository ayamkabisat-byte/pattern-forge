import type { SvgAsset } from '../types'

const BLOCKED_TAGS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'image'])

function numeric(value: string | null, fallback: number) {
  const n = Number.parseFloat(value || '')
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function parseSvgAsset(text: string, name: string, id: string): SvgAsset {
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

  const rawViewBox = root.getAttribute('viewBox')
  let viewWidth = numeric(root.getAttribute('width'), 100)
  let viewHeight = numeric(root.getAttribute('height'), 100)
  let viewBox = rawViewBox || `0 0 ${viewWidth} ${viewHeight}`
  if (rawViewBox) {
    const parts = rawViewBox.trim().split(/[ ,]+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      viewWidth = Math.abs(parts[2]) || viewWidth
      viewHeight = Math.abs(parts[3]) || viewHeight
    }
  }

  return {
    id,
    name,
    viewBox,
    viewWidth,
    viewHeight,
    innerSvg: root.innerHTML,
  }
}
