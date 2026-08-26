import { useEffect, useMemo, useRef, useState } from 'react'
import { buildSvg, generatePattern, patternGeometry } from '../engine/pattern'
import { parseSvgAsset } from '../engine/svg'
import { SPACING_PRESETS } from '../exportPresets'
import { consumePendingPattern, patternAssetToSvg, savePatternAsset } from '../patternLibrary'
import type { BrickOffset, PatternSettings, RepeatMode, SvgAsset } from '../types'

type Props = {
  onOpenLibrary: () => void
  onOpenPixel: () => void
}

type ModeMeta = { id: RepeatMode; label: string; note: string }

const MODES: ModeMeta[] = [
  { id: 'grid', label: 'Grid', note: 'Straight exact repeat.' },
  { id: 'brick-row', label: 'Brick / Half Drop', note: 'Offset every second row.' },
  { id: 'brick-column', label: 'Brick Column', note: 'Offset every second column.' },
  { id: 'hex-row', label: 'Hex Row', note: 'Compact honeycomb repeat.' },
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

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repeat-pattern'
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function scaledDimensions(width: number, height: number, longSide: number) {
  const logicalLong = Math.max(width, height) || 1
  const scale = longSide / logicalLong
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

function buildProofSvg(tileSvg: string, width: number, height: number, copies: number) {
  const doc = new DOMParser().parseFromString(tileSvg, 'image/svg+xml')
  const inner = doc.documentElement.innerHTML
  const totalWidth = width * copies
  const totalHeight = height * copies
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}"><defs><pattern id="pf-repeat-proof" patternUnits="userSpaceOnUse" width="${width}" height="${height}">${inner}</pattern></defs><rect width="100%" height="100%" fill="url(#pf-repeat-proof)"/></svg>`
}

function looksLikePatternForgeMaster(svg: string) {
  return /data-patternforge-seamless=["']true["']/i.test(svg) || /shape-rendering=["']crispEdges["']/i.test(svg)
}

export default function RepeatLayoutWorkspace({ onOpenLibrary, onOpenPixel }: Props) {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [mode, setMode] = useState<RepeatMode>('grid')
  const [settings, setSettings] = useState<PatternSettings>(INITIAL)
  const [view, setView] = useState<'tile' | 'proof'>('proof')
  const [proofCopies, setProofCopies] = useState(3)
  const [exportLongSide, setExportLongSide] = useState(4096)
  const [patternName, setPatternName] = useState('Repeat Pattern 01')
  const [solidBackground, setSolidBackground] = useState('#FFFFFF')
  const [message, setMessage] = useState('Use Exact Tile for a complete Pixel master tile. Interlock is an overlap style, not a seamless requirement.')
  const inputRef = useRef<HTMLInputElement>(null)

  const geometry = useMemo(() => patternGeometry(mode, assets, settings), [mode, assets, settings])
  const instances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])
  const tileSvg = useMemo(() => buildSvg(mode, assets, instances, settings), [mode, assets, instances, settings])
  const proofSvg = useMemo(() => buildProofSvg(tileSvg, geometry.tileWidth, geometry.tileHeight, proofCopies), [tileSvg, geometry.tileWidth, geometry.tileHeight, proofCopies])

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))

  function applyExactTile() {
    setSettings((current) => ({ ...current, hSpacing: 0, vSpacing: 0, paddingX: 0, paddingY: 0, sizeTileToArt: true, snapTileToGrid: true }))
    setMessage('Exact Tile applied: zero padding and zero gap. Use this for a complete seamless master tile from Pixel Pattern.')
  }

  function applySpacingPreset(id: string) {
    const preset = SPACING_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings((current) => ({ ...current, hSpacing: preset.h, vSpacing: preset.v, paddingX: preset.px, paddingY: preset.py }))
    setMessage(id === 'interlock' ? 'Interlock overlaps neighboring motifs. It is a layout style, not required for seamless output.' : `${preset.label} spacing applied.`)
  }

  async function loadSvg(svg: string, name: string, exactMaster = false) {
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    const asset = await parseSvgAsset(svg, name, id)
    setAssets([asset])
    setPatternName(name.replace(/\.svg$/i, '').replace(/[-_]+/g, ' ').trim() || 'Repeat Pattern 01')
    if (exactMaster || looksLikePatternForgeMaster(svg)) applyExactTile()
    setMessage(exactMaster || looksLikePatternForgeMaster(svg)
      ? `${name} loaded with exact SVG bounds. No visual trimming or half-unit safety margin was added.`
      : `${name} loaded as a motif. Choose spacing based on the visual rhythm you want.`)
  }

  async function addFiles(files: FileList | null) {
    const file = Array.from(files ?? []).find((entry) => entry.name.toLowerCase().endsWith('.svg'))
    if (!file) return
    try {
      const text = await file.text()
      await loadSvg(text, file.name, looksLikePatternForgeMaster(text))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load SVG.')
    }
  }

  useEffect(() => {
    const pending = consumePendingPattern('repeat')
    if (!pending) return
    const svg = patternAssetToSvg(pending)
    void loadSvg(svg, pending.name, Boolean(pending.grid && !pending.meta?.cropped))
  }, [])

  function setBackgroundTransparent(transparent: boolean) {
    patch('background', transparent ? 'transparent' : solidBackground)
  }

  function exportSvg() {
    if (!assets.length) { setMessage('Add a motif first.'); return }
    const svg = scaleSvgDocument(tileSvg, geometry.tileWidth, geometry.tileHeight, exportLongSide)
    const dims = scaledDimensions(geometry.tileWidth, geometry.tileHeight, exportLongSide)
    downloadText(svg, `${slug(patternName)}-${mode}-${dims.width}x${dims.height}-seamless.svg`, 'image/svg+xml;charset=utf-8')
    setMessage(`Seamless SVG exported at ${dims.width}×${dims.height}.`)
  }

  function saveToLibrary() {
    if (!assets.length) { setMessage('Add a motif first.'); return }
    const svg = scaleSvgDocument(tileSvg, geometry.tileWidth, geometry.tileHeight, exportLongSide)
    const dims = scaledDimensions(geometry.tileWidth, geometry.tileHeight, exportLongSide)
    savePatternAsset({
      name: patternName.trim() || 'Repeat Pattern',
      sourceType: 'imported-svg',
      svg,
      tags: ['repeat-layout', mode, 'seamless'],
      meta: { width: dims.width, height: dims.height, repeatMode: mode, exactBounds: true },
    })
    setMessage(`${patternName || 'Repeat Pattern'} saved to My Patterns as a reusable seamless SVG.`)
  }

  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0]
  const previewSvg = view === 'tile' ? tileSvg : proofSvg

  return (
    <div className="v10-builder-shell v115-repeat-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>SVG Motif / Tile</h2>
          <button className="v10-drop v115-repeat-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files) }}>
            <b>{assets[0]?.name ?? 'Drop SVG or choose file'}</b>
            <span>PatternForge Pixel masters keep exact viewBox bounds; generic motifs can still be visually trimmed.</span>
          </button>
          <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" onChange={(event) => void addFiles(event.target.files)} />
          <div className="v115-repeat-shortcuts"><button onClick={onOpenLibrary}>My Patterns</button><button onClick={onOpenPixel}>Pixel Pattern</button></div>
        </section>

        <section>
          <h2>Repeat Layout</h2>
          <div className="v115-repeat-modes">{MODES.map((item) => <button key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}><b>{item.label}</b><span>{item.note}</span></button>)}</div>
        </section>

        <section className="v115-exact-section">
          <h2>Seam Control</h2>
          <button className="v10-primary-action" onClick={applyExactTile}>Exact Tile · Recommended for Pixel Master</button>
          <div className="v115-spacing-presets">{SPACING_PRESETS.map((preset) => <button key={preset.id} className={preset.id === 'exact' ? 'active' : ''} onClick={() => applySpacingPreset(preset.id)}>{preset.label}</button>)}</div>
          <small><b>Exact Tile:</b> 0 padding + 0 gap. <b>Interlock:</b> negative gap/overlap. Interlock can be useful visually, but it is not what makes an SVG seamless.</small>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head"><div><b>{activeMode.label}</b><span>{activeMode.note} · tile {Math.round(geometry.tileWidth)}×{Math.round(geometry.tileHeight)}</span></div><div className="v10-view-buttons"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button></div></div>
        <div className="v10-preview-zone v115-repeat-preview">{assets.length ? <img src={svgDataUri(previewSvg)} alt="Repeat pattern preview" /> : <div className="v10-empty-state"><b>Add an SVG motif</b><p>Use a Pixel Pattern master tile or any SVG motif, then choose Grid, Brick, Brick Column or Hex Row.</p></div>}</div>
        <div className="v10-stage-status"><span>{message}</span><b>EXACT BOUNDS REPEAT ENGINE</b></div>
      </main>

      <aside className="v10-panel v10-panel-right">
        <section>
          <h2>Layout Geometry</h2>
          <label><span>Motif size</span><input type="range" min="16" max="800" value={settings.motifSize} onChange={(event) => patch('motifSize', Number(event.target.value))} /><output>{settings.motifSize}</output></label>
          <div className="v10-two"><label><span>Columns</span><input type="number" min="1" max="30" value={settings.columns} onChange={(event) => patch('columns', Number(event.target.value))} /></label><label><span>Rows</span><input type="number" min="1" max="30" value={settings.rows} onChange={(event) => patch('rows', Number(event.target.value))} /></label></div>
          <label><span>Horizontal gap</span><input type="range" min="-200" max="300" value={settings.hSpacing} onChange={(event) => patch('hSpacing', Number(event.target.value))} /><output>{settings.hSpacing}</output></label>
          <label><span>Vertical gap</span><input type="range" min="-200" max="300" value={settings.vSpacing} onChange={(event) => patch('vSpacing', Number(event.target.value))} /><output>{settings.vSpacing}</output></label>
          <div className="v10-two"><label><span>Padding X</span><input type="number" min="0" max="200" value={settings.paddingX} onChange={(event) => patch('paddingX', Number(event.target.value))} /></label><label><span>Padding Y</span><input type="number" min="0" max="200" value={settings.paddingY} onChange={(event) => patch('paddingY', Number(event.target.value))} /></label></div>
          {(mode === 'brick-row' || mode === 'brick-column') ? <label><span>Brick offset</span><select value={settings.brickOffset} onChange={(event) => patch('brickOffset', event.target.value as BrickOffset)}><option value="1/4">1/4</option><option value="1/3">1/3</option><option value="1/2">1/2</option><option value="2/3">2/3</option><option value="3/4">3/4</option></select></label> : null}
        </section>

        <section>
          <h2>Background</h2>
          <div className="v115-repeat-shortcuts"><button className={settings.background === 'transparent' ? 'active' : ''} onClick={() => setBackgroundTransparent(true)}>Transparent</button><button className={settings.background !== 'transparent' ? 'active' : ''} onClick={() => setBackgroundTransparent(false)}>Solid</button></div>
          <input type="color" value={solidBackground} onChange={(event) => { setSolidBackground(event.target.value); if (settings.background !== 'transparent') patch('background', event.target.value) }} />
        </section>

        <section>
          <h2>Repeat Proof</h2>
          <div className="v11-repeat-buttons">{[2,3,6].map((count) => <button key={count} className={proofCopies === count ? 'active' : ''} onClick={() => { setProofCopies(count); setView('proof') }}>{count}×{count}</button>)}</div>
        </section>

        <section>
          <h2>SVG Output Size</h2>
          <div className="v115-export-presets">{EXPORT_PRESETS.map((size) => <button key={size} className={exportLongSide === size ? 'active' : ''} onClick={() => setExportLongSide(size)}>{size}</button>)}</div>
          <label><span>Custom long side</span><input type="number" min="256" max="20000" value={exportLongSide} onChange={(event) => setExportLongSide(Math.max(256, Math.min(20000, Number(event.target.value) || 4096)))} /></label>
          <small>SVG stays vector. This controls document dimensions while the repeat geometry remains mathematically identical.</small>
        </section>

        <section>
          <h2>Save / Export</h2>
          <label><span>Pattern name</span><input value={patternName} onChange={(event) => setPatternName(event.target.value)} /></label>
          <button className="v10-primary-action" onClick={exportSvg}>Export Seamless SVG</button>
          <button className="v10-wide-button" onClick={saveToLibrary}>Save Result to My Patterns</button>
        </section>
      </aside>
    </div>
  )
}
