import { parseSvgAsset } from './svg'
import type { SvgAsset, TileCellPlacement } from '../types'

const MAX_PROJECT_ASSETS = 128
const MAX_PROJECT_PLACEMENTS = 10000
const MAX_INNER_SVG_LENGTH = 8_000_000

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function safeNumber(value: unknown, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function safeViewBox(raw: Record<string, unknown>) {
  if (typeof raw.viewBox === 'string') {
    const parts = raw.viewBox.trim().split(/[ ,]+/).map(Number)
    if (parts.length === 4 && parts.every(Number.isFinite) && Math.abs(parts[2]) > 0 && Math.abs(parts[3]) > 0) return parts.join(' ')
  }
  const width = Math.max(1, Math.abs(safeNumber(raw.viewWidth, 100)))
  const height = Math.max(1, Math.abs(safeNumber(raw.viewHeight, 100)))
  return `0 0 ${width} ${height}`
}

function safeName(raw: Record<string, unknown>, index: number) {
  const value = typeof raw.name === 'string' ? raw.name.trim() : ''
  return (value || `Embedded SVG ${index + 1}`).slice(0, 180)
}

function safePlacementKey(raw: Record<string, unknown>, index: number) {
  const key = typeof raw.key === 'string' ? raw.key : ''
  if (/^(?:cell-\d+-\d+|free-[a-z0-9_-]+)$/i.test(key)) return key
  if (raw.positionMode === 'free') return `free-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
  const row = Math.max(0, Math.round(safeNumber(raw.row, 0)))
  const col = Math.max(0, Math.round(safeNumber(raw.col, 0)))
  return `cell-${row}-${col}-${index}`
}

export async function sanitizeEmbeddedComposerData(rawAssets: unknown[], rawPlacements: unknown[]) {
  if (rawAssets.length > MAX_PROJECT_ASSETS) throw new Error(`Composer project contains too many SVG assets (${rawAssets.length}). Maximum is ${MAX_PROJECT_ASSETS}.`)
  if (rawPlacements.length > MAX_PROJECT_PLACEMENTS) throw new Error(`Composer project contains too many placements (${rawPlacements.length}). Maximum is ${MAX_PROJECT_PLACEMENTS}.`)

  const assets: SvgAsset[] = []
  const idMap = new Map<string, string>()
  const seenOldIds = new Set<string>()

  for (let index = 0; index < rawAssets.length; index++) {
    const raw = record(rawAssets[index])
    if (!raw) throw new Error(`Embedded SVG asset ${index + 1} is invalid.`)
    const innerSvg = typeof raw.innerSvg === 'string' ? raw.innerSvg : ''
    if (!innerSvg.trim()) throw new Error(`Embedded SVG asset ${index + 1} has no vector content.`)
    if (innerSvg.length > MAX_INNER_SVG_LENGTH) throw new Error(`Embedded SVG asset ${index + 1} is too large to import safely.`)

    const oldId = typeof raw.id === 'string' && raw.id.trim() ? raw.id : `asset-${index}`
    if (seenOldIds.has(oldId)) throw new Error(`Composer project contains duplicate SVG asset id “${oldId}”.`)
    seenOldIds.add(oldId)

    const newId = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    const viewBox = safeViewBox(raw)
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" data-patternforge-exact-bounds="true">${innerSvg}</svg>`
    const sanitized = await parseSvgAsset(source, safeName(raw, index), newId)
    assets.push(sanitized)
    idMap.set(oldId, newId)
  }

  if (!assets.length) throw new Error('Composer project contains no usable SVG assets.')

  const placements: TileCellPlacement[] = []
  for (let index = 0; index < rawPlacements.length; index++) {
    const raw = record(rawPlacements[index])
    if (!raw) continue
    const oldAssetId = typeof raw.assetId === 'string' ? raw.assetId : ''
    const assetId = idMap.get(oldAssetId)
    if (!assetId) continue
    placements.push({
      ...(raw as unknown as TileCellPlacement),
      key: safePlacementKey(raw, index),
      assetId,
    })
  }

  return { assets, placements }
}
