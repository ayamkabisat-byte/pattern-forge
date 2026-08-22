import { useMemo, useRef, useState } from 'react'
import TextLayerSvg from './components/TextLayerSvg'
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
import { parseSvgAsset } from './engine/svg'
import { FONT_REGISTRY, SCRIPT_DEFAULTS, SCRIPT_LABELS, fontByFamily, fontsForScript } from './fontRegistry'
import { EXPORT_PRESETS, SPACING_PRESETS } from './exportPresets'
import type {
  BuilderTool,
  BuilderView,
  CanvasMode,
  ExportSettings,
  PatternGeometry,
  PatternInstance,
  PatternSettings,
  RepeatMode,
  SvgAsset,
  TextAlign,
  TextLayer,
  TextScript,
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
  hSpacing: 0,
  vSpacing: 0,
  paddingX: 4,
  paddingY: 4,
  alignX: 'center',
  alignY: 'middle',
  columns: 7,
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
  canvasMode: 'full-bleed',
  proofCopies: 3,
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

const textScripts: TextScript[] = ['latin', 'devanagari', 'arabic', 'zh-hans', 'korean', 'japanese']

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Instance({ item, asset, opacity = 1 }: { item: PatternInstance; asset: SvgAsset; opacity?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g opacity={opacity} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function ProofPreview({ assets, instances, settings, geometry, textLayers = [] }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings; geometry: PatternGeometry; textLayers?: TextLayer[] }) {
  const copies = settings.copies
  const w = geometry.tileWidth
  const h = geometry.tileHeight
  const tiles: JSX.Element[] = []

  for (let row = 0; row < copies; row++) {
    for (let col = 0; col < copies; col++) {
      const center = row === Math.floor(copies / 2) && col === Math.floor(copies / 2)
      const opacity = center || !settings.dimCopies ? 1 : settings.dimCopiesPercent / 100
      tiles.push(
        <g key={`${row}-${col}`} transform={`translate(${col * w} ${row * h})`} opacity={opacity}>
          <rect width={w} height={h} fill={settings.background} />
          {instances.map((item) => {
            const asset = assets[item.assetIndex]
            return asset ? <Instance key={`${row}-${col}-${item.key}`} item={item} asset={asset} /> : null
          })}
          {textLayers.map((layer) => <TextLayerSvg key={`${row}-${col}-${layer.id}`} layer={layer} />)}
        </g>,
      )
    }
  }

  return (
    <svg className="proof" viewBox={`0 0 ${w * copies} ${h * copies}`} aria-label="Canvas repeat proof">
      {tiles}
      {settings.showBoundary && <rect x={Math.floor(copies / 2) * w} y={Math.floor(copies / 2) * h} width={w} height={h} className="tile-boundary" />}
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

function makeTextLayer(script: TextScript, width: number, height: number, index: number): TextLayer {
  const preset = SCRIPT_DEFAULTS[script]
  const font = fontByFamily(preset.fontFamily, script)
  const fontSize = Math.max(48, Math.round(Math.min(width, height) * 0.13))
  const preferredWeight = font?.weights.includes(700) ? 700 : font?.weights[font.weights.length - 1] ?? 400
  return {
    id: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
    name: `${SCRIPT_LABELS[script]} ${index}`,
    text: preset.text,
    script,
    fontFamily: preset.fontFamily,
    fontSize,
    fontWeight: preferredWeight,
    fill: '#328746',
    x: width / 2,
    y: height / 2,
    rotation: 0,
    letterSpacing: script === 'latin' ? 4 : 0,
    lineHeight: 1.12,
    align: 'center',
    direction: preset.direction,
    opacity: 1,
  }
}

export default function App() {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [mode, setMode] = useState<RepeatMode>('grid')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('builder')
  const [builderView, setBuilderView] = useState<BuilderView>('edit')
  const [builderTool, setBuilderTool] = useState<BuilderTool>('paint')
  const [placements, setPlacements] = useState<TileCellPlacement[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [textLayers, setTextLayers] = useState<TextLayer[]>([])
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PatternSettings>(initialSettings)
  const [exportSettings, setExportSettings] = useState<ExportSettings>(initialExport)
  const [exportPresetId, setExportPresetId] = useState('web-hd')
  const [message, setMessage] = useState('v0.7: add multilingual greeting text directly on the final SVG canvas.')
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const finalCanvasTile = useMemo(() => ({ mode: 'custom' as const, width: exportSettings.width, height: exportSettings.height, cellShape: 'square' as const }), [exportSettings.width, exportSettings.height])
  const autoGeometry = useMemo(() => patternGeometry(mode, assets, settings), [mode, assets, settings])
  const autoInstances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])
  const builderResult = useMemo(() => generateBuilderPattern(placements, assets, settings, finalCanvasTile), [placements, assets, settings, finalCanvasTile])
  const geometry = workspaceMode === 'builder' ? builderResult.geometry : autoGeometry
  const instances = workspaceMode === 'builder' ? builderResult.instances : autoInstances
  const selectedPlacement = placements.find((item) => item.key === selectedKey) ?? null
  const selectedText = textLayers.find((item) => item.id === selectedTextId) ?? null
  const selectedFont = selectedText ? fontByFamily(selectedText.fontFamily, selectedText.script) : null

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const patchExport = <K extends keyof ExportSettings>(key: K, value: ExportSettings[K]) => {
    setExportSettings((current) => ({ ...current, [key]: value }))
    if (key === 'width' || key === 'height') setExportPresetId('custom')
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('PatternForge currently accepts SVG vector motif files.')
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

  function enterBuilder() {
    setWorkspaceMode('builder')
    setBuilderView('edit')
    if (!placements.length && assets.length) {
      const g = builderGeometry(assets, settings, finalCanvasTile)
      setPlacements(fillSequential(assets, g))
      setSelectedKey(cellKey(0, 0))
    }
  }

  function handleCellClick(row: number, col: number) {
    setSelectedTextId(null)
    const owner = findPlacementCoveringCell(placements, row, col)
    if (builderTool === 'erase') {
      if (owner) {
        setPlacements((items) => items.filter((item) => item.key !== owner.key))
        if (selectedKey === owner.key) setSelectedKey(null)
        setMessage(`Removed ${spanCols(owner)}×${spanRows(owner)} block.`)
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
      setMessage(`A ${cols}×${rows} block does not fit from this anchor cell.`)
      return
    }

    const targetCells: Array<[number, number]> = []
    for (let row = selectedPlacement.row; row < selectedPlacement.row + rows; row++) {
      for (let col = selectedPlacement.col; col < selectedPlacement.col + cols; col++) targetCells.push([row, col])
    }

    setPlacements((items) => {
      const withoutCoveredNeighbors = items.filter((item) => {
        if (item.key === selectedKey) return true
        return !targetCells.some(([row, col]) => placementCoversCell(item, row, col))
      })
      return withoutCoveredNeighbors.map((item) => item.key === selectedKey ? { ...item, spanCols: cols, spanRows: rows } : item)
    })
    setMessage(`${cols}×${rows} block created.`)
  }

  function clearSelected() {
    if (!selectedKey) return
    setPlacements((items) => items.filter((item) => item.key !== selectedKey))
    setSelectedKey(null)
  }

  function clearCenter() {
    const centerRows = geometry.rows % 2 === 1 ? [Math.floor(geometry.rows / 2)] : [geometry.rows / 2 - 1, geometry.rows / 2]
    const centerCols = geometry.columns % 2 === 1 ? [Math.floor(geometry.columns / 2)] : [geometry.columns / 2 - 1, geometry.columns / 2]
    const centerCells = centerRows.flatMap((row) => centerCols.map((col) => [row, col] as [number, number]))
    setPlacements((items) => items.filter((item) => !centerCells.some(([row, col]) => placementCoversCell(item, row, col))))
    setSelectedKey(null)
  }

  function fillBuilderSequential() {
    const g = builderGeometry(assets, settings, finalCanvasTile)
    setPlacements(fillSequential(assets, g))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
    setSelectedTextId(null)
    setMessage('Canvas filled with 1×1 blocks. Clear or merge blocks to create greeting space.')
  }

  function fillBuilderRandom() {
    const g = builderGeometry(assets, settings, finalCanvasTile)
    setPlacements(fillRandom(assets, g, settings.seed))
    setSelectedKey(assets.length ? cellKey(0, 0) : null)
    setSelectedTextId(null)
    setMessage('Random 1×1 fill created.')
  }

  function addText(script: TextScript = 'latin') {
    const layer = makeTextLayer(script, exportSettings.width, exportSettings.height, textLayers.length + 1)
    setTextLayers((items) => [...items, layer])
    setSelectedTextId(layer.id)
    setSelectedKey(null)
    setBuilderView('edit')
    setWorkspaceMode('builder')
    setMessage(`${SCRIPT_LABELS[script]} text layer added. Browser shaping keeps complex scripts joined correctly.`)
  }

  function updateText(value: Partial<TextLayer>) {
    if (!selectedTextId) return
    setTextLayers((items) => items.map((item) => item.id === selectedTextId ? { ...item, ...value } : item))
  }

  function selectText(id: string) {
    setSelectedTextId(id)
    setSelectedKey(null)
  }

  function deleteSelectedText() {
    if (!selectedTextId) return
    setTextLayers((items) => items.filter((item) => item.id !== selectedTextId))
    setSelectedTextId(null)
  }

  function duplicateSelectedText() {
    if (!selectedText) return
    const copy: TextLayer = {
      ...selectedText,
      id: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
      name: `${selectedText.name} Copy`,
      x: selectedText.x + 30,
      y: selectedText.y + 30,
    }
    setTextLayers((items) => [...items, copy])
    setSelectedTextId(copy.id)
  }

  function setTextScript(script: TextScript) {
    if (!selectedText) return
    const preset = SCRIPT_DEFAULTS[script]
    const font = fontByFamily(preset.fontFamily, script)
    updateText({
      script,
      fontFamily: preset.fontFamily,
      fontWeight: font?.weights.includes(700) ? 700 : font?.weights[font.weights.length - 1] ?? 400,
      direction: preset.direction,
      letterSpacing: script === 'latin' ? selectedText.letterSpacing : 0,
    })
  }

  function useGreetingPreset(script: TextScript) {
    if (!selectedText) {
      addText(script)
      return
    }
    const preset = SCRIPT_DEFAULTS[script]
    const font = fontByFamily(preset.fontFamily, script)
    updateText({
      text: preset.text,
      script,
      fontFamily: preset.fontFamily,
      fontWeight: font?.weights.includes(700) ? 700 : font?.weights[font.weights.length - 1] ?? 400,
      direction: preset.direction,
      letterSpacing: script === 'latin' ? 4 : 0,
    })
  }

  function applySpacingPreset(id: string) {
    const preset = SPACING_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setSettings((current) => ({ ...current, hSpacing: preset.h, vSpacing: preset.v, paddingX: preset.px, paddingY: preset.py }))
  }

  function applyGridPreset(columns: number, rows = columns) {
    setSettings((current) => ({ ...current, columns, rows }))
  }

  function applyExportPreset(id: string) {
    const preset = EXPORT_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setExportPresetId(id)
    setExportSettings((current) => ({ ...current, width: preset.width, height: preset.height }))
  }

  function composerSvg() {
    return buildComposerSvg(assets, builderResult.instances, settings.background, builderResult.geometry, textLayers)
  }

  function exportSvg() {
    if (workspaceMode === 'builder') {
      if (!instances.length && !textLayers.length) return
      downloadBlob(new Blob([composerSvg()], { type: 'image/svg+xml;charset=utf-8' }), `patternforge-canvas-${exportSettings.width}x${exportSettings.height}.svg`)
      setMessage('SVG exported with editable Unicode text. Outline-to-path export is scheduled for v0.7.1.')
      return
    }
    if (!instances.length) return
    const svg = buildSvg(mode, assets, instances, settings)
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `patternforge-${mode}.svg`)
  }

  async function exportPng() {
    if ((!instances.length && !textLayers.length) || exporting) return
    setExporting(true)
    try {
      if ('fonts' in document) await document.fonts.ready
      if (workspaceMode === 'builder') {
        const png = await canvasAwarePng(composerSvg(), exportSettings.width, exportSettings.height, exportSettings.width, exportSettings.height, 100, 'single-tile', 3, settings.background)
        downloadBlob(png, `patternforge-canvas-${exportSettings.width}x${exportSettings.height}.png`)
      } else {
        const svg = buildSvg(mode, assets, instances, settings)
        const png = await canvasAwarePng(svg, autoGeometry.tileWidth, autoGeometry.tileHeight, exportSettings.width, exportSettings.height, exportSettings.tileScale, exportSettings.canvasMode ?? 'full-bleed', exportSettings.proofCopies ?? 3, settings.background)
        downloadBlob(png, `patternforge-${mode}-${exportSettings.width}x${exportSettings.height}.png`)
      }
      setMessage(`Exported ${exportSettings.width} × ${exportSettings.height}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  const isBrick = mode === 'brick-row' || mode === 'brick-column'
  const regularMode = mode !== 'toss'
  const currentSpanCols = selectedPlacement ? spanCols(selectedPlacement) : 1
  const currentSpanRows = selectedPlacement ? spanRows(selectedPlacement) : 1
  const canExportBuilder = instances.length > 0 || textLayers.length > 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand"><span>PF</span> PatternForge <small>v0.7</small></div>
          <p>Canvas Composer · Block Span · Multilingual Typography · SVG-first</p>
        </div>
        <div className="workspace-switch">
          <button className={workspaceMode === 'auto' ? 'active' : ''} onClick={() => setWorkspaceMode('auto')}>Auto Repeat</button>
          <button className={workspaceMode === 'builder' ? 'active' : ''} onClick={enterBuilder}>Canvas Builder</button>
        </div>
        <div className="top-actions">
          <button onClick={exportSvg} disabled={workspaceMode === 'builder' ? !canExportBuilder : !instances.length}>Export SVG</button>
          <button className="accent" onClick={exportPng} disabled={(workspaceMode === 'builder' ? !canExportBuilder : !instances.length) || exporting}>{exporting ? 'Rendering…' : 'Export PNG'}</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar left-panel">
          <section>
            <h2>Assets</h2>
            <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
              <strong>Drop SVG motifs</strong>
              <span>SVG visual whitespace is trimmed automatically</span>
              <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            <p className="privacy">Local motif processing · artwork stays in your browser.</p>
            <div className="asset-list">
              {assets.map((asset, index) => (
                <div className={`asset-card ${workspaceMode === 'builder' && builderTool === 'paint' && activeAssetId === asset.id ? 'active-asset' : ''}`} key={asset.id} onClick={() => { if (workspaceMode === 'builder') { setBuilderTool('paint'); setActiveAssetId(asset.id); setSelectedTextId(null) } }}>
                  <div className="asset-thumb"><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /></div>
                  <div><b>{asset.name}</b><span>{workspaceMode === 'builder' ? 'Click to paint / replace a block' : `Motif ${index + 1}`}</span></div>
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
                  <button className={builderTool === 'paint' && !selectedTextId ? 'active' : ''} onClick={() => { setBuilderTool('paint'); setSelectedTextId(null) }}>Paint</button>
                  <button className={builderTool === 'erase' && !selectedTextId ? 'active' : ''} onClick={() => { setBuilderTool('erase'); setSelectedTextId(null) }}>Erase Block</button>
                </div>
              </section>

              <section>
                <h2>Add Greeting Text</h2>
                <div className="text-add-grid">
                  {textScripts.map((script) => <button key={script} onClick={() => addText(script)}>{SCRIPT_LABELS[script]}</button>)}
                </div>
                {textLayers.length > 0 && (
                  <div className="text-layer-list">
                    {textLayers.map((layer) => (
                      <div key={layer.id} className={`text-layer-card ${selectedTextId === layer.id ? 'active' : ''}`} onClick={() => selectText(layer.id)}>
                        <div><b>{layer.text.replace(/\s+/g, ' ') || 'Empty text'}</b><span>{layer.fontFamily} · {Math.round(layer.fontSize)}px</span></div>
                        <span className="text-layer-badge">{layer.script}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2>Canvas Fill</h2>
                <div className="builder-actions">
                  <button onClick={fillBuilderSequential} disabled={!assets.length}>Fill Sequential</button>
                  <button onClick={fillBuilderRandom} disabled={!assets.length}>Fill Random</button>
                  <button onClick={clearCenter}>Clear Center</button>
                  <button className="danger-ghost" onClick={() => { setPlacements([]); setSelectedKey(null) }}>Clear Pattern</button>
                </div>
                <p className="builder-help">Clear or merge pattern cells to create negative space, then place multilingual text directly in that area.</p>
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
              <b>{workspaceMode === 'builder' ? (builderView === 'proof' ? 'Canvas Repeat Proof' : 'Edit Final Canvas') : 'Live Seamless Proof'}</b>
              <span>{workspaceMode === 'builder' ? `${exportSettings.width} × ${exportSettings.height} · ${textLayers.length} text layer${textLayers.length === 1 ? '' : 's'}` : `tile ${Math.round(geometry.tileWidth)} × ${Math.round(geometry.tileHeight)}`}</span>
            </div>
            <div className="toolbar-checks">
              {workspaceMode === 'builder' && (
                <div className="view-switch">
                  <button className={builderView === 'edit' ? 'active' : ''} onClick={() => setBuilderView('edit')}>Edit Canvas</button>
                  <button className={builderView === 'proof' ? 'active' : ''} onClick={() => setBuilderView('proof')}>Repeat Proof</button>
                </div>
              )}
              <label className="check"><input type="checkbox" checked={settings.showBoundary} onChange={(e) => patch('showBoundary', e.target.checked)} /> Guides</label>
            </div>
          </div>

          <div className="stage canvas-stage direct-canvas-stage">
            {!assets.length && !textLayers.length ? (
              <div className="empty-stage"><div className="empty-mark">✦</div><h1>Build a vector greeting composition</h1><p>Upload SVG motifs or add a multilingual text layer. Canvas Builder exports the same final artboard to SVG.</p></div>
            ) : workspaceMode === 'builder' && builderView === 'edit' ? (
              <TileComposer
                assets={assets}
                placements={placements}
                instances={instances}
                settings={settings}
                geometry={geometry}
                selectedKey={selectedKey}
                activeAssetId={builderTool === 'paint' && !selectedTextId ? activeAssetId : null}
                erasing={builderTool === 'erase' && !selectedTextId}
                wrapEdges={false}
                textLayers={textLayers}
                selectedTextId={selectedTextId}
                onTextSelect={selectText}
                onCellClick={handleCellClick}
              />
            ) : (
              <ProofPreview assets={assets} instances={instances} settings={settings} geometry={geometry} textLayers={workspaceMode === 'builder' ? textLayers : []} />
            )}
          </div>

          <div className="statusbar">
            <span>{message}</span>
            <span>{workspaceMode === 'builder' ? `${placements.length} pattern blocks · ${textLayers.length} text layers · square cell ${Math.round(geometry.cellWidth)}px` : `${instances.length} generated motifs`}</span>
          </div>
        </section>

        <aside className="sidebar right-panel">
          <section className="canvas-panel final-first">
            <h2>Final Canvas / Editor Size</h2>
            <SelectRow label="Preset" value={exportPresetId} onChange={applyExportPreset}>
              <option value="custom">Custom</option>
              {['Logo', 'Web', 'Social', 'Stock', 'Print'].map((group) => (
                <optgroup key={group} label={group}>{EXPORT_PRESETS.filter((item) => item.group === group).map((item) => <option key={item.id} value={item.id}>{item.label} — {item.width}×{item.height}</option>)}</optgroup>
              ))}
            </SelectRow>
            <div className="two-col compact">
              <label><span>Width</span><input type="number" min="128" max="12000" value={exportSettings.width} onChange={(e) => patchExport('width', Number(e.target.value))} /></label>
              <label><span>Height</span><input type="number" min="128" max="12000" value={exportSettings.height} onChange={(e) => patchExport('height', Number(e.target.value))} /></label>
            </div>
            {workspaceMode === 'builder' && <div className="canvas-summary safe"><b>SVG-first Composition</b><span>Pattern blocks and Unicode text share the same final {exportSettings.width} × {exportSettings.height} artboard.</span></div>}
          </section>

          {workspaceMode === 'builder' && selectedText ? (
            <section className="text-editor">
              <h2>Selected Text</h2>
              <textarea value={selectedText.text} dir={selectedText.direction} onChange={(e) => updateText({ text: e.target.value })} />

              <SelectRow label="Script" value={selectedText.script} onChange={(value) => setTextScript(value as TextScript)}>
                {textScripts.map((script) => <option key={script} value={script}>{SCRIPT_LABELS[script]}</option>)}
              </SelectRow>

              <SelectRow label="Font" value={selectedText.fontFamily} onChange={(value) => {
                const font = fontByFamily(value, selectedText.script)
                updateText({ fontFamily: value, fontWeight: font?.weights.includes(selectedText.fontWeight) ? selectedText.fontWeight : font?.weights[font.weights.length - 1] ?? 400 })
              }}>
                {fontsForScript(selectedText.script).map((font) => <option key={font.id} value={font.family}>{font.label} · {font.category}</option>)}
              </SelectRow>

              <SelectRow label="Weight" value={String(selectedText.fontWeight)} onChange={(value) => updateText({ fontWeight: Number(value) })}>
                {(selectedFont?.weights ?? [400]).map((weight) => <option key={weight} value={weight}>{weight}</option>)}
              </SelectRow>

              <div className="font-license-box"><b>{selectedFont?.license ?? 'SIL OFL 1.1'}</b><br />{selectedFont?.source ?? 'Curated open font'} · commercial artwork permitted. Font license notices remain with PatternForge; your exported artwork is not relicensed as OFL.</div>

              <div className="script-preset-grid">
                {textScripts.map((script) => <button key={script} onClick={() => useGreetingPreset(script)}>{SCRIPT_DEFAULTS[script].text}</button>)}
              </div>

              <NumberControl label="Font Size" value={selectedText.fontSize} min={18} max={800} onChange={(v) => updateText({ fontSize: v })} />
              <NumberControl label="Tracking" value={selectedText.letterSpacing} min={-10} max={60} onChange={(v) => updateText({ letterSpacing: v })} />
              <NumberControl label="Line Height" value={selectedText.lineHeight} min={0.7} max={2} step={0.05} onChange={(v) => updateText({ lineHeight: v })} />
              <NumberControl label="Rotation" value={selectedText.rotation} min={-180} max={180} onChange={(v) => updateText({ rotation: v })} />
              <NumberControl label="Opacity" value={Math.round(selectedText.opacity * 100)} min={10} max={100} suffix="%" onChange={(v) => updateText({ opacity: v / 100 })} />

              <label className="color-row"><span>Text Color</span><input type="color" value={selectedText.fill} onChange={(e) => updateText({ fill: e.target.value })} /></label>

              <div className="text-align-buttons">
                {(['left', 'center', 'right'] as TextAlign[]).map((align) => <button key={align} className={selectedText.align === align ? 'active' : ''} onClick={() => updateText({ align })}>{align}</button>)}
              </div>

              <div className="text-position-grid">
                <label><span>X</span><input type="number" min={-2000} max={exportSettings.width + 2000} value={Math.round(selectedText.x)} onChange={(e) => updateText({ x: Number(e.target.value) })} /></label>
                <label><span>Y</span><input type="number" min={-2000} max={exportSettings.height + 2000} value={Math.round(selectedText.y)} onChange={(e) => updateText({ y: Number(e.target.value) })} /></label>
              </div>

              <div className="text-inline-actions">
                <button onClick={() => updateText({ x: exportSettings.width / 2, y: exportSettings.height / 2 })}>Center</button>
                <button onClick={duplicateSelectedText}>Duplicate</button>
                <button className="danger-ghost" onClick={deleteSelectedText}>Delete</button>
              </div>

              <p className="export-text-warning">Arabic and Devanagari are shaped by the browser while editing. v0.7 exports editable Unicode SVG text. Final text-to-path outlining with HarfBuzz shaping is reserved for v0.7.1 so complex scripts are not broken.</p>
            </section>
          ) : (
            <>
              <section>
                <h2>Grid Across Canvas</h2>
                <div className="grid-presets">
                  <button onClick={() => applyGridPreset(4, 4)}>4×4</button>
                  <button onClick={() => applyGridPreset(7, 4)}>7×4</button>
                  <button onClick={() => applyGridPreset(8, 6)}>8×6</button>
                  <button onClick={() => applyGridPreset(12, 7)}>12×7</button>
                </div>
                <div className="two-col compact">
                  <label><span>Columns</span><input type="number" min="1" max="24" value={settings.columns} onChange={(e) => patch('columns', Number(e.target.value))} /></label>
                  <label><span>Rows</span><input type="number" min="1" max="24" value={settings.rows} onChange={(e) => patch('rows', Number(e.target.value))} /></label>
                </div>
                <div className="computed-box"><span>Square cell</span><b>{Math.round(geometry.cellWidth)} × {Math.round(geometry.cellHeight)}</b></div>
                <div className="spacing-presets">{SPACING_PRESETS.map((item) => <button key={item.id} onClick={() => applySpacingPreset(item.id)}>{item.label}</button>)}</div>
                <NumberControl label="Inner Padding X" value={settings.paddingX} min={0} max={120} onChange={(v) => patch('paddingX', v)} />
                <NumberControl label="Inner Padding Y" value={settings.paddingY} min={0} max={120} onChange={(v) => patch('paddingY', v)} />
                <NumberControl label="Horizontal Gap" value={settings.hSpacing} min={-200} max={240} onChange={(v) => patch('hSpacing', v)} />
                <NumberControl label="Vertical Gap" value={settings.vSpacing} min={-200} max={240} onChange={(v) => patch('vSpacing', v)} />
              </section>

              {workspaceMode === 'builder' ? (
                <section>
                  <h2>Selected Block</h2>
                  {selectedPlacement ? (
                    <>
                      <SelectRow label="Motif" value={selectedPlacement.assetId} onChange={(v) => updateSelected({ assetId: v })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</SelectRow>
                      <div className="span-control">
                        <div className="span-heading"><span>Block Span</span><b>{currentSpanCols}×{currentSpanRows}</b></div>
                        <div className="span-buttons">
                          <button className={currentSpanCols === 1 && currentSpanRows === 1 ? 'active' : ''} onClick={() => setSelectedSpan(1, 1)}>1×1</button>
                          <button className={currentSpanCols === 2 && currentSpanRows === 1 ? 'active' : ''} disabled={!spanFitsGrid(selectedPlacement.row, selectedPlacement.col, 2, 1, geometry)} onClick={() => setSelectedSpan(2, 1)}>1×2 H</button>
                          <button className={currentSpanCols === 1 && currentSpanRows === 2 ? 'active' : ''} disabled={!spanFitsGrid(selectedPlacement.row, selectedPlacement.col, 1, 2, geometry)} onClick={() => setSelectedSpan(1, 2)}>1×2 V</button>
                          <button className={currentSpanCols === 2 && currentSpanRows === 2 ? 'active' : ''} disabled={!spanFitsGrid(selectedPlacement.row, selectedPlacement.col, 2, 2, geometry)} onClick={() => setSelectedSpan(2, 2)}>2×2</button>
                        </div>
                      </div>
                      <NumberControl label="Scale" value={selectedPlacement.scale} min={20} max={300} suffix="%" onChange={(v) => updateSelected({ scale: v })} />
                      <NumberControl label="Rotation" value={selectedPlacement.rotation} min={-180} max={180} onChange={(v) => updateSelected({ rotation: v })} />
                      <NumberControl label="Offset X" value={selectedPlacement.offsetX} min={-300} max={300} onChange={(v) => updateSelected({ offsetX: v })} />
                      <NumberControl label="Offset Y" value={selectedPlacement.offsetY} min={-300} max={300} onChange={(v) => updateSelected({ offsetY: v })} />
                      <div className="transform-buttons">
                        <button className={selectedPlacement.flipX ? 'active' : ''} onClick={() => updateSelected({ flipX: !selectedPlacement.flipX })}>Flip H</button>
                        <button className={selectedPlacement.flipY ? 'active' : ''} onClick={() => updateSelected({ flipY: !selectedPlacement.flipY })}>Flip V</button>
                        <button className="danger-ghost" onClick={clearSelected}>Empty Block</button>
                      </div>
                    </>
                  ) : <p className="builder-help">Click a pattern block to edit it, or add a text layer from the left panel.</p>}
                </section>
              ) : regularMode ? (
                <section>
                  <h2>Auto Repeat Motif</h2>
                  <NumberControl label="Motif size" value={settings.motifSize} min={24} max={320} onChange={(v) => patch('motifSize', v)} />
                  <NumberControl label="Rotation" value={settings.rotation} min={-180} max={180} onChange={(v) => patch('rotation', v)} />
                  {isBrick && <SelectRow label="Brick Offset" value={settings.brickOffset} onChange={(v) => patch('brickOffset', v as PatternSettings['brickOffset'])}><option value="1/4">1/4</option><option value="1/3">1/3</option><option value="1/2">1/2</option><option value="2/3">2/3</option><option value="3/4">3/4</option></SelectRow>}
                </section>
              ) : null}
            </>
          )}

          {workspaceMode === 'auto' && (
            <section>
              <h2>Auto Export Fill</h2>
              <SelectRow label="Fit Mode" value={exportSettings.canvasMode ?? 'full-bleed'} onChange={(v) => patchExport('canvasMode', v as CanvasMode)}>
                <option value="full-bleed">Full Bleed</option>
                <option value="fit-full-tiles">Fit Full Tiles</option>
                <option value="single-tile">Single Tile</option>
                <option value="proof">Proof</option>
              </SelectRow>
              <NumberControl label="Pattern scale" value={exportSettings.tileScale} min={25} max={300} suffix="%" onChange={(v) => patchExport('tileScale', v)} />
            </section>
          )}

          <section>
            <h2>Proof</h2>
            <SelectRow label="Copies" value={String(settings.copies)} onChange={(v) => patch('copies', Number(v))}><option value="3">3 × 3</option><option value="5">5 × 5</option><option value="7">7 × 7</option></SelectRow>
            <label className="option-check"><input type="checkbox" checked={settings.dimCopies} onChange={(e) => patch('dimCopies', e.target.checked)} /><span><b>Dim Copies</b><small>Highlights the center canvas in repeat proof.</small></span></label>
            {settings.dimCopies && <NumberControl label="Copy opacity" value={settings.dimCopiesPercent} min={10} max={100} suffix="%" onChange={(v) => patch('dimCopiesPercent', v)} />}
          </section>

          <section className="batik-note typography-note">
            <h2>v0.7 Typography</h2>
            <p>Built-in font choices are curated from <b>SIL OFL 1.1</b> families. Supported scripts: Latin, Devanagari, Arabic RTL, Simplified Chinese, Korean, and Japanese.</p>
            <p><b>Export SVG</b> currently keeps text editable as Unicode text. v0.7.1 will add shaped text-to-path output for EPS-oriented finalization.</p>
          </section>
        </aside>
      </main>
    </div>
  )
}
