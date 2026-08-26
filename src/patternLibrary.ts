import type { CamoPatternData } from './engine/camouflage/types'

export type PatternSourceType = 'grid' | 'woven-template' | 'camouflage' | 'imported-svg' | 'imported-json'
export type PatternTarget = 'seamless' | 'guides' | 'woven' | 'pixel' | 'repeat' | 'camouflage'

export type GridPatternData = {
  width: number
  height: number
  cellsBase64: string
  palette: string[]
  transparentValue?: number
}

export type PatternAsset = {
  id: string
  name: string
  sourceType: PatternSourceType
  createdAt: string
  updatedAt: string
  svg?: string
  palette?: string[]
  grid?: GridPatternData
  camo?: CamoPatternData
  tags?: string[]
  meta?: Record<string, string | number | boolean>
}

type PendingPattern = {
  target: PatternTarget
  asset: PatternAsset
}

const LIBRARY_KEY = 'patternforge.my-patterns.v1'
const PENDING_KEY = 'patternforge.pending-pattern.v1'
const LIBRARY_EVENT = 'patternforge:library-changed'

function uid() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 18)
}

function nowIso() {
  return new Date().toISOString()
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function cloneCamo(camo?: CamoPatternData) {
  return camo ? JSON.parse(JSON.stringify(camo)) as CamoPatternData : undefined
}

function notifyLibrary() {
  window.dispatchEvent(new CustomEvent(LIBRARY_EVENT))
}

export function libraryEventName() {
  return LIBRARY_EVENT
}

export function loadPatternLibrary(): PatternAsset[] {
  if (typeof window === 'undefined') return []
  const items = safeParse<PatternAsset[]>(localStorage.getItem(LIBRARY_KEY), [])
  return Array.isArray(items) ? items : []
}

function writeLibrary(items: PatternAsset[]) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(items))
  notifyLibrary()
}

export function savePatternAsset(input: Omit<PatternAsset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): PatternAsset {
  const items = loadPatternLibrary()
  const existing = input.id ? items.find((item) => item.id === input.id) : undefined
  const stamp = nowIso()
  const asset: PatternAsset = {
    ...input,
    camo: cloneCamo(input.camo),
    id: input.id ?? uid(),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  }
  const next = existing ? items.map((item) => item.id === asset.id ? asset : item) : [asset, ...items]
  writeLibrary(next)
  return asset
}

export function deletePatternAsset(id: string) {
  writeLibrary(loadPatternLibrary().filter((item) => item.id !== id))
}

export function renamePatternAsset(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed) return
  const items = loadPatternLibrary().map((item) => item.id === id ? { ...item, name: trimmed, updatedAt: nowIso() } : item)
  writeLibrary(items)
}

export function duplicatePatternAsset(id: string) {
  const source = loadPatternLibrary().find((item) => item.id === id)
  if (!source) return null
  const copy: PatternAsset = {
    ...source,
    id: uid(),
    name: `${source.name} Copy`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    grid: source.grid ? { ...source.grid, palette: [...source.grid.palette] } : undefined,
    camo: cloneCamo(source.camo),
    palette: source.palette ? [...source.palette] : undefined,
    tags: source.tags ? [...source.tags] : undefined,
    meta: source.meta ? { ...source.meta } : undefined,
  }
  writeLibrary([copy, ...loadPatternLibrary()])
  return copy
}

export function encodeGridCells(cells: Uint8Array) {
  const chunk = 0x8000
  let binary = ''
  for (let offset = 0; offset < cells.length; offset += chunk) {
    binary += String.fromCharCode(...cells.subarray(offset, Math.min(cells.length, offset + chunk)))
  }
  return btoa(binary)
}

export function decodeGridCells(data: string, expectedLength: number) {
  try {
    const binary = atob(data)
    const cells = new Uint8Array(expectedLength)
    const limit = Math.min(binary.length, expectedLength)
    for (let index = 0; index < limit; index++) cells[index] = binary.charCodeAt(index)
    if (binary.length < expectedLength) cells.fill(255, binary.length)
    return cells
  } catch {
    return new Uint8Array(expectedLength).fill(255)
  }
}

