import { patternGeometry } from './pattern'
import type { BuilderTileSettings, PatternGeometry, PatternInstance, PatternSettings, SvgAsset, TileCellPlacement } from '../types'

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

function fittedDims(
  asset: SvgAsset,
  s: PatternSettings,
  g: PatternGeometry,
  placementScale: number,
  customTile = false,
) {
  const availableWidth = Math.max(1, g.cellWidth - s.paddingX * 2)
  const availableHeight = Math.max(1, g.cellHeight - s.paddingY * 2)
  const autoSize = Math.max(8, Math.min(availableWidth, availableHeight) * 0.96)
  const base = dims(asset, customTile ? autoSize : s.motifSize)
  const fit = Math.min(1, availableWidth / base.width, availableHeight / base.height)
  const manual = Math.max(0.05, placementScale / 100)
  return {
    width: base.width * fit * manual,
    height: base.height * fit * manual,
  }
}

export function cellKey(row: number, col: number) {
  return `cell-${row}-${col}`
}

export function createPlacement(row: number, col: number, assetId: string): TileCellPlacement {
  return {
    key: cellKey(row, col),
    row,
    col,
    assetId,
    rotation: 0,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    flipX: false,
    flipY: false,
  }
}

export function normalizePlacements(placements: TileCellPlacement[], g: PatternGeometry, assets: SvgAsset[]) {
  const validAssets = new Set(assets.map((asset) => asset.id))
  return placements.filter((item) =>
    item.row >= 0 &&
    item.col >= 0 &&
    item.row < g.rows &&
    item.col < g.columns &&
    validAssets.has(item.assetId),
  )
}

export function fillSequential(assets: SvgAsset[], g: PatternGeometry): TileCellPlacement[] {
  if (!assets.length) return []
  const out: TileCellPlacement[] = []
  let index = 0
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.columns; col++) {
      out.push(createPlacement(row, col, assets[index++ % assets.length].id))
    }
  }
  return out
}

export function fillRandom(assets: SvgAsset[], g: PatternGeometry, seed: number): TileCellPlacement[] {
  if (!assets.length) return []
  const rand = mulberry32(seed)
  const out: TileCellPlacement[] = []
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.columns; col++) {
      const asset = assets[Math.floor(rand() * assets.length)]
      const item = createPlacement(row, col, asset.id)
      item.rotation = Math.round(rand() * 3) * 90
      item.flipX = rand() > 0.72
      item.flipY = rand() > 0.86
      out.push(item)
    }
  }
  return out
}

export function builderGeometry(
  assets: SvgAsset[],
  s: PatternSettings,
  tile?: BuilderTileSettings,
): PatternGeometry {
  const gridGeometry = patternGeometry('grid', assets, { ...s, snapTileToGrid: true })
  if (!tile || tile.mode !== 'custom') return gridGeometry

  const columns = Math.max(1, Math.round(s.columns))
  const rows = Math.max(1, Math.round(s.rows))
  const tileWidth = Math.max(64, tile.width)
  const tileHeight = Math.max(64, tile.height)
  const cellShape = tile.cellShape ?? 'square'

  if (cellShape === 'stretch') {
    // Stretch mode always fills the artboard. Gap is a real inter-cell gap/overlap,
    // while cell size compensates so the outside edges still reach the canvas edges.
    const cellWidth = Math.max(8, (tileWidth - (columns - 1) * s.hSpacing) / columns)
    const cellHeight = Math.max(8, (tileHeight - (rows - 1) * s.vSpacing) / rows)
    const stepX = Math.max(4, cellWidth + s.hSpacing)
    const stepY = Math.max(4, cellHeight + s.vSpacing)
    return { cellWidth, cellHeight, stepX, stepY, tileWidth, tileHeight, rows, columns, originX: 0, originY: 0 }
  }

  // Square mode preserves each motif module as a square. This is usually what
  // geometric pattern artwork expects. The grid is centered on the final canvas.
  // Positive gap separates cells; negative gap interlocks/overlaps them.
  const fitByWidth = (tileWidth - (columns - 1) * s.hSpacing) / columns
  const fitByHeight = (tileHeight - (rows - 1) * s.vSpacing) / rows
  const cellSize = Math.max(8, Math.min(fitByWidth, fitByHeight))
  const stepX = Math.max(4, cellSize + s.hSpacing)
  const stepY = Math.max(4, cellSize + s.vSpacing)
  const patternWidth = cellSize * columns + s.hSpacing * Math.max(0, columns - 1)
  const patternHeight = cellSize * rows + s.vSpacing * Math.max(0, rows - 1)
  const originX = (tileWidth - patternWidth) / 2
  const originY = (tileHeight - patternHeight) / 2

  return {
    cellWidth: cellSize,
    cellHeight: cellSize,
    stepX,
    stepY,
    tileWidth,
    tileHeight,
    rows,
    columns,
    originX,
    originY,
  }
}

export function generateBuilderPattern(
  placements: TileCellPlacement[],
  assets: SvgAsset[],
  s: PatternSettings,
  tile?: BuilderTileSettings,
): { geometry: PatternGeometry; instances: PatternInstance[] } {
  const geometry = builderGeometry(assets, s, tile)
  const assetIndexById = new Map(assets.map((asset, index) => [asset.id, index]))
  const clean = normalizePlacements(placements, geometry, assets)
  const customTile = tile?.mode === 'custom'
  const originX = geometry.originX ?? 0
  const originY = geometry.originY ?? 0

  const instances: PatternInstance[] = clean.map((placement, order) => {
    const assetIndex = assetIndexById.get(placement.assetId) ?? 0
    const asset = assets[assetIndex]
    const d = fittedDims(asset, s, geometry, placement.scale, customTile)
    const cellX = originX + placement.col * geometry.stepX
    const cellY = originY + placement.row * geometry.stepY
    return {
      key: placement.key,
      assetIndex,
      x: cellX + geometry.cellWidth / 2 + placement.offsetX,
      y: cellY + geometry.cellHeight / 2 + placement.offsetY,
      width: d.width,
      height: d.height,
      rotation: placement.rotation,
      flipX: placement.flipX,
      flipY: placement.flipY,
      order,
    }
  })

  return { geometry, instances }
}
