import { useMemo, useRef, useState } from 'react'
import CanvasPreview from './components/CanvasPreview'
import TileComposer from './components/TileComposer'
import { builderGeometry, cellKey, createPlacement, fillRandom, fillSequential, generateBuilderPattern } from './engine/builder'
import { canvasModeLabel, computeCanvasLayout } from './engine/canvas'
import { canvasAwarePng } from './engine/export'
import { buildSvg, generatePattern, patternGeometry } from './engine/pattern'
import { parseSvgAsset } from './engine/svg'
import { EXPORT_PRESETS, SPACING_PRESETS } from './exportPresets'
import type {
  BuilderTileSettings,
  BuilderTool,
  BuilderView,
  CanvasMode,
  ExportSettings,
  PatternGeometry,
  PatternInstance,
  PatternSettings,
  RepeatMode,
  SvgAsset,
  TileCellPlacement,
  WorkspaceMode,
} from './types'

const initialSettings: PatternSettings = {
  tileWidth: 512,
  tileHeight: 512,
  background: '#f4efe4',
  motifSize: 104,
  repeatWidth: 140,
  repeatHeight: 140,
  sizeTileToArt: true,
  hSpacing: 8,
  vSpacing: 8,
  paddingX: 8,
  paddingY: 8,
  alignX: 'center',
  alignY: 'middle',
  columns: 4,
  rows: 4,
  snapTileToGrid: true,
  brickOffset: '1/2',
  overlapX: 'right',
  overlapY: 'bottom',
  rotation: 0,
  randomRotation: 35,
  density: 48,
  seed: 1287,
  copies: 3,
  dimCopies: true,
  dimCopiesPercent: 55,
  showBoundary: true,
  showSwatchBounds: false,
}

const initialExport: ExportSettings = {
  width: 1920,
  height: 1080,
  tileScale: 100,
  canvasMode: 'fit-full-tiles',
  proofCopies: 3,
}

const initialBuilderTile: BuilderTileSettings = {
  mode: 'grid',
  width: 1000,
  height: 1000,
}

