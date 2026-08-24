import { useMemo, useRef, useState, type ReactNode } from 'react'
import TileComposer from './components/TileComposer'
import {
  builderGeometry,
  cellKey,
  createPlacement,
  fillRandom,
  fillSequential,
  findPlacementCoveringCell,
  generateBuilderPattern,
  placementCoversCell,
  spanCols,
  spanFitsGrid,
  spanRows,
} from './engine/builder'
import { buildComposerSvg } from './engine/composerExport'
import { canvasAwarePng } from './engine/export'
import { buildSvg, generatePattern, patternGeometry } from './engine/pattern'
import { buildRepeatProofSvg } from './engine/proofExport'
import { parseSvgAsset } from './engine/svg'
import { EXPORT_PRESETS, SPACING_PRESETS } from './exportPresets'
import type {
  BuilderTool,
  BuilderView,
  ExportSettings,
  OutputMode,
  PatternGeometry,
  PatternInstance,
  PatternSettings,
  RepeatMode,
  SvgAsset,
  TileCellPlacement,
  WorkspaceMode,
} from './types'

const initialSettings: PatternSettings = {
  tileWidth: 1600,
  tileHeight: 1600,
  background: '#f4efe4',
  motifSize: 180,
  repeatWidth: 220,
  repeatHeight: 220,
  sizeTileToArt: true,
  hSpacing: 8,
  vSpacing: 8,
  paddingX: 5,
  paddingY: 5,
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
  parangAngle: -45,
  parangRowOffset: 0.5,
  paisleyAlternateRotation: 180,
  paisleyBorderWidth: 230,
  paisleyCenterScale: 220,
  paisleyCornerScale: 145,
  paisleyEdgeDensity: 7,
  paisleyCenterDensity: 6,
  paisleyInward: true,
  copies: 3,
  dimCopies: false,
  dimCopiesPercent: 55,
  showBoundary: true,
  showSwatchBounds: false,
}

const initialExport: ExportSettings = {
  width: 5000,
  height: 5000,
  tileScale: 100,
  canvasMode: 'full-bleed',
  proofCopies: 3,
}

type ModeMeta = {
  id: RepeatMode
  label: string
  group: 'Classic' | 'Batik' | 'Paisley'
  note: string
}

