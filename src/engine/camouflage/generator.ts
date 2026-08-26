import type { CamoPatternData, OrganicDirection } from './types'

const TRANSPARENT = 255
const TAU = Math.PI * 2
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const mod = (value: number, size: number) => ((value % size) + size) % size

export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    let t = value += 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Harmonic = { kx: number; ky: number; phase: number; amp: number }
type FieldProfile = {
  macroScale: number
  mediumBreakup: number
  edgeComplexity: number
  branching: number
  islandAmount: number
  direction: OrganicDirection
}

type RegionScores = {
  scores: Float64Array[]
  biases: number[]
  size: number
}

function chooseWaveVector(rand: () => number, minFreq: number, maxFreq: number, direction: OrganicDirection) {
  const freq = Math.max(1, Math.round(minFreq + rand() * Math.max(0, maxFreq - minFreq)))
  const signX = rand() > .5 ? 1 : -1
  const signY = rand() > .5 ? 1 : -1
  if (direction === 'horizontal') {
    const kx = rand() < .65 ? 0 : Math.max(1, Math.round(freq * .35)) * signX
    return { kx, ky: freq * signY }
  }
  if (direction === 'vertical') {
    const ky = rand() < .65 ? 0 : Math.max(1, Math.round(freq * .35)) * signY
    return { kx: freq * signX, ky }
  }
  if (direction === 'diagonal') {
    const minor = Math.max(1, freq + (rand() > .5 ? 1 : -1))
    return { kx: freq * signX, ky: minor * signY }
  }
  let kx = Math.round(rand() * freq) * signX
  let ky = Math.round(rand() * freq) * signY
  if (kx === 0 && ky === 0) kx = freq
  return { kx, ky }
}

function addBand(out: Harmonic[], rand: () => number, count: number, minFreq: number, maxFreq: number, amplitude: number, direction: OrganicDirection) {
  for (let i = 0; i < count; i++) {
    const vector = chooseWaveVector(rand, minFreq, maxFreq, direction)
    out.push({ ...vector, phase: rand() * TAU, amp: amplitude * (.55 + rand() * .9) })
  }
}

function createPeriodicField(seed: number, profile: FieldProfile) {
  const rand = seededRandom(seed)
  const macro = clamp01(profile.macroScale)
  const medium = clamp01(profile.mediumBreakup)
  const edge = clamp01(profile.edgeComplexity)
  const islands = clamp01(profile.islandAmount)
  const branching = clamp01(profile.branching)
  const harmonics: Harmonic[] = []

  const macroMax = Math.max(2, Math.round(4.6 - macro * 2.8))
  addBand(harmonics, rand, 6, 1, macroMax, 1, profile.direction)
  addBand(harmonics, rand, 6, 2, 6, .18 + medium * .78, profile.direction)
  addBand(harmonics, rand, 5, 5, 11, .03 + edge * .32 + islands * .22, profile.direction)

  const warpPhaseX = rand() * TAU
  const warpPhaseY = rand() * TAU
  const warpPhaseD = rand() * TAU
  const warpAmount = .012 + branching * .085

  return (x: number, y: number, size: number) => {
    const nx = x / size
    const ny = y / size
    const warpX = warpAmount * (Math.sin(TAU * (2 * ny) + warpPhaseX) + .55 * Math.sin(TAU * (3 * nx + ny) + warpPhaseD))
    const warpY = warpAmount * (Math.sin(TAU * (2 * nx) + warpPhaseY) + .55 * Math.cos(TAU * (nx - 3 * ny) - warpPhaseD))
    const ux = nx + warpX
    const uy = ny + warpY
    let value = 0
    let total = 0
    for (const harmonic of harmonics) {
      value += Math.sin(TAU * (harmonic.kx * ux + harmonic.ky * uy) + harmonic.phase) * harmonic.amp
      total += Math.abs(harmonic.amp)
    }
    if (total <= 0) return 0
    const normalized = value / total
    return normalized + Math.sin(normalized * Math.PI * (1.25 + branching * 1.8)) * branching * .18
  }
}

function weightAt(weights: number[], index: number) {
  const value = Number(weights[index])
  return Number.isFinite(value) && value > 0 ? value : 1
}

function normalizedWeights(paletteSize: number, weights: number[]) {
  const raw = Array.from({ length: paletteSize }, (_, index) => weightAt(weights, index))
  const total = raw.reduce((sum, value) => sum + value, 0) || 1
  return raw.map((value) => value / total)
}

