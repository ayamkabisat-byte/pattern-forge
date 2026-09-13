import { useMemo, useRef, useState } from 'react'
import { savePatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void }
type TemplateId = 'balanced' | 'airy' | 'dense' | 'flowing' | 'large-small' | 'cluster' | 'directional' | 'organic'
type Distribution = 'cycle' | 'shuffle' | 'primary-accent'
type ViewMode = 'proof' | 'tile' | 'guide'
type MotifAsset = { id: string; name: string; inner: string; x: number; y: number; width: number; height: number }
type Slot = { x: number; y: number; scale: number; rotation: number; asset: number; halfW: number; halfH: number; clearance: number }
type GenerationResult = { slots: Slot[]; requested: number; skipped: number }
type TemplateMeta = { id: TemplateId; label: string; note: string; badge: string }

const TEMPLATES: TemplateMeta[] = [
  { id: 'balanced', label: 'Balanced Scatter', note: 'Random sequential placement with calm, uneven spacing.', badge: 'ALL-ROUND' },
  { id: 'airy', label: 'Airy Scatter', note: 'Fewer larger motifs with naturally uneven open space.', badge: 'LIGHT' },
  { id: 'dense', label: 'Dense Toss', note: 'Busy fill using smaller motifs without forcing a grid.', badge: 'BUSY' },
  { id: 'flowing', label: 'Flowing Toss', note: 'Organic positions with a soft shared motion direction.', badge: 'FLOW' },
  { id: 'large-small', label: 'Large + Small Mix', note: 'Irregular hero-and-filler hierarchy with no fixed sequence.', badge: 'MIXED' },
  { id: 'cluster', label: 'Organic Clusters', note: 'Seeded clusters and calm pockets; cluster centers also move.', badge: 'ORGANIC' },
  { id: 'directional', label: 'Directional Toss', note: 'Truly scattered positions with a shared rotation bias.', badge: 'TOSS' },
  { id: 'organic', label: 'Wild Organic Toss', note: 'Maximum positional irregularity; no rows, columns, bands, or half-drop scaffold.', badge: 'WILD' },
]

const PLACEHOLDER: MotifAsset = { id: 'placeholder', name: 'placeholder.svg', inner: '', x: 0, y: 0, width: 100, height: 100 }
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

