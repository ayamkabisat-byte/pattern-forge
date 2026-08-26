import type { CamoPatternData, OrganicSvgDetail } from './types'

const TRANSPARENT = 255
const mod = (value: number, size: number) => ((value % size) + size) % size
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    let t = value += 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function usableColorIndexes(data: CamoPatternData) {
  const indexes = data.palette.map((_, index) => index)
  if (data.backgroundMode === 'solid' && indexes.length > 1) return indexes.filter((index) => index !== data.backgroundColor)
  return indexes
}

function weightAt(weights: number[], index: number) {
  return Math.max(0.001, Number.isFinite(weights[index]) ? weights[index] : 1)
}

function chooseColor(rand: () => number, indexes: number[], weights: number[]) {
  if (!indexes.length) return 0
  const total = indexes.reduce((sum, index) => sum + weightAt(weights, index), 0)
  let cursor = rand() * total
  for (const index of indexes) {
    cursor -= weightAt(weights, index)
    if (cursor <= 0) return index
  }
  return indexes[indexes.length - 1]
}

function fillWrappedRect(cells: Uint8Array, size: number, cx: number, cy: number, width: number, height: number, color: number) {
  const left = Math.round(cx - width / 2)
  const top = Math.round(cy - height / 2)
  for (let y = 0; y < Math.max(1, Math.round(height)); y++) {
    for (let x = 0; x < Math.max(1, Math.round(width)); x++) {
      const px = mod(left + x, size)
      const py = mod(top + y, size)
      cells[py * size + px] = color
    }
  }
}

function stampDigitalCluster(cells: Uint8Array, size: number, cx: number, cy: number, width: number, height: number, color: number, fragmentation: number, rectangularBias: number, rand: () => number) {
  fillWrappedRect(cells, size, cx, cy, width, height, color)
  const satellites = 1 + Math.round(fragmentation * 5 + rand() * 2)
  for (let i = 0; i < satellites; i++) {
    const horizontal = rand() < rectangularBias
    const scale = 0.24 + rand() * 0.46
    const sw = Math.max(1, width * (horizontal ? scale : 0.35 + rand() * 0.35))
    const sh = Math.max(1, height * (horizontal ? 0.35 + rand() * 0.35 : scale))
    const angle = rand() * Math.PI * 2
    const distance = Math.max(width, height) * (0.2 + rand() * 0.7)
    fillWrappedRect(cells, size, cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance, sw, sh, color)
  }
}

function smoothDigital(cells: Uint8Array, size: number, passes: number, roughness: number, rand: () => number) {
  let current = cells
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice()
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (rand() < roughness * 0.18) continue
      const neighbors = [
        current[y * size + mod(x - 1, size)],
        current[y * size + mod(x + 1, size)],
        current[mod(y - 1, size) * size + x],
        current[mod(y + 1, size) * size + x],
      ]
      const counts = new Map<number, number>()
      neighbors.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1))
      let best = current[y * size + x]
      let bestCount = 1
      counts.forEach((count, value) => { if (count > bestCount) { best = value; bestCount = count } })
      if (bestCount >= 3) next[y * size + x] = best
    }
    current = next
  }
  return current
}

export function generateDigitalCells(data: CamoPatternData) {
  const settings = data.digital
  const size = settings.resolution
  const rand = seededRandom(data.seed)
  const background = data.backgroundMode === 'solid' ? data.backgroundColor : TRANSPARENT
  let cells = new Uint8Array(size * size).fill(background)
  const indexes = usableColorIndexes(data)
  const density = clamp01(settings.density)

  const macroCount = Math.round(5 + density * 18)
  for (let i = 0; i < macroCount; i++) {
    const color = chooseColor(rand, indexes, settings.colorWeights)
    const base = size * (0.055 + clamp01(settings.macroScale) * 0.15)
    const width = base * (0.65 + rand() * 1.45)
    const height = base * (0.55 + rand() * 1.35)
    stampDigitalCluster(cells, size, rand() * size, rand() * size, width, height, color, settings.fragmentation, settings.rectangularBias, rand)
  }

  const mediumCount = Math.round(8 + density * 30)
  for (let i = 0; i < mediumCount; i++) {
    const color = chooseColor(rand, indexes, settings.colorWeights)
    const base = size * (0.018 + clamp01(settings.mediumScale) * 0.065)
    stampDigitalCluster(cells, size, rand() * size, rand() * size, base * (0.7 + rand()), base * (0.6 + rand()), color, settings.fragmentation * .7, settings.rectangularBias, rand)
  }

  const microCount = Math.round(clamp01(settings.microDetail) * size * 1.4)
  for (let i = 0; i < microCount; i++) {
    const color = chooseColor(rand, indexes, settings.colorWeights)
    const width = 1 + Math.floor(rand() * Math.max(2, size * 0.035))
    const height = 1 + Math.floor(rand() * Math.max(2, size * 0.028))
    fillWrappedRect(cells, size, rand() * size, rand() * size, width, height, color)
  }

  cells = smoothDigital(cells, size, Math.max(0, Math.min(3, Math.round(settings.smoothingPasses))), clamp01(settings.roughness), rand)
  return cells
}

