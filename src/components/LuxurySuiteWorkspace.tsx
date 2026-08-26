import { useEffect, useMemo, useState } from 'react'
import { FILLER_LUXURY_MOTIFS, MAIN_LUXURY_MOTIFS } from '../engine/luxury/motifs'
import { initialLuxuryMonogram, luxuryMonogramProofSvg, luxuryMonogramSvg } from '../engine/luxury/monogramEngine'
import type { LuxuryMonogramData, MonogramLayout } from '../engine/luxury/types'
import { consumePendingPattern, exportPatternAssetJson, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void }
const EXPORT_PRESETS = [1024, 2048, 4096, 6000, 8000]
const PROOF_PRESETS = [1, 2, 3, 6]

function cloneData(data: LuxuryMonogramData) { return JSON.parse(JSON.stringify(data)) as LuxuryMonogramData }
function svgDataUri(svg: string) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
function slug(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'luxury-monogram' }
function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function currentAsset(name: string, data: LuxuryMonogramData, svg: string): PatternAsset {
  const stamp = new Date().toISOString()
  return {
    id: 'luxury-monogram-preview',
    name: name.trim() || 'Luxury Monogram',
    sourceType: 'luxury-monogram',
    createdAt: stamp,
    updatedAt: stamp,
    svg,
    palette: [...data.palette],
    luxury: cloneData(data),
    tags: ['luxury', 'monogram', data.layout, 'seamless', 'fashion'],
    meta: { seamless: true, exactBounds: true, exportLongSide: data.exportLongSide, luxuryMode: 'monogram' },
  }
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="v14-range"><span>{label}<b>{step < 1 ? value.toFixed(2) : Math.round(value)}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}/></label>
}

