import { useMemo, useRef, useState } from 'react'
import { savePatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void }
type TemplateId = 'balanced' | 'airy' | 'dense' | 'flowing' | 'large-small' | 'cluster' | 'directional' | 'half-drop'
type Distribution = 'cycle' | 'shuffle' | 'primary-accent'
type ViewMode = 'proof' | 'tile' | 'guide'
type MotifAsset = { id: string; name: string; inner: string; x: number; y: number; width: number; height: number }
type Slot = { x: number; y: number; scale: number; rotation: number; asset: number }

type TemplateMeta = { id: TemplateId; label: string; note: string; badge: string }

const TEMPLATES: TemplateMeta[] = [
  { id: 'balanced', label: 'Balanced Scatter', note: 'Even natural spacing with no obvious rows.', badge: 'ALL-ROUND' },
  { id: 'airy', label: 'Airy Scatter', note: 'More breathing room for larger hero motifs.', badge: 'LIGHT' },
  { id: 'dense', label: 'Dense Toss', note: 'Busy fill with smaller interlocking motifs.', badge: 'BUSY' },
  { id: 'flowing', label: 'Flowing Diagonal', note: 'A loose diagonal rhythm without rigid stripes.', badge: 'FLOW' },
  { id: 'large-small', label: 'Large + Small Mix', note: 'Alternates hero motifs and small fillers.', badge: 'MIXED' },
  { id: 'cluster', label: 'Cluster + Space', note: 'Organic mini-clusters separated by calm pockets.', badge: 'ORGANIC' },
  { id: 'directional', label: 'Directional Toss', note: 'Loose scatter with a shared directional bias.', badge: 'TOSS' },
  { id: 'half-drop', label: 'Soft Half-Drop', note: 'Half-drop structure softened by controlled jitter.', badge: 'CLASSIC' },
]

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const uid = () => crypto.randomUUID().replaceAll('-', '').slice(0, 12)
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scattered-pattern'
const dataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6D2B79F5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashTemplate(id: string) {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}

function torusDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx0 = Math.abs(a.x - b.x); const dy0 = Math.abs(a.y - b.y)
  const dx = Math.min(dx0, 1 - dx0); const dy = Math.min(dy0, 1 - dy0)
  return Math.hypot(dx, dy)
}

function sanitizeSvg(raw: string, prefix: string): MotifAsset {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const root = doc.documentElement
  if (root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Invalid SVG file.')
  root.querySelectorAll('script, foreignObject').forEach((node) => node.remove())
  const ids = new Map<string, string>()
  root.querySelectorAll<HTMLElement>('[id]').forEach((node) => {
    const old = node.id; if (!old) return
    const next = `${prefix}-${old.replace(/[^a-zA-Z0-9_-]/g, '-')}`; ids.set(old, next); node.id = next
  })
  root.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const key = attr.name.toLowerCase(); let value = attr.value
      if (key.startsWith('on') || /^javascript:/i.test(value)) { node.removeAttribute(attr.name); return }
      ids.forEach((next, old) => {
        value = value.replaceAll(`url(#${old})`, `url(#${next})`)
        if (value === `#${old}`) value = `#${next}`
      })
      node.setAttribute(attr.name, value)
    })
  })
  root.querySelectorAll('style').forEach((style) => {
    let css = style.textContent ?? ''
    ids.forEach((next, old) => { css = css.replaceAll(`#${old}`, `#${next}`) })
    style.textContent = css
  })
  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[ ,]+/).map(Number)
  const widthAttr = parseFloat(root.getAttribute('width') ?? '')
  const heightAttr = parseFloat(root.getAttribute('height') ?? '')
  const x = vb.length === 4 && vb.every(Number.isFinite) ? vb[0] : 0
  const y = vb.length === 4 && vb.every(Number.isFinite) ? vb[1] : 0
  const width = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 ? vb[2] : (Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : 100)
  const height = vb.length === 4 && vb.every(Number.isFinite) && vb[3] > 0 ? vb[3] : (Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : 100)
  const inner = Array.from(root.childNodes).map((node) => new XMLSerializer().serializeToString(node)).join('')
  return { id: prefix, name: 'motif.svg', inner, x, y, width, height }
}

function assignAssets(slots: Omit<Slot, 'asset'>[], count: number, distribution: Distribution, random: () => number) {
  if (count <= 1) return slots.map((slot) => ({ ...slot, asset: 0 }))
  return slots.map((slot, index) => {
    if (distribution === 'cycle') return { ...slot, asset: index % count }
    if (distribution === 'shuffle') return { ...slot, asset: Math.floor(random() * count) }
    return { ...slot, asset: slot.scale >= 1.08 ? 0 : 1 + (index % (count - 1)) }
  })
}

