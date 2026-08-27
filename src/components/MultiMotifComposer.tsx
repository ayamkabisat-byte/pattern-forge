import { useMemo, useRef, useState } from 'react'
import TileComposer from './TileComposer'
import {
  builderGeometry,
  canUseSpan,
  createPlacement,
  fillRandom,
  fillSequential,
  findPlacementCoveringCell,
  generateBuilderPattern,
  isFreePlacement,
} from '../engine/builder'
import { buildComposerSvg } from '../engine/composerExport'
import { buildRepeatProofSvg } from '../engine/proofExport'
import { parseSvgAsset } from '../engine/svg'
import { savePatternAsset } from '../patternLibrary'
import type { OutputMode, PatternSettings, SvgAsset, TileCellPlacement } from '../types'

type Tool = 'paint' | 'erase'
type View = 'edit' | 'proof'
type ProjectFile = {
  patternForge: 'multi-motif-project'
  version: 1
  name: string
  outputMode: OutputMode
  settings: PatternSettings
  assets: SvgAsset[]
  placements: TileCellPlacement[]
  exportLongSide: number
}

const INITIAL: PatternSettings = {
  tileWidth: 1600,
  tileHeight: 1600,
  background: '#F4EFE4',
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
  copies: 3,
  dimCopies: false,
  dimCopiesPercent: 55,
  showBoundary: true,
  showSwatchBounds: false,
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'multi-motif-pattern'
const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function scaledSvg(svg: string, logicalWidth: number, logicalHeight: number, longSide: number, seamless: boolean) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const target = Math.max(256, Math.min(20000, Math.round(longSide)))
  const scale = target / Math.max(1, logicalWidth, logicalHeight)
  root.setAttribute('width', String(Math.max(1, Math.round(logicalWidth * scale))))
  root.setAttribute('height', String(Math.max(1, Math.round(logicalHeight * scale))))
  root.setAttribute('data-patternforge-exact-bounds', 'true')
  root.setAttribute('data-patternforge-seamless', seamless ? 'true' : 'false')
  root.setAttribute('data-patternforge-source', 'multi-motif-composer')
  return new XMLSerializer().serializeToString(root)
}