function gridPaths(grid: GridPatternData) {
  const cells = decodeGridCells(grid.cellsBase64, grid.width * grid.height)
  const transparent = grid.transparentValue ?? 255
  const paths = new Map<number, string[]>()

  for (let y = 0; y < grid.height; y++) {
    let x = 0
    while (x < grid.width) {
      const value = cells[y * grid.width + x]
      const start = x
      while (x + 1 < grid.width && cells[y * grid.width + x + 1] === value) x++
      const length = x - start + 1
      if (value !== transparent && value < grid.palette.length) {
        const list = paths.get(value) ?? []
        list.push(`M${start} ${y}h${length}v1H${start}z`)
        paths.set(value, list)
      }
      x++
    }
  }

  return Array.from(paths.entries()).map(([index, parts]) => `<path fill="${grid.palette[index]}" d="${parts.join('')}"/>`).join('')
}

function gridSvgDocumentSize(asset: PatternAsset, grid: GridPatternData) {
  const configured = Number(asset.meta?.exportLongSide)
  if (!Number.isFinite(configured) || configured <= 0) return { width: grid.width, height: grid.height }
  const longSide = Math.max(64, Math.min(20000, Math.round(configured)))
  const logicalLongSide = Math.max(grid.width, grid.height) || 1
  const scale = longSide / logicalLongSide
  return {
    width: Math.max(1, Math.round(grid.width * scale)),
    height: Math.max(1, Math.round(grid.height * scale)),
  }
}

export function patternAssetToSvg(asset: PatternAsset) {
  if (asset.grid) {
    const { width, height } = asset.grid
    const documentSize = gridSvgDocumentSize(asset, asset.grid)
    const seamless = asset.meta?.cropped ? 'false' : 'true'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${documentSize.width}" height="${documentSize.height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" data-patternforge-exact-bounds="true" data-patternforge-seamless="${seamless}">${gridPaths(asset.grid)}</svg>`
  }
  if (asset.svg) return asset.svg
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="#20242b"/></svg>'
}

export function exportPatternAssetJson(asset: PatternAsset) {
  return JSON.stringify({ patternForge: 'pattern-asset', version: '1.3', asset }, null, 2)
}

export function parsePatternAssetJson(raw: string): PatternAsset {
  const parsed = JSON.parse(raw) as { patternForge?: string; asset?: PatternAsset } | PatternAsset
  const candidate = 'asset' in parsed && parsed.asset ? parsed.asset : parsed as PatternAsset
  if (!candidate || typeof candidate !== 'object' || !candidate.name || !candidate.sourceType) throw new Error('Not a valid PatternForge pattern asset JSON.')
  const stamp = nowIso()
  return {
    ...candidate,
    id: uid(),
    createdAt: stamp,
    updatedAt: stamp,
    palette: candidate.palette ? [...candidate.palette] : undefined,
    grid: candidate.grid ? { ...candidate.grid, palette: [...candidate.grid.palette] } : undefined,
    camo: cloneCamo(candidate.camo),
  }
}

export function importPatternAssetJson(raw: string) {
  const asset = parsePatternAssetJson(raw)
  return savePatternAsset(asset)
}

export function setPendingPattern(target: PatternTarget, asset: PatternAsset) {
  const pending: PendingPattern = { target, asset }
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
}

export function peekPendingPattern(target?: PatternTarget) {
  const pending = safeParse<PendingPattern | null>(localStorage.getItem(PENDING_KEY), null)
  if (!pending) return null
  if (target && pending.target !== target) return null
  return pending
}

export function consumePendingPattern(target: PatternTarget) {
  const pending = peekPendingPattern(target)
  if (!pending) return null
  localStorage.removeItem(PENDING_KEY)
  return pending.asset
}
