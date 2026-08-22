import { useMemo, useRef, useState } from 'react'
import TileComposer from './components/TileComposer'
import { cellKey, createPlacement, fillRandom, fillSequential, generateBuilderPattern } from './engine/builder'
import { repeatedTilePng } from './engine/export'
import { buildSvg, generatePattern, patternGeometry } from './engine/pattern'
import { parseSvgAsset } from './engine/svg'
import { EXPORT_PRESETS, SPACING_PRESETS } from './exportPresets'
import type {
  BuilderTool,
  BuilderView,
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
  width: 4000,
  height: 4000,
  tileScale: 100,
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
      {settings.showSwatchBounds && (
        <g className="cell-guides">
          {Array.from({ length: geometry.rows }).flatMap((_, row) =>
            Array.from({ length: geometry.columns }).map((__, col) => (
              <rect key={`${row}-${col}`} x={col * geometry.stepX} y={row * geometry.stepY} width={geometry.cellWidth} height={geometry.cellHeight} className="swatch-boundary" />
            )),
          )}
        </g>
      )}
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
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('auto')
  const [builderView, setBuilderView] = useState<BuilderView>('edit')
  const [builderTool, setBuilderTool] = useState<BuilderTool>('paint')
  const [placements, setPlacements] = useState<TileCellPlacement[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PatternSettings>(initialSettings)
  const [exportSettings, setExportSettings] = useState<ExportSettings>(initialExport)
  const [exportPresetId, setExportPresetId] = useState('stock-4000')
  const [message, setMessage] = useState('Upload one or more SVG motifs to begin.')
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const autoGeometry = useMemo(() => patternGeometry(mode, assets, settings), [mode, assets, settings])
  const autoInstances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])
  const builderResult = useMemo(() => generateBuilderPattern(placements, assets, settings), [placements, assets, settings])
  const geometry = workspaceMode === 'builder' ? builderResult.geometry : autoGeometry
  const instances = workspaceMode === 'builder' ? builderResult.instances : autoInstances
  const selectedPlacement = placements.find((item) => item.key === selectedKey) ?? null

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const patchExport = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setExportSettings((current) => ({ ...current, [key]: value }))
    setExportPresetId('custom')
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
      setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} added · ${trimmed} visual bound${trimmed === 1 ? '' : 's'} normalized.`)
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
    setBuilderView('edit')
    if (!placements.length && assets.length) {
      const g = generateBuilderPattern([], assets, settings).geometry
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
    const centerRows = geometry.rows % 2 === 1
      ? [Math.floor(geometry.rows / 2)]
      : [geometry.rows / 2 - 1, geometry.rows / 2]
    const centerCols = geometry.columns % 2 === 1
      ? [Math.floor(geometry.columns / 2)]
      : [geometry.columns / 2 - 1, geometry.columns / 2]
    const centerKeys = new Set(centerRows.flatMap((row) => centerCols.map((col) => cellKey(row, col))))
    setPlacements((items) => items.filter((item) => !centerKeys.has(item.key)))
    if (selectedKey && centerKeys.has(selectedKey)) setSelectedKey(null)
    setMessage(`Center cleared (${centerRows.length} × ${centerCols.length} cells).`)
  }

  function fillBuilderSequential() {
    const g = generateBuilderPattern([], assets, settings).geometry
    setPlacements(fillSequential(assets, g))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
  }

  function fillBuilderRandom() {
    const g = generateBuilderPattern([], assets, settings).geometry
    setPlacements(fillRandom(assets, g, settings.seed))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
  }

  function applySpacingPreset(id: string) {
    const preset = SPACING_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings((current) => ({
      ...current,
      hSpacing: preset.h,
      vSpacing: preset.v,
      paddingX: preset.px,
      paddingY: preset.py,
    }))
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

  function masterSvg() {
    const exportSettingsForTile = workspaceMode === 'builder' ? { ...settings, snapTileToGrid: true } : settings
    const exportMode: RepeatMode = workspaceMode === 'builder' ? 'grid' : mode
    return buildSvg(exportMode, assets, instances, exportSettingsForTile)
  }

  function exportSvg() {
    if (!assets.length || !instances.length) return
    const svg = masterSvg()
    const label = workspaceMode === 'builder' ? 'tile-builder' : mode
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `patternforge-${label}-${settings.seed}.svg`)
  }

  async function exportPng() {
    if (!assets.length || !instances.length || exporting) return
    setExporting(true)
    setMessage(`Rendering ${exportSettings.width} × ${exportSettings.height} PNG…`)
    try {
      const png = await repeatedTilePng(
        masterSvg(),
        geometry.tileWidth,
        geometry.tileHeight,
        exportSettings.width,
        exportSettings.height,
        exportSettings.tileScale,
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
  const effectiveOverlapX = settings.hSpacing < 0
  const effectiveOverlapY = settings.vSpacing < 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand"><span>PF</span> PatternForge <small>v0.5</small></div>
          <p>Controlled Spacing · Modular Tile Builder · Export Canvas</p>
        </div>
        <div className="workspace-switch">
          <button className={workspaceMode === 'auto' ? 'active' : ''} onClick={() => setWorkspaceMode('auto')}>Auto Repeat</button>
          <button className={workspaceMode === 'builder' ? 'active' : ''} onClick={enterBuilder}>Tile Builder</button>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={() => patch('seed', Math.floor(Math.random() * 999999))}>Randomize</button>
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
            <p className="privacy">Local processing · files are not uploaded by this app.</p>
            <div className="asset-list">
              {assets.map((asset, index) => (
                <div className={`asset-card ${workspaceMode === 'builder' && builderTool === 'paint' && activeAssetId === asset.id ? 'active-asset' : ''}`} key={asset.id} onClick={() => { if (workspaceMode === 'builder') { setBuilderTool('paint'); setActiveAssetId(asset.id) } }}>
                  <div className="asset-thumb"><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /></div>
                  <div><b>{asset.name}</b><span>{workspaceMode === 'builder' ? 'Click to use paint tool' : `Motif ${index + 1}`} · {asset.visualBoundsTrimmed ? 'trimmed' : 'original'}</span></div>
                  <button className="icon-button" onClick={(e) => { e.stopPropagation(); removeAsset(asset.id) }}>×</button>
                </div>
              ))}
            </div>
          </section>

          {workspaceMode === 'auto' ? (
            <section>
              <h2>Tile Type</h2>
              <div className="mode-grid">
                {modes.map((item) => (
                  <button key={item.id} className={mode === item.id ? 'mode active' : 'mode'} onClick={() => setMode(item.id)}>
                    <span>{item.group}</span>{item.label}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section>
                <h2>Builder Tool</h2>
                <div className="tool-switch">
                  <button className={builderTool === 'paint' ? 'active' : ''} onClick={() => setBuilderTool('paint')}>Paint</button>
                  <button className={builderTool === 'erase' ? 'active' : ''} onClick={() => setBuilderTool('erase')}>Erase</button>
                </div>
                <p className="builder-help">Empty cells are valid. Use Erase or Clear Center to intentionally create negative space.</p>
              </section>
              <section>
                <h2>Tile Builder</h2>
                <div className="builder-actions">
                  <button onClick={fillBuilderSequential} disabled={!assets.length}>Fill Sequential</button>
                  <button onClick={fillBuilderRandom} disabled={!assets.length}>Fill Random</button>
                  <button onClick={clearCenter}>Clear Center</button>
                  <button className="danger-ghost" onClick={() => { setPlacements([]); setSelectedKey(null) }}>Clear Tile</button>
                </div>
                <p className="builder-help">Choose a motif above, then click cells to paint it. The center can stay empty for frame, border, greeting-card, or batik compositions.</p>
              </section>
            </>
          )}
        </aside>

        <section className="stage-wrap">
          <div className="stage-toolbar">
            <div>
              <b>{workspaceMode === 'builder' ? 'Modular Master Tile' : 'Live Seamless Proof'}</b>
              <span>{workspaceMode === 'builder' && builderView === 'edit' ? `${geometry.columns} × ${geometry.rows} editable cells` : `${settings.copies} × ${settings.copies} copies · center box is the master repeat`}</span>
            </div>
            <div className="toolbar-checks">
              {workspaceMode === 'builder' && (
                <div className="view-switch">
                  <button className={builderView === 'edit' ? 'active' : ''} onClick={() => setBuilderView('edit')}>Edit Tile</button>
                  <button className={builderView === 'proof' ? 'active' : ''} onClick={() => setBuilderView('proof')}>Seamless Proof</button>
                </div>
              )}
              <label className="check"><input type="checkbox" checked={settings.showBoundary} onChange={(e) => patch('showBoundary', e.target.checked)} /> Tile Edge</label>
              {workspaceMode === 'auto' && <label className="check"><input type="checkbox" checked={settings.showSwatchBounds} onChange={(e) => patch('showSwatchBounds', e.target.checked)} /> Cell Guides</label>}
            </div>
          </div>
          <div className="stage">
            {!assets.length ? (
              <div className="empty-stage"><div className="empty-mark">✦</div><h1>Start with SVG motifs</h1><p>Upload several shapes. Auto Repeat creates instant patterns; Tile Builder lets you compose every grid cell manually.</p></div>
            ) : workspaceMode === 'builder' && builderView === 'edit' ? (
              <TileComposer assets={assets} placements={placements} instances={instances} settings={settings} geometry={geometry} selectedKey={selectedKey} activeAssetId={builderTool === 'paint' ? activeAssetId : null} erasing={builderTool === 'erase'} onCellClick={handleCellClick} />
            ) : (
              <PatternPreview assets={assets} instances={instances} settings={settings} geometry={geometry} />
            )}
          </div>
          <div className="statusbar">
            <span>{message}</span>
            <span>{assets.length} assets · {instances.length} motifs · tile {Math.round(geometry.tileWidth)} × {Math.round(geometry.tileHeight)} · step {Math.round(geometry.stepX)} × {Math.round(geometry.stepY)}</span>
          </div>
        </section>

        <aside className="sidebar right-panel">
          <section>
            <h2>Exact Repeat</h2>
            <label className="option-check">
              <input type="checkbox" checked={workspaceMode === 'builder' ? true : settings.snapTileToGrid} disabled={workspaceMode === 'builder'} onChange={(e) => patch('snapTileToGrid', e.target.checked)} />
              <span><b>Snap Tile to Exact Grid</b><small>{workspaceMode === 'builder' ? 'Required for modular tile editing' : 'Prevents odd spacing at the repeat seam'}</small></span>
            </label>
            {(workspaceMode === 'builder' || settings.snapTileToGrid) ? (
              <>
                <div className="grid-presets">
                  {[2, 4, 6, 8].map((size) => <button key={size} onClick={() => applyGridPreset(size)}>{size}×{size}</button>)}
                </div>
                <div className="two-col compact">
                  <label><span>Columns</span><input type="number" min="1" max="16" value={settings.columns} onChange={(e) => patch('columns', Number(e.target.value))} /></label>
                  <label><span>Rows</span><input type="number" min="1" max="16" value={settings.rows} onChange={(e) => patch('rows', Number(e.target.value))} /></label>
                </div>
                <div className="computed-box"><span>Master tile</span><b>{Math.round(geometry.tileWidth)} × {Math.round(geometry.tileHeight)}</b></div>
              </>
            ) : (
              <div className="two-col compact">
                <label><span>Tile Width</span><input type="number" min="128" max="4096" value={settings.tileWidth} onChange={(e) => patch('tileWidth', Number(e.target.value))} /></label>
                <label><span>Tile Height</span><input type="number" min="128" max="4096" value={settings.tileHeight} onChange={(e) => patch('tileHeight', Number(e.target.value))} /></label>
              </div>
            )}
            <label className="color-row"><span>Background</span><input type="color" value={settings.background} onChange={(e) => patch('background', e.target.value)} /><code>{settings.background}</code></label>
          </section>

          {(workspaceMode === 'builder' || regularMode) && (
            <section>
              <h2>Controlled Spacing</h2>
              <div className="spacing-presets">
                {SPACING_PRESETS.map((item) => <button key={item.id} onClick={() => applySpacingPreset(item.id)}>{item.label}</button>)}
              </div>
              <label className="option-check">
                <input type="checkbox" checked={settings.sizeTileToArt} onChange={(e) => patch('sizeTileToArt', e.target.checked)} />
                <span><b>Auto Cell from Visual Bounds</b><small>Uses trimmed artwork, not SVG canvas whitespace</small></span>
              </label>
              {!settings.sizeTileToArt && (
                <div className="two-col compact">
                  <label><span>Cell Width</span><input type="number" min="16" max="1024" value={settings.repeatWidth} onChange={(e) => patch('repeatWidth', Number(e.target.value))} /></label>
                  <label><span>Cell Height</span><input type="number" min="16" max="1024" value={settings.repeatHeight} onChange={(e) => patch('repeatHeight', Number(e.target.value))} /></label>
                </div>
              )}
              <NumberControl label="Inner Padding X" value={settings.paddingX} min={0} max={120} onChange={(v) => patch('paddingX', v)} />
              <NumberControl label="Inner Padding Y" value={settings.paddingY} min={0} max={120} onChange={(v) => patch('paddingY', v)} />
              <NumberControl label="Horizontal Gap" value={settings.hSpacing} min={-200} max={240} onChange={(v) => patch('hSpacing', v)} />
              <NumberControl label="Vertical Gap" value={settings.vSpacing} min={-200} max={240} onChange={(v) => patch('vSpacing', v)} />
              <div className={`overlap-note ${effectiveOverlapX || effectiveOverlapY ? 'active' : ''}`}>
                <span>Effective step</span>
                <b>{Math.round(geometry.stepX)} × {Math.round(geometry.stepY)}</b>
                <small>{effectiveOverlapX || effectiveOverlapY ? 'Negative gap is creating controlled overlap/interlock.' : 'Positive gap creates breathing room; 0 is flush.'}</small>
              </div>
              <div className="two-selects">
                <SelectRow label="Align X" value={settings.alignX} onChange={(v) => patch('alignX', v as PatternSettings['alignX'])}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></SelectRow>
                <SelectRow label="Align Y" value={settings.alignY} onChange={(v) => patch('alignY', v as PatternSettings['alignY'])}><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></SelectRow>
              </div>
            </section>
          )}

          {workspaceMode === 'auto' ? (
            <section>
              <h2>Motif</h2>
              <NumberControl label="Motif size" value={settings.motifSize} min={24} max={320} onChange={(v) => patch('motifSize', v)} />
              <NumberControl label="Rotation" value={settings.rotation} min={-180} max={180} onChange={(v) => patch('rotation', v)} />
              {mode === 'toss' && <><NumberControl label="Random rotation" value={settings.randomRotation} min={0} max={180} onChange={(v) => patch('randomRotation', v)} /><NumberControl label="Density" value={settings.density} min={5} max={100} onChange={(v) => patch('density', v)} /></>}
              {isBrick && <SelectRow label="Brick Offset" value={settings.brickOffset} onChange={(v) => patch('brickOffset', v as PatternSettings['brickOffset'])}><option value="1/4">1/4</option><option value="1/3">1/3</option><option value="1/2">1/2</option><option value="2/3">2/3</option><option value="3/4">3/4</option></SelectRow>}
            </section>
          ) : (
            <section>
              <h2>Selected Cell</h2>
              {selectedPlacement ? (
                <>
                  <SelectRow label="Motif" value={selectedPlacement.assetId} onChange={(v) => updateSelected({ assetId: v })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</SelectRow>
                  <NumberControl label="Scale" value={selectedPlacement.scale} min={20} max={180} suffix="%" onChange={(v) => updateSelected({ scale: v })} />
                  <NumberControl label="Rotation" value={selectedPlacement.rotation} min={-180} max={180} onChange={(v) => updateSelected({ rotation: v })} />
                  <NumberControl label="Offset X" value={selectedPlacement.offsetX} min={-120} max={120} onChange={(v) => updateSelected({ offsetX: v })} />
                  <NumberControl label="Offset Y" value={selectedPlacement.offsetY} min={-120} max={120} onChange={(v) => updateSelected({ offsetY: v })} />
                  <div className="transform-buttons">
                    <button className={selectedPlacement.flipX ? 'active' : ''} onClick={() => updateSelected({ flipX: !selectedPlacement.flipX })}>Flip H</button>
                    <button className={selectedPlacement.flipY ? 'active' : ''} onClick={() => updateSelected({ flipY: !selectedPlacement.flipY })}>Flip V</button>
                    <button className="danger-ghost" onClick={clearSelected}>Empty</button>
                  </div>
                </>
              ) : <p className="builder-help">Select a cell to edit it. Empty cells are preserved in the seamless tile.</p>}
            </section>
          )}

          <section>
            <h2>Export Canvas</h2>
            <SelectRow label="Preset" value={exportPresetId} onChange={applyExportPreset}>
              <option value="custom">Custom</option>
              {['Logo', 'Web', 'Social', 'Stock', 'Print'].map((group) => (
                <optgroup key={group} label={group}>
                  {EXPORT_PRESETS.filter((item) => item.group === group).map((item) => <option key={item.id} value={item.id}>{item.label} — {item.width}×{item.height}</option>)}
                </optgroup>
              ))}
            </SelectRow>
            <div className="two-col compact">
              <label><span>Width</span><input type="number" min="64" max="12000" value={exportSettings.width} onChange={(e) => patchExport('width', Number(e.target.value))} /></label>
              <label><span>Height</span><input type="number" min="64" max="12000" value={exportSettings.height} onChange={(e) => patchExport('height', Number(e.target.value))} /></label>
            </div>
            <NumberControl label="Pattern scale" value={exportSettings.tileScale} min={25} max={300} suffix="%" onChange={(v) => patchExport('tileScale', v)} />
            <div className="export-note">
              <b>SVG Tile stays vector.</b>
              <span>PNG Canvas repeats the master tile into the exact output dimensions above. Stock presets are convenience sizes, not a submission guarantee.</span>
            </div>
            <div className="export-buttons">
              <button onClick={exportSvg} disabled={!instances.length}>Export SVG Tile</button>
              <button className="accent" onClick={exportPng} disabled={!instances.length || exporting}>{exporting ? 'Rendering…' : `Export PNG ${exportSettings.width}×${exportSettings.height}`}</button>
            </div>
          </section>

          <section>
            <h2>Preview</h2>
            <SelectRow label="Copies" value={String(settings.copies)} onChange={(v) => patch('copies', Number(v))}><option value="3">3 × 3</option><option value="5">5 × 5</option><option value="7">7 × 7</option><option value="9">9 × 9</option></SelectRow>
            <label className="option-check"><input type="checkbox" checked={settings.dimCopies} onChange={(e) => patch('dimCopies', e.target.checked)} /><span><b>Dim Copies</b><small>Keep the center master tile easy to inspect</small></span></label>
            {settings.dimCopies && <NumberControl label="Copy opacity" value={settings.dimCopiesPercent} min={10} max={100} suffix="%" onChange={(v) => patch('dimCopiesPercent', v)} />}
          </section>

          <section className="batik-note">
            <h2>v0.5 Controlled Spacing</h2>
            <p><b>Negative H/V Gap</b> lets neighboring modules overlap and interlock, while Inner Padding can preserve a small visual breathing gap inside each cell.</p>
            <p><b>Tile Builder</b> now has Paint / Erase tools and Clear Center for deliberate negative-space compositions.</p>
          </section>
        </aside>
      </main>
    </div>
  )
}