export default function LuxurySuiteWorkspace({ onOpenLibrary }: Props) {
  const [data, setData] = useState<LuxuryMonogramData>(() => initialLuxuryMonogram())
  const [name, setName] = useState('Quatrefoil Diamond Canvas 01')
  const [view, setView] = useState<'tile' | 'proof'>('proof')
  const [proofCopies, setProofCopies] = useState(3)
  const [showBoundary, setShowBoundary] = useState(false)
  const [message, setMessage] = useState('Luxury Suite Phase 1: controlled seamless Monogram Maker. Scarf / Hijab Composer follows after this engine is stable.')

  useEffect(() => {
    const pending = consumePendingPattern('luxury')
    if (!pending?.luxury) return
    setData(cloneData(pending.luxury))
    setName(pending.name)
    setMessage(`${pending.name} reopened as editable Luxury Monogram.`)
  }, [])

  const tileSvg = useMemo(() => luxuryMonogramSvg(data), [data])
  const proofSvg = useMemo(() => luxuryMonogramProofSvg(data, proofCopies), [data, proofCopies])
  const previewSvg = view === 'tile' ? tileSvg : proofSvg

  function patch<K extends keyof LuxuryMonogramData>(key: K, value: LuxuryMonogramData[K]) {
    setData((current) => ({ ...current, [key]: value }))
  }

  function patchMain(key: keyof LuxuryMonogramData['mainMotif'], value: string | number | boolean | Record<string, number>) {
    setData((current) => ({ ...current, mainMotif: { ...current.mainMotif, [key]: value } }))
  }

  function patchFiller(key: keyof LuxuryMonogramData['fillerMotif'], value: string | number | boolean | Record<string, number>) {
    setData((current) => ({ ...current, fillerMotif: { ...current.fillerMotif, [key]: value } }))
  }

  function updateColor(index: number, value: string) {
    setData((current) => ({ ...current, palette: current.palette.map((color, i) => i === index ? value.toUpperCase() : color) }))
  }

  function mapRole(target: 'main' | 'filler', role: string, index: number) {
    const instance = target === 'main' ? data.mainMotif : data.fillerMotif
    const next = { ...instance.colorRoles, [role]: index }
    target === 'main' ? patchMain('colorRoles', next) : patchFiller('colorRoles', next)
  }

  function saveAsset() {
    savePatternAsset({ name: name.trim() || 'Luxury Monogram', sourceType: 'luxury-monogram', svg: tileSvg, palette: [...data.palette], luxury: cloneData(data), tags: ['luxury','monogram',data.layout,'seamless','fashion'], meta: { seamless: true, exactBounds: true, exportLongSide: data.exportLongSide, luxuryMode: 'monogram' } })
    setMessage(`${name || 'Luxury Monogram'} saved to My Patterns as an editable monogram asset.`)
  }

  function exportSvg() {
    downloadText(tileSvg, `${slug(name)}-${data.exportLongSide}-seamless.svg`, 'image/svg+xml;charset=utf-8')
    setMessage(`Seamless monogram SVG exported with ${data.exportLongSide}px document long side.`)
  }

  function exportJson() {
    downloadText(exportPatternAssetJson(currentAsset(name, data, tileSvg)), `${slug(name)}.pattern.json`, 'application/json;charset=utf-8')
  }

  function exportPng() {
    const blob = new Blob([tileSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const size = Math.max(256, Math.min(8000, Math.round(data.exportLongSide)))
      const ratio = data.tileHeight / data.tileWidth
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = Math.max(1, Math.round(size * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url)
        if (!png) return
        const out = URL.createObjectURL(png)
        const anchor = document.createElement('a')
        anchor.href = out
        anchor.download = `${slug(name)}-${canvas.width}x${canvas.height}.png`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(out), 1200)
      }, 'image/png')
    }
    image.onerror = () => URL.revokeObjectURL(url)
    image.src = url
  }

  const mainRoles = MAIN_LUXURY_MOTIFS.find((item) => item.id === data.mainMotif.motifId)?.roles ?? ['primary']
  const fillerRoles = FILLER_LUXURY_MOTIFS.find((item) => item.id === data.fillerMotif.motifId)?.roles ?? ['primary']

  return <div className="v10-builder-shell v14-luxury-shell">
    <aside className="v10-panel v10-panel-left">
      <section className="v14-intro"><h2>Luxury Suite</h2><div className="v14-mode-tabs"><button className="active">Monogram Maker</button><button disabled>Scarf / Hijab · Next</button></div><small>Original shape-based fashion pattern workflow. No brand logos or exact signature patterns are built in.</small></section>

      <section><h2>Main Motif</h2><div className="v14-motif-grid">{MAIN_LUXURY_MOTIFS.map((motif) => <button key={motif.id} className={data.mainMotif.motifId === motif.id ? 'active' : ''} onClick={() => patchMain('motifId', motif.id)}>{motif.name}</button>)}</div><Range label="Main Scale" value={data.mainMotif.scale} min={.2} max={1.6} step={.01} onChange={(v) => patchMain('scale', v)}/><Range label="Main Rotation" value={data.mainMotif.rotation} min={-180} max={180} onChange={(v) => patchMain('rotation', v)}/></section>

      <section><h2>Filler Motif</h2><label className="v10-check"><input type="checkbox" checked={data.fillerMotif.enabled} onChange={(e) => patchFiller('enabled', e.target.checked)}/> Enable filler</label><div className="v14-motif-grid">{FILLER_LUXURY_MOTIFS.map((motif) => <button key={motif.id} className={data.fillerMotif.motifId === motif.id ? 'active' : ''} onClick={() => patchFiller('motifId', motif.id)}>{motif.name}</button>)}</div><Range label="Filler Scale" value={data.fillerMotif.scale} min={.08} max={.7} step={.01} onChange={(v) => patchFiller('scale', v)}/></section>

      <section><h2>Repeat Structure</h2><div className="v14-layout-grid">{(['grid','brick','diagonal','diamond'] as MonogramLayout[]).map((layout) => <button key={layout} className={data.layout === layout ? 'active' : ''} onClick={() => patch('layout', layout)}>{layout}</button>)}</div><Range label="Spacing X" value={data.spacingX} min={60} max={280} onChange={(v) => patch('spacingX', v)}/><Range label="Spacing Y" value={data.spacingY} min={60} max={280} onChange={(v) => patch('spacingY', v)}/><Range label="Phase X" value={data.offsetX} min={-200} max={200} onChange={(v) => patch('offsetX', v)}/><Range label="Phase Y" value={data.offsetY} min={-200} max={200} onChange={(v) => patch('offsetY', v)}/><label><span>Alternate rotation</span><select value={data.alternateRotation} onChange={(e) => patch('alternateRotation', e.target.value as LuxuryMonogramData['alternateRotation'])}><option value="none">None</option><option value="180">180°</option><option value="90">90°</option></select></label><label className="v10-check"><input type="checkbox" checked={data.mirrorColumns} onChange={(e) => patch('mirrorColumns', e.target.checked)}/> Mirror alternating columns</label><label className="v10-check"><input type="checkbox" checked={data.mirrorRows} onChange={(e) => patch('mirrorRows', e.target.checked)}/> Mirror alternating rows</label></section>
    </aside>

    <main className={`v10-stage v14-stage ${showBoundary ? 'show-boundary' : ''}`}>
      <header className="v10-stage-head"><div><b>{name}</b><span>{data.layout} · {data.tileWidth}×{data.tileHeight} logical tile · {data.palette.length} colors</span></div><div className="v14-view-tabs"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button></div></header>
      <div className="v14-preview"><div className="v14-preview-wrap"><img src={svgDataUri(previewSvg)} alt="Luxury monogram seamless pattern preview"/></div></div>
      <footer className="v10-stage-foot"><div className="v14-proof-row">{PROOF_PRESETS.map((count) => <button key={count} className={proofCopies === count && view === 'proof' ? 'active' : ''} onClick={() => { setProofCopies(count); setView(count === 1 ? 'tile' : 'proof') }}>{count}×{count}</button>)}<label className="v10-check"><input type="checkbox" checked={showBoundary} onChange={(e) => setShowBoundary(e.target.checked)}/> Seam Inspector</label></div><span>{message}</span></footer>
    </main>

    <aside className="v10-panel v10-panel-right">
      <section><h2>Document</h2><label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><div className="v14-size-grid"><label><span>Tile W</span><input type="number" min="100" max="2000" value={data.tileWidth} onChange={(e) => patch('tileWidth', Math.max(100, Number(e.target.value) || 400))}/></label><label><span>Tile H</span><input type="number" min="100" max="2000" value={data.tileHeight} onChange={(e) => patch('tileHeight', Math.max(100, Number(e.target.value) || 400))}/></label></div></section>

      <section><h2>Palette</h2><div className="v14-palette">{data.palette.map((color, index) => <label key={`${index}-${color}`}><input type="color" value={color} onChange={(e) => updateColor(index, e.target.value)}/><code>{color}</code></label>)}</div><label><span>Background</span><select value={data.backgroundMode} onChange={(e) => patch('backgroundMode', e.target.value as 'solid' | 'transparent')}><option value="solid">Solid</option><option value="transparent">Transparent</option></select></label>{data.backgroundMode === 'solid' ? <label><span>Background slot</span><select value={data.backgroundColor} onChange={(e) => patch('backgroundColor', Number(e.target.value))}>{data.palette.map((color, index) => <option key={color} value={index}>#{index + 1} {color}</option>)}</select></label> : null}</section>

      <section><h2>Main Color Roles</h2>{mainRoles.map((role) => <label key={role}><span>{role}</span><select value={data.mainMotif.colorRoles[role] ?? 0} onChange={(e) => mapRole('main', role, Number(e.target.value))}>{data.palette.map((color, index) => <option key={`${role}-${color}`} value={index}>#{index + 1} {color}</option>)}</select></label>)}</section>
      {data.fillerMotif.enabled ? <section><h2>Filler Color Roles</h2>{fillerRoles.map((role) => <label key={role}><span>{role}</span><select value={data.fillerMotif.colorRoles[role] ?? 0} onChange={(e) => mapRole('filler', role, Number(e.target.value))}>{data.palette.map((color, index) => <option key={`${role}-${color}`} value={index}>#{index + 1} {color}</option>)}</select></label>)}</section> : null}

      <section><h2>SVG / PNG Output</h2><div className="v14-export-grid">{EXPORT_PRESETS.map((size) => <button key={size} className={data.exportLongSide === size ? 'active' : ''} onClick={() => patch('exportLongSide', size)}>{size}</button>)}</div><label><span>Custom long side</span><input type="number" min="256" max="20000" value={data.exportLongSide} onChange={(e) => patch('exportLongSide', Math.max(256, Math.min(20000, Number(e.target.value) || 4096)))}/></label><button className="v09-primary" onClick={saveAsset}>Save Editable Monogram</button><button onClick={exportSvg}>Export Seamless SVG</button><button onClick={exportPng}>Export PNG</button><button onClick={exportJson}>Export Pattern JSON</button><button onClick={onOpenLibrary}>Open My Patterns</button></section>
    </aside>
  </div>
}