export default function MultiMotifComposer() {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<TileCellPlacement[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [settings, setSettings] = useState<PatternSettings>(INITIAL)
  const [outputMode, setOutputMode] = useState<OutputMode>('seamless')
  const [tool, setTool] = useState<Tool>('paint')
  const [view, setView] = useState<View>('edit')
  const [proofCopies, setProofCopies] = useState(3)
  const [name, setName] = useState('Multi Motif Pattern 01')
  const [exportLongSide, setExportLongSide] = useState(4096)
  const [message, setMessage] = useState('Upload several SVG motifs, then fill the grid or paint cells manually.')
  const svgInput = useRef<HTMLInputElement>(null)
  const projectInput = useRef<HTMLInputElement>(null)

  const builderTile = useMemo(() => ({ mode: 'custom' as const, width: settings.tileWidth, height: settings.tileHeight, cellShape: 'square' as const }), [settings.tileWidth, settings.tileHeight])
  const result = useMemo(() => generateBuilderPattern(placements, assets, settings, builderTile), [placements, assets, settings, builderTile])
  const selected = placements.find((item) => item.key === selectedKey) ?? null
  const tileSvg = useMemo(() => buildComposerSvg(assets, result.instances, settings.background, result.geometry, [], outputMode === 'seamless'), [assets, result.instances, settings.background, result.geometry, outputMode])
  const proofSvg = useMemo(() => buildRepeatProofSvg(tileSvg, result.geometry.tileWidth, result.geometry.tileHeight, proofCopies), [tileSvg, result.geometry.tileWidth, result.geometry.tileHeight, proofCopies])

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))
  const patchSelected = (value: Partial<TileCellPlacement>) => {
    if (!selectedKey) return
    setPlacements((items) => items.map((item) => item.key === selectedKey ? { ...item, ...value } : item))
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) { setMessage('Only SVG vector motifs are accepted.'); return }
    const next: SvgAsset[] = []
    for (const file of incoming) {
      try {
        next.push(await parseSvgAsset(await file.text(), file.name, crypto.randomUUID().replaceAll('-', '').slice(0, 12)))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `Could not load ${file.name}.`)
      }
    }
    if (!next.length) return
    setAssets((current) => [...current, ...next])
    setActiveAssetId((current) => current ?? next[0].id)
    setMessage(`${next.length} SVG motif${next.length === 1 ? '' : 's'} added. ${assets.length + next.length} total.`)
  }

  function removeAsset(id: string) {
    setAssets((items) => items.filter((item) => item.id !== id))
    setPlacements((items) => items.filter((item) => item.assetId !== id))
    if (activeAssetId === id) setActiveAssetId(null)
    if (selected?.assetId === id) setSelectedKey(null)
  }

  function geometryNow() {
    return builderGeometry(assets, settings, builderTile)
  }

  function sequentialFill() {
    if (!assets.length) return
    const g = geometryNow()
    const next = fillSequential(assets, g)
    setPlacements(next)
    setSelectedKey(next[0]?.key ?? null)
    setMessage('Sequential fill applied across the complete master tile.')
  }

  function randomFill() {
    if (!assets.length) return
    const g = geometryNow()
    const next = fillRandom(assets, g, settings.seed)
    setPlacements(next)
    setSelectedKey(next[0]?.key ?? null)
    setMessage(`Seeded random fill applied · seed ${settings.seed}.`)
  }

  function handleCellClick(row: number, col: number) {
    const owner = findPlacementCoveringCell(placements, row, col)
    if (tool === 'erase') {
      if (!owner) return
      setPlacements((items) => items.filter((item) => item.key !== owner.key))
      if (owner.key === selectedKey) setSelectedKey(null)
      return
    }
    if (!activeAssetId) return
    if (owner) {
      setPlacements((items) => items.map((item) => item.key === owner.key ? { ...item, assetId: activeAssetId } : item))
      setSelectedKey(owner.key)
      return
    }
    const next = createPlacement(row, col, activeAssetId)
    setPlacements((items) => [...items, next])
    setSelectedKey(next.key)
  }

  function setSpan(cols: number, rows: number) {
    if (!selected || isFreePlacement(selected)) return
    const g = geometryNow()
    if (!canUseSpan(placements, selected.key, selected.row, selected.col, cols, rows, g)) {
      setMessage(`${cols}×${rows} span overlaps another placement or exceeds the tile.`)
      return
    }
    patchSelected({ spanCols: cols, spanRows: rows })
  }

  function addFreeMotif() {
    const asset = assets.find((item) => item.id === activeAssetId)
    if (!asset) return
    const size = Math.min(settings.tileWidth, settings.tileHeight) * 0.18
    const ratio = asset.viewWidth / asset.viewHeight || 1
    const width = ratio >= 1 ? size : size * ratio
    const height = ratio >= 1 ? size / ratio : size
    const item: TileCellPlacement = {
      key: `free-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
      row: 0,
      col: 0,
      assetId: asset.id,
      rotation: 0,
      scale: 100,
      offsetX: 0,
      offsetY: 0,
      flipX: false,
      flipY: false,
      positionMode: 'free',
      freeX: settings.tileWidth / 2,
      freeY: settings.tileHeight / 2,
      freeWidth: width,
      freeHeight: height,
    }
    setPlacements((items) => [...items, item])
    setSelectedKey(item.key)
    setMessage('Free motif added. Use X/Y and scale controls for manual placement.')
  }

  function exportSvg() {
    if (!assets.length || !placements.length) { setMessage('Add and place motifs first.'); return }
    const svg = scaledSvg(tileSvg, result.geometry.tileWidth, result.geometry.tileHeight, exportLongSide, outputMode === 'seamless')
    downloadText(svg, `${slug(name)}-${outputMode}.svg`, 'image/svg+xml;charset=utf-8')
  }

  function exportPng() {
    if (!assets.length || !placements.length) { setMessage('Add and place motifs first.'); return }
    const svg = scaledSvg(tileSvg, result.geometry.tileWidth, result.geometry.tileHeight, Math.min(8000, exportLongSide), outputMode === 'seamless')
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const long = Math.max(256, Math.min(8000, exportLongSide))
      const scale = long / Math.max(result.geometry.tileWidth, result.geometry.tileHeight)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(result.geometry.tileWidth * scale))
      canvas.height = Math.max(1, Math.round(result.geometry.tileHeight * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) return
        const out = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = out; a.download = `${slug(name)}-${outputMode}.png`; a.click()
        setTimeout(() => URL.revokeObjectURL(out), 1200)
      }, 'image/png')
    }
    image.src = url
  }

  function saveFinished() {
    if (!assets.length || !placements.length) { setMessage('Add and place motifs first.'); return }
    const svg = scaledSvg(tileSvg, result.geometry.tileWidth, result.geometry.tileHeight, exportLongSide, outputMode === 'seamless')
    savePatternAsset({
      name: name.trim() || 'Multi Motif Pattern',
      sourceType: 'imported-svg',
      svg,
      tags: ['multi-motif', outputMode, outputMode === 'seamless' ? 'seamless' : 'composition'],
      meta: { multiMotif: true, width: result.geometry.tileWidth, height: result.geometry.tileHeight, motifCount: assets.length, exactBounds: true },
    })
    setMessage('Finished vector saved to My Patterns. Export Project JSON to preserve full editability.')
  }

  function exportProject() {
    const project: ProjectFile = { patternForge: 'multi-motif-project', version: 1, name, outputMode, settings, assets, placements, exportLongSide }
    downloadText(JSON.stringify(project, null, 2), `${slug(name)}.composer.json`, 'application/json;charset=utf-8')
  }

  async function importProject(file: File | undefined) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as ProjectFile
      if (parsed.patternForge !== 'multi-motif-project' || parsed.version !== 1 || !Array.isArray(parsed.assets) || !Array.isArray(parsed.placements)) throw new Error('Not a valid PatternForge Multi-Motif project.')
      setName(parsed.name || 'Multi Motif Pattern')
      setOutputMode(parsed.outputMode === 'canvas' ? 'canvas' : 'seamless')
      setSettings({ ...INITIAL, ...parsed.settings })
      setAssets(parsed.assets)
      setPlacements(parsed.placements)
      setActiveAssetId(parsed.assets[0]?.id ?? null)
      setSelectedKey(parsed.placements[0]?.key ?? null)
      setExportLongSide(Math.max(256, Math.min(20000, parsed.exportLongSide || 4096)))
      setMessage(`${file.name} reopened as an editable Multi-Motif project.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import project JSON.') }
  }

  const preview = view === 'proof' && outputMode === 'seamless' ? proofSvg : tileSvg

  return <div className="v10-builder-shell v19-multi-shell">
    <aside className="v10-panel v10-panel-left">
      <section><h2>SVG Motif Set</h2><button className="v10-drop v19-multi-drop" onClick={() => svgInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void addFiles(e.dataTransfer.files) }}><b>Drop multiple SVG motifs</b><span>Diwali, Halloween, floral, school, Arabic, icon sets, and other element bundles.</span></button><input ref={svgInput} hidden multiple type="file" accept=".svg,image/svg+xml" onChange={(e) => void addFiles(e.target.files ?? [])}/><div className="v19-asset-list">{assets.map((asset, index) => <div key={asset.id} className={activeAssetId === asset.id ? 'active' : ''}><button onClick={() => { setActiveAssetId(asset.id); setTool('paint') }}><b>{String.fromCharCode(65 + (index % 26))}</b><span>{asset.name}</span></button><button className="v09-danger" onClick={() => removeAsset(asset.id)}>×</button></div>)}</div></section>
      <section><h2>Auto Build</h2><div className="v19-action-grid"><button onClick={sequentialFill}>Fill Sequential</button><button onClick={randomFill}>Fill Random</button><button onClick={addFreeMotif}>+ Free Motif</button><button className="v09-danger" onClick={() => { setPlacements([]); setSelectedKey(null) }}>Clear Canvas</button></div><label><span>Random seed</span><input type="number" value={settings.seed} onChange={(e) => patch('seed', Number(e.target.value) || 1)}/></label></section>
      <section><h2>Paint Tool</h2><div className="v19-action-grid"><button className={tool === 'paint' ? 'active' : ''} onClick={() => setTool('paint')}>Paint</button><button className={tool === 'erase' ? 'active' : ''} onClick={() => setTool('erase')}>Erase</button></div><small>Choose a motif above, then click grid cells. Existing cells can be repainted with another SVG.</small></section>
      <section><h2>Project</h2><button onClick={() => projectInput.current?.click()}>Open Composer JSON</button><input ref={projectInput} hidden type="file" accept=".json,application/json" onChange={(e) => void importProject(e.target.files?.[0])}/><button onClick={exportProject}>Export Editable Project JSON</button></section>
    </aside>

    <main className="v10-center-stage">
      <div className="v10-stage-head"><div><b>{name}</b><span>{outputMode === 'seamless' ? 'Edge-wrapped seamless master tile' : 'Final canvas composition'} · {assets.length} SVG assets</span></div><div className="v10-view-buttons"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Builder</button>{outputMode === 'seamless' ? <button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button> : null}</div></div>
      <div className="v10-preview-zone v19-multi-preview">{assets.length ? (view === 'edit' ? <TileComposer assets={assets} placements={placements} instances={result.instances} geometry={result.geometry} settings={settings} selectedKey={selectedKey} activeAssetId={activeAssetId} erasing={tool === 'erase'} wrapEdges={outputMode === 'seamless'} onPlacementSelect={setSelectedKey} onCellClick={handleCellClick}/> : <img src={svgDataUri(preview)} alt="Multi motif repeat proof"/>) : <div className="v10-empty-state"><b>Add several SVG motifs</b><p>Then use Sequential, Random, manual cell painting, spans, mirroring, or free placement.</p></div>}</div>
      <div className="v10-stage-status"><span>{message}</span><b>MULTI-SVG COMPOSER · {outputMode.toUpperCase()}</b></div>
    </main>

    <aside className="v10-panel v10-panel-right">
      <section><h2>Output Mode</h2><div className="v19-mode-switch"><button className={outputMode === 'seamless' ? 'active' : ''} onClick={() => { setOutputMode('seamless'); setView('edit') }}>Seamless Pattern</button><button className={outputMode === 'canvas' ? 'active' : ''} onClick={() => { setOutputMode('canvas'); setView('edit') }}>Canvas Composition</button></div></section>
      <section><h2>Document / Grid</h2><label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><div className="v10-two"><label><span>Width</span><input type="number" min="256" max="8000" value={settings.tileWidth} onChange={(e) => patch('tileWidth', Math.max(256, Number(e.target.value) || 1600))}/></label><label><span>Height</span><input type="number" min="256" max="8000" value={settings.tileHeight} onChange={(e) => patch('tileHeight', Math.max(256, Number(e.target.value) || 1600))}/></label></div><div className="v10-two"><label><span>Columns</span><input type="number" min="1" max="30" value={settings.columns} onChange={(e) => patch('columns', Math.max(1, Math.min(30, Number(e.target.value) || 1)))}/></label><label><span>Rows</span><input type="number" min="1" max="30" value={settings.rows} onChange={(e) => patch('rows', Math.max(1, Math.min(30, Number(e.target.value) || 1)))}/></label></div><label><span>Gap X</span><input type="range" min="-100" max="200" value={settings.hSpacing} onChange={(e) => patch('hSpacing', Number(e.target.value))}/><output>{settings.hSpacing}</output></label><label><span>Gap Y</span><input type="range" min="-100" max="200" value={settings.vSpacing} onChange={(e) => patch('vSpacing', Number(e.target.value))}/><output>{settings.vSpacing}</output></label><input type="color" value={settings.background === 'transparent' ? '#FFFFFF' : settings.background} onChange={(e) => patch('background', e.target.value)}/></section>
      {selected ? <section className="v19-selected"><h2>Selected Placement</h2><label><span>SVG</span><select value={selected.assetId} onChange={(e) => patchSelected({ assetId: e.target.value })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label><label><span>Scale</span><input type="range" min="20" max="300" value={selected.scale} onChange={(e) => patchSelected({ scale: Number(e.target.value) })}/><output>{selected.scale}%</output></label><label><span>Rotation</span><input type="range" min="-180" max="180" value={selected.rotation} onChange={(e) => patchSelected({ rotation: Number(e.target.value) })}/><output>{selected.rotation}°</output></label><div className="v10-two"><label className="v10-check"><input type="checkbox" checked={selected.flipX} onChange={(e) => patchSelected({ flipX: e.target.checked })}/> Flip X</label><label className="v10-check"><input type="checkbox" checked={selected.flipY} onChange={(e) => patchSelected({ flipY: e.target.checked })}/> Flip Y</label></div><div className="v10-two"><label className="v10-check"><input type="checkbox" checked={Boolean(selected.mirror?.axisX)} onChange={(e) => patchSelected({ mirror: { enabled: e.target.checked || Boolean(selected.mirror?.axisY), axisX: e.target.checked, axisY: Boolean(selected.mirror?.axisY) } })}/> Mirror X</label><label className="v10-check"><input type="checkbox" checked={Boolean(selected.mirror?.axisY)} onChange={(e) => patchSelected({ mirror: { enabled: e.target.checked || Boolean(selected.mirror?.axisX), axisX: Boolean(selected.mirror?.axisX), axisY: e.target.checked } })}/> Mirror Y</label></div>{isFreePlacement(selected) ? <><label><span>X</span><input type="range" min="0" max={settings.tileWidth} value={selected.freeX ?? settings.tileWidth / 2} onChange={(e) => patchSelected({ freeX: Number(e.target.value) })}/></label><label><span>Y</span><input type="range" min="0" max={settings.tileHeight} value={selected.freeY ?? settings.tileHeight / 2} onChange={(e) => patchSelected({ freeY: Number(e.target.value) })}/></label></> : <><div className="v10-two"><label><span>Offset X</span><input type="number" value={selected.offsetX} onChange={(e) => patchSelected({ offsetX: Number(e.target.value) || 0 })}/></label><label><span>Offset Y</span><input type="number" value={selected.offsetY} onChange={(e) => patchSelected({ offsetY: Number(e.target.value) || 0 })}/></label></div><div className="v19-span-grid">{[[1,1],[2,1],[1,2],[2,2],[3,1],[1,3]].map(([cols, rows]) => <button key={`${cols}-${rows}`} className={(selected.spanCols ?? 1) === cols && (selected.spanRows ?? 1) === rows ? 'active' : ''} onClick={() => setSpan(cols, rows)}>{cols}×{rows}</button>)}</div></>}<button className="v09-danger" onClick={() => { setPlacements((items) => items.filter((item) => item.key !== selected.key)); setSelectedKey(null) }}>Delete Placement</button></section> : null}
      <section><h2>Proof / Export</h2>{outputMode === 'seamless' ? <div className="v11-repeat-buttons">{[2,3,6].map((count) => <button key={count} className={proofCopies === count ? 'active' : ''} onClick={() => { setProofCopies(count); setView('proof') }}>{count}×{count}</button>)}</div> : null}<label><span>Export long side</span><input type="number" min="256" max="20000" value={exportLongSide} onChange={(e) => setExportLongSide(Math.max(256, Math.min(20000, Number(e.target.value) || 4096)))}/></label><button className="v09-primary" onClick={saveFinished}>Save Finished SVG to My Patterns</button><button onClick={exportSvg}>Export SVG</button><button onClick={exportPng}>Export PNG</button></section>
    </aside>
  </div>
}