function digitalPaths(cells: Uint8Array, size: number, paletteSize: number, transparent: number, backgroundIndex: number | null) {
  const paths = new Map<number, string[]>()
  for (let y = 0; y < size; y++) {
    let x = 0
    while (x < size) {
      const value = cells[y * size + x]
      const start = x
      while (x + 1 < size && cells[y * size + x + 1] === value) x++
      const length = x - start + 1
      if (value !== transparent && value < paletteSize && value !== backgroundIndex) {
        const list = paths.get(value) ?? []
        list.push(`M${start} ${y}h${length}v1H${start}z`)
        paths.set(value, list)
      }
      x++
    }
  }
  return paths
}

function documentSize(width: number, height: number, longSide: number) {
  const logicalLong = Math.max(width, height) || 1
  const scale = Math.max(64, Math.min(20000, Math.round(longSide))) / logicalLong
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function esc(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function digitalCamoSvg(data: CamoPatternData) {
  const size = data.digital.resolution
  const cells = generateDigitalCells(data)
  const dims = documentSize(size, size, data.exportLongSide)
  const backgroundIndex = data.backgroundMode === 'solid' ? data.backgroundColor : null
  const background = backgroundIndex !== null && data.palette[backgroundIndex]
    ? `<rect width="${size}" height="${size}" fill="${esc(data.palette[backgroundIndex])}"/>`
    : ''
  const paths = digitalPaths(cells, size, data.palette.length, TRANSPARENT, backgroundIndex)
  const body = Array.from(paths.entries()).map(([index, parts]) => `<path fill="${esc(data.palette[index])}" d="${parts.join('')}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="camouflage-digital">${background}${body}</svg>`
}

type Point = { x: number; y: number }

type OrganicBlob = {
  path: string
  color: number
}

function catmullRomClosed(points: Point[], smoothness: number) {
  if (points.length < 3) return ''
  const tension = 0.35 + clamp01(smoothness) * 0.75
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  const n = points.length
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]
    const p1 = points[i]
    const p2 = points[(i + 1) % n]
    const p3 = points[(i + 2) % n]
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension
    d += `C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return `${d}Z`
}

function detailSamples(detail: OrganicSvgDetail, complexity: number, simplification: number) {
  const base = detail === 'clean' ? 14 : detail === 'detailed' ? 42 : 26
  return Math.max(10, Math.round(base + complexity * 18 - simplification * 12))
}

function directionAngle(direction: CamoPatternData['organic']['direction'], rand: () => number) {
  if (direction === 'horizontal') return (rand() - .5) * .45
  if (direction === 'vertical') return Math.PI / 2 + (rand() - .5) * .45
  if (direction === 'diagonal') return Math.PI / 4 + (rand() - .5) * .55
  return rand() * Math.PI
}

function makeOrganicBlob(data: CamoPatternData, rand: () => number, index: number): OrganicBlob {
  const s = data.organic
  const tile = s.tileSize
  const base = tile * (0.035 + clamp01(s.blobScale) * 0.085) * (0.72 + rand() * 0.9)
  const elongated = 1 + clamp01(s.elongation) * (0.5 + rand() * 1.2)
  let rx = base * elongated
  let ry = base / Math.sqrt(elongated)
  if (rand() > .5) [rx, ry] = [ry, rx]
  const cx = rand() * tile
  const cy = rand() * tile
  const rotation = directionAngle(s.direction, rand)
  const phase = rand() * Math.PI * 2
  const lobes = 2 + Math.floor(rand() * (3 + clamp01(s.edgeComplexity) * 6))
  const samples = detailSamples(s.detail, s.edgeComplexity, s.simplification)
  const points: Point[] = []
  for (let i = 0; i < samples; i++) {
    const angle = i / samples * Math.PI * 2
    const wave = Math.sin(angle * lobes + phase) * clamp01(s.distortion) * .24
    const wave2 = Math.sin(angle * (lobes + 2) - phase * .7) * clamp01(s.edgeComplexity) * .12
    const jitter = (rand() - .5) * clamp01(s.distortion) * .14
    const radius = Math.max(.42, 1 + wave + wave2 + jitter)
    const ex = Math.cos(angle) * rx * radius
    const ey = Math.sin(angle) * ry * radius
    const x = cx + ex * Math.cos(rotation) - ey * Math.sin(rotation)
    const y = cy + ex * Math.sin(rotation) + ey * Math.cos(rotation)
    points.push({ x, y })
  }
  const indexes = usableColorIndexes(data)
  const color = chooseColor(rand, indexes, s.colorWeights)
  return { path: catmullRomClosed(points, s.smoothness), color: color ?? (index % Math.max(1, data.palette.length)) }
}

function generateOrganicBlobs(data: CamoPatternData) {
  const rand = seededRandom(data.seed)
  const s = data.organic
  const densityFactor = .55 + clamp01(s.coverage) * .9
  const overlapFactor = .75 + clamp01(s.overlap) * .65
  const count = Math.max(4, Math.round(s.blobCount * densityFactor * overlapFactor))
  return Array.from({ length: count }, (_, index) => makeOrganicBlob(data, rand, index))
}

export function organicCamoSvg(data: CamoPatternData) {
  const tile = data.organic.tileSize
  const dims = documentSize(tile, tile, data.exportLongSide)
  const blobs = generateOrganicBlobs(data)
  const background = data.backgroundMode === 'solid' && data.palette[data.backgroundColor]
    ? `<rect width="${tile}" height="${tile}" fill="${esc(data.palette[data.backgroundColor])}"/>`
    : ''
  const wraps = [-1, 0, 1]
  const body = blobs.map((blob, blobIndex) => wraps.flatMap((wx) => wraps.map((wy) => {
    const color = data.palette[blob.color] ?? data.palette[0] ?? '#000000'
    return `<path d="${blob.path}" fill="${esc(color)}" transform="translate(${wx * tile} ${wy * tile})" data-blob="${blobIndex}"/>`
  })).join('')).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${tile} ${tile}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="camouflage-organic"><defs><clipPath id="pf-camo-organic-clip"><rect width="${tile}" height="${tile}"/></clipPath></defs>${background}<g clip-path="url(#pf-camo-organic-clip)">${body}</g></svg>`
}

export function camouflageSvg(data: CamoPatternData) {
  return data.mode === 'digital' ? digitalCamoSvg(data) : organicCamoSvg(data)
}

function svgInner(svg: string) {
  const start = svg.indexOf('>')
  const end = svg.lastIndexOf('</svg>')
  return start >= 0 && end > start ? svg.slice(start + 1, end) : svg
}

export function camouflageLogicalSize(data: CamoPatternData) {
  const size = data.mode === 'digital' ? data.digital.resolution : data.organic.tileSize
  return { width: size, height: size }
}

export function camouflageProofSvg(data: CamoPatternData, copies: number) {
  const tileSvg = camouflageSvg(data)
  const { width, height } = camouflageLogicalSize(data)
  const count = Math.max(1, Math.round(copies))
  const body = svgInner(tileSvg)
  const totalWidth = width * count
  const totalHeight = height * count
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}"><defs><pattern id="pf-camo-proof" patternUnits="userSpaceOnUse" width="${width}" height="${height}"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg></pattern></defs><rect width="100%" height="100%" fill="url(#pf-camo-proof)"/></svg>`
}

export function randomSeed() {
  return Math.floor(Math.random() * 2147483646) + 1
}
