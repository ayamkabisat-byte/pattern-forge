import { useEffect, useMemo, useRef, useState } from 'react'
import { MAIN_LUXURY_MOTIFS, FILLER_LUXURY_MOTIFS, resolveLuxuryMotif } from '../engine/luxury/motifs'
import { applyLuxuryGeometryPreset, initialLuxuryMonogram, luxuryMonogramMetrics, luxuryMonogramProofSvg, luxuryMonogramSvg, normalizeLuxuryMonogram } from '../engine/luxury/monogramEngine'
import { deleteLuxuryShape, loadLuxuryShapeLibrary, luxuryShapeLibraryEvent, parseLuxurySvgShape, saveLuxuryShape } from '../engine/luxury/shapeLibrary'
import {
  isLuxuryScarf,
  type LuxuryCustomShape,
  type LuxuryFillerAnchor,
  type LuxuryGeometryPreset,
  type LuxuryMainAnchor,
  type LuxuryMonogramData,
  type LuxurySymmetry,
  type MonogramLayout,
} from '../engine/luxury/types'
import { consumePendingPattern, exportPatternAssetJson, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void; onSendToScarf: (svg: string, name: string) => void }
const EXPORT_PRESETS = [1024, 2048, 4096, 6000, 8000]
const PROOF_PRESETS = [1, 2, 3, 6]
const GEOMETRY_PRESETS: Array<{ id: LuxuryGeometryPreset; label: string }> = [
  { id: 'legacy', label: 'Classic' },
  { id: 'square-lattice', label: 'Square Lattice' },
  { id: 'diamond-lattice', label: 'Diamond Lattice' },
  { id: 'wide-rhombus', label: 'Wide Rhombus' },
  { id: 'tall-rhombus', label: 'Tall Rhombus' },
  { id: 'trellis', label: 'Trellis' },
  { id: 'offset-trellis', label: 'Offset Trellis' },
  { id: 'cross-lattice', label: 'Cross Lattice' },
]

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'luxury-monogram'

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="v14-range"><span>{label}<b>{step < 1 ? value.toFixed(2) : Math.round(value)}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}/></label>
}

function currentAsset(name: string, raw: LuxuryMonogramData, svg: string): PatternAsset {
  const data = normalizeLuxuryMonogram(raw)
  const stamp = new Date().toISOString()
  return { id: 'luxury-monogram-preview', name: name.trim() || 'Luxury Monogram', sourceType: 'luxury-monogram', createdAt: stamp, updatedAt: stamp, svg, palette: [...data.palette], luxury: clone(data), tags: ['luxury','monogram',data.layout,data.geometryPreset ?? 'legacy','seamless','fashion'], meta: { seamless: true, exactBounds: true, exportLongSide: data.exportLongSide, luxuryMode: 'monogram', geometryPreset: data.geometryPreset ?? 'legacy' } }
}