function calibrateBiases(scores: Float64Array[], weights: number[], iterations = 10) {
  const colors = scores.length
  if (!colors) return []
  const count = scores[0].length
  const target = normalizedWeights(colors, weights)
  const biases = target.map((value) => Math.log(Math.max(1e-6, value)) * .28)

  for (let iteration = 0; iteration < iterations; iteration++) {
    const observed = new Array(colors).fill(0)
    for (let index = 0; index < count; index++) {
      let best = 0
      let bestScore = scores[0][index] + biases[0]
      for (let color = 1; color < colors; color++) {
        const score = scores[color][index] + biases[color]
        if (score > bestScore) { best = color; bestScore = score }
      }
      observed[best]++
    }
    for (let color = 0; color < colors; color++) {
      const ratio = Math.max(1e-6, observed[color] / Math.max(1, count))
      biases[color] += .22 * Math.log(Math.max(1e-6, target[color]) / ratio)
    }
  }
  return biases
}

function createRegionScores(data: CamoPatternData, profile: FieldProfile, size: number, coordinate: (value: number) => number, weights: number[]): RegionScores {
  const scores: Float64Array[] = []
  const count = size * size
  for (let color = 0; color < data.palette.length; color++) {
    const derivedSeed = (data.seed + Math.imul(color + 1, 0x9e3779b1)) >>> 0
    const field = createPeriodicField(derivedSeed, {
      ...profile,
      macroScale: clamp01(profile.macroScale * (.92 + ((color * 37) % 11) * .012)),
      mediumBreakup: clamp01(profile.mediumBreakup * (.9 + ((color * 17) % 9) * .025)),
    })
    const values = new Float64Array(count)
    let sum = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const value = field(coordinate(x), coordinate(y), size)
        values[y * size + x] = value
        sum += value
      }
    }
    const mean = sum / Math.max(1, count)
    let variance = 0
    for (let index = 0; index < count; index++) variance += (values[index] - mean) ** 2
    const std = Math.sqrt(variance / Math.max(1, count)) || 1
    for (let index = 0; index < count; index++) values[index] = (values[index] - mean) / std
    scores.push(values)
  }
  return { scores, biases: calibrateBiases(scores, weights), size }
}

function labelsFromRegionScores(region: RegionScores) {
  const { scores, biases } = region
  const count = scores[0]?.length ?? 0
  const labels = new Uint8Array(count)
  for (let index = 0; index < count; index++) {
    let best = 0
    let bestScore = scores[0][index] + biases[0]
    for (let color = 1; color < scores.length; color++) {
      const score = scores[color][index] + biases[color]
      if (score > bestScore) { best = color; bestScore = score }
    }
    labels[index] = best
  }
  return labels
}

function dominanceField(region: RegionScores, colorIndex: number) {
  const { scores, biases } = region
  const count = scores[colorIndex]?.length ?? 0
  const values = new Float64Array(count)
  for (let index = 0; index < count; index++) {
    const own = scores[colorIndex][index] + biases[colorIndex]
    let other = -Infinity
    for (let color = 0; color < scores.length; color++) {
      if (color === colorIndex) continue
      other = Math.max(other, scores[color][index] + biases[color])
    }
    values[index] = own - other
  }
  return values
}

function digitalProfile(data: CamoPatternData): FieldProfile {
  const s = data.digital
  return {
    macroScale: s.macroRegion ?? s.macroScale,
    mediumBreakup: s.mediumBreakup ?? s.mediumScale,
    edgeComplexity: s.fragmentation ?? s.roughness,
    branching: clamp01((s.fragmentation + s.stairStep) * .5),
    islandAmount: s.islandAmount ?? s.microDetail,
    direction: 'none',
  }
}

function organicProfile(data: CamoPatternData): FieldProfile {
  const s = data.organic
  return {
    macroScale: s.macroScale ?? s.blobScale,
    mediumBreakup: s.mediumBreakup ?? s.distortion,
    edgeComplexity: s.edgeComplexity,
    branching: s.branching ?? s.elongation,
    islandAmount: s.islandAmount ?? .12,
    direction: s.direction,
  }
}

function nearestChunk(blockScale: number) {
  const scale = clamp01(blockScale)
  if (scale > .84) return 8
  if (scale > .6) return 4
  if (scale > .3) return 2
  return 1
}

function cleanupOrthogonal(cells: Uint8Array, size: number, passes: number) {
  let current = cells
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice()
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const center = current[y * size + x]
        const neighbors = [
          current[y * size + mod(x - 1, size)],
          current[y * size + mod(x + 1, size)],
          current[mod(y - 1, size) * size + x],
          current[mod(y + 1, size) * size + x],
        ]
        const counts = new Map<number, number>()
        for (const value of neighbors) counts.set(value, (counts.get(value) ?? 0) + 1)
        let best = center
        let bestCount = 0
        counts.forEach((count, value) => { if (count > bestCount) { best = value; bestCount = count } })
        if (best !== center && bestCount >= 3) next[y * size + x] = best
      }
    }
    current = next
  }
  return current
}

