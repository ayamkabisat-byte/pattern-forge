import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSvg, generatePattern, patternGeometry } from '../engine/pattern'
import { buildTileSetSvg, normalizeTileSetConfig, remapTileSetConfigAfterAssetRemoval, type TileSetConfig, type TileSetStrategy } from '../engine/repeatTileSet'
import { buildRepeatProofSvg } from '../engine/proofExport'
import { parseSvgAsset } from '../engine/svg'
import { SPACING_PRESETS } from '../exportPresets'
import { consumePendingPattern, patternAssetToSvg, savePatternAsset } from '../patternLibrary'
import type { BrickOffset, PatternSettings, RepeatMode, SvgAsset } from '../types'

type Props = { onOpenLibrary: () => void; onOpenPixel: () => void }
type ModeMeta = { id: Extract<RepeatMode, 'grid' | 'brick-row' | 'brick-column' | 'hex-row'>; label: string; note: string }
type SourceMode = 'single' | 'set'

const MODES: ModeMeta[] = [
  { id: 'grid', label: 'Grid', note: 'Straight exact repeat.' },
  { id: 'brick-row', label: 'Brick / Half Drop', note: 'Offset every second row.' },
  { id: 'brick-column', label: 'Brick Column', note: 'Offset every second column.' },
  { id: 'hex-row', label: 'Hex Row', note: 'Compact honeycomb / hex mosaic repeat.' },
]

const STRATEGIES: Array<{ id: TileSetStrategy; label: string }> = [
  { id: 'sequential', label: 'Sequential' },
  { id: 'checker', label: 'Checker' },
  { id: 'row-alternate', label: 'Row Alternate' },
  { id: 'column-alternate', label: 'Column Alternate' },
  { id: 'diagonal-cycle', label: 'Diagonal Cycle' },
  { id: 'random', label: 'Weighted Random' },
  { id: 'custom', label: 'Custom Matrix' },
]

const EXPORT_PRESETS = [1024, 2048, 4096, 6000, 8000]
const INITIAL: PatternSettings = {
  tileWidth: 1600,
  tileHeight: 1600,
  background: 'transparent',
  motifSize: 180,
  repeatWidth: 180,
  repeatHeight: 180,
  sizeTileToArt: true,
  hSpacing: 0,
  vSpacing: 0,
  paddingX: 0,
  paddingY: 0,
  alignX: 'center',
  alignY: 'middle',
  columns: 6,
  rows: 6,
  snapTileToGrid: true,
  brickOffset: '1/2',
  overlapX: 'right',
  overlapY: 'bottom',
  rotation: 0,
  randomRotation: 32,
  density: 52,
  seed: 1287,
  copies: 3,
  dimCopies: false,
  dimCopiesPercent: 55,
  showBoundary: false,
  showSwatchBounds: false,
}

