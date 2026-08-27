import type { RepeatMode, SvgAsset } from '../types'

export type TileSetStrategy = 'sequential' | 'checker' | 'row-alternate' | 'column-alternate' | 'diagonal-cycle' | 'random' | 'custom'

export type TileSetConfig = {
  mode: Extract<RepeatMode, 'grid' | 'brick-row' | 'brick-column' | 'hex-row'>
  columns: number
  rows: number
  strategy: TileSetStrategy
  seed: number
  weights: number[]
  customMatrix: number[]
  background: string
}

export type TileSetResult = {
  svg: string
  width: number
  height: number
  columns: number
  rows: number
  matrix: number[]
  cellSize: number
}

const CELL = 1000
const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const mod = (value: number, size: number) => ((value % size) + size) % size
const nextEven = (value: number) => value % 2 === 0 ? value : value < 12 ? value + 1 : value - 1

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weightedPick(rand: () => number, weights: number[], count: number) {
  const safe = Array.from({ length: count }, (_, index) => Math.max(0.01, Number(weights[index]) || 1))
  const total = safe.reduce((sum, value) => sum + value, 0)
  let hit = rand() * total
  for (let index = 0; index < safe.length; index++) {
    hit -= safe[index]
    if (hit <= 0) return index
  }
  return Math.max(0, count - 1)
}

export function normalizeTileSetConfig(config: TileSetConfig, assetCount: number): TileSetConfig {
  let columns = Math.max(1, Math.min(12, Math.round(config.columns || 1)))
  let rows = Math.max(1, Math.min(12, Math.round(config.rows || 1)))
  if ((config.mode === 'brick-row' || config.mode === 'hex-row') && rows % 2 !== 0) rows = nextEven(rows)
  if (config.mode === 'brick-column' && columns % 2 !== 0) columns = nextEven(columns)
  const count = Math.max(1, assetCount)
  const customMatrix = Array.from({ length: columns * rows }, (_, index) => mod(Math.round(config.customMatrix[index] ?? index), count))
  const weights = Array.from({ length: count }, (_, index) => Math.max(0.01, Number(config.weights[index]) || 1))
  return { ...config, columns, rows, customMatrix, weights }
}

export function remapTileSetConfigAfterAssetRemoval(config: TileSetConfig, removedIndex: number, assetCountBefore: number): TileSetConfig {
  const oldCount = Math.max(0, Math.round(assetCountBefore))
  if (oldCount <= 1) return { ...config, weights: [], customMatrix: [] }

  const safeRemoved = Math.max(0, Math.min(oldCount - 1, Math.round(removedIndex)))
  const normalized = normalizeTileSetConfig(config, oldCount)
  const newCount = oldCount - 1
  const replacementIndex = Math.min(safeRemoved, newCount - 1)
  const remapIndex = (value: number) => {
    const oldIndex = mod(Math.round(value), oldCount)
    if (oldIndex === safeRemoved) return replacementIndex
    if (oldIndex > safeRemoved) return oldIndex - 1
    return oldIndex
  }

  return {
    ...config,
    columns: normalized.columns,
    rows: normalized.rows,
    customMatrix: normalized.customMatrix.map(remapIndex),
    weights: normalized.weights.filter((_, index) => index !== safeRemoved),
  }
}

export function tileSetMatrix(config: TileSetConfig, assetCount: number) {
  const normalized = normalizeTileSetConfig(config, assetCount)
  const n = Math.max(1, assetCount)
  const rand = mulberry32(normalized.seed || 1)
  return Array.from({ length: normalized.rows * normalized.columns }, (_, index) => {
    const row = Math.floor(index / normalized.columns)
    const col = index % normalized.columns
    if (normalized.strategy === 'checker') return n === 1 ? 0 : (row + col) % 2
    if (normalized.strategy === 'row-alternate') return mod(row, n)
    if (normalized.strategy === 'column-alternate') return mod(col, n)
    if (normalized.strategy === 'diagonal-cycle') return mod(row + col, n)
    if (normalized.strategy === 'random') return weightedPick(rand, normalized.weights, n)
    if (normalized.strategy === 'custom') return mod(normalized.customMatrix[index] ?? 0, n)
    return mod(index, n)
  })
}

function assetAt(matrix: number[], row: number, col: number, rows: number, columns: number) {
  return matrix[mod(row, rows) * columns + mod(col, columns)] ?? 0
}

function renderSquareAsset(asset: SvgAsset, x: number, y: number, clipId?: string) {
  const body = `<svg x="0" y="0" width="${CELL}" height="${CELL}" viewBox="${esc(asset.viewBox)}" preserveAspectRatio="xMidYMid slice">${asset.innerSvg}</svg>`
  return `<g transform="translate(${x} ${y})"${clipId ? ` clip-path="url(#${clipId})"` : ''}>${body}</g>`
}

export function buildTileSetSvg(assets: SvgAsset[], rawConfig: TileSetConfig): TileSetResult {
  const fallback = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000"></svg>'
  if (!assets.length) return { svg: fallback, width: CELL, height: CELL, columns: 1, rows: 1, matrix: [0], cellSize: CELL }

  const config = normalizeTileSetConfig(rawConfig, assets.length)
  const matrix = tileSetMatrix(config, assets.length)
  const isHex = config.mode === 'hex-row'
  const stepY = isHex ? CELL * 0.75 : CELL
  const width = config.columns * CELL
  const height = config.rows * stepY
  const pieces: string[] = []

  const rowStart = isHex ? -2 : config.mode === 'brick-column' ? -1 : 0
  const rowEnd = isHex ? config.rows + 2 : config.mode === 'brick-column' ? config.rows + 1 : config.rows - 1
  const colStart = config.mode === 'brick-row' || isHex ? -1 : 0
  const colEnd = config.mode === 'brick-row' || isHex ? config.columns + 1 : config.columns - 1

  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      let x = col * CELL
      let y = row * stepY
      if (config.mode === 'brick-row') x += mod(row, 2) * CELL * 0.5
      if (config.mode === 'brick-column') y += mod(col, 2) * CELL * 0.5
      if (isHex) x += mod(row, 2) * CELL * 0.5
      const index = assetAt(matrix, row, col, config.rows, config.columns)
      const asset = assets[index] ?? assets[0]
      pieces.push(renderSquareAsset(asset, x, y, isHex ? 'pf-tile-set-hex' : undefined))
    }
  }

  const background = config.background === 'transparent' ? '' : `<rect width="${width}" height="${height}" fill="${esc(config.background)}"/>`
  const defs = isHex ? `<clipPath id="pf-tile-set-hex"><polygon points="500,0 1000,250 1000,750 500,1000 0,750 0,250"/></clipPath>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="multi-tile-repeat" data-patternforge-layout="${config.mode}" data-patternforge-strategy="${config.strategy}"><defs>${defs}<clipPath id="pf-tile-set-master"><rect width="${width}" height="${height}"/></clipPath></defs>${background}<g clip-path="url(#pf-tile-set-master)">${pieces.join('')}</g></svg>`
  return { svg, width, height, columns: config.columns, rows: config.rows, matrix, cellSize: CELL }
}
