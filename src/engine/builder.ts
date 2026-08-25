import { patternGeometry } from './pattern'
import type { BuilderTileSettings, MirrorAxis, MirrorConfig, PatternGeometry, PatternInstance, PatternSettings, SvgAsset, TileCellPlacement } from '../types'

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
  availableWidth: number,
  availableHeight: number,
  placementScale: number,
  customTile = false,
) {
  const safeWidth = Math.max(1, availableWidth - s.paddingX * 2)
  const safeHeight = Math.max(1, availableHeight - s.paddingY * 2)
  const autoSize = Math.max(8, Math.min(safeWidth, safeHeight) * 0.96)
  const base = dims(asset, customTile ? autoSize : s.motifSize)
  const fit = Math.min(1, safeWidth / base.width, safeHeight / base.height)
  const manual = Math.max(0.05, placementScale / 100)
  return {
    width: base.width * fit * manual,
    height: base.height * fit * manual,
  }
}

export function cellKey(row: number, col: number) {
  return `cell-${row}-${col}`
}

export function isFreePlacement(item: TileCellPlacement) {
  return item.positionMode === 'free'
}

export function spanCols(item: TileCellPlacement) {
  return Math.max(1, Math.round(item.spanCols ?? 1))
}

export function spanRows(item: TileCellPlacement) {
  return Math.max(1, Math.round(item.spanRows ?? 1))
}

export function placementCoversCell(item: TileCellPlacement, row: number, col: number) {
  if (isFreePlacement(item)) return false
  return row >= item.row &&
    row < item.row + spanRows(item) &&
    col >= item.col &&
    col < item.col + spanCols(item)
}

export function findPlacementCoveringCell(placements: TileCellPlacement[], row: number, col: number) {
  return placements.find((item) => placementCoversCell(item, row, col)) ?? null
}

export function spanFitsGrid(row: number, col: number, cols: number, rows: number, g: PatternGeometry) {
  return row >= 0 && col >= 0 && row + rows <= g.rows && col + cols <= g.columns
}

function placementsOverlap(a: TileCellPlacement, b: TileCellPlacement) {
  if (isFreePlacement(a) || isFreePlacement(b)) return false
  const aRight = a.col + spanCols(a)
  const aBottom = a.row + spanRows(a)
  const bRight = b.col + spanCols(b)
  const bBottom = b.row + spanRows(b)
  return a.col < bRight && aRight > b.col && a.row < bBottom && aBottom > b.row
}

export function canUseSpan(
  placements: TileCellPlacement[],
  targetKey: string,
  row: number,
  col: number,
  cols: number,
  rows: number,
  g: PatternGeometry,
) {
  if (!spanFitsGrid(row, col, cols, rows, g)) return false
  const candidate: TileCellPlacement = {
    key: targetKey,
    row,
    col,
    assetId: '',
    rotation: 0,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    flipX: false,
    flipY: false,
    spanCols: cols,
    spanRows: rows,
    positionMode: 'grid',
  }
  return !placements.some((item) => item.key !== targetKey && placementsOverlap(candidate, item))
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
    spanCols: 1,
    spanRows: 1,
    positionMode: 'grid',
  }
}