const INITIAL_SET: TileSetConfig = {
  mode: 'grid',
  columns: 3,
  rows: 3,
  strategy: 'diagonal-cycle',
  seed: 1287,
  weights: [],
  customMatrix: [],
  background: 'transparent',
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repeat-pattern'
const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function scaledDimensions(width: number, height: number, longSide: number) {
  const scale = Math.max(256, Math.min(20000, longSide)) / (Math.max(width, height) || 1)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function scaleSvgDocument(svg: string, logicalWidth: number, logicalHeight: number, longSide: number) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const dims = scaledDimensions(logicalWidth, logicalHeight, longSide)
  root.setAttribute('width', String(dims.width))
  root.setAttribute('height', String(dims.height))
  root.setAttribute('data-patternforge-exact-bounds', 'true')
  root.setAttribute('data-patternforge-seamless', 'true')
  return new XMLSerializer().serializeToString(root)
}

function looksLikePatternForgeMaster(svg: string) {
  return /data-patternforge-seamless=["']true["']/i.test(svg) || /shape-rendering=["']crispEdges["']/i.test(svg)
}

function forceExactBounds(svg: string) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return svg
  root.setAttribute('data-patternforge-exact-bounds', 'true')
  return new XMLSerializer().serializeToString(root)
}

export default function RepeatLayoutWorkspace({ onOpenLibrary, onOpenPixel }: Props) {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>('single')
  const [mode, setMode] = useState<ModeMeta['id']>('grid')
  const [settings, setSettings] = useState<PatternSettings>(INITIAL)
  const [tileSet, setTileSet] = useState<TileSetConfig>(INITIAL_SET)
  const [activeMatrixAsset, setActiveMatrixAsset] = useState(0)
  const [view, setView] = useState<'tile' | 'proof'>('proof')
  const [proofCopies, setProofCopies] = useState(3)
  const [exportLongSide, setExportLongSide] = useState(4096)
  const [patternName, setPatternName] = useState('Repeat Pattern 01')
  const [solidBackground, setSolidBackground] = useState('#FFFFFF')
  const [message, setMessage] = useState('Single Tile repeats one SVG. Tile Set creates a seamless super-tile from several complete square SVG patterns.')
  const inputRef = useRef<HTMLInputElement>(null)

  const activeAsset = assets.find((asset) => asset.id === activeAssetId) ?? assets[0]
  const singleAssets = activeAsset ? [activeAsset] : []
  const geometry = useMemo(() => patternGeometry(mode, singleAssets, settings), [mode, singleAssets, settings])
  const instances = useMemo(() => generatePattern(mode, singleAssets, settings), [mode, singleAssets, settings])
  const singleTileSvg = useMemo(() => buildSvg(mode, singleAssets, instances, settings), [mode, singleAssets, instances, settings])
  const normalizedSet = useMemo(() => normalizeTileSetConfig({ ...tileSet, mode }, assets.length), [tileSet, mode, assets.length])
  const tileSetResult = useMemo(() => buildTileSetSvg(assets, { ...normalizedSet, mode }), [assets, normalizedSet, mode])

  const tileSvg = sourceMode === 'single' ? singleTileSvg : tileSetResult.svg
  const logicalWidth = sourceMode === 'single' ? geometry.tileWidth : tileSetResult.width
  const logicalHeight = sourceMode === 'single' ? geometry.tileHeight : tileSetResult.height
  const proofSvg = useMemo(() => buildRepeatProofSvg(tileSvg, logicalWidth, logicalHeight, proofCopies), [tileSvg, logicalWidth, logicalHeight, proofCopies])
  const previewSvg = view === 'tile' ? tileSvg : proofSvg

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const patchSet = <K extends keyof TileSetConfig>(key: K, value: TileSetConfig[K]) => setTileSet((current) => ({ ...current, [key]: value }))

  function applyExactTile() {
    setSettings((current) => ({ ...current, hSpacing: 0, vSpacing: 0, paddingX: 0, paddingY: 0, sizeTileToArt: true, snapTileToGrid: true }))
    setMessage('Exact Tile applied: zero padding and zero gap around the single source tile.')
  }

  function applySpacingPreset(id: string) {
    const preset = SPACING_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings((current) => ({ ...current, hSpacing: preset.h, vSpacing: preset.v, paddingX: preset.px, paddingY: preset.py }))
    setMessage(id === 'interlock' ? 'Interlock overlaps neighboring motifs. It is a layout style, not a seamless requirement.' : `${preset.label} spacing applied.`)
  }

  async function parseOne(svg: string, name: string, exact: boolean) {
    return parseSvgAsset(exact ? forceExactBounds(svg) : svg, name, crypto.randomUUID().replaceAll('-', '').slice(0, 12))
  }

  async function loadSvg(svg: string, name: string, exactMaster = false) {
    const asset = await parseOne(svg, name, exactMaster || looksLikePatternForgeMaster(svg))
    setAssets([asset])
    setActiveAssetId(asset.id)
    setSourceMode('single')
    setPatternName(name.replace(/\.svg$/i, '').replace(/[-_]+/g, ' ').trim() || 'Repeat Pattern 01')
    if (exactMaster || looksLikePatternForgeMaster(svg)) applyExactTile()
    setMessage(`${name} loaded as the single repeat source.`)
  }

  async function addFiles(files: FileList | null) {
    const incoming = Array.from(files ?? []).filter((entry) => entry.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) return
    const tileSetImport = sourceMode === 'set' || incoming.length > 1
    const next: SvgAsset[] = []
    for (const file of incoming) {
      try {
        const raw = await file.text()
        next.push(await parseOne(raw, file.name, tileSetImport || looksLikePatternForgeMaster(raw)))
      } catch (error) { setMessage(error instanceof Error ? error.message : `Could not load ${file.name}.`) }
    }
    if (!next.length) return
    setAssets((current) => [...current, ...next])
    setActiveAssetId((current) => current ?? next[0].id)
    if (incoming.length > 1) {
      setSourceMode('set')
      setPatternName('Multi Tile Set 01')
      setMessage(`${next.length} complete SVG tiles loaded. Exact source viewBoxes are preserved for super-tile composition.`)
    } else setMessage(`${next[0].name} added.`)
  }

  function removeAsset(id: string) {
    const index = assets.findIndex((asset) => asset.id === id)
    if (index < 0) return
    const oldCount = assets.length
    const nextCount = Math.max(0, oldCount - 1)
    const fallbackActiveId = assets.find((asset) => asset.id !== id)?.id ?? null
    setTileSet((current) => remapTileSetConfigAfterAssetRemoval({ ...current, mode }, index, oldCount))
    setAssets((items) => items.filter((asset) => asset.id !== id))
    if (activeAssetId === id) setActiveAssetId(fallbackActiveId)
    setActiveMatrixAsset((current) => {
      if (!nextCount) return 0
      if (current === index) return Math.min(index, nextCount - 1)
      if (current > index) return current - 1
      return Math.min(current, nextCount - 1)
    })
    setMessage(nextCount ? `Removed source tile. Existing Custom Matrix cells were remapped by tile identity; ${nextCount} source tile${nextCount === 1 ? '' : 's'} remain.` : 'All source tiles removed.')
  }

  useEffect(() => {
    const pending = consumePendingPattern('repeat')
    if (!pending) return
    const svg = patternAssetToSvg(pending)
    void loadSvg(svg, pending.name, Boolean(pending.grid && !pending.meta?.cropped))
  }, [])

  function setBackgroundTransparent(transparent: boolean) {
    if (sourceMode === 'single') patch('background', transparent ? 'transparent' : solidBackground)
    else patchSet('background', transparent ? 'transparent' : solidBackground)
  }

  function patchWeight(index: number, value: number) {
    const next = [...normalizedSet.weights]
    next[index] = Math.max(0.01, value || 1)
    patchSet('weights', next)
  }

  function paintMatrix(index: number) {
    const next = [...normalizedSet.customMatrix]
    next[index] = Math.max(0, Math.min(Math.max(0, assets.length - 1), activeMatrixAsset))
    setTileSet((current) => ({ ...current, customMatrix: next, strategy: 'custom' }))
  }

  function exportSvg() {
    if (!assets.length) { setMessage('Add SVG source tiles first.'); return }
    const svg = scaleSvgDocument(tileSvg, logicalWidth, logicalHeight, exportLongSide)
    const dims = scaledDimensions(logicalWidth, logicalHeight, exportLongSide)
    downloadText(svg, `${slug(patternName)}-${sourceMode === 'set' ? 'multi-tile-' : ''}${mode}-${dims.width}x${dims.height}-seamless.svg`, 'image/svg+xml;charset=utf-8')
    setMessage(`Seamless SVG exported at ${dims.width}×${dims.height}.`)
  }

  function saveToLibrary() {
    if (!assets.length) { setMessage('Add SVG source tiles first.'); return }
    const svg = scaleSvgDocument(tileSvg, logicalWidth, logicalHeight, exportLongSide)
    const dims = scaledDimensions(logicalWidth, logicalHeight, exportLongSide)
    savePatternAsset({
      name: patternName.trim() || 'Repeat Pattern',
      sourceType: 'imported-svg',
      svg,
      tags: sourceMode === 'set' ? ['repeat-layout','multi-tile',mode,normalizedSet.strategy,'seamless'] : ['repeat-layout',mode,'seamless'],
      meta: { width: dims.width, height: dims.height, repeatMode: mode, exactBounds: true, multiTile: sourceMode === 'set', tileCount: assets.length, tileSetStrategy: sourceMode === 'set' ? normalizedSet.strategy : '' },
    })
    setMessage(`${patternName || 'Repeat Pattern'} saved to My Patterns as a reusable seamless SVG.`)
  }

  function exportTileSetJson() {
    const payload = { patternForge: 'multi-tile-repeat', version: 1, name: patternName, assets, config: normalizedSet, exportLongSide }
    downloadText(JSON.stringify(payload, null, 2), `${slug(patternName)}.tileset.json`, 'application/json;charset=utf-8')
  }

  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0]
  const backgroundValue = sourceMode === 'single' ? settings.background : normalizedSet.background
  const matrix = normalizedSet.strategy === 'custom' ? normalizedSet.customMatrix : tileSetResult.matrix

  return <div className="v10-builder-shell v115-repeat-shell">
    <aside className="v10-panel v10-panel-left">
      <section><h2>Source Mode</h2><div className="v19-repeat-source-switch"><button className={sourceMode === 'single' ? 'active' : ''} onClick={() => setSourceMode('single')}>Single Tile</button><button className={sourceMode === 'set' ? 'active' : ''} onClick={() => setSourceMode('set')}>Tile Set</button></div><button className="v10-drop v115-repeat-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files) }}><b>{sourceMode === 'set' ? 'Drop multiple square SVG patterns' : activeAsset?.name ?? 'Drop SVG or choose file'}</b><span>{sourceMode === 'set' ? 'Each SVG remains a complete tile and becomes one cell of the seamless super-tile.' : 'Use one motif or one complete master tile.'}</span></button><input ref={inputRef} hidden multiple type="file" accept=".svg,image/svg+xml" onChange={(event) => void addFiles(event.target.files)}/><div className="v115-repeat-shortcuts"><button onClick={onOpenLibrary}>My Patterns</button><button onClick={onOpenPixel}>Pixel Pattern</button></div><div className="v19-tile-set">{assets.map((asset, index) => <div key={asset.id}><b>{String.fromCharCode(65 + (index % 26))}</b><span>{asset.name}</span>{sourceMode === 'set' ? <input aria-label={`${asset.name} weight`} title="Random weight" type="number" min="0.01" max="100" step="0.25" value={normalizedSet.weights[index] ?? 1} onChange={(e) => patchWeight(index, Number(e.target.value))}/> : <button className={activeAsset?.id === asset.id ? 'active' : ''} onClick={() => setActiveAssetId(asset.id)}>Use</button>}<button className="v09-danger" onClick={() => removeAsset(asset.id)}>×</button></div>)}</div></section>
      <section><h2>Repeat Layout</h2><div className="v115-repeat-modes">{MODES.map((item) => <button key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => { setMode(item.id); setTileSet((current) => ({ ...current, mode: item.id })) }}><b>{item.label}</b><span>{sourceMode === 'set' && item.id === 'hex-row' ? 'Hex-clipped mosaic from complete source tiles.' : item.note}</span></button>)}</div></section>
      {sourceMode === 'single' ? <section className="v115-exact-section"><h2>Seam Control</h2><button className="v10-primary-action" onClick={applyExactTile}>Exact Tile · Recommended for Master SVG</button><div className="v115-spacing-presets">{SPACING_PRESETS.map((preset) => <button key={preset.id} className={preset.id === 'exact' ? 'active' : ''} onClick={() => applySpacingPreset(preset.id)}>{preset.label}</button>)}</div><small>Exact Tile = zero padding and gap. Interlock is only an overlap style.</small></section> : <section><h2>Tile Distribution</h2><div className="v19-tile-strategy">{STRATEGIES.map((strategy) => <button key={strategy.id} className={normalizedSet.strategy === strategy.id ? 'active' : ''} onClick={() => patchSet('strategy', strategy.id)}>{strategy.label}</button>)}</div>{normalizedSet.strategy === 'random' ? <label><span>Seed</span><input type="number" value={normalizedSet.seed} onChange={(e) => patchSet('seed', Number(e.target.value) || 1)}/></label> : null}</section>}
    </aside>

    <main className="v10-center-stage">
      <div className="v10-stage-head"><div><b>{sourceMode === 'set' ? `Multi-Tile · ${activeMode.label}` : activeMode.label}</b><span>{sourceMode === 'set' ? `${normalizedSet.columns}×${normalizedSet.rows} super-tile · ${assets.length} source patterns · ${normalizedSet.strategy.replaceAll('-', ' ')}` : `${activeMode.note} · tile ${Math.round(geometry.tileWidth)}×${Math.round(geometry.tileHeight)}`}</span></div><div className="v10-view-buttons"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button></div></div>
      <div className="v10-preview-zone v115-repeat-preview">{assets.length ? <img src={svgDataUri(previewSvg)} alt="Repeat pattern preview"/> : <div className="v10-empty-state"><b>Add SVG pattern tiles</b><p>Use Single Tile for a traditional repeat, or Tile Set to combine several complete square SVG patterns into one seamless super-tile.</p></div>}</div>
      <div className="v10-stage-status"><span>{message}</span><b>{sourceMode === 'set' ? 'MULTI-TILE SUPER-TILE ENGINE' : 'EXACT BOUNDS REPEAT ENGINE'}</b></div>
    </main>

    <aside className="v10-panel v10-panel-right">
      {sourceMode === 'single' ? <section><h2>Layout Geometry</h2><label><span>Motif size</span><input type="range" min="16" max="800" value={settings.motifSize} onChange={(event) => patch('motifSize', Number(event.target.value))}/><output>{settings.motifSize}</output></label><div className="v10-two"><label><span>Columns</span><input type="number" min="1" max="30" value={settings.columns} onChange={(event) => patch('columns', Number(event.target.value))}/></label><label><span>Rows</span><input type="number" min="1" max="30" value={settings.rows} onChange={(event) => patch('rows', Number(event.target.value))}/></label></div><label><span>Horizontal gap</span><input type="range" min="-200" max="300" value={settings.hSpacing} onChange={(event) => patch('hSpacing', Number(event.target.value))}/><output>{settings.hSpacing}</output></label><label><span>Vertical gap</span><input type="range" min="-200" max="300" value={settings.vSpacing} onChange={(event) => patch('vSpacing', Number(event.target.value))}/><output>{settings.vSpacing}</output></label><div className="v10-two"><label><span>Padding X</span><input type="number" min="0" max="200" value={settings.paddingX} onChange={(event) => patch('paddingX', Number(event.target.value))}/></label><label><span>Padding Y</span><input type="number" min="0" max="200" value={settings.paddingY} onChange={(event) => patch('paddingY', Number(event.target.value))}/></label></div>{(mode === 'brick-row' || mode === 'brick-column') ? <label><span>Brick offset</span><select value={settings.brickOffset} onChange={(event) => patch('brickOffset', event.target.value as BrickOffset)}><option value="1/4">1/4</option><option value="1/3">1/3</option><option value="1/2">1/2</option><option value="2/3">2/3</option><option value="3/4">3/4</option></select></label> : null}</section> : <section><h2>Super-Tile Matrix</h2><div className="v10-two"><label><span>Columns</span><input type="number" min="1" max="12" value={normalizedSet.columns} onChange={(e) => patchSet('columns', Math.max(1, Math.min(12, Number(e.target.value) || 1)))}/></label><label><span>Rows</span><input type="number" min="1" max="12" value={normalizedSet.rows} onChange={(e) => patchSet('rows', Math.max(1, Math.min(12, Number(e.target.value) || 1)))}/></label></div><small>{mode === 'hex-row' ? 'Hex Row automatically uses an even row cycle so the top and bottom boundaries return to the same stagger phase.' : 'The whole matrix becomes one exact seamless master tile.'}</small>{normalizedSet.strategy === 'custom' ? <><label><span>Paint matrix with</span><select value={activeMatrixAsset} onChange={(e) => setActiveMatrixAsset(Number(e.target.value))}>{assets.map((asset, index) => <option key={asset.id} value={index}>{String.fromCharCode(65 + (index % 26))} · {asset.name}</option>)}</select></label><div className="v19-matrix" style={{ gridTemplateColumns: `repeat(${normalizedSet.columns},minmax(0,1fr))` }}>{matrix.map((assetIndex, index) => <button key={index} className={assetIndex === activeMatrixAsset ? 'active' : ''} onClick={() => paintMatrix(index)}>{String.fromCharCode(65 + (assetIndex % 26))}</button>)}</div></> : <div className="v19-matrix" style={{ gridTemplateColumns: `repeat(${normalizedSet.columns},minmax(0,1fr))` }}>{matrix.map((assetIndex, index) => <button key={index} disabled>{String.fromCharCode(65 + (assetIndex % 26))}</button>)}</div>}</section>}
      <section><h2>Background</h2><div className="v115-repeat-shortcuts"><button className={backgroundValue === 'transparent' ? 'active' : ''} onClick={() => setBackgroundTransparent(true)}>Transparent</button><button className={backgroundValue !== 'transparent' ? 'active' : ''} onClick={() => setBackgroundTransparent(false)}>Solid</button></div><input type="color" value={solidBackground} onChange={(event) => { setSolidBackground(event.target.value); if (backgroundValue !== 'transparent') sourceMode === 'single' ? patch('background', event.target.value) : patchSet('background', event.target.value) }}/></section>
      <section><h2>Repeat Proof</h2><div className="v11-repeat-buttons">{[2,3,6].map((count) => <button key={count} className={proofCopies === count ? 'active' : ''} onClick={() => { setProofCopies(count); setView('proof') }}>{count}×{count}</button>)}</div></section>
      <section><h2>Output / Reuse</h2><label><span>Name</span><input value={patternName} onChange={(e) => setPatternName(e.target.value)}/></label><div className="v14-export-grid">{EXPORT_PRESETS.map((size) => <button key={size} className={exportLongSide === size ? 'active' : ''} onClick={() => setExportLongSide(size)}>{size}</button>)}</div><label><span>Custom long side</span><input type="number" min="256" max="20000" value={exportLongSide} onChange={(e) => setExportLongSide(Math.max(256, Math.min(20000, Number(e.target.value) || 4096)))}/></label><button className="v09-primary" onClick={saveToLibrary}>Save to My Patterns</button><button onClick={exportSvg}>Export Seamless SVG</button>{sourceMode === 'set' ? <button onClick={exportTileSetJson}>Export Tile Set JSON</button> : null}</section>
    </aside>
  </div>
}