export default function MonogramMaker({ onOpenLibrary, onSendToScarf }: Props) {
  const [data, setData] = useState<LuxuryMonogramData>(() => initialLuxuryMonogram())
  const [name, setName] = useState('Quatrefoil Diamond Canvas 01')
  const [view, setView] = useState<'tile' | 'proof'>('proof')
  const [proofCopies, setProofCopies] = useState(3)
  const [showBoundary, setShowBoundary] = useState(false)
  const [shapes, setShapes] = useState<LuxuryCustomShape[]>(() => loadLuxuryShapeLibrary())
  const [message, setMessage] = useState('Built-in or your own SVG can occupy the existing Main and Filler slots. Geometry Lab adds cycle-safe lattice control.')
  const mainInput = useRef<HTMLInputElement>(null)
  const fillerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const pending = consumePendingPattern('luxury')
    if (pending?.luxury && !isLuxuryScarf(pending.luxury)) {
      setData(normalizeLuxuryMonogram({ ...clone(pending.luxury), customShapes: clone(pending.luxury.customShapes ?? []) }))
      setName(pending.name)
      setMessage(`${pending.name} reopened as an editable Luxury Monogram.`)
    }
    const refresh = () => setShapes(loadLuxuryShapeLibrary())
    window.addEventListener(luxuryShapeLibraryEvent(), refresh)
    return () => window.removeEventListener(luxuryShapeLibraryEvent(), refresh)
  }, [])

  const normalized = useMemo(() => normalizeLuxuryMonogram(data), [data])
  const tileSvg = useMemo(() => luxuryMonogramSvg(normalized), [normalized])
  const proofSvg = useMemo(() => luxuryMonogramProofSvg(normalized, proofCopies), [normalized, proofCopies])
  const metrics = useMemo(() => luxuryMonogramMetrics(normalized), [normalized])
  const previewSvg = view === 'tile' ? tileSvg : proofSvg
  const mainMotif = resolveLuxuryMotif(normalized.mainMotif.motifId, normalized.customShapes ?? [])
  const fillerMotif = resolveLuxuryMotif(normalized.fillerMotif.motifId, normalized.customShapes ?? [])

  function patch<K extends keyof LuxuryMonogramData>(key: K, value: LuxuryMonogramData[K]) { setData((current) => normalizeLuxuryMonogram({ ...current, [key]: value })) }
  function patchMain(key: keyof LuxuryMonogramData['mainMotif'], value: unknown) { setData((current) => normalizeLuxuryMonogram({ ...current, mainMotif: { ...current.mainMotif, [key]: value } })) }
  function patchFiller(key: keyof LuxuryMonogramData['fillerMotif'], value: unknown) { setData((current) => normalizeLuxuryMonogram({ ...current, fillerMotif: { ...current.fillerMotif, [key]: value } })) }
  function mapRole(target: 'main' | 'filler', role: string, index: number) {
    const instance = target === 'main' ? normalized.mainMotif : normalized.fillerMotif
    const next = { ...instance.colorRoles, [role]: index }
    target === 'main' ? patchMain('colorRoles', next) : patchFiller('colorRoles', next)
  }

  function attachShape(shape: LuxuryCustomShape, target: 'main' | 'filler') {
    setData((currentRaw) => {
      const current = normalizeLuxuryMonogram(currentRaw)
      const customShapes = [shape, ...(current.customShapes ?? []).filter((item) => item.id !== shape.id)]
      const roles = Object.fromEntries(shape.roles.map((role, index) => [role, Math.min(index, current.palette.length - 1)]))
      if (target === 'main') return { ...current, customShapes, mainMotif: { ...current.mainMotif, motifId: shape.id, colorRoles: roles } }
      return { ...current, customShapes, fillerMotif: { ...current.fillerMotif, motifId: shape.id, enabled: true, colorRoles: roles } }
    })
    setMessage(`${shape.name} is now the ${target === 'main' ? 'Main' : 'Filler'} motif.`)
  }

  async function importShape(file: File | undefined, target: 'main' | 'filler') {
    if (!file) return
    try {
      const shape = parseLuxurySvgShape(await file.text(), file.name.replace(/\.svg$/i, ''), target)
      saveLuxuryShape(shape)
      attachShape(shape, target)
      setMessage(`${shape.name} imported. ${shape.originalColors.length || 1} color role${shape.originalColors.length === 1 ? '' : 's'} available for remapping.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import SVG.') }
  }

  function applyGeometryPreset(preset: LuxuryGeometryPreset) {
    setData((current) => applyLuxuryGeometryPreset(current, preset))
    setMessage(`${GEOMETRY_PRESETS.find((item) => item.id === preset)?.label ?? preset} geometry applied with seam-compatible row/column cycles.`)
  }

  function saveAsset() {
    const asset = currentAsset(name, normalized, tileSvg)
    savePatternAsset({ name: asset.name, sourceType: 'luxury-monogram', svg: asset.svg, palette: asset.palette, luxury: asset.luxury, tags: asset.tags, meta: asset.meta })
    setMessage(`${asset.name} saved with editable layout, geometry, and embedded custom shapes.`)
  }

  function exportPng() {
    const url = URL.createObjectURL(new Blob([tileSvg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const long = Math.max(256, Math.min(8000, Math.round(normalized.exportLongSide)))
      const canvas = document.createElement('canvas'); canvas.width = long; canvas.height = Math.max(1, Math.round(long * normalized.tileHeight / normalized.tileWidth))
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((png) => { URL.revokeObjectURL(url); if (!png) return; const out = URL.createObjectURL(png); const a = document.createElement('a'); a.href = out; a.download = `${slug(name)}-${canvas.width}x${canvas.height}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(out), 1200) }, 'image/png')
    }
    image.src = url
  }

  return <div className="v10-builder-shell v14-luxury-shell">
    <aside className="v10-panel v10-panel-left">
      <section className="v14-intro"><h2>Monogram Maker</h2><small>Shape-based seamless fashion pattern. Custom SVG uses the existing Main/Filler slots; Geometry Lab changes the lattice instead of adding unnecessary motif slots.</small></section>
      <section><h2>Main Motif</h2><div className="v14-motif-grid">{MAIN_LUXURY_MOTIFS.map((motif) => <button key={motif.id} className={normalized.mainMotif.motifId === motif.id ? 'active' : ''} onClick={() => patchMain('motifId', motif.id)}>{motif.name}</button>)}</div><button className="v09-primary" onClick={() => mainInput.current?.click()}>Upload Main SVG</button><input hidden ref={mainInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importShape(e.target.files?.[0], 'main')}/><Range label="Main Scale" value={normalized.mainMotif.scale} min={.15} max={1.8} step={.01} onChange={(v) => patchMain('scale', v)}/><Range label="Main Rotation" value={normalized.mainMotif.rotation} min={-180} max={180} onChange={(v) => patchMain('rotation', v)}/></section>
      <section><h2>Filler Motif</h2><label className="v10-check"><input type="checkbox" checked={normalized.fillerMotif.enabled} onChange={(e) => patchFiller('enabled', e.target.checked)}/> Enable filler</label><div className="v14-motif-grid">{FILLER_LUXURY_MOTIFS.map((motif) => <button key={motif.id} className={normalized.fillerMotif.motifId === motif.id ? 'active' : ''} onClick={() => patchFiller('motifId', motif.id)}>{motif.name}</button>)}</div><button onClick={() => fillerInput.current?.click()}>Upload Filler SVG</button><input hidden ref={fillerInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importShape(e.target.files?.[0], 'filler')}/><Range label="Filler Scale" value={normalized.fillerMotif.scale} min={.05} max={.9} step={.01} onChange={(v) => patchFiller('scale', v)}/></section>
      <section><h2>My SVG Shape Library</h2>{!shapes.length ? <small>No custom SVG yet. Uploaded SVGs will appear here automatically.</small> : <div className="v15-shape-library">{shapes.map((shape) => <div key={shape.id}><b>{shape.name}</b><span>{shape.category} · {shape.roles.length} role{shape.roles.length === 1 ? '' : 's'}</span><div><button onClick={() => attachShape(shape, 'main')}>Main</button><button onClick={() => attachShape(shape, 'filler')}>Filler</button><button className="v09-danger" onClick={() => deleteLuxuryShape(shape.id)}>×</button></div></div>)}</div>}</section>
      <section><h2>Repeat Structure</h2><div className="v14-layout-grid">{(['grid','brick','diagonal','diamond'] as MonogramLayout[]).map((layout) => <button key={layout} className={normalized.layout === layout ? 'active' : ''} onClick={() => patch('layout', layout)}>{layout}</button>)}</div><Range label="Target Spacing X" value={normalized.spacingX} min={40} max={360} onChange={(v) => patch('spacingX', v)}/><Range label="Target Spacing Y" value={normalized.spacingY} min={40} max={360} onChange={(v) => patch('spacingY', v)}/><Range label="Phase X" value={normalized.offsetX} min={-200} max={200} onChange={(v) => patch('offsetX', v)}/><Range label="Phase Y" value={normalized.offsetY} min={-200} max={200} onChange={(v) => patch('offsetY', v)}/><label><span>Alternate rotation</span><select value={normalized.alternateRotation} onChange={(e) => patch('alternateRotation', e.target.value as LuxuryMonogramData['alternateRotation'])}><option value="none">None</option><option value="180">180°</option><option value="90">90°</option></select></label><label className="v10-check"><input type="checkbox" checked={normalized.mirrorColumns} onChange={(e) => patch('mirrorColumns', e.target.checked)}/> Mirror alternating columns</label><label className="v10-check"><input type="checkbox" checked={normalized.mirrorRows} onChange={(e) => patch('mirrorRows', e.target.checked)}/> Mirror alternating rows</label></section>
      <section className="v19-luxury-geometry"><h2>Geometry Lab</h2><small>Row/column phase is quantized to 1/8. PatternForge expands the row/column cycle automatically so the tile remains mathematically repeatable.</small><div className="v19-geometry-presets">{GEOMETRY_PRESETS.map((preset) => <button key={preset.id} className={normalized.geometryPreset === preset.id ? 'active' : ''} onClick={() => applyGeometryPreset(preset.id)}>{preset.label}</button>)}</div><Range label="Row Phase" value={normalized.rowPhase ?? 0} min={-1} max={1} step={.125} onChange={(v) => patch('rowPhase', v)}/><Range label="Column Phase" value={normalized.columnPhase ?? 0} min={-1} max={1} step={.125} onChange={(v) => patch('columnPhase', v)}/><label><span>Main anchor</span><select value={normalized.mainAnchor ?? 'origin'} onChange={(e) => patch('mainAnchor', e.target.value as LuxuryMainAnchor)}><option value="origin">Lattice Intersection</option><option value="cell-center">Cell Center</option><option value="edge-x">Horizontal Edge Midpoint</option><option value="edge-y">Vertical Edge Midpoint</option><option value="alternate">Alternate Intersection / Center</option></select></label><label><span>Filler anchor</span><select value={normalized.fillerAnchor ?? 'cell-center'} onChange={(e) => patch('fillerAnchor', e.target.value as LuxuryFillerAnchor)}><option value="cell-center">Cell Center</option><option value="edge-x">Horizontal Edge Midpoint</option><option value="edge-y">Vertical Edge Midpoint</option><option value="alternate-cells">Alternate Cells Only</option><option value="four-corners">Four Quarter Anchors</option></select></label><label><span>Symmetry geometry</span><select value={normalized.symmetry ?? 'none'} onChange={(e) => patch('symmetry', e.target.value as LuxurySymmetry)}><option value="none">None</option><option value="mirror-x">Mirror Columns</option><option value="mirror-y">Mirror Rows</option><option value="mirror-xy">Double Mirror</option><option value="half-turn">Half Turn</option><option value="quarter-turn">Quarter Turn</option><option value="glide">Glide Reflection</option></select></label><Range label="Alternate Main Scale" value={normalized.alternateMainScale ?? 1} min={.25} max={1.75} step={.01} onChange={(v) => patch('alternateMainScale', v)}/><Range label="Alternate Filler Scale" value={normalized.alternateFillerScale ?? 1} min={.25} max={1.75} step={.01} onChange={(v) => patch('alternateFillerScale', v)}/><div className="v19-metrics"><span><b>{metrics.stepX.toFixed(1)} × {metrics.stepY.toFixed(1)}</b>effective step</span><span><b>{metrics.columns} × {metrics.rows}</b>lattice count</span><span><b>{metrics.columnCycle}</b>column cycle</span><span><b>{metrics.rowCycle}</b>row cycle</span></div></section>
    </aside>

    <main className={`v10-stage v14-stage ${showBoundary ? 'show-boundary' : ''}`}><header className="v10-stage-head"><div><b>{name}</b><span>{normalized.layout} · {normalized.geometryPreset ?? 'legacy'} · {normalized.palette.length} colors</span></div><div className="v14-view-tabs"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button></div></header><div className="v14-preview"><div className="v14-preview-wrap"><img src={svgDataUri(previewSvg)} alt="Luxury monogram preview"/></div></div><footer className="v10-stage-foot"><div className="v14-proof-row">{PROOF_PRESETS.map((count) => <button key={count} className={proofCopies === count && view === 'proof' ? 'active' : ''} onClick={() => { setProofCopies(count); setView(count === 1 ? 'tile' : 'proof') }}>{count}×{count}</button>)}<label className="v10-check"><input type="checkbox" checked={showBoundary} onChange={(e) => setShowBoundary(e.target.checked)}/> Seam Inspector</label></div><span>{message}</span></footer></main>

    <aside className="v10-panel v10-panel-right"><section><h2>Document</h2><label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><div className="v14-size-grid"><label><span>Tile W</span><input type="number" min="100" max="2000" value={normalized.tileWidth} onChange={(e) => patch('tileWidth', Math.max(100, Number(e.target.value) || 400))}/></label><label><span>Tile H</span><input type="number" min="100" max="2000" value={normalized.tileHeight} onChange={(e) => patch('tileHeight', Math.max(100, Number(e.target.value) || 400))}/></label></div></section><section><h2>Palette</h2><div className="v14-palette">{normalized.palette.map((color, index) => <label key={`${index}-${color}`}><input type="color" value={color} onChange={(e) => patch('palette', normalized.palette.map((c, i) => i === index ? e.target.value.toUpperCase() : c))}/><code>{color}</code></label>)}</div><label><span>Background</span><select value={normalized.backgroundMode} onChange={(e) => patch('backgroundMode', e.target.value as 'solid' | 'transparent')}><option value="solid">Solid</option><option value="transparent">Transparent</option></select></label>{normalized.backgroundMode === 'solid' ? <label><span>Background slot</span><select value={normalized.backgroundColor} onChange={(e) => patch('backgroundColor', Number(e.target.value))}>{normalized.palette.map((color, index) => <option key={color} value={index}>#{index + 1} {color}</option>)}</select></label> : null}</section><section><h2>Main Color Roles</h2>{mainMotif.roles.map((role) => <label key={role}><span>{role}</span><select value={normalized.mainMotif.colorRoles[role] ?? 0} onChange={(e) => mapRole('main', role, Number(e.target.value))}>{normalized.palette.map((color, index) => <option key={`${role}-${color}`} value={index}>#{index + 1} {color}</option>)}</select></label>)}</section>{normalized.fillerMotif.enabled ? <section><h2>Filler Color Roles</h2>{fillerMotif.roles.map((role) => <label key={role}><span>{role}</span><select value={normalized.fillerMotif.colorRoles[role] ?? 0} onChange={(e) => mapRole('filler', role, Number(e.target.value))}>{normalized.palette.map((color, index) => <option key={`${role}-${color}`} value={index}>#{index + 1} {color}</option>)}</select></label>)}</section> : null}<section><h2>Output / Reuse</h2><div className="v14-export-grid">{EXPORT_PRESETS.map((size) => <button key={size} className={normalized.exportLongSide === size ? 'active' : ''} onClick={() => patch('exportLongSide', size)}>{size}</button>)}</div><label><span>Custom long side</span><input type="number" min="256" max="20000" value={normalized.exportLongSide} onChange={(e) => patch('exportLongSide', Math.max(256, Math.min(20000, Number(e.target.value) || 4096)))}/></label><button className="v09-primary" onClick={saveAsset}>Save Editable Monogram</button><button className="v15-scarf-bridge" onClick={() => onSendToScarf(tileSvg, name)}>Use in Scarf / Hijab</button><button onClick={() => downloadText(tileSvg, `${slug(name)}-${normalized.exportLongSide}-seamless.svg`, 'image/svg+xml;charset=utf-8')}>Export Seamless SVG</button><button onClick={exportPng}>Export PNG</button><button onClick={() => downloadText(exportPatternAssetJson(currentAsset(name, normalized, tileSvg)), `${slug(name)}.pattern.json`, 'application/json;charset=utf-8')}>Export Pattern JSON</button><button onClick={onOpenLibrary}>Open My Patterns</button></section></aside>
  </div>
}
