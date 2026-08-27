import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { MAIN_LUXURY_MOTIFS, resolveLuxuryMotif } from '../engine/luxury/motifs'
import { initialLuxuryScarf, luxuryScarfSvg, luxuryScarfTemplate, normalizeLuxuryScarf, type ScarfTemplate } from '../engine/luxury/scarfEngine'
import { loadLuxuryShapeLibrary, luxuryShapeLibraryEvent, parseLuxurySvgShape, saveLuxuryShape } from '../engine/luxury/shapeLibrary'
import {
  isLuxuryScarf,
  type LuxuryCustomShape,
  type LuxuryScarfData,
  type ScarfCenterMode,
  type ScarfCorner,
  type ScarfCornerSlot,
  type ScarfFrameLayer,
  type ScarfSide,
  type ScarfSidePattern,
} from '../engine/luxury/types'
import { consumePendingPattern, exportPatternAssetJson, patternAssetToSvg, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void; sourcePattern?: { svg: string; name: string } | null }
type FoldGuide = 'none' | 'diagonal' | 'triangle' | 'wear'
const EXPORT_PRESETS = [2048, 4096, 6000, 8000, 10000]
const SIDES: ScarfSide[] = ['top', 'right', 'bottom', 'left']
const CORNERS: ScarfCorner[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']
const FRAME_IDS: ScarfFrameLayer['id'][] = ['outer', 'inner', 'accent']
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
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

function currentAsset(name: string, raw: LuxuryScarfData): PatternAsset {
  const data = normalizeLuxuryScarf(raw)
  const svg = luxuryScarfSvg(data)
  const stamp = new Date().toISOString()
  return { id: 'luxury-scarf-preview', name: name.trim() || 'Scarf Hijab Composition', sourceType: 'luxury-composition', createdAt: stamp, updatedAt: stamp, svg, palette: [...data.palette], luxury: clone(data), tags: ['luxury', data.product, 'scarf', 'hijab', 'composition', 'zone-based'], meta: { luxuryMode: 'scarf', product: data.product, physicalSizeCm: data.physicalSizeCm, exportLongSide: data.exportLongSide, scarfStudioVersion: 2 } }
}

function oppositeSide(side: ScarfSide): ScarfSide {
  return side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left'
}

function sideLabel(side: ScarfSide) { return side[0].toUpperCase() + side.slice(1) }
function cornerLabel(corner: ScarfCorner) { return ({ topLeft: 'Top Left', topRight: 'Top Right', bottomRight: 'Bottom Right', bottomLeft: 'Bottom Left' } as Record<ScarfCorner, string>)[corner] }

export default function ScarfHijabComposer({ onOpenLibrary, sourcePattern }: Props) {
  const [data, setData] = useState<LuxuryScarfData>(() => initialLuxuryScarf())
  const [name, setName] = useState('Scarf Studio Composition 01')
  const [shapes, setShapes] = useState<LuxuryCustomShape[]>(() => loadLuxuryShapeLibrary())
  const [activeSide, setActiveSide] = useState<ScarfSide>('top')
  const [activeFrame, setActiveFrame] = useState<ScarfFrameLayer['id']>('outer')
  const [activeCorner, setActiveCorner] = useState<ScarfCorner>('topLeft')
  const [foldGuide, setFoldGuide] = useState<FoldGuide>('diagonal')
  const [showSafeGuide, setShowSafeGuide] = useState(true)
  const [message, setMessage] = useState('Zone-based studio ready: Sides, Frames, Corners, Center and Border Scatter.')
  const [previewUrl, setPreviewUrl] = useState('')
  const patternInput = useRef<HTMLInputElement>(null)
  const sideInput = useRef<HTMLInputElement>(null)
  const frameInput = useRef<HTMLInputElement>(null)
  const cornerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const pending = consumePendingPattern('scarf')
    if (pending) {
      if (pending.luxury && isLuxuryScarf(pending.luxury)) {
        setData(normalizeLuxuryScarf(clone(pending.luxury)))
        setName(pending.name)
        setMessage(`${pending.name} reopened in Scarf Studio v2.`)
      } else {
        const svg = patternAssetToSvg(pending)
        setData((current) => ({ ...normalizeLuxuryScarf(current), sourcePatternSvg: svg, sourcePatternName: pending.name }))
        setMessage(`${pending.name} loaded as the global pattern source.`)
      }
    }
    const refresh = () => setShapes(loadLuxuryShapeLibrary())
    window.addEventListener(luxuryShapeLibraryEvent(), refresh)
    return () => window.removeEventListener(luxuryShapeLibraryEvent(), refresh)
  }, [])

  useEffect(() => {
    if (!sourcePattern?.svg) return
    setData((current) => ({ ...normalizeLuxuryScarf(current), sourcePatternSvg: sourcePattern.svg, sourcePatternName: sourcePattern.name }))
    setMessage(`${sourcePattern.name} received from Monogram Maker.`)
  }, [sourcePattern])

  const normalized = useMemo(() => normalizeLuxuryScarf(data), [data])
  const deferredData = useDeferredValue(normalized)
  const previewSvg = useMemo(() => luxuryScarfSvg(deferredData), [deferredData])

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([previewSvg], { type: 'image/svg+xml;charset=utf-8' }))
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [previewSvg])

  const side = normalized.sides![activeSide]
  const frame = normalized.frames!.find((item) => item.id === activeFrame) ?? normalized.frames![0]
  const corner = normalized.corners![activeCorner]
  const cornerMotif = resolveLuxuryMotif(corner.shapeId, normalized.customShapes ?? [])
  const allDecorShapes = [...MAIN_LUXURY_MOTIFS, ...shapes]

  function patch<K extends keyof LuxuryScarfData>(key: K, value: LuxuryScarfData[K]) { setData((current) => ({ ...normalizeLuxuryScarf(current), [key]: value })) }
  function paletteOptions() { return normalized.palette.map((color, index) => <option key={`${index}-${color}`} value={index}>#{index + 1} {color}</option>) }

  function sideTargets(current: LuxuryScarfData) {
    if (current.sideLinkMode === 'all') return SIDES
    if (current.sideLinkMode === 'opposite') return [activeSide, oppositeSide(activeSide)]
    return [activeSide]
  }
  function patchSide<K extends keyof ScarfSidePattern>(key: K, value: ScarfSidePattern[K]) {
    setData((currentRaw) => {
      const current = normalizeLuxuryScarf(currentRaw)
      const sides = clone(current.sides!)
      sideTargets(current).forEach((target) => { sides[target] = { ...sides[target], [key]: value } })
      return { ...current, sides }
    })
  }
  function patchFrame<K extends keyof ScarfFrameLayer>(key: K, value: ScarfFrameLayer[K]) {
    setData((currentRaw) => {
      const current = normalizeLuxuryScarf(currentRaw)
      return { ...current, frames: current.frames!.map((item) => item.id === activeFrame ? { ...item, [key]: value } : item) }
    })
  }
  function patchCorner<K extends keyof ScarfCornerSlot>(key: K, value: ScarfCornerSlot[K]) {
    setData((currentRaw) => {
      const current = normalizeLuxuryScarf(currentRaw)
      const corners = clone(current.corners!)
      const targets = current.cornerLinkMode === 'all' ? CORNERS : [activeCorner]
      targets.forEach((target) => { corners[target] = { ...corners[target], [key]: value } })
      return { ...current, corners }
    })
  }

  async function readSvg(file: File | undefined) {
    if (!file) return null
    const text = await file.text()
    if (!/<svg\b/i.test(text)) { setMessage('Please upload an SVG file.'); return null }
    return { svg: text, name: file.name.replace(/\.svg$/i, '') }
  }
  async function importGlobalPattern(file: File | undefined) {
    const loaded = await readSvg(file); if (!loaded) return
    patch('sourcePatternSvg', loaded.svg); patch('sourcePatternName', loaded.name)
    setMessage(`${loaded.name} loaded as global pattern source.`)
  }
  async function importSidePattern(file: File | undefined) {
    const loaded = await readSvg(file); if (!loaded) return
    patchSide('sourceSvg', loaded.svg); patchSide('sourceName', loaded.name); patchSide('enabled', true)
    setMessage(`${loaded.name} applied to ${normalized.sideLinkMode === 'independent' ? sideLabel(activeSide) : normalized.sideLinkMode === 'opposite' ? 'opposite sides' : 'all sides'}.`)
  }
  async function importFramePattern(file: File | undefined) {
    const loaded = await readSvg(file); if (!loaded) return
    patchFrame('patternSvg', loaded.svg); patchFrame('patternName', loaded.name); patchFrame('source', 'custom-pattern')
    setMessage(`${loaded.name} applied to ${frame.name}.`)
  }
  async function importCornerShape(file: File | undefined) {
    if (!file) return
    try {
      const shape = parseLuxurySvgShape(await file.text(), file.name.replace(/\.svg$/i, ''), 'corner')
      saveLuxuryShape(shape)
      setData((currentRaw) => {
        const current = normalizeLuxuryScarf(currentRaw)
        const customShapes = [shape, ...(current.customShapes ?? []).filter((item) => item.id !== shape.id)]
        const mapping = Object.fromEntries(shape.roles.map((role, index) => [role, Math.min(index, current.palette.length - 1)]))
        const corners = clone(current.corners!)
        const targets = current.cornerLinkMode === 'all' ? CORNERS : [activeCorner]
        targets.forEach((target) => { corners[target] = { ...corners[target], enabled: true, shapeId: shape.id, colorRoles: mapping } })
        return { ...current, customShapes, corners }
      })
      setMessage(`${shape.name} loaded into corner system.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import corner SVG.') }
  }

  function useShapeAsCorner(shape: LuxuryCustomShape | (typeof MAIN_LUXURY_MOTIFS)[number]) {
    patchCorner('shapeId', shape.id)
    patchCorner('enabled', true)
    if ('body' in shape && 'originalColors' in shape) {
      setData((currentRaw) => {
        const current = normalizeLuxuryScarf(currentRaw)
        return { ...current, customShapes: [shape, ...(current.customShapes ?? []).filter((item) => item.id !== shape.id)] }
      })
    }
  }

  function applyTemplate(template: ScarfTemplate) {
    setData((current) => luxuryScarfTemplate(current, template))
    setMessage(`${template.replaceAll('-', ' ')} template applied.`)
  }

  function saveAsset() {
    const asset = currentAsset(name, normalized)
    savePatternAsset({ name: asset.name, sourceType: 'luxury-composition', svg: asset.svg, palette: asset.palette, luxury: asset.luxury, tags: asset.tags, meta: asset.meta })
    setMessage(`${asset.name} saved as an editable Scarf Studio composition.`)
  }
  function exportSvg() { const asset = currentAsset(name, normalized); downloadText(asset.svg!, `${slug(name)}-${normalized.exportLongSide}.svg`, 'image/svg+xml') }
  function exportJson() { downloadText(exportPatternAssetJson(currentAsset(name, normalized)), `${slug(name)}.pattern.json`, 'application/json') }
  function exportPng() {
    const exactSvg = luxuryScarfSvg(normalized)
    const url = URL.createObjectURL(new Blob([exactSvg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const size = Math.max(512, Math.min(8000, Math.round(normalized.exportLongSide)))
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.drawImage(image, 0, 0, size, size)
      canvas.toBlob((png) => { URL.revokeObjectURL(url); if (!png) return; const out = URL.createObjectURL(png); const a = document.createElement('a'); a.href = out; a.download = `${slug(name)}-${size}x${size}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(out), 1200) }, 'image/png')
    }
    image.src = url
  }

  return <div className="v10-builder-shell v14-luxury-shell v15-scarf-shell v18-scarf-shell">
    <aside className="v10-panel v10-panel-left">
      <section className="v14-intro"><h2>Scarf / Hijab Studio</h2><small>Zone-based textile composer. Build four sides, layered frames, corners, center field and border-to-center transitions independently or with symmetry.</small></section>

      <section><h2>Product / Templates</h2><div className="v14-mode-tabs"><button className={normalized.product === 'hijab' ? 'active' : ''} onClick={() => patch('product', 'hijab')}>Hijab</button><button className={normalized.product === 'scarf' ? 'active' : ''} onClick={() => patch('product', 'scarf')}>Scarf</button></div><label><span>Physical size</span><select value={normalized.physicalSizeCm} onChange={(e) => patch('physicalSizeCm', Number(e.target.value))}><option value="90">90 × 90 cm</option><option value="110">110 × 110 cm</option><option value="120">120 × 120 cm</option><option value="140">140 × 140 cm</option></select></label><div className="v18-template-grid"><button onClick={() => applyTemplate('calm-hijab')}>Calm</button><button onClick={() => applyTemplate('four-side')}>4-Side</button><button onClick={() => applyTemplate('mirror-frame')}>Mirror</button><button onClick={() => applyTemplate('scatter-border')}>Scatter</button><button onClick={() => applyTemplate('full-scarf')}>Full</button><button onClick={() => applyTemplate('medallion')}>Medallion</button><button onClick={() => applyTemplate('monogram-border')}>Pattern Frame</button></div></section>

      <section><h2>Global Pattern Source</h2><b className="v15-source-name">{normalized.sourcePatternName || 'No global pattern loaded'}</b><button className="v09-primary" onClick={() => patternInput.current?.click()}>Upload Global Pattern SVG</button><input hidden ref={patternInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importGlobalPattern(e.target.files?.[0])}/><small>Global source can feed center, frame, sides and border scatter. A side/frame can override it with its own SVG.</small></section>

      <section><h2>Side Patterns</h2><div className="v18-zone-tabs">{SIDES.map((item) => <button key={item} className={activeSide === item ? 'active' : ''} onClick={() => setActiveSide(item)}>{sideLabel(item)}</button>)}</div><label><span>Link sides</span><select value={normalized.sideLinkMode} onChange={(e) => patch('sideLinkMode', e.target.value as LuxuryScarfData['sideLinkMode'])}><option value="all">All Sides</option><option value="opposite">Opposite Sides</option><option value="independent">Independent</option></select></label><label><span>Symmetry</span><select value={normalized.sideSymmetry} onChange={(e) => patch('sideSymmetry', e.target.value as LuxuryScarfData['sideSymmetry'])}><option value="copy">Copy</option><option value="rotate">4-Way Rotate</option><option value="mirror">4-Way Mirror</option><option value="alternate">Rotate + Alternate Mirror</option></select></label><label className="v10-check"><input type="checkbox" checked={side.enabled} onChange={(e) => patchSide('enabled', e.target.checked)}/> Enable {sideLabel(activeSide)} zone</label><b className="v15-source-name">{side.sourceName || normalized.sourcePatternName || 'Uses global pattern when available'}</b><div className="v18-inline-actions"><button onClick={() => sideInput.current?.click()}>Upload Side SVG</button><button onClick={() => { patchSide('sourceSvg', undefined); patchSide('sourceName', undefined) }}>Use Global</button></div><input hidden ref={sideInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importSidePattern(e.target.files?.[0])}/><Range label="Motif Scale" value={side.scale} min={30} max={260} onChange={(v) => patchSide('scale', v)}/><Range label="Spacing" value={side.spacing} min={-40} max={160} onChange={(v) => patchSide('spacing', v)}/><Range label="Along Offset" value={side.offset} min={-250} max={250} onChange={(v) => patchSide('offset', v)}/><Range label="Band Width" value={side.bandWidth} min={20} max={220} onChange={(v) => patchSide('bandWidth', v)}/><Range label="Inset" value={side.inset} min={0} max={260} onChange={(v) => patchSide('inset', v)}/><Range label="Rotation Offset" value={side.rotation} min={-180} max={180} onChange={(v) => patchSide('rotation', v)}/><Range label="Opacity" value={side.opacity} min={0} max={1} step={.01} onChange={(v) => patchSide('opacity', v)}/><div className="v18-inline-checks"><label className="v10-check"><input type="checkbox" checked={side.mirrorX} onChange={(e) => patchSide('mirrorX', e.target.checked)}/> Mirror X</label><label className="v10-check"><input type="checkbox" checked={side.mirrorY} onChange={(e) => patchSide('mirrorY', e.target.checked)}/> Mirror Y</label></div></section>

      <section><h2>Frames</h2><div className="v18-zone-tabs">{FRAME_IDS.map((id) => <button key={id} className={activeFrame === id ? 'active' : ''} onClick={() => setActiveFrame(id)}>{id}</button>)}</div><label className="v10-check"><input type="checkbox" checked={frame.enabled} onChange={(e) => patchFrame('enabled', e.target.checked)}/> Enable {frame.name}</label><label><span>Frame source</span><select value={frame.source} onChange={(e) => patchFrame('source', e.target.value as ScarfFrameLayer['source'])}><option value="solid">Solid Color</option><option value="global-pattern">Global Pattern</option><option value="custom-pattern">Custom Pattern</option></select></label>{frame.source === 'custom-pattern' ? <><b className="v15-source-name">{frame.patternName || 'No custom frame SVG'}</b><button onClick={() => frameInput.current?.click()}>Upload Frame SVG</button><input hidden ref={frameInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importFramePattern(e.target.files?.[0])}/></> : null}<Range label="Frame Width" value={frame.width} min={0} max={220} onChange={(v) => patchFrame('width', v)}/><Range label="Frame Inset" value={frame.inset} min={0} max={360} onChange={(v) => patchFrame('inset', v)}/>{frame.source !== 'solid' ? <Range label="Pattern Scale" value={frame.patternScale} min={30} max={260} onChange={(v) => patchFrame('patternScale', v)}/> : null}<Range label="Opacity" value={frame.opacity} min={0} max={1} step={.01} onChange={(v) => patchFrame('opacity', v)}/><label><span>Solid / fallback color</span><select value={frame.color} onChange={(e) => patchFrame('color', Number(e.target.value))}>{paletteOptions()}</select></label></section>

      <section><h2>Border Scatter / Transition</h2><label className="v10-check"><input type="checkbox" checked={normalized.scatter!.enabled} onChange={(e) => patch('scatter', { ...normalized.scatter!, enabled: e.target.checked })}/> Enable border-to-center breakup</label><Range label="Depth" value={normalized.scatter!.depth} min={20} max={320} onChange={(v) => patch('scatter', { ...normalized.scatter!, depth: v })}/><Range label="Rows" value={normalized.scatter!.rows} min={1} max={8} onChange={(v) => patch('scatter', { ...normalized.scatter!, rows: Math.round(v) })}/><Range label="Density" value={normalized.scatter!.density} min={.2} max={1.5} step={.01} onChange={(v) => patch('scatter', { ...normalized.scatter!, density: v })}/><Range label="Base Opacity" value={normalized.scatter!.baseOpacity} min={0} max={1} step={.01} onChange={(v) => patch('scatter', { ...normalized.scatter!, baseOpacity: v })}/><Range label="Scale Falloff" value={normalized.scatter!.scaleFalloff} min={0} max={1} step={.01} onChange={(v) => patch('scatter', { ...normalized.scatter!, scaleFalloff: v })}/><Range label="Opacity Falloff" value={normalized.scatter!.opacityFalloff} min={0} max={1} step={.01} onChange={(v) => patch('scatter', { ...normalized.scatter!, opacityFalloff: v })}/></section>
    </aside>

    <main className="v10-stage v14-stage"><header className="v10-stage-head"><div><b>{name}</b><span>{normalized.product} · {normalized.physicalSizeCm}×{normalized.physicalSizeCm} cm · Scarf Studio v2</span></div></header><div className="v14-preview"><div className="v14-preview-wrap v15-scarf-preview">{previewUrl ? <img src={previewUrl} alt="Scarf or hijab design preview"/> : null}{foldGuide !== 'none' || showSafeGuide ? <svg className="v15-guide-overlay v18-guide-overlay" viewBox={`0 0 ${normalized.canvasSize} ${normalized.canvasSize}`} preserveAspectRatio="none">{foldGuide === 'diagonal' ? <line x1="0" y1="0" x2={normalized.canvasSize} y2={normalized.canvasSize}/> : null}{foldGuide === 'triangle' ? <><line x1="0" y1="0" x2={normalized.canvasSize} y2={normalized.canvasSize}/><path d={`M0 0H${normalized.canvasSize}L${normalized.canvasSize} ${normalized.canvasSize}Z`}/></> : null}{foldGuide === 'wear' ? <><path className="v18-wear-muted" d={`M0 0H${normalized.canvasSize}L0 ${normalized.canvasSize}Z`}/><path className="v18-wear-focus" d={`M0 ${normalized.canvasSize}L${normalized.canvasSize} ${normalized.canvasSize}L${normalized.canvasSize} 0Z`}/></> : null}{showSafeGuide ? <rect x={normalized.safeMargin} y={normalized.safeMargin} width={Math.max(0, normalized.canvasSize - normalized.safeMargin * 2)} height={Math.max(0, normalized.canvasSize - normalized.safeMargin * 2)}/> : null}</svg> : null}</div></div><footer className="v10-stage-foot"><span>{message}</span><b>DEFERRED PREVIEW · FULL VECTOR EXPORT</b></footer></main>

    <aside className="v10-panel v10-panel-right">
      <section><h2>Document / Palette</h2><label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)}/></label><div className="v14-palette">{normalized.palette.map((color, index) => <label key={`${index}-${color}`}><input type="color" value={color} onChange={(e) => patch('palette', normalized.palette.map((c, i) => i === index ? e.target.value.toUpperCase() : c))}/><code>{color}</code></label>)}</div><label><span>Background</span><select value={normalized.backgroundColor} onChange={(e) => patch('backgroundColor', Number(e.target.value))}>{paletteOptions()}</select></label></section>

      <section><h2>Corners</h2><div className="v18-zone-tabs">{CORNERS.map((item) => <button key={item} className={activeCorner === item ? 'active' : ''} onClick={() => setActiveCorner(item)}>{cornerLabel(item)}</button>)}</div><label><span>Corner linking</span><select value={normalized.cornerLinkMode} onChange={(e) => patch('cornerLinkMode', e.target.value as LuxuryScarfData['cornerLinkMode'])}><option value="all">All Corners</option><option value="independent">Independent</option></select></label><label><span>Corner symmetry</span><select value={normalized.cornerMode} onChange={(e) => patch('cornerMode', e.target.value as LuxuryScarfData['cornerMode'])}><option value="rotate">Rotate 90°</option><option value="mirror">Mirror Around Canvas</option><option value="same">Same Orientation</option></select></label><label className="v10-check"><input type="checkbox" checked={corner.enabled} onChange={(e) => patchCorner('enabled', e.target.checked)}/> Enable corner</label><label><span>Shape</span><select value={corner.shapeId} onChange={(e) => { const selected = allDecorShapes.find((shape) => shape.id === e.target.value); if (selected) useShapeAsCorner(selected) }}>{allDecorShapes.map((shape) => <option key={`corner-${shape.id}`} value={shape.id}>{shape.name}</option>)}</select></label><button onClick={() => cornerInput.current?.click()}>Upload Corner SVG</button><input hidden ref={cornerInput} type="file" accept=".svg,image/svg+xml" onChange={(e) => importCornerShape(e.target.files?.[0])}/><Range label="Corner Scale" value={corner.scale} min={.25} max={4} step={.01} onChange={(v) => patchCorner('scale', v)}/><Range label="Corner Inset" value={corner.inset} min={20} max={300} onChange={(v) => patchCorner('inset', v)}/><Range label="Rotation Offset" value={corner.rotation} min={-180} max={180} onChange={(v) => patchCorner('rotation', v)}/><div className="v18-inline-checks"><label className="v10-check"><input type="checkbox" checked={corner.mirrorX} onChange={(e) => patchCorner('mirrorX', e.target.checked)}/> Mirror X</label><label className="v10-check"><input type="checkbox" checked={corner.mirrorY} onChange={(e) => patchCorner('mirrorY', e.target.checked)}/> Mirror Y</label></div>{cornerMotif.roles.map((role) => <label key={role}><span>{role}</span><select value={corner.colorRoles[role] ?? 0} onChange={(e) => patchCorner('colorRoles', { ...corner.colorRoles, [role]: Number(e.target.value) })}>{paletteOptions()}</select></label>)}</section>

      <section><h2>Center Field</h2><label><span>Center mode</span><select value={normalized.centerMode} onChange={(e) => patch('centerMode', e.target.value as ScarfCenterMode)}><option value="empty">Empty / Calm</option><option value="pattern">Full Pattern</option><option value="sparse-pattern">Sparse Pattern</option><option value="medallion">Medallion Only</option><option value="pattern-medallion">Pattern + Medallion</option></select></label><Range label="Pattern Scale" value={normalized.patternScale} min={50} max={420} onChange={(v) => patch('patternScale', v)}/><Range label="Pattern Opacity" value={normalized.centerPatternOpacity} min={0} max={1} step={.01} onChange={(v) => patch('centerPatternOpacity', v)}/><Range label="Center Calmness" value={normalized.centerCalmness} min={0} max={1} step={.01} onChange={(v) => patch('centerCalmness', v)}/><Range label="Safe Center Inset" value={normalized.safeMargin} min={120} max={480} onChange={(v) => patch('safeMargin', v)}/><label className="v10-check"><input type="checkbox" checked={normalized.medallionEnabled} onChange={(e) => patch('medallionEnabled', e.target.checked)}/> Center medallion</label>{normalized.medallionEnabled || normalized.centerMode.includes('medallion') ? <><label><span>Medallion shape</span><select value={normalized.medallionShapeId} onChange={(e) => patch('medallionShapeId', e.target.value)}>{allDecorShapes.map((shape) => <option key={`med-${shape.id}`} value={shape.id}>{shape.name}</option>)}</select></label><Range label="Medallion Scale" value={normalized.medallionScale} min={.5} max={6} step={.01} onChange={(v) => patch('medallionScale', v)}/></> : null}</section>

      <section><h2>Fold / Wear Preview</h2><div className="v18-template-grid"><button className={foldGuide === 'none' ? 'active' : ''} onClick={() => setFoldGuide('none')}>Flat</button><button className={foldGuide === 'diagonal' ? 'active' : ''} onClick={() => setFoldGuide('diagonal')}>Diagonal</button><button className={foldGuide === 'triangle' ? 'active' : ''} onClick={() => setFoldGuide('triangle')}>Triangle</button><button className={foldGuide === 'wear' ? 'active' : ''} onClick={() => setFoldGuide('wear')}>Wear Focus</button></div><label className="v10-check"><input type="checkbox" checked={showSafeGuide} onChange={(e) => setShowSafeGuide(e.target.checked)}/> Show safe center guide</label><small>Fold and wear overlays are preview-only.</small></section>

      <section><h2>Output</h2><div className="v14-export-grid">{EXPORT_PRESETS.map((size) => <button key={size} className={normalized.exportLongSide === size ? 'active' : ''} onClick={() => patch('exportLongSide', size)}>{size}</button>)}</div><label><span>Custom SVG long side</span><input type="number" min="512" max="20000" value={normalized.exportLongSide} onChange={(e) => patch('exportLongSide', Math.max(512, Math.min(20000, Number(e.target.value) || 4096)))}/></label><button className="v09-primary" onClick={saveAsset}>Save Editable Studio</button><button onClick={exportSvg}>Export SVG</button><button onClick={exportPng}>Export PNG</button><button onClick={exportJson}>Export Pattern JSON</button><button onClick={onOpenLibrary}>Open My Patterns</button></section>
    </aside>
  </div>
}
