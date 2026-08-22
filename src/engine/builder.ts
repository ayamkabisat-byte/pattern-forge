import { patternGeometry } from './pattern'
import type { PatternGeometry, PatternInstance, PatternSettings, SvgAsset, TileCellPlacement } from '../types'

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

function fittedDims(asset: SvgAsset, s: PatternSettings, g: PatternGeometry, placementScale: number) {
  const base = dims(asset, s.motifSize)
  const availableWidth = Math.max(1, g.cellWidth - s.paddingX * 2)
  const availableHeight = Math.max(1, g.cellHeight - s.paddingY * 2)
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

export function generateBuilderPattern(
  placements: TileCellPlacement[],
  assets: SvgAsset[],
  s: PatternSettings,
): { geometry: PatternGeometry; instances: PatternInstance[] } {
  const geometry = patternGeometry('grid', assets, { ...s, snapTileToGrid: true })
  const assetIndexById = new Map(assets.map((asset, index) => [asset.id, index]))
  const clean = normalizePlacements(placements, geometry, assets)

  const instances: PatternInstance[] = clean.map((placement, order) => {
    const assetIndex = assetIndexById.get(placement.assetId) ?? 0
    const asset = assets[assetIndex]
    const d = fittedDims(asset, s, geometry, placement.scale)
    const cellX = placement.col * geometry.stepX
    const cellY = placement.row * geometry.stepY
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