export function createFreePlacement(
  source: PatternInstance,
  assetId: string,
  key = `free-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
): TileCellPlacement {
  return {
    key,
    row: 0,
    col: 0,
    assetId,
    rotation: source.rotation,
    scale: 100,
    offsetX: 0,
    offsetY: 0,
    flipX: !!source.flipX,
    flipY: !!source.flipY,
    spanCols: 1,
    spanRows: 1,
    positionMode: 'free',
    freeX: source.x,
    freeY: source.y,
    freeWidth: source.width,
    freeHeight: source.height,
  }
}

export function normalizePlacements(placements: TileCellPlacement[], g: PatternGeometry, assets: SvgAsset[]) {
  const validAssets = new Set(assets.map((asset) => asset.id))
  const accepted: TileCellPlacement[] = []

  for (const raw of placements) {
    const item: TileCellPlacement = {
      ...raw,
      positionMode: raw.positionMode ?? 'grid',
      spanCols: spanCols(raw),
      spanRows: spanRows(raw),
    }
    if (!validAssets.has(item.assetId)) continue

    if (isFreePlacement(item)) {
      if (!Number.isFinite(item.freeX) || !Number.isFinite(item.freeY)) continue
      accepted.push(item)
      continue
    }

    if (!spanFitsGrid(item.row, item.col, spanCols(item), spanRows(item), g)) continue
    if (accepted.some((other) => placementsOverlap(item, other))) continue
    accepted.push(item)
  }

  return accepted
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
    const cellWidth = Math.max(8, (tileWidth - (columns - 1) * s.hSpacing) / columns)
    const cellHeight = Math.max(8, (tileHeight - (rows - 1) * s.vSpacing) / rows)
    const stepX = Math.max(4, cellWidth + s.hSpacing)
    const stepY = Math.max(4, cellHeight + s.vSpacing)
    return { cellWidth, cellHeight, stepX, stepY, tileWidth, tileHeight, rows, columns, originX: 0, originY: 0 }
  }

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

export function blockBounds(item: TileCellPlacement, g: PatternGeometry) {
  if (isFreePlacement(item)) {
    const scale = Math.max(0.05, item.scale / 100)
    const width = Math.max(1, (item.freeWidth ?? g.cellWidth) * scale)
    const height = Math.max(1, (item.freeHeight ?? g.cellHeight) * scale)
    const cx = (item.freeX ?? g.tileWidth / 2) + item.offsetX
    const cy = (item.freeY ?? g.tileHeight / 2) + item.offsetY
    return { x: cx - width / 2, y: cy - height / 2, width, height }
  }

  const cols = spanCols(item)
  const rows = spanRows(item)
  const originX = g.originX ?? 0
  const originY = g.originY ?? 0
  const x = originX + item.col * g.stepX
  const y = originY + item.row * g.stepY
  const width = g.cellWidth + Math.max(0, cols - 1) * g.stepX
  const height = g.cellHeight + Math.max(0, rows - 1) * g.stepY
  return { x, y, width, height }
}

function makeMirror(item: PatternInstance, axis: MirrorAxis, g: PatternGeometry): PatternInstance {
  if (axis === 'x') {
    return {
      ...item,
      key: `${item.key}::mirror-x`,
      sourceKey: item.key,
      virtualMirror: 'x',
      x: g.tileWidth - item.x,
      rotation: -item.rotation,
      flipX: !item.flipX,
      order: (item.order ?? 0) + 0.1,
    }
  }
  if (axis === 'y') {
    return {
      ...item,
      key: `${item.key}::mirror-y`,
      sourceKey: item.key,
      virtualMirror: 'y',
      y: g.tileHeight - item.y,
      rotation: -item.rotation,
      flipY: !item.flipY,
      order: (item.order ?? 0) + 0.2,
    }
  }
  return {
    ...item,
    key: `${item.key}::mirror-xy`,
    sourceKey: item.key,
    virtualMirror: 'xy',
    x: g.tileWidth - item.x,
    y: g.tileHeight - item.y,
    flipX: !item.flipX,
    flipY: !item.flipY,
    order: (item.order ?? 0) + 0.3,
  }
}

export function mirrorAxes(config?: MirrorConfig): MirrorAxis[] {
  if (!config?.enabled) return []
  const axes: MirrorAxis[] = []
  if (config.axisX) axes.push('x')
  if (config.axisY) axes.push('y')
  if (config.axisX && config.axisY) axes.push('xy')
  return axes
}

export function mirrorLabel(config?: MirrorConfig) {
  if (!config?.enabled) return 'None'
  if (config.axisX && config.axisY) return 'MXY'
  if (config.axisX) return 'MX'
  if (config.axisY) return 'MY'
  return 'None'
}

export function expandMirrors(item: PatternInstance, config: MirrorConfig | undefined, g: PatternGeometry) {
  const clones = mirrorAxes(config).map((axis) => makeMirror(item, axis, g))
  return [item, ...clones]
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

  const baseInstances: PatternInstance[] = clean.map((placement, order) => {
    const assetIndex = assetIndexById.get(placement.assetId) ?? 0
    const asset = assets[assetIndex]

    if (isFreePlacement(placement)) {
      const manual = Math.max(0.05, placement.scale / 100)
      const fallback = dims(asset, customTile ? Math.min(geometry.cellWidth, geometry.cellHeight) * 0.96 : s.motifSize)
      const width = Math.max(1, (placement.freeWidth ?? fallback.width) * manual)
      const height = Math.max(1, (placement.freeHeight ?? fallback.height) * manual)
      return {
        key: placement.key,
        assetIndex,
        x: (placement.freeX ?? geometry.tileWidth / 2) + placement.offsetX,
        y: (placement.freeY ?? geometry.tileHeight / 2) + placement.offsetY,
        width,
        height,
        rotation: placement.rotation,
        flipX: placement.flipX,
        flipY: placement.flipY,
        order,
        freeform: true,
      }
    }

    const bounds = blockBounds(placement, geometry)
    const d = fittedDims(asset, s, bounds.width, bounds.height, placement.scale, customTile)
    return {
      key: placement.key,
      assetIndex,
      x: bounds.x + bounds.width / 2 + placement.offsetX,
      y: bounds.y + bounds.height / 2 + placement.offsetY,
      width: d.width,
      height: d.height,
      rotation: placement.rotation,
      flipX: placement.flipX,
      flipY: placement.flipY,
      order,
    }
  })

  const placementByKey = new Map(clean.map((item) => [item.key, item]))
  const instances = baseInstances.flatMap((instance) => expandMirrors(instance, placementByKey.get(instance.key)?.mirror, geometry))

  return { geometry, instances }
}