function poissonScatter(count: number, random: () => number, minDistance: number, make: (index: number, r: () => number) => Omit<Slot, 'asset'>) {
  const slots: Omit<Slot, 'asset'>[] = []
  for (let i = 0; i < count; i++) {
    let best = make(i, random); let bestScore = -1
    for (let attempt = 0; attempt < 55; attempt++) {
      const candidate = make(i, random)
      const score = slots.length ? Math.min(...slots.map((slot) => torusDistance(candidate, slot))) : 1
      if (score > bestScore) { best = candidate; bestScore = score }
      if (score >= minDistance) break
    }
    slots.push(best)
  }
  return slots
}

function generateSlots(template: TemplateId, requestedCount: number, seed: number, jitter: number, scaleVariation: number, rotation: number, minGap: number, assetCount: number, distribution: Distribution) {
  const random = rng(seed + hashTemplate(template))
  const j = jitter / 100
  const sv = scaleVariation / 100
  const rot = rotation
  let count = requestedCount
  if (template === 'airy') count = Math.max(6, Math.round(requestedCount * .7))
  if (template === 'dense') count = Math.min(54, requestedCount + 8)
  const base = (scale = 1, angle = (random() * 2 - 1) * rot): Omit<Slot, 'asset'> => ({ x: random(), y: random(), scale: scale * (1 + (random() * 2 - 1) * sv), rotation: angle })
  let raw: Omit<Slot, 'asset'>[] = []
  const minDistance = clamp(minGap / 100, .035, .23)

  if (template === 'half-drop') {
    const cols = Math.max(2, Math.ceil(Math.sqrt(count)))
    const rows = Math.ceil(count / cols)
    for (let row = 0; row < rows && raw.length < count; row++) for (let col = 0; col < cols && raw.length < count; col++) {
      const x = (col + .5 + (row % 2 ? .5 : 0)) / cols
      const y = (row + .5) / rows
      raw.push({ x: (x + (random() * 2 - 1) * j / cols + 1) % 1, y: (y + (random() * 2 - 1) * j / rows + 1) % 1, scale: 1 + (random() * 2 - 1) * sv, rotation: (random() * 2 - 1) * rot })
    }
  } else if (template === 'flowing') {
    raw = poissonScatter(count, random, minDistance, (index, r) => {
      const band = index % 5; const y = (index / count + r() * .22) % 1
      const x = (y * .78 + band * .19 + (r() * 2 - 1) * (.08 + j * .08)) % 1
      return { x: (x + 1) % 1, y, scale: 1 + (r() * 2 - 1) * sv, rotation: -18 + (r() * 2 - 1) * rot * .55 }
    })
  } else if (template === 'cluster') {
    const centers = [{ x: .18, y: .22 }, { x: .72, y: .28 }, { x: .46, y: .73 }, { x: .91, y: .82 }]
    raw = Array.from({ length: count }, (_, index) => {
      const c = centers[index % centers.length]; const radius = .06 + random() * (.1 + j * .08); const angle = random() * Math.PI * 2
      return { x: (c.x + Math.cos(angle) * radius + 1) % 1, y: (c.y + Math.sin(angle) * radius + 1) % 1, scale: (index % 5 === 0 ? 1.22 : .84) * (1 + (random() * 2 - 1) * sv), rotation: (random() * 2 - 1) * rot }
    })
  } else if (template === 'large-small') {
    raw = poissonScatter(count, random, minDistance * .92, (index, r) => base(index % 4 === 0 ? 1.36 : .72 + r() * .22, (r() * 2 - 1) * rot))
  } else if (template === 'directional') {
    raw = poissonScatter(count, random, minDistance, (_index, r) => ({ ...base(1, 18 + (r() * 2 - 1) * Math.max(4, rot * .35)), x: r(), y: r() }))
  } else {
    const distance = template === 'dense' ? minDistance * .74 : template === 'airy' ? minDistance * 1.22 : minDistance
    raw = poissonScatter(count, random, distance, (_index, r) => ({ ...base(template === 'airy' ? 1.12 : template === 'dense' ? .78 : 1), x: r(), y: r() }))
  }
  return assignAssets(raw, assetCount, distribution, rng(seed ^ 0x9E3779B9))
}