export function generateDigitalCells(data: CamoPatternData) {
  const s = data.digital
  const size = s.resolution
  const chunk = nearestChunk(s.blockScale)
  const coordinate = (value: number) => Math.floor(value / chunk) * chunk + chunk * .5
  const region = createRegionScores(data, digitalProfile(data), size, coordinate, s.colorWeights)
  let cells = labelsFromRegionScores(region)
  const passes = Math.max(0, Math.round(clamp01(s.orthogonalCleanup) * 3))
  cells = cleanupOrthogonal(cells, size, passes)
  if (data.backgroundMode === 'transparent') {
    for (let index = 0; index < cells.length; index++) if (cells[index] === data.backgroundColor) cells[index] = TRANSPARENT
  }
  return cells
}

function documentSize(width: number, height: number, longSide: number) {
  const logicalLong = Math.max(width, height) || 1
  const scale = Math.max(64, Math.min(20000, Math.round(longSide))) / logicalLong
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function esc(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
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

export function digitalCamoSvg(data: CamoPatternData) {
  const size = data.digital.resolution
  const dims = documentSize(size, size, data.exportLongSide)
  const cells = generateDigitalCells(data)
  const backgroundIndex = data.backgroundMode === 'solid' ? data.backgroundColor : null
  const background = backgroundIndex !== null && data.palette[backgroundIndex]
    ? `<rect width="${size}" height="${size}" fill="${esc(data.palette[backgroundIndex])}"/>`
    : ''
  const paths = digitalPaths(cells, size, data.palette.length, TRANSPARENT, backgroundIndex)
  const body = Array.from(paths.entries()).map(([index, parts]) => `<path fill="${esc(data.palette[index])}" d="${parts.join('')}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="camouflage-digital-region">${background}${body}</svg>`
}

type Point = { x: number; y: number }

function interpolate(a: number, b: number, threshold: number) {
  const denominator = b - a
  if (Math.abs(denominator) < 1e-9) return .5
  return Math.max(0, Math.min(1, (threshold - a) / denominator))
}

function cellPolygons(v0: number, v1: number, v2: number, v3: number, threshold: number): Point[][] {
  const mask = (v0 >= threshold ? 1 : 0) | (v1 >= threshold ? 2 : 0) | (v2 >= threshold ? 4 : 0) | (v3 >= threshold ? 8 : 0)
  if (mask === 0) return []
  const A = { x: 0, y: 0 }
  const B = { x: 1, y: 0 }
  const C = { x: 1, y: 1 }
  const D = { x: 0, y: 1 }
  const T = { x: interpolate(v0, v1, threshold), y: 0 }
  const R = { x: 1, y: interpolate(v1, v2, threshold) }
  const Bt = { x: interpolate(v3, v2, threshold), y: 1 }
  const L = { x: 0, y: interpolate(v0, v3, threshold) }
  const centerInside = (v0 + v1 + v2 + v3) * .25 >= threshold

  switch (mask) {
    case 1: return [[A, T, L]]
    case 2: return [[B, R, T]]
    case 3: return [[A, B, R, L]]
    case 4: return [[C, Bt, R]]
    case 5: return centerInside ? [[A, T, R, C, Bt, L]] : [[A, T, L], [C, Bt, R]]
    case 6: return [[T, B, C, Bt]]
    case 7: return [[A, B, C, Bt, L]]
    case 8: return [[D, L, Bt]]
    case 9: return [[A, T, Bt, D]]
    case 10: return centerInside ? [[T, B, R, Bt, D, L]] : [[B, R, T], [D, L, Bt]]
    case 11: return [[A, B, R, Bt, D]]
    case 12: return [[L, R, C, D]]
    case 13: return [[A, T, R, C, D]]
    case 14: return [[T, B, C, D, L]]
    case 15: return [[A, B, C, D]]
    default: return []
  }
}

function effectiveOrganicResolution(data: CamoPatternData) {
  const s = data.organic
  const detailFactor = s.detail === 'clean' ? .78 : s.detail === 'detailed' ? 1.18 : 1
  const simplifyFactor = 1 - clamp01(s.simplification) * .28
  return Math.max(32, Math.min(128, Math.round(s.fieldResolution * detailFactor * simplifyFactor)))
}

function organicRegionScores(data: CamoPatternData) {
  const n = effectiveOrganicResolution(data)
  const region = createRegionScores(data, organicProfile(data), n, (value) => value, data.organic.colorWeights)
  return { n, region }
}

function fieldValue(values: Float64Array, n: number, x: number, y: number) {
  return values[mod(y, n) * n + mod(x, n)]
}

function layerPath(values: Float64Array, n: number, tile: number, threshold: number) {
  const scale = tile / n
  const f = (value: number) => Number(value.toFixed(2))
  const chunks: string[] = []

  for (let y = 0; y < n; y++) {
    let x = 0
    while (x < n) {
      const v0 = fieldValue(values, n, x, y)
      const v1 = fieldValue(values, n, x + 1, y)
      const v2 = fieldValue(values, n, x + 1, y + 1)
      const v3 = fieldValue(values, n, x, y + 1)
      const mask = (v0 >= threshold ? 1 : 0) | (v1 >= threshold ? 2 : 0) | (v2 >= threshold ? 4 : 0) | (v3 >= threshold ? 8 : 0)

      if (mask === 15) {
        const start = x
        x++
        while (x < n) {
          const a = fieldValue(values, n, x, y)
          const b = fieldValue(values, n, x + 1, y)
          const c = fieldValue(values, n, x + 1, y + 1)
          const d = fieldValue(values, n, x, y + 1)
          if (!([a, b, c, d].every((value) => value >= threshold))) break
          x++
        }
        chunks.push(`M${f(start * scale)} ${f(y * scale)}h${f((x - start) * scale)}v${f(scale)}H${f(start * scale)}z`)
        continue
      }

      if (mask !== 0) {
        const polygons = cellPolygons(v0, v1, v2, v3, threshold)
        for (const polygon of polygons) {
          if (!polygon.length) continue
          const [first, ...rest] = polygon
          let d = `M${f((x + first.x) * scale)} ${f((y + first.y) * scale)}`
          for (const point of rest) d += `L${f((x + point.x) * scale)} ${f((y + point.y) * scale)}`
          chunks.push(`${d}Z`)
        }
      }
      x++
    }
  }
  return chunks.join('')
}

function hexLuminance(hex: string) {
  const raw = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(raw)) return .5
  const values = [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16) / 255)
  const linear = values.map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
}

function catmullRomClosed(points: Point[], tension = .72) {
  if (points.length < 3) return ''
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

function spotPath(cx: number, cy: number, rx: number, ry: number, rand: () => number, smoothness: number) {
  const samples = 10 + Math.floor(rand() * 7)
  const phase = rand() * TAU
  const lobes = 2 + Math.floor(rand() * 4)
  const rotation = rand() * Math.PI
  const points: Point[] = []
  for (let i = 0; i < samples; i++) {
    const angle = i / samples * TAU
    const wobble = 1 + Math.sin(angle * lobes + phase) * .12 + (rand() - .5) * .12
    const ex = Math.cos(angle) * rx * wobble
    const ey = Math.sin(angle) * ry * wobble
    points.push({ x: cx + ex * Math.cos(rotation) - ey * Math.sin(rotation), y: cy + ex * Math.sin(rotation) + ey * Math.cos(rotation) })
  }
  return catmullRomClosed(points, .45 + smoothness * .5)
}

function pebbleOverlay(data: CamoPatternData) {
  const s = data.organic
  const tile = s.tileSize
  const rand = seededRandom((data.seed ^ 0x6d2b79f5) >>> 0)
  const count = Math.max(0, Math.round(8 + clamp01(s.spotAmount) * 72))
  const luminance = data.palette.map((color, index) => ({ index, value: hexLuminance(color) })).sort((a, b) => a.value - b.value)
  const outerIndex = luminance[0]?.index ?? 0
  const innerIndex = luminance[luminance.length - 1]?.index ?? Math.min(1, data.palette.length - 1)
  const outerColor = esc(data.palette[outerIndex] ?? '#222222')
  const innerColor = esc(data.palette[innerIndex] ?? '#EEEEEE')
  const wraps = [-1, 0, 1]
  const parts: string[] = []

  for (let i = 0; i < count; i++) {
    const cx = rand() * tile
    const cy = rand() * tile
    const base = tile * (.006 + clamp01(s.spotScale) * .022) * (.55 + rand() * 1.25)
    const rx = base * (.7 + rand() * 1.15)
    const ry = base * (.55 + rand() * .9)
    const outer = spotPath(cx, cy, rx, ry, rand, s.contourSmoothness)
    const innerScale = .26 + clamp01(s.spotInnerScale) * .48
    const inner = spotPath(cx, cy, rx * innerScale, ry * innerScale, rand, s.contourSmoothness)
    const hasInner = rand() > .18
    for (const wx of wraps) for (const wy of wraps) {
      const transform = `translate(${wx * tile} ${wy * tile})`
      parts.push(`<path d="${outer}" fill="${outerColor}" transform="${transform}"/>`)
      if (hasInner) parts.push(`<path d="${inner}" fill="${innerColor}" transform="${transform}"/>`)
    }
  }
  return parts.join('')
}

function hybridOverlay(data: CamoPatternData) {
  const amount = clamp01(data.organic.hybridBlockAmount)
  if (amount <= .01) return ''
  const tile = data.organic.tileSize
  const grid = 64
  const field = createPeriodicField((data.seed ^ 0x9e3779b9) >>> 0, { macroScale: .55, mediumBreakup: .72, edgeComplexity: .66, branching: .5, islandAmount: .2, direction: data.organic.direction })
  const values: number[] = []
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) values.push(field(x, y, grid))
  const sorted = [...values].sort((a, b) => a - b)
  const threshold = sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor((.9 - amount * .28) * (sorted.length - 1))))]
  const dark = data.palette.map((color, index) => ({ index, value: hexLuminance(color) })).sort((a, b) => a.value - b.value)[0]?.index ?? 0
  const cell = tile / grid
  const chunks: string[] = []
  for (let y = 0; y < grid; y++) {
    let x = 0
    while (x < grid) {
      if (values[y * grid + x] < threshold) { x++; continue }
      const start = x
      while (x + 1 < grid && values[y * grid + x + 1] >= threshold) x++
      chunks.push(`M${(start * cell).toFixed(2)} ${(y * cell).toFixed(2)}h${((x - start + 1) * cell).toFixed(2)}v${cell.toFixed(2)}H${(start * cell).toFixed(2)}z`)
      x++
    }
  }
  return `<path d="${chunks.join('')}" fill="${esc(data.palette[dark] ?? '#222222')}" shape-rendering="crispEdges"/>`
}

