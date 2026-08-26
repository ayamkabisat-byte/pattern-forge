import { useEffect, useMemo, useRef, useState } from 'react'
import { MAIN_LUXURY_MOTIFS, resolveLuxuryMotif } from '../engine/luxury/motifs'
import { initialLuxuryScarf, luxuryScarfSvg, luxuryScarfTemplate } from '../engine/luxury/scarfEngine'
import { deleteLuxuryShape, loadLuxuryShapeLibrary, luxuryShapeLibraryEvent, parseLuxurySvgShape, saveLuxuryShape } from '../engine/luxury/shapeLibrary'
import { isLuxuryScarf, type LuxuryCustomShape, type LuxuryScarfData, type ScarfCenterMode } from '../engine/luxury/types'
import { consumePendingPattern, exportPatternAssetJson, patternAssetToSvg, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void; sourcePattern?: { svg: string; name: string } | null }
type FoldGuide = 'none' | 'diagonal' | 'triangle'
const EXPORT_PRESETS = [2048, 4096, 6000, 8000, 10000]
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scarf-hijab'

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <label className="v14-range"><span>{label}<b>{step < 1 ? value.toFixed(2) : Math.round(value)}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}/></label>
}

function currentAsset(name: string, data: LuxuryScarfData, svg: string): PatternAsset {
  const stamp = new Date().toISOString()
  return { id: 'luxury-scarf-preview', name: name.trim() || 'Scarf Hijab Composition', sourceType: 'luxury-composition', createdAt: stamp, updatedAt: stamp, svg, palette: [...data.palette], luxury: clone(data), tags: ['luxury',data.product,'scarf','hijab','composition'], meta: { luxuryMode: 'scarf', product: data.product, physicalSizeCm: data.physicalSizeCm, exportLongSide: data.exportLongSide } }
}