function buildTileSvg(assets: MotifAsset[], slots: Slot[], tileSize: number, motifScale: number, background: string, includeGuides = false) {
  const defs = assets.map((asset, index) => `<g id="scatter-motif-${index}">${asset.inner}</g>`).join('')
  const copies: string[] = []
  slots.forEach((slot, slotIndex) => {
    const asset = assets[slot.asset] ?? assets[0]; if (!asset) return
    const target = tileSize * (motifScale / 100) * slot.scale
    const factor = target / Math.max(asset.width, asset.height)
    const cx = asset.x + asset.width / 2; const cy = asset.y + asset.height / 2
    for (const ox of [-tileSize, 0, tileSize]) for (const oy of [-tileSize, 0, tileSize]) {
      const px = slot.x * tileSize + ox; const py = slot.y * tileSize + oy
      copies.push(`<use href="#scatter-motif-${slot.asset}" transform="translate(${px.toFixed(3)} ${py.toFixed(3)}) rotate(${slot.rotation.toFixed(2)}) scale(${factor.toFixed(6)}) translate(${-cx} ${-cy})"/>`)
    }
    if (includeGuides) copies.push(`<g pointer-events="none"><circle cx="${(slot.x * tileSize).toFixed(2)}" cy="${(slot.y * tileSize).toFixed(2)}" r="14" fill="#111827" fill-opacity=".82" stroke="#fff" stroke-width="2"/><text x="${(slot.x * tileSize).toFixed(2)}" y="${(slot.y * tileSize + 5).toFixed(2)}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fff">${slotIndex + 1}</text></g>`)
  })
  const bg = background === 'transparent' ? '' : `<rect width="100%" height="100%" fill="${background}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" data-patternforge-seamless="true" data-patternforge-exact-bounds="true"><defs><clipPath id="scatter-tile-clip"><rect width="${tileSize}" height="${tileSize}"/></clipPath>${defs}</defs>${bg}<g clip-path="url(#scatter-tile-clip)">${copies.join('')}</g></svg>`
}

function buildGuideSvg(slots: Slot[], tileSize: number) {
  const marks = slots.map((slot, index) => {
    const radius = tileSize * (.038 + clamp(slot.scale, .5, 1.6) * .018)
    return `<g><circle cx="${slot.x * tileSize}" cy="${slot.y * tileSize}" r="${radius}" fill="none" stroke="#6b7280" stroke-width="2"/><text x="${slot.x * tileSize}" y="${slot.y * tileSize + 5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#4b5563">${index + 1}</text></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}"><rect width="100%" height="100%" fill="#fff"/>${marks}<rect x="1" y="1" width="${tileSize - 2}" height="${tileSize - 2}" fill="none" stroke="#9ca3af" stroke-dasharray="8 8"/></svg>`
}

function buildProofSvg(tileSvg: string, tileSize: number) {
  const uri = dataUri(tileSvg); const side = tileSize * 3
  let images = ''
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) images += `<image href="${uri}" x="${x * tileSize}" y="${y * tileSize}" width="${tileSize}" height="${tileSize}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">${images}</svg>`
}

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadPng(svg: string, name: string, size: number) {
  const image = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render PNG.')); image.src = url })
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
  const context = canvas.getContext('2d'); if (!context) { URL.revokeObjectURL(url); return }
  context.drawImage(image, 0, 0, size, size); URL.revokeObjectURL(url)
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!png) return
  const pngUrl = URL.createObjectURL(png); const a = document.createElement('a'); a.href = pngUrl; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(pngUrl), 1000)
}