const modes: { id: RepeatMode; label: string; group: string }[] = [
  { id: 'grid', label: 'Grid', group: 'Exact Repeat' },
  { id: 'brick-row', label: 'Brick by Row', group: 'Pattern Options' },
  { id: 'brick-column', label: 'Brick by Column', group: 'Pattern Options' },
  { id: 'hex-row', label: 'Hex by Row', group: 'Pattern Options' },
  { id: 'hex-column', label: 'Hex by Column', group: 'Pattern Options' },
  { id: 'toss', label: 'Tossed', group: 'Creative' },
  { id: 'ceplok', label: 'Ceplok', group: 'Batik Lab' },
  { id: 'kawung', label: 'Kawung-inspired', group: 'Batik Lab' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Instance({ item, asset, dx = 0, dy = 0 }: { item: PatternInstance; asset: SvgAsset; dx?: number; dy?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g transform={`translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function WrappedTile({ assets, instances, settings, geometry }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings; geometry: PatternGeometry }) {
  const shiftsX = [-geometry.tileWidth, 0, geometry.tileWidth]
  const shiftsY = [-geometry.tileHeight, 0, geometry.tileHeight]
  return (
    <>
      <rect width={geometry.tileWidth} height={geometry.tileHeight} fill={settings.background} />
      {instances.flatMap((item) => {
        const asset = assets[item.assetIndex]
        if (!asset) return []
        return shiftsX.flatMap((dx) => shiftsY.map((dy) => <Instance key={`${item.key}-${dx}-${dy}`} item={item} asset={asset} dx={dx} dy={dy} />))
      })}
    </>
  )
}

function PatternPreview({ assets, instances, settings, geometry }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings; geometry: PatternGeometry }) {
  const w = geometry.tileWidth
  const h = geometry.tileHeight
  const half = Math.floor(settings.copies / 2)
  const tiles: JSX.Element[] = []

  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      const center = row === 0 && col === 0
      const opacity = center || !settings.dimCopies ? 1 : settings.dimCopiesPercent / 100
      tiles.push(
        <svg key={`${row}-${col}`} x={col * w} y={row * h} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden" opacity={opacity}>
          <WrappedTile assets={assets} instances={instances} settings={settings} geometry={geometry} />
        </svg>,
      )
    }
  }

  return (
    <svg className="proof" viewBox={`${-half * w} ${-half * h} ${settings.copies * w} ${settings.copies * h}`} aria-label="Seamless pattern preview">
      {tiles}
      {settings.showBoundary && <rect x={0} y={0} width={w} height={h} className="tile-boundary" />}
    </svg>
  )
}

function NumberControl({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void }) {
  return (
    <label className="control">
      <span>{label}<b>{value}{suffix}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function SelectRow({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="select-row">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  )
}

export default function App() {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [mode, setMode] = useState<RepeatMode>('grid')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('builder')
  const [builderView, setBuilderView] = useState<BuilderView>('canvas')
  const [builderTool, setBuilderTool] = useState<BuilderTool>('paint')
  const [builderTile, setBuilderTile] = useState<BuilderTileSettings>(initialBuilderTile)
  const [placements, setPlacements] = useState<TileCellPlacement[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PatternSettings>(initialSettings)
  const [exportSettings, setExportSettings] = useState<ExportSettings>(initialExport)
  const [exportPresetId, setExportPresetId] = useState('web-hd')
  const [message, setMessage] = useState('Upload SVG motifs. Tile Builder now previews the final export canvas.')
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const autoGeometry = useMemo(() => patternGeometry(mode, assets, settings), [mode, assets, settings])
  const autoInstances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])
  const builderResult = useMemo(() => generateBuilderPattern(placements, assets, settings, builderTile), [placements, assets, settings, builderTile])
  const geometry = workspaceMode === 'builder' ? builderResult.geometry : autoGeometry
  const instances = workspaceMode === 'builder' ? builderResult.instances : autoInstances
  const selectedPlacement = placements.find((item) => item.key === selectedKey) ?? null
  const canvasLayout = useMemo(() => computeCanvasLayout(
    geometry.tileWidth,
    geometry.tileHeight,
    exportSettings.width,
    exportSettings.height,
    exportSettings.tileScale,
    exportSettings.canvasMode ?? 'full-bleed',
    exportSettings.proofCopies ?? 3,
  ), [geometry, exportSettings])

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const patchExport = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setExportSettings((current) => ({ ...current, [key]: value }))
    if (key === 'width' || key === 'height') setExportPresetId('custom')
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('PatternForge currently accepts SVG vector files.')
      return
    }
    const next: SvgAsset[] = []
    for (const file of incoming) {
      try {
        const text = await file.text()
        const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
        next.push(await parseSvgAsset(text, file.name, id))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `Could not load ${file.name}`)
      }
    }
    if (next.length) {
      setAssets((current) => [...current, ...next])
      setActiveAssetId((current) => current ?? next[0].id)
      const trimmed = next.filter((asset) => asset.visualBoundsTrimmed).length
      setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} added · ${trimmed} visual bounds normalized.`)
    }
  }

  function removeAsset(assetId: string) {
    setAssets((items) => items.filter((asset) => asset.id !== assetId))
    setPlacements((items) => items.filter((item) => item.assetId !== assetId))
    if (activeAssetId === assetId) setActiveAssetId(null)
    if (selectedPlacement?.assetId === assetId) setSelectedKey(null)
  }

  function enterBuilder() {
    setWorkspaceMode('builder')
    setBuilderView('canvas')
    if (!placements.length && assets.length) {
      const g = builderGeometry(assets, settings, builderTile)
      setPlacements(fillSequential(assets, g))
      setSelectedKey(cellKey(0, 0))
    }
  }

  function handleCellClick(row: number, col: number) {
    const key = cellKey(row, col)
    setSelectedKey(key)
    if (builderTool === 'erase') {
      setPlacements((items) => items.filter((item) => item.key !== key))
      return
    }
    if (!activeAssetId) return
    setPlacements((items) => {
      const existing = items.find((item) => item.key === key)
      if (existing) return items.map((item) => item.key === key ? { ...item, assetId: activeAssetId } : item)
      return [...items, createPlacement(row, col, activeAssetId)]
    })
  }

  function updateSelected(patchValue: Partial<TileCellPlacement>) {
    if (!selectedKey) return
    setPlacements((items) => items.map((item) => item.key === selectedKey ? { ...item, ...patchValue } : item))
  }

  function clearSelected() {
    if (!selectedKey) return
    setPlacements((items) => items.filter((item) => item.key !== selectedKey))
  }

  function clearCenter() {
    const centerRows = geometry.rows % 2 === 1 ? [Math.floor(geometry.rows / 2)] : [geometry.rows / 2 - 1, geometry.rows / 2]
    const centerCols = geometry.columns % 2 === 1 ? [Math.floor(geometry.columns / 2)] : [geometry.columns / 2 - 1, geometry.columns / 2]
    const keys = new Set(centerRows.flatMap((row) => centerCols.map((col) => cellKey(row, col))))
    setPlacements((items) => items.filter((item) => !keys.has(item.key)))
    if (selectedKey && keys.has(selectedKey)) setSelectedKey(null)
  }

  function fillBuilderSequential() {
    const g = builderGeometry(assets, settings, builderTile)
    setPlacements(fillSequential(assets, g))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
  }

  function fillBuilderRandom() {
    const g = builderGeometry(assets, settings, builderTile)
    setPlacements(fillRandom(assets, g, settings.seed))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
  }

  function applySpacingPreset(id: string) {
    const preset = SPACING_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings((current) => ({ ...current, hSpacing: preset.h, vSpacing: preset.v, paddingX: preset.px, paddingY: preset.py }))
  }

  function applyGridPreset(size: number) {
    setSettings((current) => ({ ...current, columns: size, rows: size }))
  }

  function applyExportPreset(id: string) {
    const preset = EXPORT_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setExportPresetId(id)
    setExportSettings((current) => ({ ...current, width: preset.width, height: preset.height }))
  }

  function applyMasterTilePreset(size: number) {
    setBuilderTile({ mode: 'custom', width: size, height: size })
  }

  function matchMasterTileToCanvas() {
    setBuilderTile({ mode: 'custom', width: exportSettings.width, height: exportSettings.height })
  }

  function masterSvg() {
    const exportMode: RepeatMode = workspaceMode === 'builder' ? 'grid' : mode
    const exportSettingsForTile = workspaceMode === 'builder'
      ? { ...settings, snapTileToGrid: true, tileWidth: geometry.tileWidth, tileHeight: geometry.tileHeight }
      : settings
    return buildSvg(exportMode, assets, instances, exportSettingsForTile)
  }

  function exportSvg() {
    if (!assets.length || !instances.length) return
    const label = workspaceMode === 'builder' ? 'tile-builder' : mode
    downloadBlob(new Blob([masterSvg()], { type: 'image/svg+xml;charset=utf-8' }), `patternforge-${label}-tile-${Math.round(geometry.tileWidth)}x${Math.round(geometry.tileHeight)}.svg`)
  }

  async function exportPng() {
    if (!assets.length || !instances.length || exporting) return
    setExporting(true)
    setMessage(`Rendering ${exportSettings.width} × ${exportSettings.height} · ${canvasModeLabel(exportSettings.canvasMode ?? 'full-bleed')}…`)
    try {
      const png = await canvasAwarePng(
        masterSvg(),
        geometry.tileWidth,
        geometry.tileHeight,
        exportSettings.width,
        exportSettings.height,
        exportSettings.tileScale,
        exportSettings.canvasMode ?? 'full-bleed',
        exportSettings.proofCopies ?? 3,
        settings.background,
      )
      const label = workspaceMode === 'builder' ? 'tile-builder' : mode
      downloadBlob(png, `patternforge-${label}-${exportSettings.width}x${exportSettings.height}.png`)
      setMessage(`PNG exported: ${exportSettings.width} × ${exportSettings.height}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'PNG export failed.')
    } finally {
      setExporting(false)
    }
  }

  const isBrick = mode === 'brick-row' || mode === 'brick-column'
  const regularMode = mode !== 'toss'
  const noCut = exportSettings.canvasMode === 'fit-full-tiles'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand"><span>PF</span> PatternForge <small>v0.6</small></div>
          <p>Canvas-Aware Tile Builder · No-Cut Export · Master Tile Control</p>
        </div>
        <div className="workspace-switch">
          <button className={workspaceMode === 'auto' ? 'active' : ''} onClick={() => setWorkspaceMode('auto')}>Auto Repeat</button>
          <button className={workspaceMode === 'builder' ? 'active' : ''} onClick={enterBuilder}>Tile Builder</button>
        </div>
        <div className="top-actions">
          <button onClick={exportSvg} disabled={!instances.length}>SVG Tile</button>
          <button className="accent" onClick={exportPng} disabled={!instances.length || exporting}>{exporting ? 'Rendering…' : 'PNG Canvas'}</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar left-panel">
          <section>
            <h2>Assets</h2>
            <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
              <strong>Drop SVG motifs</strong>
              <span>visual whitespace is trimmed automatically</span>
              <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            <p className="privacy">Local processing · files stay in your browser.</p>
            <div className="asset-list">
              {assets.map((asset, index) => (
                <div className={`asset-card ${workspaceMode === 'builder' && builderTool === 'paint' && activeAssetId === asset.id ? 'active-asset' : ''}`} key={asset.id} onClick={() => { if (workspaceMode === 'builder') { setBuilderTool('paint'); setActiveAssetId(asset.id) } }}>
                  <div className="asset-thumb"><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /></div>
                  <div><b>{asset.name}</b><span>{workspaceMode === 'builder' ? 'Click to use Paint' : `Motif ${index + 1}`} · {asset.visualBoundsTrimmed ? 'trimmed' : 'original'}</span></div>
                  <button className="icon-button" onClick={(e) => { e.stopPropagation(); removeAsset(asset.id) }}>×</button>
                </div>
              ))}
            </div>
          </section>

          {workspaceMode === 'builder' ? (
            <>
              <section>
                <h2>Builder Tool</h2>
                <div className="tool-switch">
                  <button className={builderTool === 'paint' ? 'active' : ''} onClick={() => setBuilderTool('paint')}>Paint</button>
                  <button className={builderTool === 'erase' ? 'active' : ''} onClick={() => setBuilderTool('erase')}>Erase</button>
                </div>
              </section>
              <section>
                <h2>Tile Builder</h2>
                <div className="builder-actions">
                  <button onClick={fillBuilderSequential} disabled={!assets.length}>Fill Sequential</button>
                  <button onClick={fillBuilderRandom} disabled={!assets.length}>Fill Random</button>
                  <button onClick={clearCenter}>Clear Center</button>
                  <button className="danger-ghost" onClick={() => { setPlacements([]); setSelectedKey(null) }}>Clear Tile</button>
                </div>
                <p className="builder-help">Edit the master tile, then switch to Final Canvas to see exactly how it fits the export dimensions.</p>
              </section>
            </>
          ) : (
            <section>
              <h2>Tile Type</h2>
              <div className="mode-grid">
                {modes.map((item) => <button key={item.id} className={mode === item.id ? 'mode active' : 'mode'} onClick={() => setMode(item.id)}><span>{item.group}</span>{item.label}</button>)}
              </div>
            </section>
          )}
        </aside>

        <section className="stage-wrap">
          <div className="stage-toolbar">
            <div>
              <b>{workspaceMode === 'builder' ? (builderView === 'canvas' ? 'Final Export Canvas' : builderView === 'edit' ? 'Master Tile Editor' : 'Seamless Proof') : 'Live Seamless Proof'}</b>
              <span>{builderView === 'canvas' && workspaceMode === 'builder' ? `${exportSettings.width} × ${exportSettings.height} · ${canvasModeLabel(exportSettings.canvasMode ?? 'full-bleed')}` : `Master tile ${Math.round(geometry.tileWidth)} × ${Math.round(geometry.tileHeight)}`}</span>
            </div>
            <div className="toolbar-checks">
              {workspaceMode === 'builder' && (
                <div className="view-switch three">
                  <button className={builderView === 'edit' ? 'active' : ''} onClick={() => setBuilderView('edit')}>Edit Tile</button>
                  <button className={builderView === 'canvas' ? 'active' : ''} onClick={() => setBuilderView('canvas')}>Final Canvas</button>
                  <button className={builderView === 'proof' ? 'active' : ''} onClick={() => setBuilderView('proof')}>Proof</button>
                </div>
              )}
              <label className="check"><input type="checkbox" checked={settings.showBoundary} onChange={(e) => patch('showBoundary', e.target.checked)} /> Guides</label>
            </div>
          </div>

          <div className="stage canvas-stage">
            {!assets.length ? (
              <div className="empty-stage"><div className="empty-mark">✦</div><h1>Start with SVG motifs</h1><p>Tile Builder is now canvas-aware. Choose the export canvas first, compose the master tile, then preview the final result.</p></div>
            ) : workspaceMode === 'builder' && builderView === 'edit' ? (
              <TileComposer assets={assets} placements={placements} instances={instances} settings={settings} geometry={geometry} selectedKey={selectedKey} activeAssetId={builderTool === 'paint' ? activeAssetId : null} erasing={builderTool === 'erase'} onCellClick={handleCellClick} />
            ) : workspaceMode === 'builder' && builderView === 'canvas' ? (
              <CanvasPreview assets={assets} instances={instances} settings={settings} geometry={geometry} exportSettings={exportSettings} />
            ) : (
              <PatternPreview assets={assets} instances={instances} settings={settings} geometry={geometry} />
            )}
          </div>

          <div className="statusbar">
            <span>{message}</span>
            <span>{noCut ? `Whole tiles: ${canvasLayout.columns} × ${canvasLayout.rows}` : `Canvas layout: ${canvasLayout.columns} × ${canvasLayout.rows}`} · drawn tile {Math.round(canvasLayout.tileWidth)} × {Math.round(canvasLayout.tileHeight)}</span>
          </div>
        </section>

        <aside className="sidebar right-panel">
          {workspaceMode === 'builder' && (
            <section>
              <h2>Master Tile Size</h2>
              <SelectRow label="Sizing" value={builderTile.mode} onChange={(value) => setBuilderTile((current) => ({ ...current, mode: value as BuilderTileSettings['mode'] }))}>
                <option value="grid">Auto from Grid</option>
                <option value="custom">Custom Master Tile</option>
              </SelectRow>
              <div className="master-presets">
                {[500, 1000, 2000, 3000].map((size) => <button key={size} onClick={() => applyMasterTilePreset(size)}>{size}</button>)}
              </div>
              {builderTile.mode === 'custom' && (
                <div className="two-col compact">
                  <label><span>Tile Width</span><input type="number" min="128" max="8000" value={builderTile.width} onChange={(e) => setBuilderTile((current) => ({ ...current, width: Number(e.target.value) }))} /></label>
                  <label><span>Tile Height</span><input type="number" min="128" max="8000" value={builderTile.height} onChange={(e) => setBuilderTile((current) => ({ ...current, height: Number(e.target.value) }))} /></label>
                </div>
              )}
              <button className="full master-match" onClick={matchMasterTileToCanvas}>Match Master Tile to Canvas</button>
              <div className="computed-box"><span>Actual master tile</span><b>{Math.round(geometry.tileWidth)} × {Math.round(geometry.tileHeight)}</b></div>
            </section>
          )}

          <section>
            <h2>Grid & Spacing</h2>
            <div className="grid-presets">{[2, 4, 6, 8].map((size) => <button key={size} onClick={() => applyGridPreset(size)}>{size}×{size}</button>)}</div>
            <div className="two-col compact">
              <label><span>Columns</span><input type="number" min="1" max="16" value={settings.columns} onChange={(e) => patch('columns', Number(e.target.value))} /></label>
              <label><span>Rows</span><input type="number" min="1" max="16" value={settings.rows} onChange={(e) => patch('rows', Number(e.target.value))} /></label>
            </div>
            <div className="spacing-presets">{SPACING_PRESETS.map((item) => <button key={item.id} onClick={() => applySpacingPreset(item.id)}>{item.label}</button>)}</div>
            <NumberControl label="Inner Padding X" value={settings.paddingX} min={0} max={120} onChange={(v) => patch('paddingX', v)} />
            <NumberControl label="Inner Padding Y" value={settings.paddingY} min={0} max={120} onChange={(v) => patch('paddingY', v)} />
            <NumberControl label="Horizontal Gap" value={settings.hSpacing} min={-200} max={240} onChange={(v) => patch('hSpacing', v)} />
            <NumberControl label="Vertical Gap" value={settings.vSpacing} min={-200} max={240} onChange={(v) => patch('vSpacing', v)} />
          </section>

          {workspaceMode === 'builder' ? (
            <section>
              <h2>Selected Cell</h2>
              {selectedPlacement ? (
                <>
                  <SelectRow label="Motif" value={selectedPlacement.assetId} onChange={(v) => updateSelected({ assetId: v })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</SelectRow>
                  <NumberControl label="Scale" value={selectedPlacement.scale} min={20} max={220} suffix="%" onChange={(v) => updateSelected({ scale: v })} />
                  <NumberControl label="Rotation" value={selectedPlacement.rotation} min={-180} max={180} onChange={(v) => updateSelected({ rotation: v })} />
                  <NumberControl label="Offset X" value={selectedPlacement.offsetX} min={-200} max={200} onChange={(v) => updateSelected({ offsetX: v })} />
                  <NumberControl label="Offset Y" value={selectedPlacement.offsetY} min={-200} max={200} onChange={(v) => updateSelected({ offsetY: v })} />
                  <div className="transform-buttons">
                    <button className={selectedPlacement.flipX ? 'active' : ''} onClick={() => updateSelected({ flipX: !selectedPlacement.flipX })}>Flip H</button>
                    <button className={selectedPlacement.flipY ? 'active' : ''} onClick={() => updateSelected({ flipY: !selectedPlacement.flipY })}>Flip V</button>
                    <button className="danger-ghost" onClick={clearSelected}>Empty</button>
                  </div>
                </>
              ) : <p className="builder-help">Select a cell in Edit Tile mode to transform it.</p>}
            </section>
          ) : regularMode ? (
            <section>
              <h2>Motif</h2>
              <NumberControl label="Motif size" value={settings.motifSize} min={24} max={320} onChange={(v) => patch('motifSize', v)} />
              <NumberControl label="Rotation" value={settings.rotation} min={-180} max={180} onChange={(v) => patch('rotation', v)} />
              {isBrick && <SelectRow label="Brick Offset" value={settings.brickOffset} onChange={(v) => patch('brickOffset', v as PatternSettings['brickOffset'])}><option value="1/4">1/4</option><option value="1/3">1/3</option><option value="1/2">1/2</option><option value="2/3">2/3</option><option value="3/4">3/4</option></SelectRow>}
            </section>
          ) : null}

          <section className="canvas-panel">
            <h2>Final Canvas</h2>
            <SelectRow label="Preset" value={exportPresetId} onChange={applyExportPreset}>
              <option value="custom">Custom</option>
              {['Logo', 'Web', 'Social', 'Stock', 'Print'].map((group) => (
                <optgroup key={group} label={group}>{EXPORT_PRESETS.filter((item) => item.group === group).map((item) => <option key={item.id} value={item.id}>{item.label} — {item.width}×{item.height}</option>)}</optgroup>
              ))}
            </SelectRow>
            <div className="two-col compact">
              <label><span>Width</span><input type="number" min="64" max="12000" value={exportSettings.width} onChange={(e) => patchExport('width', Number(e.target.value))} /></label>
              <label><span>Height</span><input type="number" min="64" max="12000" value={exportSettings.height} onChange={(e) => patchExport('height', Number(e.target.value))} /></label>
            </div>
            <SelectRow label="Fit Mode" value={exportSettings.canvasMode ?? 'full-bleed'} onChange={(v) => patchExport('canvasMode', v as CanvasMode)}>
              <option value="full-bleed">Full Bleed — crop edges allowed</option>
              <option value="fit-full-tiles">Fit Full Tiles — no cut tiles</option>
              <option value="single-tile">Single Tile — centered</option>
              <option value="proof">Proof Sheet — whole tiles</option>
            </SelectRow>
            {exportSettings.canvasMode === 'proof' && <SelectRow label="Proof copies" value={String(exportSettings.proofCopies ?? 3)} onChange={(v) => patchExport('proofCopies', Number(v))}><option value="3">3 × 3</option><option value="5">5 × 5</option><option value="7">7 × 7</option></SelectRow>}
            <NumberControl label="Pattern scale" value={exportSettings.tileScale} min={25} max={300} suffix="%" onChange={(v) => patchExport('tileScale', v)} />
            <div className={`canvas-summary ${noCut ? 'safe' : ''}`}>
              <b>{canvasModeLabel(exportSettings.canvasMode ?? 'full-bleed')}</b>
              <span>{canvasLayout.columns} × {canvasLayout.rows} tiles · tile draw {Math.round(canvasLayout.tileWidth)} × {Math.round(canvasLayout.tileHeight)}</span>
              {noCut && <small>No tile is clipped. Extra space, if any, stays as background margin.</small>}
            </div>
            <div className="export-buttons">
              <button onClick={() => { setWorkspaceMode('builder'); setBuilderView('canvas') }}>Preview Final Canvas</button>
              <button onClick={exportSvg} disabled={!instances.length}>Export SVG Master Tile</button>
              <button className="accent" onClick={exportPng} disabled={!instances.length || exporting}>{exporting ? 'Rendering…' : `Export PNG ${exportSettings.width}×${exportSettings.height}`}</button>
            </div>
          </section>

          <section className="batik-note">
            <h2>v0.6 Canvas-Aware</h2>
            <p><b>Fit Full Tiles</b> prevents partial tiles at the canvas edge. It preserves the tile aspect ratio and centers whole repeats, so a small margin may remain.</p>
            <p><b>Final Canvas</b> uses the exact export aspect ratio, so the builder result is visible before PNG export.</p>
          </section>
        </aside>
      </main>
    </div>
  )
}
