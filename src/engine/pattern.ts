import type {
  BrickOffset,
  PatternGeometry,
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

function maxMotifDims(assets: SvgAsset[], motifSize: number) {
  let width = motifSize
  let height = motifSize
  if (!assets.length) return { width, height }

  width = 1
  height = 1
  for (const asset of assets) {
    const d = dims(asset, motifSize)
    width = Math.max(width, d.width)
    height = Math.max(height, d.height)
  }
  return { width, height }
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

function even(value: number) {
  const n = Math.max(2, Math.round(value))
  return n % 2 === 0 ? n : n + 1
}

function mod(value: number, size: number) {
  return ((value % size) + size) % size
}

export function patternGeometry(mode: RepeatMode, assets: SvgAsset[], s: PatternSettings): PatternGeometry {
  const maxDims = maxMotifDims(assets, s.motifSize)
  const cellWidth = s.sizeTileToArt
    ? Math.max(8, maxDims.width + s.paddingX * 2)
    : Math.max(8, s.repeatWidth)
  const cellHeight = s.sizeTileToArt
    ? Math.max(8, maxDims.height + s.paddingY * 2)
    : Math.max(8, s.repeatHeight)

  let stepX = Math.max(8, cellWidth + s.hSpacing)
  let stepY = Math.max(8, cellHeight + s.vSpacing)
  let columns = Math.max(1, Math.round(s.columns))
  let rows = Math.max(1, Math.round(s.rows))

  if (mode === 'hex-column') {
    stepX *= 0.75
    columns = even(columns)
  }
  if (mode === 'hex-row') {
    stepY *= 0.75
    rows = even(rows)
  }
  if (mode === 'brick-row' || mode === 'ceplok') rows = even(rows)
  if (mode === 'brick-column') columns = even(columns)

  const tileWidth = s.snapTileToGrid && mode !== 'toss'
    ? Math.max(8, stepX * columns)
    : Math.max(8, s.tileWidth)
  const tileHeight = s.snapTileToGrid && mode !== 'toss'
    ? Math.max(8, stepY * rows)
    : Math.max(8, s.tileHeight)

  if (!s.snapTileToGrid || mode === 'toss') {
    columns = Math.max(1, Math.ceil(tileWidth / stepX))
    rows = Math.max(1, Math.ceil(tileHeight / stepY))
  }

  return { cellWidth, cellHeight, stepX, stepY, tileWidth, tileHeight, rows, columns }
}

export function repeatCellSize(s: PatternSettings, assets: SvgAsset[] = []) {
  const maxDims = maxMotifDims(assets, s.motifSize)
  return {
    width: s.sizeTileToArt ? maxDims.width + s.paddingX * 2 : s.repeatWidth,
    height: s.sizeTileToArt ? maxDims.height + s.paddingY * 2 : s.repeatHeight,
  }
}

function fitAssetToCell(asset: SvgAsset, s: PatternSettings, g: PatternGeometry) {
  const base = dims(asset, s.motifSize)
  const availableWidth = Math.max(1, g.cellWidth - s.paddingX * 2)
  const availableHeight = Math.max(1, g.cellHeight - s.paddingY * 2)
  const scale = Math.min(1, availableWidth / base.width, availableHeight / base.height)
  return { width: base.width * scale, height: base.height * scale }
}

function alignedCenter(originX: number, originY: number, width: number, height: number, s: PatternSettings, g: PatternGeometry) {
  const innerLeft = originX + s.paddingX
  const innerTop = originY + s.paddingY
  const innerWidth = Math.max(1, g.cellWidth - s.paddingX * 2)
  const innerHeight = Math.max(1, g.cellHeight - s.paddingY * 2)

  let x = innerLeft + innerWidth / 2
  let y = innerTop + innerHeight / 2

  if (s.alignX === 'left') x = innerLeft + width / 2
  if (s.alignX === 'right') x = innerLeft + innerWidth - width / 2
  if (s.alignY === 'top') y = innerTop + height / 2
  if (s.alignY === 'bottom') y = innerTop + innerHeight - height / 2

  return { x, y }
}

function sortForOverlap(items: PatternInstance[], s: PatternSettings) {
  return [...items].sort((a, b) => {
    const y = s.overlapY === 'top' ? b.y - a.y : a.y - b.y
    if (Math.abs(y) > 0.001) return y
    return s.overlapX === 'left' ? b.x - a.x : a.x - b.x
  })
}

function dedupeToTile(items: PatternInstance[], tileWidth: number, tileHeight: number) {
  const seen = new Set<string>()
  const out: PatternInstance[] = []
  for (const item of items) {
    const x = mod(item.x, tileWidth)
    const y = mod(item.y, tileHeight)
    const key = `${item.assetIndex}:${x.toFixed(3)}:${y.toFixed(3)}:${item.rotation.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...item, x, y, key: `${item.key}-${out.length}` })
  }
  return out
}

function cellOrigin(mode: RepeatMode, row: number, col: number, g: PatternGeometry, s: PatternSettings) {
  const offset = offsetFraction(s.brickOffset)
  let x = col * g.stepX
  let y = row * g.stepY

  if (mode === 'brick-row') x += (row & 1) ? (g.cellWidth + s.hSpacing) * offset : 0
  if (mode === 'brick-column') y += (col & 1) ? (g.cellHeight + s.vSpacing) * offset : 0
  if (mode === 'hex-row') x += (row & 1) ? (g.cellWidth + s.hSpacing) / 2 : 0
  if (mode === 'hex-column') y += (col & 1) ? (g.cellHeight + s.vSpacing) / 2 : 0
  if (mode === 'ceplok') x += (row & 1) ? (g.cellWidth + s.hSpacing) / 2 : 0

  return { x, y }
}

export function generatePattern(
  mode: RepeatMode,
  assets: SvgAsset[],
  s: PatternSettings,
): PatternInstance[] {
  if (!assets.length) return []
  const g = patternGeometry(mode, assets, s)
  const out: PatternInstance[] = []

  if (mode === 'toss') {
    const rand = mulberry32(s.seed)
    const cellArea = Math.max(1, g.cellWidth * g.cellHeight)
    const tileArea = g.tileWidth * g.tileHeight
    const baseCount = Math.max(1, Math.round(tileArea / cellArea))
    const count = Math.max(1, Math.round(baseCount * (s.density / 55)))

    for (let i = 0; i < count; i++) {
      const assetIndex = i % assets.length
      const asset = assets[assetIndex]
      const d = dims(asset, s.motifSize * (0.78 + rand() * 0.44))
      out.push({
        key: `toss-${i}`,
        assetIndex,
        x: rand() * g.tileWidth,
        y: rand() * g.tileHeight,
        width: d.width,
        height: d.height,
        rotation: s.rotation + (rand() * 2 - 1) * s.randomRotation,
        flipX: rand() > 0.78,
      })
    }
    return sortForOverlap(out, s)
  }

  let counter = 0
  const rowStart = s.snapTileToGrid ? 0 : -1
  const colStart = s.snapTileToGrid ? 0 : -1
  const rowEnd = s.snapTileToGrid ? g.rows - 1 : g.rows + 1
  const colEnd = s.snapTileToGrid ? g.columns - 1 : g.columns + 1

  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const assetIndex = counter++ % assets.length
      const asset = assets[assetIndex]
      const origin = cellOrigin(mode, row, col, g, s)

      if (mode === 'kawung') {
        const d = fitAssetToCell(asset, { ...s, motifSize: s.motifSize * 0.58 }, g)
        const center = {
          x: origin.x + g.cellWidth / 2,
          y: origin.y + g.cellHeight / 2,
        }
        ;[0, 90, 180, 270].forEach((angle, arm) => {
          const radius = Math.min(g.cellWidth, g.cellHeight) * 0.22
          const rad = (angle * Math.PI) / 180
          out.push({
            key: `k-${row}-${col}-${arm}`,
            assetIndex,
            x: center.x + Math.cos(rad) * radius,
            y: center.y + Math.sin(rad) * radius,
            width: d.width,
            height: d.height,
            rotation: angle + s.rotation,
          })
        })
        continue
      }

      const d = fitAssetToCell(asset, s, g)
      const center = alignedCenter(origin.x, origin.y, d.width, d.height, s, g)
      let rotation = s.rotation
      if (mode === 'ceplok' && ((row + col) & 1)) rotation += 45

      out.push({
        key: `${mode}-${row}-${col}`,
        assetIndex,
        x: center.x,
        y: center.y,
        width: d.width,
        height: d.height,
        rotation,
      })
    }
  }

  const normalized = s.snapTileToGrid ? out : dedupeToTile(out, g.tileWidth, g.tileHeight)
  return sortForOverlap(normalized, s)
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

export function buildSvg(mode: RepeatMode, assets: SvgAsset[], instances: PatternInstance[], s: PatternSettings) {
  const g = patternGeometry(mode, assets, s)
  const shiftsX = [-g.tileWidth, 0, g.tileWidth]
  const shiftsY = [-g.tileHeight, 0, g.tileHeight]
  const body = instances
    .flatMap((item) => {
      const asset = assets[item.assetIndex]
      if (!asset) return []
      return shiftsX.flatMap((dx) => shiftsY.map((dy) => renderInstance(item, asset, dx, dy)))
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.tileWidth}" height="${g.tileHeight}" viewBox="0 0 ${g.tileWidth} ${g.tileHeight}"><defs><clipPath id="pf-master-clip"><rect width="${g.tileWidth}" height="${g.tileHeight}"/></clipPath></defs><rect width="100%" height="100%" fill="${esc(s.background)}"/><g clip-path="url(#pf-master-clip)">${body}</g></svg>`
}