function wrappedDelta(a: number, b: number) {
  const raw = Math.abs(a - b)
  return Math.min(raw, 1 - raw)
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

function shuffledIndices(count: number, random: () => number) {
  const values = Array.from({ length: count }, (_, index) => index)
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

function makeAssetSequence(total: number, count: number, distribution: Distribution, random: () => number) {
  if (count <= 1) return Array.from({ length: total }, () => 0)
  if (distribution === 'shuffle') return Array.from({ length: total }, () => Math.floor(random() * count))
  if (distribution === 'primary-accent') return Array.from({ length: total }, (_, index) => index === 0 || random() < .28 ? 0 : 1 + Math.floor(random() * (count - 1)))
  const output: number[] = []
  while (output.length < total) output.push(...shuffledIndices(count, random))
  return output.slice(0, total)
}

function rotatedBounds(asset: MotifAsset, motifScale: number, slotScale: number, rotation: number) {
  const target = (motifScale / 100) * slotScale
  const factor = target / Math.max(asset.width, asset.height)
  const w = asset.width * factor
  const h = asset.height * factor
  const radians = rotation * Math.PI / 180
  const c = Math.abs(Math.cos(radians)); const s = Math.abs(Math.sin(radians))
  return { halfW: (w * c + h * s) / 2, halfH: (w * s + h * c) / 2 }
}

function overlaps(candidate: Slot, existing: Slot, collisionPadding: number, breathing: number, motifScale: number) {
  const dx = wrappedDelta(candidate.x, existing.x)
  const dy = wrappedDelta(candidate.y, existing.y)
  const pad = (motifScale / 100) * (collisionPadding / 100)
  const organicGap = (motifScale / 100) * (breathing / 100) * ((candidate.clearance + existing.clearance) / 2)
  return dx < candidate.halfW + existing.halfW + pad + organicGap && dy < candidate.halfH + existing.halfH + pad + organicGap
}

function collisionCount(slots: Slot[]) {
  let count = 0
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const dx = wrappedDelta(slots[i].x, slots[j].x)
    const dy = wrappedDelta(slots[i].y, slots[j].y)
    if (dx < slots[i].halfW + slots[j].halfW && dy < slots[i].halfH + slots[j].halfH) count++
  }
  return count
}

function generateSlots(template: TemplateId, requestedCount: number, seed: number, irregularity: number, scaleVariation: number, rotation: number, breathing: number, collisionPadding: number, preventOverlap: boolean, motifScale: number, assetsInput: MotifAsset[], distribution: Distribution): GenerationResult {
  const assets = assetsInput.length ? assetsInput : [PLACEHOLDER]
  const random = rng(seed + hashTemplate(template))
  const assetRandom = rng(seed ^ hashTemplate(`${template}-assets`))
  const irregular = irregularity / 100
  const sv = scaleVariation / 100
  let count = requestedCount
  if (template === 'airy') count = Math.max(5, Math.round(requestedCount * .68))
  if (template === 'dense') count = Math.min(56, requestedCount + 7)
  const assetSequence = makeAssetSequence(count, assets.length, distribution, assetRandom)
  const clusterCount = 3 + Math.floor(random() * 2)
  const clusterCenters = Array.from({ length: clusterCount }, () => ({ x: random(), y: random(), reach: .11 + random() * .12 }))
  const slots: Slot[] = []
  let skipped = 0

  function baseScale(index: number, assetIndex: number) {
    let scale = 1
    if (template === 'airy') scale = 1.08
    if (template === 'dense') scale = .68
    if (template === 'large-small') scale = index % 5 === 0 ? 1.28 + random() * .18 : .66 + random() * .27
    if (template === 'cluster') scale = index % 6 === 0 ? 1.12 : .76 + random() * .28
    if (template === 'organic') scale = .78 + random() * .42
    if (distribution === 'primary-accent' && assetIndex === 0) scale *= 1.12
    return Math.max(.42, scale * (1 + (random() * 2 - 1) * sv))
  }

  function slotRotation() {
    if (template === 'directional') return 18 + (random() * 2 - 1) * Math.max(3, rotation * .32)
    if (template === 'flowing') return -16 + (random() * 2 - 1) * Math.max(5, rotation * .48)
    return (random() * 2 - 1) * rotation
  }

  function candidatePosition(index: number) {
    if (template === 'cluster' && random() < .78) {
      const center = clusterCenters[Math.floor(random() * clusterCenters.length)]
      const radius = Math.sqrt(random()) * center.reach * (.7 + irregular * .65)
      const angle = random() * Math.PI * 2
      return { x: (center.x + Math.cos(angle) * radius + 1) % 1, y: (center.y + Math.sin(angle) * radius + 1) % 1 }
    }
    if (template === 'flowing' && random() < .32) {
      const x = random()
      const phase = random() * Math.PI * 2
      const y = (x * .58 + .18 * Math.sin(x * Math.PI * 2 + phase) + random() * .52 + 1) % 1
      return { x, y }
    }
    if (template === 'organic') {
      const x = (random() + Math.sin((index + 1) * 2.399) * .035 * irregular + 1) % 1
      const y = (random() + Math.cos((index + 1) * 1.731) * .035 * irregular + 1) % 1
      return { x, y }
    }
    return { x: random(), y: random() }
  }

  for (let index = 0; index < count; index++) {
    const asset = assetSequence[index] ?? 0
    const scale = baseScale(index, asset)
    const angle = slotRotation()
    const bounds = rotatedBounds(assets[asset] ?? assets[0], motifScale, scale, angle)
    const clearance = .58 + random() * .84
    let placed: Slot | null = null
    const attempts = preventOverlap ? 520 : 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      const pos = candidatePosition(index)
      const candidate: Slot = { ...pos, scale, rotation: angle, asset, ...bounds, clearance }
      if (!preventOverlap || slots.every((current) => !overlaps(candidate, current, collisionPadding, breathing, motifScale))) { placed = candidate; break }
    }
    if (placed) slots.push(placed)
    else skipped++
  }
  return { slots, requested: count, skipped }
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
    const width = Math.max(20, slot.halfW * tileSize * 2)
    const height = Math.max(20, slot.halfH * tileSize * 2)
    return `<g><ellipse cx="${slot.x * tileSize}" cy="${slot.y * tileSize}" rx="${width / 2}" ry="${height / 2}" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5 5"/><circle cx="${slot.x * tileSize}" cy="${slot.y * tileSize}" r="14" fill="#fff" stroke="#6b7280" stroke-width="2"/><text x="${slot.x * tileSize}" y="${slot.y * tileSize + 5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#4b5563">${index + 1}</text></g>`
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
  const [template, setTemplate] = useState<TemplateId>('organic')
  const [distribution, setDistribution] = useState<Distribution>('shuffle')
  const [density, setDensity] = useState(18)
  const [motifScale, setMotifScale] = useState(15)
  const [scaleVariation, setScaleVariation] = useState(32)
  const [rotation, setRotation] = useState(44)
  const [irregularity, setIrregularity] = useState(82)
  const [breathing, setBreathing] = useState(3)
  const [preventOverlap, setPreventOverlap] = useState(true)
  const [collisionPadding, setCollisionPadding] = useState(5)
  const [seed, setSeed] = useState(1472)
  const [tileSize, setTileSize] = useState(1600)
  const [background, setBackground] = useState('transparent')
  const [solidBackground, setSolidBackground] = useState('#FFFDF7')
  const [view, setView] = useState<ViewMode>('proof')
  const [name, setName] = useState('Scattered Pattern 01')
  const [message, setMessage] = useState('Organic scatter is the default. Strict collision protection checks across the seamless edges too.')
  const inputRef = useRef<HTMLInputElement>(null)

  const generation = useMemo(() => generateSlots(template, density, seed, irregularity, scaleVariation, rotation, breathing, collisionPadding, preventOverlap, motifScale, assets, distribution), [template, density, seed, irregularity, scaleVariation, rotation, breathing, collisionPadding, preventOverlap, motifScale, assets, distribution])
  const slots = generation.slots
  const overlapsNow = useMemo(() => collisionCount(slots), [slots])
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
    setMessage(`${parsed.length} SVG motif${parsed.length === 1 ? '' : 's'} added. Collision bounds now use each SVG's real aspect ratio.`)
  }

  function removeAsset(id: string) { setAssets((current) => current.filter((asset) => asset.id !== id)); setMessage('Motif removed. Organic placement and collision bounds were recalculated.') }
  function clearAssets() { setAssets([]); setMessage('Motifs cleared. The guide uses square placeholder bounds until SVGs are added.') }
  function exportSvg() { if (!assets.length) { setMessage('Add at least one SVG motif before export.'); return } downloadText(tileSvg, `${slug(name)}-${template}-seamless.svg`); setMessage('Exact seamless master tile exported as SVG.') }
  function exportGuide() { downloadText(guideSvg, `${slug(name)}-${template}-layout-guide.svg`); setMessage('Numbered collision-aware layout guide exported.') }
  async function exportPng() { if (!assets.length) { setMessage('Add at least one SVG motif before export.'); return } try { await downloadPng(tileSvg, `${slug(name)}-${template}-4096.png`, 4096); setMessage('4096 × 4096 seamless PNG exported.') } catch { setMessage('PNG rendering failed. SVG export is still available.') } }
  function saveLibrary() {
    if (!assets.length) { setMessage('Add at least one SVG motif before saving.'); return }
    savePatternAsset({ name: name.trim() || 'Scattered Pattern', sourceType: 'imported-svg', svg: tileSvg, tags: ['scattered','organic',template,'seamless'], meta: { width: tileSize, height: tileSize, exactBounds: true, template, motifCount: assets.length, slotCount: slots.length, preventOverlap, collisionPadding } })
    setMessage('Saved to My Patterns as an exact seamless SVG master tile.')
  }

  const activeTemplate = TEMPLATES.find((item) => item.id === template) ?? TEMPLATES[0]
  const crowdingText = generation.skipped ? `${generation.skipped} requested placement${generation.skipped === 1 ? '' : 's'} skipped to preserve spacing.` : 'All requested placements fit.'

  return <div className="v20-scatter-shell">
    <aside className="v20-scatter-panel v20-scatter-left">
      <div className="v20-scatter-heading"><span>SCATTERED</span><h1>Seamless Template</h1><p>True organic scatter: no hidden rows or grid scaffold. SVG motifs wrap seamlessly and can be kept physically separated.</p></div>
      <section><div className="v20-section-title"><b>1 · Layout Template</b><small>{activeTemplate.note}</small></div><div className="v20-template-grid">{TEMPLATES.map((item) => <button key={item.id} className={template === item.id ? 'active' : ''} onClick={() => setTemplate(item.id)}><span>{item.badge}</span><b>{item.label}</b><small>{item.note}</small></button>)}</div></section>
      <section><div className="v20-section-title"><b>2 · SVG Motifs</b><small>1–12 SVGs · vector stays vector</small></div><button className="v20-scatter-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files) }}><b>Drop SVG motifs here</b><span>or click to choose files</span></button><input ref={inputRef} type="file" accept=".svg,image/svg+xml" multiple hidden onChange={(event) => void addFiles(event.target.files)}/><div className="v20-motif-list">{assets.map((asset, index) => <div key={asset.id}><span>{index + 1}</span><b title={asset.name}>{asset.name}</b><button onClick={() => removeAsset(asset.id)}>×</button></div>)}</div>{assets.length ? <button className="v20-text-button" onClick={clearAssets}>Clear all motifs</button> : null}</section>
      <section><div className="v20-section-title"><b>3 · Organic Scatter</b><small>Random placement, not a disguised grid</small></div><label>Asset distribution<select value={distribution} onChange={(event) => setDistribution(event.target.value as Distribution)}><option value="shuffle">Seeded Random Mix</option><option value="cycle">Balanced Mix</option><option value="primary-accent">Primary + Accent</option></select></label><label>Density <output>{density}</output><input type="range" min="6" max="48" value={density} onChange={(event) => setDensity(Number(event.target.value))}/></label><label>Motif size <output>{motifScale}%</output><input type="range" min="5" max="30" value={motifScale} onChange={(event) => setMotifScale(Number(event.target.value))}/></label><label>Size variation <output>{scaleVariation}%</output><input type="range" min="0" max="60" value={scaleVariation} onChange={(event) => setScaleVariation(Number(event.target.value))}/></label><label>Rotation freedom <output>±{rotation}°</output><input type="range" min="0" max="180" value={rotation} onChange={(event) => setRotation(Number(event.target.value))}/></label><label>Organic irregularity <output>{irregularity}%</output><input type="range" min="0" max="100" value={irregularity} onChange={(event) => setIrregularity(Number(event.target.value))}/></label><label>Extra breathing room <output>{breathing}%</output><input type="range" min="0" max="25" value={breathing} onChange={(event) => setBreathing(Number(event.target.value))}/></label><div className="v20-collision-box"><label className="v20-toggle-row"><span><b>Prevent motif overlap</b><small>Checks the rotated SVG bounds, including across seams.</small></span><input type="checkbox" checked={preventOverlap} onChange={(event) => setPreventOverlap(event.target.checked)}/></label><label>Collision safety gap <output>{collisionPadding}%</output><input type="range" min="0" max="30" value={collisionPadding} disabled={!preventOverlap} onChange={(event) => setCollisionPadding(Number(event.target.value))}/></label><div className={overlapsNow === 0 ? 'v20-collision-ok' : 'v20-collision-warn'}>{preventOverlap ? `${overlapsNow} overlaps · ${crowdingText}` : `${overlapsNow} geometric overlaps currently allowed.`}</div></div><div className="v20-seed-row"><label>Seed<input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)}/></label><button onClick={() => setSeed(Math.floor(Math.random() * 999999))}>New arrangement</button></div></section>
    </aside>

    <main className="v20-scatter-stage">
      <div className="v20-stage-toolbar"><div><b>{activeTemplate.label}</b><span>{slots.length}/{generation.requested} placements · {assets.length || 0} source motif{assets.length === 1 ? '' : 's'} · {preventOverlap ? 'collision-safe' : 'overlap allowed'} · exact edge wrap</span></div><div className="v20-view-tabs"><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>3×3 Proof</button><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'guide' ? 'active' : ''} onClick={() => setView('guide')}>Numbered Guide</button></div></div>
      <div className="v20-preview-wrap"><div className={`v20-preview ${view}`}>{assets.length || view === 'guide' ? <img src={dataUri(previewSvg)} alt="Scattered seamless preview"/> : <div className="v20-empty"><b>Organic layout ready.</b><span>Drop your SVG motifs on the left. The guide uses collision-aware placeholder bounds until the real SVG dimensions are known.</span></div>}</div></div>
      <div className="v20-message">{message}</div>
    </main>

    <aside className="v20-scatter-panel v20-scatter-right">
      <section><div className="v20-section-title"><b>Pattern Setup</b><small>Square seamless master tile</small></div><label>Pattern name<input value={name} onChange={(event) => setName(event.target.value)}/></label><label>Master tile<select value={tileSize} onChange={(event) => setTileSize(Number(event.target.value))}><option value={1000}>1000 × 1000</option><option value={1600}>1600 × 1600</option><option value={2048}>2048 × 2048</option><option value={3000}>3000 × 3000</option><option value={4096}>4096 × 4096</option></select></label><label>Background<select value={background} onChange={(event) => setBackground(event.target.value)}><option value="transparent">Transparent</option><option value="solid">Solid color</option></select></label>{background === 'solid' ? <label>Background HEX<input type="color" value={solidBackground} onChange={(event) => setSolidBackground(event.target.value)}/><input value={solidBackground} onChange={(event) => setSolidBackground(event.target.value)}/></label> : null}</section>
      <section><div className="v20-section-title"><b>Why this looks scattered</b><small>No underlying row/column scaffold</small></div><div className="v20-info-card"><b>First-valid random placement</b><p>PatternForge no longer pushes every motif toward the farthest empty point. That old best-candidate behavior could create an accidental honeycomb rhythm. New placements are stochastic and only rejected when they break your spacing rules.</p></div><div className="v20-info-card"><b>Real collision bounds</b><p>Overlap prevention uses each SVG's aspect ratio, current scale and rotation. Wrapped distance is checked across opposite tile edges, so a motif near the left edge also avoids its neighbors near the right edge.</p></div><div className="v20-info-card"><b>Strict means fewer, not overlapping</b><p>If your chosen density cannot physically fit, PatternForge skips placements instead of forcing motifs through one another. Reduce Motif Size or Collision Safety Gap to fit more.</p></div></section>
      <section><div className="v20-section-title"><b>Export</b><small>Traceable/editable source remains SVG</small></div><div className="v20-export-stack"><button className="primary" onClick={exportSvg}>Export Seamless SVG</button><button onClick={() => void exportPng()}>Export 4096 PNG</button><button onClick={exportGuide}>Export Numbered Guide SVG</button><button onClick={saveLibrary}>Save to My Patterns</button><button onClick={onOpenLibrary}>Open My Patterns</button></div></section>
      <div className="v20-tip"><b>Natural default</b><span>Start with Wild Organic Toss, Seeded Random Mix, 4–8 related SVG motifs, and Prevent Motif Overlap ON. Change the seed until the empty pockets feel natural.</span></div>
    </aside>
  </div>
}