const modes: ModeMeta[] = [
  { id: 'grid', label: 'Grid', group: 'Classic', note: 'Straight exact repeat.' },
  { id: 'brick-row', label: 'Brick / Half Drop', group: 'Classic', note: 'Offset every second row.' },
  { id: 'brick-column', label: 'Brick Column', group: 'Classic', note: 'Offset every second column.' },
  { id: 'hex-row', label: 'Hex Row', group: 'Classic', note: 'Compact honeycomb repeat.' },
  { id: 'toss', label: 'Tossed', group: 'Classic', note: 'Controlled scattered motifs.' },
  { id: 'ceplok', label: 'Ceplok', group: 'Batik', note: 'Alternating geometric batik layout.' },
  { id: 'kawung', label: 'Kawung-inspired', group: 'Batik', note: 'Four-arm radial module.' },
  { id: 'parang', label: 'Parang Diagonal', group: 'Batik', note: 'Continuous diagonal batik bands.' },
  { id: 'paisley-allover', label: 'Paisley All-Over', group: 'Paisley', note: 'Half-drop alternating paisley repeat.' },
  { id: 'paisley-center', label: 'Paisley Center', group: 'Paisley', note: 'Center medallion tile with orbiting accents.' },
  { id: 'paisley-frame', label: 'Paisley Scarf Frame', group: 'Paisley', note: 'Border, corners, and open center like a scarf panel.' },
  { id: 'paisley-border-center', label: 'Paisley Frame + Center', group: 'Paisley', note: 'Scarf border plus central medallion.' },
  { id: 'paisley-corner', label: 'Paisley Corner Frame', group: 'Paisley', note: 'Large corners with lighter edge decoration.' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Instance({ item, asset, dx = 0, dy = 0, opacity = 1 }: { item: PatternInstance; asset: SvgAsset; dx?: number; dy?: number; opacity?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g opacity={opacity} pointerEvents="none" transform={`translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function PatternPreview({ assets, instances, settings, geometry, copies, wrapEdges }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings; geometry: PatternGeometry; copies: number; wrapEdges: boolean }) {
  const w = geometry.tileWidth
  const h = geometry.tileHeight
  const shifts = wrapEdges
    ? [[-w, -h], [0, -h], [w, -h], [-w, 0], [0, 0], [w, 0], [-w, h], [0, h], [w, h]]
    : [[0, 0]]
  const tiles: ReactNode[] = []

  for (let row = 0; row < copies; row++) {
    for (let col = 0; col < copies; col++) {
      tiles.push(
        <svg key={`${row}-${col}`} x={col * w} y={row * h} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="hidden">
          <rect width={w} height={h} fill={settings.background} />
          {instances.flatMap((item) => {
            const asset = assets[item.assetIndex]
            if (!asset) return []
            return shifts.map(([dx, dy], shiftIndex) => <Instance key={`${item.key}-${shiftIndex}`} item={item} asset={asset} dx={dx} dy={dy} />)
          })}
          {settings.showBoundary && <rect width={w} height={h} className="tile-boundary" />}
        </svg>,
      )
    }
  }

  return <svg className="proof" viewBox={`0 0 ${w * copies} ${h * copies}`}>{tiles}</svg>
}

function NumberControl({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void }) {
  return (
    <label className="control">
      <span>{label}<b>{value}{suffix}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function SelectRow({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="select-row">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  )
}

function isPaisleyFrame(mode: RepeatMode) {
  return mode === 'paisley-center' || mode === 'paisley-frame' || mode === 'paisley-border-center' || mode === 'paisley-corner'
}

export default function App() {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [mode, setMode] = useState<RepeatMode>('paisley-allover')
  const [outputMode, setOutputMode] = useState<OutputMode>('seamless')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('auto')
  const [builderView, setBuilderView] = useState<BuilderView>('proof')
  const [builderTool, setBuilderTool] = useState<BuilderTool>('paint')
  const [placements, setPlacements] = useState<TileCellPlacement[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PatternSettings>(initialSettings)
  const [exportSettings, setExportSettings] = useState<ExportSettings>(initialExport)
  const [exportPresetId, setExportPresetId] = useState('custom')
  const [message, setMessage] = useState('Seamless Pattern is the primary workspace. Upload vector motifs to begin.')
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const builderTile = useMemo(() => ({
    mode: 'custom' as const,
    width: outputMode === 'seamless' ? settings.tileWidth : exportSettings.width,
    height: outputMode === 'seamless' ? settings.tileHeight : exportSettings.height,
    cellShape: 'square' as const,
  }), [outputMode, settings.tileWidth, settings.tileHeight, exportSettings.width, exportSettings.height])

  const autoGeometry = useMemo(() => patternGeometry(mode, assets, settings), [mode, assets, settings])
  const autoInstances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])
  const builderResult = useMemo(() => generateBuilderPattern(placements, assets, settings, builderTile), [placements, assets, settings, builderTile])
  const geometry = workspaceMode === 'builder' ? builderResult.geometry : autoGeometry
  const instances = workspaceMode === 'builder' ? builderResult.instances : autoInstances
  const selectedPlacement = placements.find((item) => item.key === selectedKey) ?? null
  const currentMode = modes.find((item) => item.id === mode) ?? modes[0]

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const patchExport = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setExportSettings((current) => ({ ...current, [key]: value }))
    if (key === 'width' || key === 'height') setExportPresetId('custom')
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('PatternForge accepts SVG vector motifs.')
      return
    }
    const next: SvgAsset[] = []
    for (const file of incoming) {
      try {
        const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
        next.push(await parseSvgAsset(await file.text(), file.name, id))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `Could not load ${file.name}`)
      }
    }
    if (next.length) {
      setAssets((current) => [...current, ...next])
      setActiveAssetId((current) => current ?? next[0].id)
      setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} added.`)
    }
  }

  function removeAsset(assetId: string) {
    setAssets((items) => items.filter((asset) => asset.id !== assetId))
    setPlacements((items) => items.filter((item) => item.assetId !== assetId))
    if (activeAssetId === assetId) setActiveAssetId(null)
    if (selectedPlacement?.assetId === assetId) setSelectedKey(null)
  }

  function chooseOutput(next: OutputMode) {
    setOutputMode(next)
    if (next === 'canvas') {
      setWorkspaceMode('builder')
      setBuilderView('edit')
      setMessage('Canvas Composer creates a final vector composition. It is not forced to repeat.')
    } else {
      setBuilderView(workspaceMode === 'builder' ? 'edit' : 'proof')
      setMessage('Seamless mode wraps every edge and exports a reusable master tile.')
    }
  }

  function chooseWorkspace(next: WorkspaceMode) {
    setWorkspaceMode(next)
    if (next === 'builder') {
      setBuilderView('edit')
      if (!placements.length && assets.length) {
        const g = builderGeometry(assets, settings, builderTile)
        setPlacements(fillSequential(assets, g))
        setSelectedKey(cellKey(0, 0))
      }
    } else {
      setBuilderView('proof')
    }
  }

  function chooseMode(next: RepeatMode) {
    setMode(next)
    setWorkspaceMode('auto')
    setOutputMode('seamless')
    setBuilderView('proof')
    if (next === 'parang') setSettings((s) => ({ ...s, columns: 7, rows: 6, parangAngle: -45, snapTileToGrid: true }))
    if (next === 'paisley-allover') setSettings((s) => ({ ...s, columns: 6, rows: 6, snapTileToGrid: true }))
    if (isPaisleyFrame(next)) setSettings((s) => ({ ...s, tileWidth: 1600, tileHeight: 1600, snapTileToGrid: false }))
  }

  function handleCellClick(row: number, col: number) {
    const owner = findPlacementCoveringCell(placements, row, col)
    if (builderTool === 'erase') {
      if (owner) {
        setPlacements((items) => items.filter((item) => item.key !== owner.key))
        if (selectedKey === owner.key) setSelectedKey(null)
      }
      return
    }
    if (owner) {
      setSelectedKey(owner.key)
      if (activeAssetId) setPlacements((items) => items.map((item) => item.key === owner.key ? { ...item, assetId: activeAssetId } : item))
      return
    }
    if (!activeAssetId) return
    const key = cellKey(row, col)
    setPlacements((items) => [...items, createPlacement(row, col, activeAssetId)])
    setSelectedKey(key)
  }

  function updateSelected(value: Partial<TileCellPlacement>) {
    if (!selectedKey) return
    setPlacements((items) => items.map((item) => item.key === selectedKey ? { ...item, ...value } : item))
  }

  function setSelectedSpan(cols: number, rows: number) {
    if (!selectedPlacement || !selectedKey) return
    if (!spanFitsGrid(selectedPlacement.row, selectedPlacement.col, cols, rows, geometry)) {
      setMessage(`A ${cols}×${rows} block does not fit from this anchor.`)
      return
    }
    const targetCells: Array<[number, number]> = []
    for (let row = selectedPlacement.row; row < selectedPlacement.row + rows; row++) {
      for (let col = selectedPlacement.col; col < selectedPlacement.col + cols; col++) targetCells.push([row, col])
    }
    setPlacements((items) => {
      const clean = items.filter((item) => item.key === selectedKey || !targetCells.some(([row, col]) => placementCoversCell(item, row, col)))
      return clean.map((item) => item.key === selectedKey ? { ...item, spanCols: cols, spanRows: rows } : item)
    })
  }

  function clearCenter() {
    const centerRows = geometry.rows % 2 === 1 ? [Math.floor(geometry.rows / 2)] : [geometry.rows / 2 - 1, geometry.rows / 2]
    const centerCols = geometry.columns % 2 === 1 ? [Math.floor(geometry.columns / 2)] : [geometry.columns / 2 - 1, geometry.columns / 2]
    const cells = centerRows.flatMap((row) => centerCols.map((col) => [row, col] as [number, number]))
    setPlacements((items) => items.filter((item) => !cells.some(([row, col]) => placementCoversCell(item, row, col))))
    setSelectedKey(null)
    setMessage('Center cleared. This copy space remains valid in the seamless master tile.')
  }

  function fillBuilder(random = false) {
    const g = builderGeometry(assets, settings, builderTile)
    setPlacements(random ? fillRandom(assets, g, settings.seed) : fillSequential(assets, g))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
  }

  function applySpacingPreset(id: string) {
    const preset = SPACING_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings((current) => ({ ...current, hSpacing: preset.h, vSpacing: preset.v, paddingX: preset.px, paddingY: preset.py }))
  }

  function applyExportPreset(id: string) {
    const preset = EXPORT_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setExportPresetId(id)
    setExportSettings((current) => ({ ...current, width: preset.width, height: preset.height }))
  }

  function currentSvg() {
    if (workspaceMode === 'auto') return buildSvg(mode, assets, autoInstances, settings)
    return buildComposerSvg(assets, builderResult.instances, settings.background, builderResult.geometry, [], outputMode === 'seamless')
  }

  function exportSvg() {
    if (!instances.length) return
    const svg = currentSvg()
    const filename = outputMode === 'seamless'
      ? `patternforge-${workspaceMode === 'auto' ? mode : 'manual'}-seamless-tile.svg`
      : `patternforge-final-canvas-${Math.round(geometry.tileWidth)}x${Math.round(geometry.tileHeight)}.svg`
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename)
    setMessage(outputMode === 'seamless' ? 'Seamless master SVG tile exported.' : 'Final canvas SVG exported.')
  }

  function exportProofSvg() {
    if (outputMode !== 'seamless' || !instances.length) return
    const copies = Math.max(2, Math.round(settings.copies))
    const proof = buildRepeatProofSvg(currentSvg(), geometry.tileWidth, geometry.tileHeight, copies)
    downloadBlob(new Blob([proof], { type: 'image/svg+xml;charset=utf-8' }), `patternforge-${workspaceMode === 'auto' ? mode : 'manual'}-${copies}x${copies}-proof.svg`)
  }

  async function exportPreview() {
    if (!instances.length || exporting) return
    setExporting(true)
    try {
      const svg = currentSvg()
      const png = await canvasAwarePng(
        svg,
        geometry.tileWidth,
        geometry.tileHeight,
        exportSettings.width,
        exportSettings.height,
        100,
        outputMode === 'seamless' ? 'full-bleed' : 'single-tile',
        settings.copies,
        settings.background,
      )
      downloadBlob(png, `patternforge-${outputMode === 'seamless' ? 'seamless-preview' : 'canvas'}-${exportSettings.width}x${exportSettings.height}.png`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Preview export failed.')
    } finally {
      setExporting(false)
    }
  }

  const vectorOnly = assets.every((asset) => !/<image\b/i.test(asset.innerSvg) && !/<foreignObject\b/i.test(asset.innerSvg))
  const seamlessReady = outputMode === 'seamless' && instances.length > 0 && vectorOnly
  const currentSpanCols = selectedPlacement ? spanCols(selectedPlacement) : 1
  const currentSpanRows = selectedPlacement ? spanRows(selectedPlacement) : 1

  return (
    <div className="app-shell v08-shell">
      <header className="topbar">
        <div>
          <div className="brand"><span>PF</span> PatternForge <small>v0.8</small></div>
          <p>Seamless Pattern Builder · Parang · Paisley Scarf Layouts · Vector-first</p>
        </div>
        <div className="output-switch">
          <button className={outputMode === 'seamless' ? 'active' : ''} onClick={() => chooseOutput('seamless')}>Seamless Pattern</button>
          <button className={outputMode === 'canvas' ? 'active' : ''} onClick={() => chooseOutput('canvas')}>Canvas Composer</button>
        </div>
        <div className="top-actions">
          {outputMode === 'seamless' && <button onClick={exportProofSvg} disabled={!instances.length}>Export Proof SVG</button>}
          <button className="accent" onClick={exportSvg} disabled={!instances.length}>{outputMode === 'seamless' ? 'Export Seamless Tile SVG' : 'Export Final Canvas SVG'}</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar left-panel">
          <section>
            <h2>Vector Motifs</h2>
            <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
              <strong>Drop SVG motifs</strong>
              <span>Visual whitespace is trimmed automatically</span>
              <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            <p className="privacy">Local processing · artwork stays in your browser.</p>
            <div className="asset-list">
              {assets.map((asset) => (
                <div className={`asset-card ${activeAssetId === asset.id ? 'active-asset' : ''}`} key={asset.id} onClick={() => { setActiveAssetId(asset.id); setBuilderTool('paint') }}>
                  <div className="asset-thumb"><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /></div>
                  <div><b>{asset.name}</b><span>{workspaceMode === 'builder' ? 'Active paint motif' : 'Auto layout source'}</span></div>
                  <button className="icon-button" onClick={(e) => { e.stopPropagation(); removeAsset(asset.id) }}>×</button>
                </div>
              ))}
            </div>
          </section>

          {outputMode === 'seamless' && (
            <section>
              <h2>Build Method</h2>
              <div className="tool-switch">
                <button className={workspaceMode === 'auto' ? 'active' : ''} onClick={() => chooseWorkspace('auto')}>Auto Repeat</button>
                <button className={workspaceMode === 'builder' ? 'active' : ''} onClick={() => chooseWorkspace('builder')}>Manual Builder</button>
              </div>
            </section>
          )}

          {outputMode === 'seamless' && workspaceMode === 'auto' && (
            <section>
              <h2>Auto Layout</h2>
              {(['Classic', 'Batik', 'Paisley'] as const).map((group) => (
                <div key={group} className="layout-group">
                  <small>{group}</small>
                  <div className="mode-grid">
                    {modes.filter((item) => item.group === group).map((item) => (
                      <button key={item.id} className={mode === item.id ? 'mode active' : 'mode'} onClick={() => chooseMode(item.id)}><span>{item.group}</span>{item.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {workspaceMode === 'builder' && (
            <>
              <section>
                <h2>Builder Tool</h2>
                <div className="tool-switch">
                  <button className={builderTool === 'paint' ? 'active' : ''} onClick={() => setBuilderTool('paint')}>Paint</button>
                  <button className={builderTool === 'erase' ? 'active' : ''} onClick={() => setBuilderTool('erase')}>Erase</button>
                </div>
              </section>
              <section>
                <h2>Canvas Fill</h2>
                <div className="builder-actions">
                  <button onClick={() => fillBuilder(false)} disabled={!assets.length}>Fill Sequential</button>
                  <button onClick={() => fillBuilder(true)} disabled={!assets.length}>Fill Random</button>
                  <button onClick={clearCenter}>Clear Center</button>
                  <button className="danger-ghost" onClick={() => { setPlacements([]); setSelectedKey(null) }}>Clear All</button>
                </div>
              </section>
            </>
          )}
        </aside>

        <section className="stage-wrap">
          <div className="stage-toolbar">
            <div>
              <b>{outputMode === 'seamless' ? (builderView === 'proof' ? 'Repeat Proof' : 'Master Seamless Tile') : 'Final Canvas'}</b>
              <span>{Math.round(geometry.tileWidth)} × {Math.round(geometry.tileHeight)} · {instances.length} motif instances</span>
            </div>
            <div className="toolbar-checks">
              {outputMode === 'seamless' && (
                <div className="view-switch">
                  <button className={builderView === 'edit' ? 'active' : ''} onClick={() => setBuilderView('edit')}>{workspaceMode === 'builder' ? 'Edit Tile' : 'Master Tile'}</button>
                  <button className={builderView === 'proof' ? 'active' : ''} onClick={() => setBuilderView('proof')}>Repeat Proof</button>
                </div>
              )}
              <label className="check"><input type="checkbox" checked={settings.showBoundary} onChange={(e) => patch('showBoundary', e.target.checked)} /> Tile Guide</label>
            </div>
          </div>

          <div className="stage canvas-stage direct-canvas-stage">
            {!assets.length ? (
              <div className="empty-stage"><div className="empty-mark">✦</div><h1>Build reusable seamless vector patterns</h1><p>Upload SVG motifs, choose Auto Repeat or Manual Builder, inspect the repeat proof, then export one clean seamless SVG tile.</p></div>
            ) : workspaceMode === 'builder' && builderView === 'edit' ? (
              <TileComposer assets={assets} placements={placements} instances={instances} settings={settings} geometry={geometry} selectedKey={selectedKey} activeAssetId={builderTool === 'paint' ? activeAssetId : null} erasing={builderTool === 'erase'} wrapEdges={outputMode === 'seamless'} onCellClick={handleCellClick} />
            ) : (
              <PatternPreview assets={assets} instances={instances} settings={settings} geometry={geometry} copies={outputMode === 'seamless' && builderView === 'proof' ? settings.copies : 1} wrapEdges={outputMode === 'seamless'} />
            )}
          </div>

          <div className="statusbar">
            <span>{message}</span>
            <span className={seamlessReady ? 'seamless-ok' : ''}>{outputMode === 'seamless' ? (seamlessReady ? '✓ Seamless Ready · vector-only' : 'Seamless check pending') : 'Final composition'}</span>
          </div>
        </section>

        <aside className="sidebar right-panel">
          {outputMode === 'seamless' ? (
            <section className="canvas-panel final-first">
              <h2>Master Tile</h2>
              <div className="tile-presets">
                {[800, 1200, 1600, 2000, 3000].map((size) => <button key={size} onClick={() => setSettings((s) => ({ ...s, tileWidth: size, tileHeight: size }))}>{size}</button>)}
              </div>
              <div className="two-col compact">
                <label><span>Width</span><input type="number" min="256" max="12000" value={settings.tileWidth} onChange={(e) => patch('tileWidth', Number(e.target.value))} /></label>
                <label><span>Height</span><input type="number" min="256" max="12000" value={settings.tileHeight} onChange={(e) => patch('tileHeight', Number(e.target.value))} /></label>
              </div>
              {workspaceMode === 'auto' && !isPaisleyFrame(mode) && <label className="option-check"><input type="checkbox" checked={settings.snapTileToGrid} onChange={(e) => patch('snapTileToGrid', e.target.checked)} /><span><b>Exact Grid Tile</b><small>Tile size follows repeat pitch for mathematical seams.</small></span></label>}
              {isPaisleyFrame(mode) && <div className="canvas-summary safe"><b>Panel Repeat</b><span>This scarf/frame composition repeats as a framed tile while keeping the center open.</span></div>}
            </section>
          ) : (
            <section className="canvas-panel final-first">
              <h2>Final Canvas</h2>
              <div className="two-col compact">
                <label><span>Width</span><input type="number" min="256" max="12000" value={exportSettings.width} onChange={(e) => patchExport('width', Number(e.target.value))} /></label>
                <label><span>Height</span><input type="number" min="256" max="12000" value={exportSettings.height} onChange={(e) => patchExport('height', Number(e.target.value))} /></label>
              </div>
            </section>
          )}

          {workspaceMode === 'auto' ? (
            <>
              <section>
                <h2>{currentMode.label}</h2>
                <p className="builder-help">{currentMode.note}</p>
                {!isPaisleyFrame(mode) && <NumberControl label="Motif Size" value={settings.motifSize} min={24} max={520} onChange={(v) => patch('motifSize', v)} />}
                {!isPaisleyFrame(mode) && (
                  <div className="two-col compact">
                    <label><span>Columns</span><input type="number" min="1" max="30" value={settings.columns} onChange={(e) => patch('columns', Number(e.target.value))} /></label>
                    <label><span>Rows</span><input type="number" min="1" max="30" value={settings.rows} onChange={(e) => patch('rows', Number(e.target.value))} /></label>
                  </div>
                )}
                {(mode === 'grid' || mode === 'brick-row' || mode === 'brick-column' || mode === 'hex-row' || mode === 'ceplok' || mode === 'kawung' || mode === 'parang' || mode === 'paisley-allover') && (
                  <>
                    <div className="spacing-presets">{SPACING_PRESETS.map((item) => <button key={item.id} onClick={() => applySpacingPreset(item.id)}>{item.label}</button>)}</div>
                    <NumberControl label="Horizontal Gap" value={settings.hSpacing} min={-200} max={300} onChange={(v) => patch('hSpacing', v)} />
                    <NumberControl label="Vertical Gap" value={settings.vSpacing} min={-200} max={300} onChange={(v) => patch('vSpacing', v)} />
                  </>
                )}
                {mode === 'parang' && (
                  <>
                    <NumberControl label="Parang Angle" value={settings.parangAngle ?? -45} min={-75} max={75} suffix="°" onChange={(v) => patch('parangAngle', v)} />
                    <NumberControl label="Row Offset" value={Math.round((settings.parangRowOffset ?? 0.5) * 100)} min={0} max={100} suffix="%" onChange={(v) => patch('parangRowOffset', v / 100)} />
                  </>
                )}
                {mode === 'paisley-allover' && <NumberControl label="Alternate Rotation" value={settings.paisleyAlternateRotation ?? 180} min={0} max={360} suffix="°" onChange={(v) => patch('paisleyAlternateRotation', v)} />}
                {isPaisleyFrame(mode) && (
                  <>
                    <NumberControl label="Border Width" value={settings.paisleyBorderWidth ?? 230} min={60} max={600} onChange={(v) => patch('paisleyBorderWidth', v)} />
                    <NumberControl label="Edge Density" value={settings.paisleyEdgeDensity ?? 7} min={2} max={16} onChange={(v) => patch('paisleyEdgeDensity', v)} />
                    <NumberControl label="Corner Scale" value={settings.paisleyCornerScale ?? 145} min={70} max={260} suffix="%" onChange={(v) => patch('paisleyCornerScale', v)} />
                    {(mode === 'paisley-center' || mode === 'paisley-border-center') && <NumberControl label="Center Scale" value={settings.paisleyCenterScale ?? 220} min={60} max={360} suffix="%" onChange={(v) => patch('paisleyCenterScale', v)} />}
                    {(mode === 'paisley-center' || mode === 'paisley-border-center') && <NumberControl label="Center Accents" value={settings.paisleyCenterDensity ?? 6} min={0} max={12} onChange={(v) => patch('paisleyCenterDensity', v)} />}
                    <label className="option-check"><input type="checkbox" checked={settings.paisleyInward ?? true} onChange={(e) => patch('paisleyInward', e.target.checked)} /><span><b>Point Inward</b><small>Orient edge and corner paisleys toward the center.</small></span></label>
                  </>
                )}
              </section>
            </>
          ) : (
            <>
              <section>
                <h2>Grid Across Tile</h2>
                <div className="grid-presets">
                  <button onClick={() => setSettings((s) => ({ ...s, columns: 4, rows: 4 }))}>4×4</button>
                  <button onClick={() => setSettings((s) => ({ ...s, columns: 6, rows: 6 }))}>6×6</button>
                  <button onClick={() => setSettings((s) => ({ ...s, columns: 8, rows: 8 }))}>8×8</button>
                  <button onClick={() => setSettings((s) => ({ ...s, columns: 10, rows: 10 }))}>10×10</button>
                </div>
                <div className="two-col compact">
                  <label><span>Columns</span><input type="number" min="1" max="24" value={settings.columns} onChange={(e) => patch('columns', Number(e.target.value))} /></label>
                  <label><span>Rows</span><input type="number" min="1" max="24" value={settings.rows} onChange={(e) => patch('rows', Number(e.target.value))} /></label>
                </div>
                <div className="spacing-presets">{SPACING_PRESETS.map((item) => <button key={item.id} onClick={() => applySpacingPreset(item.id)}>{item.label}</button>)}</div>
                <NumberControl label="Horizontal Gap" value={settings.hSpacing} min={-200} max={240} onChange={(v) => patch('hSpacing', v)} />
                <NumberControl label="Vertical Gap" value={settings.vSpacing} min={-200} max={240} onChange={(v) => patch('vSpacing', v)} />
              </section>

              <section>
                <h2>Selected Block</h2>
                {selectedPlacement ? (
                  <>
                    <SelectRow label="Motif" value={selectedPlacement.assetId} onChange={(v) => updateSelected({ assetId: v })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</SelectRow>
                    <div className="span-control">
                      <div className="span-heading"><span>Block Span</span><b>{currentSpanCols}×{currentSpanRows}</b></div>
                      <div className="span-buttons">
                        <button className={currentSpanCols === 1 && currentSpanRows === 1 ? 'active' : ''} onClick={() => setSelectedSpan(1, 1)}>1×1</button>
                        <button className={currentSpanCols === 2 && currentSpanRows === 1 ? 'active' : ''} onClick={() => setSelectedSpan(2, 1)}>1×2 H</button>
                        <button className={currentSpanCols === 1 && currentSpanRows === 2 ? 'active' : ''} onClick={() => setSelectedSpan(1, 2)}>1×2 V</button>
                        <button className={currentSpanCols === 2 && currentSpanRows === 2 ? 'active' : ''} onClick={() => setSelectedSpan(2, 2)}>2×2</button>
                      </div>
                    </div>
                    <NumberControl label="Scale" value={selectedPlacement.scale} min={20} max={300} suffix="%" onChange={(v) => updateSelected({ scale: v })} />
                    <NumberControl label="Rotation" value={selectedPlacement.rotation} min={-180} max={180} suffix="°" onChange={(v) => updateSelected({ rotation: v })} />
                    <NumberControl label="Offset X" value={selectedPlacement.offsetX} min={-500} max={500} onChange={(v) => updateSelected({ offsetX: v })} />
                    <NumberControl label="Offset Y" value={selectedPlacement.offsetY} min={-500} max={500} onChange={(v) => updateSelected({ offsetY: v })} />
                    <div className="transform-buttons">
                      <button className={selectedPlacement.flipX ? 'active' : ''} onClick={() => updateSelected({ flipX: !selectedPlacement.flipX })}>Flip H</button>
                      <button className={selectedPlacement.flipY ? 'active' : ''} onClick={() => updateSelected({ flipY: !selectedPlacement.flipY })}>Flip V</button>
                    </div>
                  </>
                ) : <p className="builder-help">Select any occupied cell to edit its motif block.</p>}
              </section>
            </>
          )}

          {outputMode === 'seamless' && (
            <section className={seamlessReady ? 'seamless-validator ready' : 'seamless-validator'}>
              <h2>Seamless Validator</h2>
              <b>{seamlessReady ? '✓ Seamless Ready' : 'Check Required'}</b>
              <span>Edge wrapping: ON</span>
              <span>Vector-only assets: {vectorOnly ? 'YES' : 'CHECK'}</span>
              <span>Empty center / copy space: ALLOWED</span>
              {isPaisleyFrame(mode) && workspaceMode === 'auto' && <small>Scarf layouts repeat as framed panels. Use the exported tile for panel-repeat products or the Canvas Composer for a one-off scarf artwork.</small>}
            </section>
          )}

          <section>
            <h2>Preview Export</h2>
            <SelectRow label="Preset" value={exportPresetId} onChange={applyExportPreset}>
              <option value="custom">Custom</option>
              {EXPORT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.width}×{item.height}</option>)}
            </SelectRow>
            <div className="two-col compact">
              <label><span>Width</span><input type="number" min="512" max="12000" value={exportSettings.width} onChange={(e) => patchExport('width', Number(e.target.value))} /></label>
              <label><span>Height</span><input type="number" min="512" max="12000" value={exportSettings.height} onChange={(e) => patchExport('height', Number(e.target.value))} /></label>
            </div>
            <button className="wide-export" onClick={exportPreview} disabled={!instances.length || exporting}>{exporting ? 'Rendering…' : 'Export PNG Preview'}</button>
            {outputMode === 'seamless' && (
              <SelectRow label="Proof Copies" value={String(settings.copies)} onChange={(v) => patch('copies', Number(v))}>
                <option value="2">2 × 2</option><option value="3">3 × 3</option><option value="5">5 × 5</option><option value="7">7 × 7</option>
              </SelectRow>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}