export default function ScatteredTemplateWorkspace({ onOpenLibrary }: Props) {
  const [assets, setAssets] = useState<MotifAsset[]>([])
  const [template, setTemplate] = useState<TemplateId>('balanced')
  const [distribution, setDistribution] = useState<Distribution>('cycle')
  const [density, setDensity] = useState(18)
  const [motifScale, setMotifScale] = useState(17)
  const [scaleVariation, setScaleVariation] = useState(28)
  const [rotation, setRotation] = useState(32)
  const [jitter, setJitter] = useState(48)
  const [minGap, setMinGap] = useState(12)
  const [seed, setSeed] = useState(1472)
  const [tileSize, setTileSize] = useState(1600)
  const [background, setBackground] = useState('transparent')
  const [solidBackground, setSolidBackground] = useState('#FFFDF7')
  const [view, setView] = useState<ViewMode>('proof')
  const [name, setName] = useState('Scattered Pattern 01')
  const [message, setMessage] = useState('Choose a layout template, then drop one or more SVG motifs. Edge wrapping is automatic.')
  const inputRef = useRef<HTMLInputElement>(null)

  const slots = useMemo(() => generateSlots(template, density, seed, jitter, scaleVariation, rotation, minGap, Math.max(1, assets.length), distribution), [template, density, seed, jitter, scaleVariation, rotation, minGap, assets.length, distribution])
  const tileSvg = useMemo(() => buildTileSvg(assets, slots, tileSize, motifScale, background === 'transparent' ? 'transparent' : solidBackground), [assets, slots, tileSize, motifScale, background, solidBackground])
  const guideSvg = useMemo(() => buildGuideSvg(slots, tileSize), [slots, tileSize])
  const previewSvg = useMemo(() => view === 'proof' ? buildProofSvg(tileSvg, tileSize) : view === 'guide' ? guideSvg : tileSvg, [view, tileSvg, guideSvg, tileSize])

  async function addFiles(files: FileList | null) {
    const incoming = Array.from(files ?? []).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) { setMessage('Please choose SVG files.'); return }
    const parsed: MotifAsset[] = []
    for (const file of incoming) {
      try { const asset = sanitizeSvg(await file.text(), `scatter-${uid()}`); parsed.push({ ...asset, name: file.name }) }
      catch (error) { setMessage(error instanceof Error ? `${file.name}: ${error.message}` : `Could not read ${file.name}.`) }
    }
    if (!parsed.length) return
    setAssets((current) => [...current, ...parsed].slice(0, 12))
    setMessage(`${parsed.length} SVG motif${parsed.length === 1 ? '' : 's'} added. Slots automatically redistribute across the seamless tile.`)
  }

  function removeAsset(id: string) { setAssets((current) => current.filter((asset) => asset.id !== id)); setMessage('Motif removed. Remaining motifs were redistributed automatically.') }
  function clearAssets() { setAssets([]); setMessage('Motifs cleared. The numbered layout guide remains available.') }
  function exportSvg() { if (!assets.length) { setMessage('Add at least one SVG motif before export.'); return } downloadText(tileSvg, `${slug(name)}-${template}-seamless.svg`); setMessage('Exact seamless master tile exported as SVG.') }
  function exportGuide() { downloadText(guideSvg, `${slug(name)}-${template}-layout-guide.svg`); setMessage('Numbered layout guide exported. You can also use it in an external editor.') }
  async function exportPng() { if (!assets.length) { setMessage('Add at least one SVG motif before export.'); return } try { await downloadPng(tileSvg, `${slug(name)}-${template}-4096.png`, 4096); setMessage('4096 × 4096 seamless PNG exported.') } catch { setMessage('PNG rendering failed. SVG export is still available.') } }
  function saveLibrary() {
    if (!assets.length) { setMessage('Add at least one SVG motif before saving.'); return }
    savePatternAsset({ name: name.trim() || 'Scattered Pattern', sourceType: 'imported-svg', svg: tileSvg, tags: ['scattered','template',template,'seamless'], meta: { width: tileSize, height: tileSize, exactBounds: true, template, motifCount: assets.length, slotCount: slots.length } })
    setMessage('Saved to My Patterns as an exact seamless SVG master tile.')
  }

  const activeTemplate = TEMPLATES.find((item) => item.id === template) ?? TEMPLATES[0]

  return <div className="v20-scatter-shell">
    <aside className="v20-scatter-panel v20-scatter-left">
      <div className="v20-scatter-heading"><span>SCATTERED</span><h1>Seamless Template</h1><p>Drop SVG motifs into ready-made natural layouts. PatternForge handles wrap-around copies automatically.</p></div>
      <section><div className="v20-section-title"><b>1 · Layout Template</b><small>{activeTemplate.note}</small></div><div className="v20-template-grid">{TEMPLATES.map((item) => <button key={item.id} className={template === item.id ? 'active' : ''} onClick={() => setTemplate(item.id)}><span>{item.badge}</span><b>{item.label}</b><small>{item.note}</small></button>)}</div></section>
      <section><div className="v20-section-title"><b>2 · SVG Motifs</b><small>1–12 SVGs · vector stays vector</small></div><button className="v20-scatter-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files) }}><b>Drop SVG motifs here</b><span>or click to choose files</span></button><input ref={inputRef} type="file" accept=".svg,image/svg+xml" multiple hidden onChange={(event) => void addFiles(event.target.files)}/><div className="v20-motif-list">{assets.map((asset, index) => <div key={asset.id}><span>{index + 1}</span><b title={asset.name}>{asset.name}</b><button onClick={() => removeAsset(asset.id)}>×</button></div>)}</div>{assets.length ? <button className="v20-text-button" onClick={clearAssets}>Clear all motifs</button> : null}</section>
      <section><div className="v20-section-title"><b>3 · Natural Balance</b><small>Template-aware controls</small></div><label>Asset distribution<select value={distribution} onChange={(event) => setDistribution(event.target.value as Distribution)}><option value="cycle">Balanced Cycle</option><option value="shuffle">Seeded Shuffle</option><option value="primary-accent">Primary + Accent</option></select></label><label>Density <output>{density}</output><input type="range" min="8" max="40" value={density} onChange={(event) => setDensity(Number(event.target.value))}/></label><label>Motif size <output>{motifScale}%</output><input type="range" min="7" max="32" value={motifScale} onChange={(event) => setMotifScale(Number(event.target.value))}/></label><label>Size variation <output>{scaleVariation}%</output><input type="range" min="0" max="55" value={scaleVariation} onChange={(event) => setScaleVariation(Number(event.target.value))}/></label><label>Rotation freedom <output>±{rotation}°</output><input type="range" min="0" max="180" value={rotation} onChange={(event) => setRotation(Number(event.target.value))}/></label><label>Position looseness <output>{jitter}%</output><input type="range" min="0" max="100" value={jitter} onChange={(event) => setJitter(Number(event.target.value))}/></label><label>Minimum breathing gap <output>{minGap}%</output><input type="range" min="5" max="22" value={minGap} onChange={(event) => setMinGap(Number(event.target.value))}/></label><div className="v20-seed-row"><label>Seed<input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)}/></label><button onClick={() => setSeed(Math.floor(Math.random() * 999999))}>New arrangement</button></div></section>
    </aside>

    <main className="v20-scatter-stage">
      <div className="v20-stage-toolbar"><div><b>{activeTemplate.label}</b><span>{slots.length} placements · {assets.length || 0} source motif{assets.length === 1 ? '' : 's'} · exact edge wrap</span></div><div className="v20-view-tabs"><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>3×3 Proof</button><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'guide' ? 'active' : ''} onClick={() => setView('guide')}>Numbered Guide</button></div></div>
      <div className="v20-preview-wrap"><div className={`v20-preview ${view}`}>{assets.length || view === 'guide' ? <img src={dataUri(previewSvg)} alt="Scattered seamless preview"/> : <div className="v20-empty"><b>Layout ready.</b><span>Drop your SVG motifs on the left. The numbered guide already defines a seamless natural scatter.</span></div>}</div></div>
      <div className="v20-message">{message}</div>
    </main>

    <aside className="v20-scatter-panel v20-scatter-right">
      <section><div className="v20-section-title"><b>Pattern Setup</b><small>Square seamless master tile</small></div><label>Pattern name<input value={name} onChange={(event) => setName(event.target.value)}/></label><label>Master tile<select value={tileSize} onChange={(event) => setTileSize(Number(event.target.value))}><option value={1000}>1000 × 1000</option><option value={1600}>1600 × 1600</option><option value={2048}>2048 × 2048</option><option value={3000}>3000 × 3000</option><option value={4096}>4096 × 4096</option></select></label><label>Background<select value={background} onChange={(event) => setBackground(event.target.value)}><option value="transparent">Transparent</option><option value="solid">Solid color</option></select></label>{background === 'solid' ? <label>Background HEX<input type="color" value={solidBackground} onChange={(event) => setSolidBackground(event.target.value)}/><input value={solidBackground} onChange={(event) => setSolidBackground(event.target.value)}/></label> : null}</section>
      <section><div className="v20-section-title"><b>Why it stays seamless</b><small>Automatic toroidal edge logic</small></div><div className="v20-info-card"><b>Edge copies are automatic</b><p>Every placement is mirrored to neighboring tile coordinates. Motifs cut by one edge re-enter from the opposite edge with identical scale and rotation.</p></div><div className="v20-info-card"><b>Natural ≠ random chaos</b><p>Balanced templates use wrapped-distance spacing, controlled scale hierarchy, seeded variation, and template-specific rhythm.</p></div></section>
      <section><div className="v20-section-title"><b>Export</b><small>Traceable/editable source remains SVG</small></div><div className="v20-export-stack"><button className="primary" onClick={exportSvg}>Export Seamless SVG</button><button onClick={() => void exportPng()}>Export 4096 PNG</button><button onClick={exportGuide}>Export Numbered Guide SVG</button><button onClick={saveLibrary}>Save to My Patterns</button><button onClick={onOpenLibrary}>Open My Patterns</button></div></section>
      <div className="v20-tip"><b>Tip</b><span>For a natural pattern, upload 4–8 related motifs. Put the hero motif first and choose “Primary + Accent”.</span></div>
    </aside>
  </div>
}
