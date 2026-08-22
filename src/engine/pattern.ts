import type {
  BrickOffset,
  PatternInstance,
  PatternSettings,
  RepeatMode,
  SvgAsset,
} from '../types'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dims(asset: SvgAsset, motifSize: number) {
  const ratio = asset.viewWidth / asset.viewHeight || 1
  return ratio >= 1
    ? { width: motifSize, height: motifSize / ratio }
    : { width: motifSize * ratio, height: motifSize }
}

function offsetFraction(value: BrickOffset) {
  const map: Record<BrickOffset, number> = {
    '1/4': 1 / 4,
    '1/3': 1 / 3,
    '1/2': 1 / 2,
    '2/3': 2 / 3,
    '3/4': 3 / 4,
  }
  return map[value]
}

function mod(value: number, size: number) {
  return ((value % size) + size) % size
}

export function repeatCellSize(s: PatternSettings) {
  if (s.sizeTileToArt) {
    return {
      width: Math.max(8, s.motifSize + s.hSpacing),
      height: Math.max(8, s.motifSize + s.vSpacing),
    }
  }
  return {
    width: Math.max(8, s.repeatWidth),
    height: Math.max(8, s.repeatHeight),
  }
}

function sortForOverlap(items: PatternInstance[], s: PatternSettings) {
  return [...items].sort((a, b) => {
    const y = s.overlapY === 'top' ? b.y - a.y : a.y - b.y
    if (Math.abs(y) > 0.001) return y
    return s.overlapX === 'left' ? b.x - a.x : a.x - b.x
  })
}

function dedupe(items: PatternInstance[], s: PatternSettings) {
  const seen = new Set<string>()
  const out: PatternInstance[] = []
  for (const item of items) {
    const x = mod(item.x, s.tileWidth)
    const y = mod(item.y, s.tileHeight)
    const key = `${item.assetIndex}:${x.toFixed(3)}:${y.toFixed(3)}:${item.rotation.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...item, x, y, key: `${item.key}-${out.length}` })
  }
  return out
}

export function generatePattern(
  mode: RepeatMode,
  assets: SvgAsset[],
  s: PatternSettings,
): PatternInstance[] {
  if (!assets.length) return []
  const out: PatternInstance[] = []
  const cell = repeatCellSize(s)
  const stepX = cell.width
  const stepY = cell.height

  if (mode === 'toss') {
    const rand = mulberry32(s.seed)
    const cellArea = Math.max(1, stepX * stepY)
    const tileArea = s.tileWidth * s.tileHeight
    const baseCount = Math.max(1, Math.round(tileArea / cellArea))
    const count = Math.max(1, Math.round(baseCount * (s.density / 55)))
    for (let i = 0; i < count; i++) {
      const assetIndex = i % assets.length
      const asset = assets[assetIndex]
      const d = dims(asset, s.motifSize * (0.78 + rand() * 0.44))
      out.push({
        key: `toss-${i}`,
        assetIndex,
        x: rand() * s.tileWidth,
        y: rand() * s.tileHeight,
        width: d.width,
        height: d.height,
        rotation: s.rotation + (rand() * 2 - 1) * s.randomRotation,
        flipX: rand() > 0.78,
      })
    }
    return sortForOverlap(out, s)
  }

  if (mode === 'kawung') {
    let index = 0
    const rows = Math.ceil(s.tileHeight / stepY) + 2
    const cols = Math.ceil(s.tileWidth / stepX) + 2
    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const assetIndex = index++ % assets.length
        const asset = assets[assetIndex]
        const d = dims(asset, s.motifSize * 0.58)
        const cx = col * stepX
        const cy = row * stepY
        ;[0, 90, 180, 270].forEach((angle, arm) => {
          const radius = s.motifSize * 0.28
          const rad = (angle * Math.PI) / 180
          out.push({
            key: `k-${row}-${col}-${arm}`,
            assetIndex,
            x: cx + Math.cos(rad) * radius,
            y: cy + Math.sin(rad) * radius,
            width: d.width,
            height: d.height,
            rotation: angle + s.rotation,
          })
        })
      }
    }
    return sortForOverlap(dedupe(out, s), s)
  }

  const offset = offsetFraction(s.brickOffset)
  const xStep = mode === 'hex-column' ? stepX * 0.75 : stepX
  const yStep = mode === 'hex-row' ? stepY * 0.75 : stepY
  const rows = Math.ceil(s.tileHeight / yStep) + 3
  const cols = Math.ceil(s.tileWidth / xStep) + 3
  let counter = 0

  for (let row = -2; row <= rows; row++) {
    for (let col = -2; col <= cols; col++) {
      const assetIndex = counter++ % assets.length
      const asset = assets[assetIndex]
      const d = dims(asset, s.motifSize)
      let px = col * xStep
      let py = row * yStep
      let rotation = s.rotation

      if (mode === 'brick-row') px += (row & 1) ? stepX * offset : 0
      if (mode === 'brick-column') py += (col & 1) ? stepY * offset : 0
      if (mode === 'hex-row') px += (row & 1) ? stepX / 2 : 0
      if (mode === 'hex-column') py += (col & 1) ? stepY / 2 : 0
      if (mode === 'ceplok') {
        px += (row & 1) ? stepX / 2 : 0
        rotation += ((row + col) & 1) ? 45 : 0
      }

      out.push({
        key: `${mode}-${row}-${col}`,
        assetIndex,
        x: px,
        y: py,
        width: d.width,
        height: d.height,
        rotation,
      })
    }
  }

  return sortForOverlap(dedupe(out, s), s)
}

function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderInstance(item: PatternInstance, asset: SvgAsset, dx = 0, dy = 0) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return `<g transform="translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})"><svg width="${item.width}" height="${item.height}" viewBox="${esc(asset.viewBox)}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
}

export function buildSvg(assets: SvgAsset[], instances: PatternInstance[], s: PatternSettings) {
  const shiftsX = [-s.tileWidth, 0, s.tileWidth]
  const shiftsY = [-s.tileHeight, 0, s.tileHeight]
  const body = instances
    .flatMap((item) => {
      const asset = assets[item.assetIndex]
      if (!asset) return []
      return shiftsX.flatMap((dx) => shiftsY.map((dy) => renderInstance(item, asset, dx, dy)))
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.tileWidth}" height="${s.tileHeight}" viewBox="0 0 ${s.tileWidth} ${s.tileHeight}"><defs><clipPath id="pf-master-clip"><rect width="${s.tileWidth}" height="${s.tileHeight}"/></clipPath></defs><rect width="100%" height="100%" fill="${esc(s.background)}"/><g clip-path="url(#pf-master-clip)">${body}</g></svg>`
}