export default function ScarfHijabComposer({ onOpenLibrary, sourcePattern }: Props) {
  const [data, setData] = useState<LuxuryScarfData>(() => initialLuxuryScarf())
  const [name, setName] = useState('Calm Center Hijab 01')
  const [shapes, setShapes] = useState<LuxuryCustomShape[]>(() => loadLuxuryShapeLibrary())
  const [foldGuide, setFoldGuide] = useState<FoldGuide>('diagonal')
  const [showSafeGuide, setShowSafeGuide] = useState(true)
  const [message, setMessage] = useState('Use a saved Monogram, upload a pattern SVG, or compose with an empty calm center.')
  const patternInput = useRef<HTMLInputElement>(null)
  const cornerInput = useRef<HTMLInputElement>(null)
  const medallionInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const pending = consumePendingPattern('scarf')
    if (pending) {
      if (pending.luxury && isLuxuryScarf(pending.luxury)) {
        setData({ ...clone(pending.luxury), customShapes: clone(pending.luxury.customShapes ?? []) })
        setName(pending.name)
        setMessage(`${pending.name} reopened as an editable scarf/hijab composition.`)
      } else {
        const svg = patternAssetToSvg(pending)
        setData((current) => ({ ...current, sourcePatternSvg: svg, sourcePatternName: pending.name }))
        setMessage(`${pending.name} loaded as the scarf/hijab pattern source.`)
      }
    }
    const refresh = () => setShapes(loadLuxuryShapeLibrary())
    window.addEventListener(luxuryShapeLibraryEvent(), refresh)
    return () => window.removeEventListener(luxuryShapeLibraryEvent(), refresh)
  }, [])

  useEffect(() => {
    if (!sourcePattern?.svg) return
    setData((current) => ({ ...current, sourcePatternSvg: sourcePattern.svg, sourcePatternName: sourcePattern.name }))
    setMessage(`${sourcePattern.name} sent directly from Monogram Maker.`)
  }, [sourcePattern])

  const svg = useMemo(() => luxuryScarfSvg(data), [data])
  const cornerMotif = resolveLuxuryMotif(data.cornerShapeId, data.customShapes ?? [])
  const medallionMotif = resolveLuxuryMotif(data.medallionShapeId, data.customShapes ?? [])

  function patch<K extends keyof LuxuryScarfData>(key: K, value: LuxuryScarfData[K]) { setData((current) => ({ ...current, [key]: value })) }
  function paletteOptions() { return data.palette.map((color, index) => <option key={`${index}-${color}`} value={index}>#{index + 1} {color}</option>) }
  function setRole(target: 'corner' | 'medallion', role: string, index: number) {
    if (target === 'corner') patch('cornerColorRoles', { ...data.cornerColorRoles, [role]: index })
    else patch('medallionColorRoles', { ...data.medallionColorRoles, [role]: index })
  }

  async function importPattern(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    if (!/<svg\b/i.test(text)) { setMessage('Pattern source must be SVG.'); return }
    patch('sourcePatternSvg', text); patch('sourcePatternName', file.name.replace(/\.svg$/i, ''))
    setMessage(`${file.name} loaded as center/border pattern source.`)
  }

  function attachShape(shape: LuxuryCustomShape, target: 'corner' | 'medallion') {
    setData((current) => {
      const customShapes = [shape, ...(current.customShapes ?? []).filter((item) => item.id !== shape.id)]
      const mapping = Object.fromEntries(shape.roles.map((role, index) => [role, Math.min(index, current.palette.length - 1)]))
      if (target === 'corner') return { ...current, customShapes, cornerShapeId: shape.id, cornerEnabled: true, cornerColorRoles: mapping }
      return { ...current, customShapes, medallionShapeId: shape.id, medallionEnabled: true, medallionColorRoles: mapping }
    })
    setMessage(`${shape.name} is now the ${target} motif.`)
  }

  async function importShape(file: File | undefined, target: 'corner' | 'medallion') {
    if (!file) return
    try {
      const shape = parseLuxurySvgShape(await file.text(), file.name.replace(/\.svg$/i, ''), target)
      saveLuxuryShape(shape); attachShape(shape, target)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import SVG shape.') }
  }

  function applyTemplate(template: 'calm-hijab' | 'full-scarf' | 'medallion' | 'monogram-border') {
    setData((current) => luxuryScarfTemplate(current, template))
    setMessage(`${template.replaceAll('-', ' ')} template applied. All controls remain editable.`)
  }

  function saveAsset() {
    const asset = currentAsset(name, data, svg)
    savePatternAsset({ name: asset.name, sourceType: 'luxury-composition', svg: asset.svg, palette: asset.palette, luxury: asset.luxury, tags: asset.tags, meta: asset.meta })
    setMessage(`${asset.name} saved to My Patterns as an editable ${data.product} composition.`)
  }

  function exportPng() {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const size = Math.max(512, Math.min(8000, Math.round(data.exportLongSide)))
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.drawImage(image, 0, 0, size, size)
      canvas.toBlob((png) => { URL.revokeObjectURL(url); if (!png) return; const out = URL.createObjectURL(png); const a = document.createElement('a'); a.href = out; a.download = `${slug(name)}-${size}x${size}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(out), 1200) }, 'image/png')
    }
    image.src = url
  }

  const allDecorShapes = [...MAIN_LUXURY_MOTIFS, ...shapes]

  return <div className="v10-builder-shell v14-luxury-shell v15-scarf-shell">
    <aside className="v10-panel v10-panel-left">
      <section className="v14-intro"><h2>Scarf / Hijab Composer</h2><small>Finished square textile composition with border, corners, center field, medallion and fold-aware preview guides.</small></section>
      <section><h2>Product / Size</h2><div className="v14-mode-tabs"><button className={data.product === 'hijab' ? 'active' : ''} onClick={() => patch('product', 'hijab')}>Hijab</button><button className={data.product === 'scarf' ? 'active' : ''} onClick={() => patch('product', 'scarf')}>Scarf</button></div><label><span>Physical size</span><select value={data.physicalSizeCm} onChange={(e) => patch('physicalSizeCm', Number(e.target.value))}><option value="90">90 × 90 cm</option><option value="110">110 × 110 cm</option><option value="120">120 × 120 cm</option><option value="140">140 × 140 cm</option></select></label></section>
      <section><h2>Quick Templates</h2><div className="v15-template-grid"><button onClick={() => applyTemplate('calm-hijab')}>Calm Hijab</button><button onClick={() => applyTemplate('full-scarf')}>Full Scarf</button><button onClick={() => applyTemplate('medallion')}>Medallion</button><button onClick={() => applyTemplate('monogram-border')}>Monogram Border</button></div></section>
      <section><h2>Pattern Source</h2><b className="v15-source-name">{data.sourcePatternName || 'No pattern source loaded'}</b><button className="v09-primary" onClick={() => patternInput.current?.click()}>Upload Pattern SVG</button><input hidden ref={patternInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importPattern(e.target.files?.[0])}/><label className="v10-check"><input type="checkbox" checked={data.borderPatternEnabled} onChange={(e) => patch('borderPatternEnabled', e.target.checked)}/> Use source pattern in outer border</label><label><span>Center mode</span><select value={data.centerMode} onChange={(e) => patch('centerMode', e.target.value as ScarfCenterMode)}><option value="empty">Empty / Calm</option><option value="pattern">Full Pattern</option><option value="sparse-pattern">Sparse Pattern</option><option value="medallion">Medallion Only</option><option value="pattern-medallion">Pattern + Medallion</option></select></label><Range label="Pattern Scale" value={data.patternScale} min={60} max={360} onChange={(v) => patch('patternScale', v)}/><Range label="Pattern Opacity" value={data.centerPatternOpacity} min={0} max={1} step={.01} onChange={(v) => patch('centerPatternOpacity', v)}/><Range label="Calm Center" value={data.centerCalmness} min={0} max={1} step={.01} onChange={(v) => patch('centerCalmness', v)}/><Range label="Safe Center Inset" value={data.safeMargin} min={180} max={470} onChange={(v) => patch('safeMargin', v)}/></section>
      <section><h2>Border Structure</h2><Range label="Outer Border" value={data.outerBorderWidth} min={0} max={220} onChange={(v) => patch('outerBorderWidth', v)}/><Range label="Inner Border" value={data.innerBorderWidth} min={0} max={50} onChange={(v) => patch('innerBorderWidth', v)}/></section>
      <section><h2>Preview Guides</h2><div className="v15-template-grid"><button className={foldGuide === 'none' ? 'active' : ''} onClick={() => setFoldGuide('none')}>Flat</button><button className={foldGuide === 'diagonal' ? 'active' : ''} onClick={() => setFoldGuide('diagonal')}>Diagonal Fold</button><button className={foldGuide === 'triangle' ? 'active' : ''} onClick={() => setFoldGuide('triangle')}>Triangle Fold</button></div><label className="v10-check"><input type="checkbox" checked={showSafeGuide} onChange={(e) => setShowSafeGuide(e.target.checked)}/> Show safe center guide</label><small>Guides are preview-only and never exported.</small></section>
    </aside>

    <main className="v10-stage v14-stage"><header className="v10-stage-head"><div><b>{name}</b><span>{data.product} · {data.physicalSizeCm}×{data.physicalSizeCm} cm · square vector composition</span></div></header><div className="v14-preview"><div className="v14-preview-wrap v15-scarf-preview"><img src={svgDataUri(svg)} alt="Scarf or hijab design preview"/>{foldGuide !== 'none' || showSafeGuide ? <svg className="v15-guide-overlay" viewBox={`0 0 ${data.canvasSize} ${data.canvasSize}`} preserveAspectRatio="none">{foldGuide === 'diagonal' ? <line x1="0" y1="0" x2={data.canvasSize} y2={data.canvasSize}/> : null}{foldGuide === 'triangle' ? <><line x1="0" y1="0" x2={data.canvasSize} y2={data.canvasSize}/><path d={`M0 0H${data.canvasSize}L${data.canvasSize} ${data.canvasSize}Z`}/></> : null}{showSafeGuide ? <rect x={data.safeMargin} y={data.safeMargin} width={Math.max(0, data.canvasSize - data.safeMargin * 2)} height={Math.max(0, data.canvasSize - data.safeMargin * 2)}/> : null}</svg> : null}</div></div><footer className="v10-stage-foot"><span>{message}</span><b>GUIDES PREVIEW ONLY · CLEAN EXPORT</b></footer></main>

    <aside className="v10-panel v10-panel-right"><section><h2>Document</h2><label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><div className="v14-palette">{data.palette.map((color, index) => <label key={`${index}-${color}`}><input type="color" value={color} onChange={(e) => patch('palette', data.palette.map((c, i) => i === index ? e.target.value.toUpperCase() : c))}/><code>{color}</code></label>)}</div><label><span>Background</span><select value={data.backgroundColor} onChange={(e) => patch('backgroundColor', Number(e.target.value))}>{paletteOptions()}</select></label><label><span>Outer border color</span><select value={data.outerBorderColor} onChange={(e) => patch('outerBorderColor', Number(e.target.value))}>{paletteOptions()}</select></label><label><span>Inner border color</span><select value={data.innerBorderColor} onChange={(e) => patch('innerBorderColor', Number(e.target.value))}>{paletteOptions()}</select></label></section>
      <section><h2>Corner Motif</h2><label className="v10-check"><input type="checkbox" checked={data.cornerEnabled} onChange={(e) => patch('cornerEnabled', e.target.checked)}/> Enable corners</label><label><span>Shape</span><select value={data.cornerShapeId} onChange={(e) => patch('cornerShapeId', e.target.value)}>{allDecorShapes.map((shape) => <option key={`c-${shape.id}`} value={shape.id}>{shape.name}</option>)}</select></label><button onClick={() => cornerInput.current?.click()}>Upload Corner SVG</button><input hidden ref={cornerInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importShape(e.target.files?.[0], 'corner')}/><Range label="Corner Scale" value={data.cornerScale} min={.25} max={2.4} step={.01} onChange={(v) => patch('cornerScale', v)}/><Range label="Corner Inset" value={data.cornerInset} min={30} max={220} onChange={(v) => patch('cornerInset', v)}/><label><span>Corner behavior</span><select value={data.cornerMode} onChange={(e) => patch('cornerMode', e.target.value as LuxuryScarfData['cornerMode'])}><option value="rotate">Rotate around canvas</option><option value="mirror">Mirror pair</option><option value="same">Same orientation</option></select></label>{cornerMotif.roles.map((role) => <label key={`cr-${role}`}><span>{role}</span><select value={data.cornerColorRoles[role] ?? 0} onChange={(e) => setRole('corner', role, Number(e.target.value))}>{paletteOptions()}</select></label>)}</section>
      <section><h2>Center Medallion</h2><label className="v10-check"><input type="checkbox" checked={data.medallionEnabled} onChange={(e) => patch('medallionEnabled', e.target.checked)}/> Enable medallion</label><label><span>Shape</span><select value={data.medallionShapeId} onChange={(e) => patch('medallionShapeId', e.target.value)}>{allDecorShapes.map((shape) => <option key={`m-${shape.id}`} value={shape.id}>{shape.name}</option>)}</select></label><button onClick={() => medallionInput.current?.click()}>Upload Medallion SVG</button><input hidden ref={medallionInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importShape(e.target.files?.[0], 'medallion')}/><Range label="Medallion Scale" value={data.medallionScale} min={.5} max={5} step={.01} onChange={(v) => patch('medallionScale', v)}/>{medallionMotif.roles.map((role) => <label key={`mr-${role}`}><span>{role}</span><select value={data.medallionColorRoles[role] ?? 0} onChange={(e) => setRole('medallion', role, Number(e.target.value))}>{paletteOptions()}</select></label>)}</section>
      <section><h2>My SVG Shapes</h2>{!shapes.length ? <small>Custom Main/Filler/Corner/Medallion SVGs share one library.</small> : <div className="v15-shape-library compact">{shapes.map((shape) => <div key={shape.id}><b>{shape.name}</b><span>{shape.category}</span><div><button onClick={() => attachShape(shape, 'corner')}>Corner</button><button onClick={() => attachShape(shape, 'medallion')}>Center</button><button className="v09-danger" onClick={() => deleteLuxuryShape(shape.id)}>×</button></div></div>)}</div>}</section>
      <section><h2>Export</h2><div className="v14-export-grid">{EXPORT_PRESETS.map((size) => <button key={size} className={data.exportLongSide === size ? 'active' : ''} onClick={() => patch('exportLongSide', size)}>{size}</button>)}</div><label><span>Custom long side</span><input type="number" min="512" max="20000" value={data.exportLongSide} onChange={(e) => patch('exportLongSide', Math.max(512, Math.min(20000, Number(e.target.value) || 8000)))}/></label><button className="v09-primary" onClick={saveAsset}>Save Editable Scarf / Hijab</button><button onClick={() => downloadText(svg, `${slug(name)}-${data.exportLongSide}.svg`, 'image/svg+xml;charset=utf-8')}>Export SVG</button><button onClick={exportPng}>Export PNG</button><button onClick={() => downloadText(exportPatternAssetJson(currentAsset(name, data, svg)), `${slug(name)}.pattern.json`, 'application/json;charset=utf-8')}>Export Pattern JSON</button><button onClick={onOpenLibrary}>Open My Patterns</button></section>
    </aside>
  </div>
}