function organicRegionSvg(data: CamoPatternData) {
  const s = data.organic
  const tile = s.tileSize
  const dims = documentSize(tile, tile, data.exportLongSide)
  const { n, region } = organicRegionScores(data)
  const backgroundIndex = Math.max(0, Math.min(data.palette.length - 1, data.backgroundColor))
  const background = data.backgroundMode === 'solid' && data.palette[backgroundIndex]
    ? `<rect width="${tile}" height="${tile}" fill="${esc(data.palette[backgroundIndex])}"/>`
    : ''
  const cellSize = tile / n
  const strokeWidth = cellSize * (.015 + clamp01(s.contourSmoothness) * .065)
  const regions = data.palette.map((color, colorIndex) => {
    if (colorIndex === backgroundIndex) return ''
    const dominance = dominanceField(region, colorIndex)
    const d = layerPath(dominance, n, tile, 0)
    const fill = esc(color)
    return `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="${strokeWidth.toFixed(3)}" stroke-linejoin="round"/>`
  }).join('')
  const extras = data.engine === 'pebble' ? pebbleOverlay(data) : data.engine === 'hybrid' ? hybridOverlay(data) : ''
  const source = data.engine === 'pebble' ? 'camouflage-pebble' : data.engine === 'hybrid' ? 'camouflage-hybrid' : 'camouflage-interlocking'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${tile} ${tile}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="${source}"><defs><clipPath id="pf-camo-region-clip"><rect width="${tile}" height="${tile}"/></clipPath></defs>${background}<g clip-path="url(#pf-camo-region-clip)">${regions}${extras}</g></svg>`
}

export function organicCamoSvg(data: CamoPatternData) {
  return organicRegionSvg(data)
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
  const count = Math.max(1, Math.min(12, Math.round(copies)))
  const tileSvg = camouflageSvg(data)
  const logical = camouflageLogicalSize(data)
  const inner = svgInner(tileSvg)
  const width = logical.width * count
  const height = logical.height * count
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="pf-camo-proof" patternUnits="userSpaceOnUse" width="${logical.width}" height="${logical.height}"><svg width="${logical.width}" height="${logical.height}" viewBox="0 0 ${logical.width} ${logical.height}">${inner}</svg></pattern></defs><rect width="100%" height="100%" fill="url(#pf-camo-proof)"/></svg>`
}

export function randomSeed() {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return Math.max(1, values[0] % 2147483646)
  }
  return Math.floor(Math.random() * 2147483646) + 1
}
