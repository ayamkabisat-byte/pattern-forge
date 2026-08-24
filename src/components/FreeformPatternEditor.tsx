import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { parseSvgAsset } from '../engine/svg'
import type { SvgAsset } from '../types'

type ManualItem = {
  id: string
  assetId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipX: boolean
  flipY: boolean
  locked: boolean
  visible: boolean
}

type Interaction = {
  mode: 'drag' | 'resize' | 'rotate'
  itemId: string
  pointerId: number
  startX: number
  startY: number
  item: ManualItem
  startDistance?: number
  startAngle?: number
}

type GuideState = { x: number | null; y: number | null }

type Props = {
  onOpenClassic: () => void
}

const WRAP_SHIFTS = [-1, 0, 1]
const SNAP_DISTANCE = 14

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function modulo(value: number, size: number) {
  if (!size) return value
  return ((value % size) + size) % size
}

function pointInSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const ctm = svg.getScreenCTM()
  return ctm ? point.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY }
}

function itemDims(asset: SvgAsset, size: number) {
  const ratio = asset.viewWidth / asset.viewHeight || 1
  return ratio >= 1
    ? { width: size, height: size / ratio }
    : { width: size * ratio, height: size }
}

function downloadText(text: string, filename: string, type = 'image/svg+xml;charset=utf-8') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function ManualAsset({ item, asset, dx = 0, dy = 0, opacity = 1 }: { item: ManualItem; asset: SvgAsset; dx?: number; dy?: number; opacity?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g opacity={opacity} pointerEvents="none" transform={`translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function RepeatProof({ assets, items, tileWidth, tileHeight, background }: { assets: SvgAsset[]; items: ManualItem[]; tileWidth: number; tileHeight: number; background: string }) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const copies = 3
  return (
    <svg className="v09-proof" viewBox={`0 0 ${tileWidth * copies} ${tileHeight * copies}`}>
      {Array.from({ length: copies }).flatMap((_, row) =>
        Array.from({ length: copies }).map((__, col) => (
          <svg key={`${row}-${col}`} x={col * tileWidth} y={row * tileHeight} width={tileWidth} height={tileHeight} viewBox={`0 0 ${tileWidth} ${tileHeight}`} overflow="hidden">
            <rect width={tileWidth} height={tileHeight} fill={background} />
            {items.filter((item) => item.visible).flatMap((item) => {
              const asset = assetById.get(item.assetId)
              if (!asset) return []
              return WRAP_SHIFTS.flatMap((sx) => WRAP_SHIFTS.map((sy) => (
                <ManualAsset key={`${item.id}-${sx}-${sy}`} item={item} asset={asset} dx={sx * tileWidth} dy={sy * tileHeight} />
              )))
            })}
            <rect width={tileWidth} height={tileHeight} className="v09-proof-boundary" />
          </svg>
        )),
      )}
    </svg>
  )
}

function overlapIds(items: ManualItem[], tileWidth: number, tileHeight: number) {
  const visible = items.filter((item) => item.visible)
  const hits = new Set<string>()
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i]
      const b = visible[j]
      const rawDx = Math.abs(a.x - b.x)
      const rawDy = Math.abs(a.y - b.y)
      const dx = Math.min(rawDx, Math.max(0, tileWidth - rawDx))
      const dy = Math.min(rawDy, Math.max(0, tileHeight - rawDy))
      const thresholdX = (a.width + b.width) * 0.34
      const thresholdY = (a.height + b.height) * 0.34
      if (dx < thresholdX && dy < thresholdY) {
        hits.add(a.id)
        hits.add(b.id)
      }
    }
  }
  return hits
}

export default function FreeformPatternEditor({ onOpenClassic }: Props) {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [items, setItems] = useState<ManualItem[]>([])
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tileWidth, setTileWidth] = useState(1600)
  const [tileHeight, setTileHeight] = useState(1600)
  const [background, setBackground] = useState('#f4efe4')
  const [view, setView] = useState<'edit' | 'proof'>('edit')
  const [showCollisions, setShowCollisions] = useState(true)
  const [smartGuides, setSmartGuides] = useState(true)
  const [linkRatio, setLinkRatio] = useState(true)
  const [seedCount, setSeedCount] = useState(24)
  const [message, setMessage] = useState('Upload SVG motifs, seed a Tossed or Paisley layout, then fine-tune every item manually.')
  const [guides, setGuides] = useState<GuideState>({ x: null, y: null })
  const inputRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const interactionRef = useRef<Interaction | null>(null)

  const selected = items.find((item) => item.id === selectedId) ?? null
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const collisions = useMemo(() => overlapIds(items, tileWidth, tileHeight), [items, tileWidth, tileHeight])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        setItems((current) => current.filter((item) => item.id !== selectedId || item.locked))
        setSelectedId((current) => {
          const hit = items.find((item) => item.id === current)
          return hit?.locked ? current : null
        })
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedId) {
        event.preventDefault()
        duplicateItem(selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, items])

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('Freeform Composer accepts SVG vector motifs.')
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
      setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} added. Choose Tossed, Paisley, or add motifs manually.`)
    }
  }

  function createItem(asset: SvgAsset, x: number, y: number, size: number, rotation = 0): ManualItem {
    const dims = itemDims(asset, size)
    return {
      id: crypto.randomUUID().replaceAll('-', '').slice(0, 14),
      assetId: asset.id,
      x,
      y,
      width: dims.width,
      height: dims.height,
      rotation,
      flipX: false,
      flipY: false,
      locked: false,
      visible: true,
    }
  }

  function seedTossed() {
    if (!assets.length) return
    const count = clamp(Math.round(seedCount), 4, 100)
    const baseSize = Math.min(tileWidth, tileHeight) / Math.sqrt(count) * 0.72
    const next = Array.from({ length: count }).map((_, index) => {
      const asset = assets[index % assets.length]
      const size = baseSize * (0.72 + Math.random() * 0.56)
      return createItem(
        asset,
        Math.random() * tileWidth,
        Math.random() * tileHeight,
        size,
        -55 + Math.random() * 110,
      )
    })
    setItems(next)
    setSelectedId(next[0]?.id ?? null)
    setMessage('Tossed baseline created. Drag motifs apart, resize individually, then inspect Repeat Proof.')
  }

  function seedPaisley() {
    if (!assets.length) return
    const columns = Math.max(3, Math.round(Math.sqrt(seedCount)))
    const rows = Math.max(3, Math.ceil(seedCount / columns))
    const stepX = tileWidth / columns
    const stepY = tileHeight / rows
    const size = Math.min(stepX, stepY) * 0.72
    const next: ManualItem[] = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        if (next.length >= seedCount) break
        const asset = assets[next.length % assets.length]
        const offset = row % 2 ? stepX / 2 : 0
        const x = modulo((col + 0.5) * stepX + offset, tileWidth)
        const y = (row + 0.5) * stepY
        const rotation = (row + col) % 2 ? 180 : 0
        next.push(createItem(asset, x, y, size, rotation))
      }
    }
    setItems(next)
    setSelectedId(next[0]?.id ?? null)
    setMessage('Paisley half-drop baseline created. Every paisley is now an independent editable item.')
  }

  function addActiveMotif() {
    const asset = assets.find((entry) => entry.id === activeAssetId)
    if (!asset) return
    const item = createItem(asset, tileWidth / 2, tileHeight / 2, Math.min(tileWidth, tileHeight) * 0.16)
    setItems((current) => [...current, item])
    setSelectedId(item.id)
    setView('edit')
  }

  function patchItem(id: string, patch: Partial<ManualItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  function duplicateItem(id: string) {
    const source = items.find((item) => item.id === id)
    if (!source) return
    const clone: ManualItem = {
      ...source,
      id: crypto.randomUUID().replaceAll('-', '').slice(0, 14),
      x: modulo(source.x + 28, tileWidth),
      y: modulo(source.y + 28, tileHeight),
      locked: false,
    }
    setItems((current) => [...current, clone])
    setSelectedId(clone.id)
  }

  function deleteItem(id: string) {
    const source = items.find((item) => item.id === id)
    if (!source || source.locked) return
    setItems((current) => current.filter((item) => item.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function bringForward(id: string) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id)
      if (index < 0 || index === current.length - 1) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + 1, 0, item)
      return next
    })
  }

  function sendBackward(id: string) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id)
      if (index <= 0) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index - 1, 0, item)
      return next
    })
  }

  function randomizeUnlocked() {
    setItems((current) => current.map((item) => {
      if (item.locked) return item
      const scale = 0.82 + Math.random() * 0.36
      return {
        ...item,
        x: Math.random() * tileWidth,
        y: Math.random() * tileHeight,
        width: item.width * scale,
        height: item.height * scale,
        rotation: -65 + Math.random() * 130,
      }
    }))
    setMessage('Only unlocked motifs were randomized. Locked/frozen items stayed in place.')
  }

  function snapPosition(itemId: string, x: number, y: number) {
    if (!smartGuides) return { x, y, guideX: null, guideY: null }
    let nextX = x
    let nextY = y
    let guideX: number | null = null
    let guideY: number | null = null
    const anchorsX = [0, tileWidth / 2, tileWidth]
    const anchorsY = [0, tileHeight / 2, tileHeight]
    for (const item of items) {
      if (item.id === itemId || !item.visible) continue
      anchorsX.push(item.x)
      anchorsY.push(item.y)
    }
    for (const anchor of anchorsX) {
      if (Math.abs(x - anchor) <= SNAP_DISTANCE) {
        nextX = anchor
        guideX = anchor
        break
      }
    }
    for (const anchor of anchorsY) {
      if (Math.abs(y - anchor) <= SNAP_DISTANCE) {
        nextY = anchor
        guideY = anchor
        break
      }
    }
    return { x: nextX, y: nextY, guideX, guideY }
  }

  function startInteraction(event: ReactPointerEvent<SVGElement>, mode: Interaction['mode'], item: ManualItem) {
    event.stopPropagation()
    setSelectedId(item.id)
    if (item.locked || !svgRef.current) return
    const point = pointInSvg(svgRef.current, event.clientX, event.clientY)
    const dx = point.x - item.x
    const dy = point.y - item.y
    interactionRef.current = {
      mode,
      itemId: item.id,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      item: { ...item },
      startDistance: Math.max(1, Math.hypot(dx, dy)),
      startAngle: Math.atan2(dy, dx) * 180 / Math.PI,
    }
    svgRef.current.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId || !svgRef.current) return
    const point = pointInSvg(svgRef.current, event.clientX, event.clientY)
    const start = interaction.item
    if (interaction.mode === 'drag') {
      const rawX = start.x + point.x - interaction.startX
      const rawY = start.y + point.y - interaction.startY
      const snapped = snapPosition(start.id, rawX, rawY)
      setGuides({ x: snapped.guideX, y: snapped.guideY })
      patchItem(start.id, { x: snapped.x, y: snapped.y })
    } else if (interaction.mode === 'resize') {
      const distance = Math.max(8, Math.hypot(point.x - start.x, point.y - start.y))
      const factor = clamp(distance / Math.max(1, interaction.startDistance ?? 1), 0.08, 12)
      patchItem(start.id, { width: Math.max(12, start.width * factor), height: Math.max(12, start.height * factor) })
    } else {
      const angle = Math.atan2(point.y - start.y, point.x - start.x) * 180 / Math.PI
      const delta = angle - (interaction.startAngle ?? angle)
      patchItem(start.id, { rotation: Math.round((start.rotation + delta) * 10) / 10 })
    }
  }

  function finishInteraction(event: ReactPointerEvent<SVGSVGElement>) {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointerId !== event.pointerId) return
    if (interaction.mode === 'drag') {
      setItems((current) => current.map((item) => item.id === interaction.itemId ? {
        ...item,
        x: modulo(item.x, tileWidth),
        y: modulo(item.y, tileHeight),
      } : item))
    }
    interactionRef.current = null
    setGuides({ x: null, y: null })
    svgRef.current?.releasePointerCapture?.(event.pointerId)
  }

  function updateSelectedSize(axis: 'width' | 'height', value: number) {
    if (!selected) return
    const safe = Math.max(8, value)
    if (!linkRatio) {
      patchItem(selected.id, { [axis]: safe })
      return
    }
    const ratio = selected.width / selected.height || 1
    patchItem(selected.id, axis === 'width'
      ? { width: safe, height: safe / ratio }
      : { height: safe, width: safe * ratio })
  }

  function renderItemMarkup(item: ManualItem, dx: number, dy: number) {
    const asset = assetById.get(item.assetId)
    if (!asset || !item.visible) return ''
    const sx = item.flipX ? -1 : 1
    const sy = item.flipY ? -1 : 1
    return `<g transform="translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})"><svg width="${item.width}" height="${item.height}" viewBox="${asset.viewBox}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
  }

  function tileSvg() {
    const clipId = 'pf-v09-clip'
    const markup = items.flatMap((item) => WRAP_SHIFTS.flatMap((sx) => WRAP_SHIFTS.map((sy) => renderItemMarkup(item, sx * tileWidth, sy * tileHeight)))).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}"><defs><clipPath id="${clipId}"><rect width="${tileWidth}" height="${tileHeight}"/></clipPath></defs><rect width="${tileWidth}" height="${tileHeight}" fill="${background}"/><g clip-path="url(#${clipId})">${markup}</g></svg>`
  }

  function exportTile() {
    if (!items.length) return
    downloadText(tileSvg(), 'patternforge-v09-freeform-seamless-tile.svg')
    setMessage('Freeform seamless master tile exported.')
  }

  function exportProof() {
    if (!items.length) return
    const tile = tileSvg().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    const groups = Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => `<g transform="translate(${col * tileWidth} ${row * tileHeight})">${tile}</g>`)).join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth * 3}" height="${tileHeight * 3}" viewBox="0 0 ${tileWidth * 3} ${tileHeight * 3}">${groups}</svg>`
    downloadText(svg, 'patternforge-v09-freeform-3x3-proof.svg')
  }

  function saveJson() {
    const project = {
      version: '0.9',
      tileWidth,
      tileHeight,
      background,
      items,
      assets: assets.map((asset) => ({ ...asset })),
    }
    downloadText(JSON.stringify(project, null, 2), 'patternforge-v09-project.json', 'application/json;charset=utf-8')
  }

  return (
    <div className="v09-editor-shell">
      <header className="v09-topbar">
        <div>
          <div className="v09-brand"><span>PF</span> PatternForge <small>v0.9 Freeform</small></div>
          <p>Per-item move · resize · rotate · lock · seamless edge wrapping</p>
        </div>
        <div className="v09-top-actions">
          <button onClick={onOpenClassic}>Open Auto Builder v0.8</button>
          <button onClick={saveJson} disabled={!items.length}>Save JSON</button>
          <button onClick={exportProof} disabled={!items.length}>Export 3×3 Proof</button>
          <button className="v09-accent" onClick={exportTile} disabled={!items.length}>Export Seamless SVG</button>
        </div>
      </header>

      <main className="v09-workspace">
        <aside className="v09-sidebar v09-left">
          <section>
            <h2>Vector Motifs</h2>
            <div className="v09-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
              <strong>Drop SVG motifs</strong>
              <span>SVG only · local processing</span>
              <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(event) => event.target.files && addFiles(event.target.files)} />
            </div>
            <div className="v09-assets">
              {assets.map((asset) => (
                <button key={asset.id} className={activeAssetId === asset.id ? 'v09-asset active' : 'v09-asset'} onClick={() => setActiveAssetId(asset.id)}>
                  <span><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /></span>
                  <b>{asset.name}</b>
                </button>
              ))}
            </div>
            <button className="v09-wide" onClick={addActiveMotif} disabled={!activeAssetId}>+ Add selected motif</button>
          </section>

          <section>
            <h2>Starting Layout</h2>
            <label className="v09-field"><span>Item count</span><input type="number" min="4" max="100" value={seedCount} onChange={(event) => setSeedCount(clamp(Number(event.target.value), 4, 100))} /></label>
            <div className="v09-seed-grid">
              <button onClick={seedTossed} disabled={!assets.length}>Tossed Baseline</button>
              <button onClick={seedPaisley} disabled={!assets.length}>Paisley Half-Drop</button>
            </div>
            <button className="v09-wide" onClick={randomizeUnlocked} disabled={!items.length}>Randomize Unlocked</button>
            <small>Lock good placements, then randomize only the remaining motifs.</small>
          </section>

          <section>
            <div className="v09-section-heading"><h2>Pattern Items</h2><b>{items.length}</b></div>
            <div className="v09-layer-list">
              {[...items].reverse().map((item) => {
                const asset = assetById.get(item.assetId)
                const overlapping = collisions.has(item.id)
                return (
                  <div key={item.id} className={`${selectedId === item.id ? 'v09-layer selected' : 'v09-layer'} ${overlapping && showCollisions ? 'collision' : ''}`}>
                    <button className="v09-layer-main" onClick={() => { setSelectedId(item.id); setView('edit') }}>
                      <span>{item.locked ? '🔒' : '◆'}</span>
                      <b>{asset?.name ?? 'Missing motif'}</b>
                    </button>
                    <button title="Toggle visibility" onClick={() => patchItem(item.id, { visible: !item.visible })}>{item.visible ? '◉' : '○'}</button>
                    <button title="Lock item" onClick={() => patchItem(item.id, { locked: !item.locked })}>{item.locked ? '🔒' : '🔓'}</button>
                  </div>
                )
              })}
            </div>
          </section>
        </aside>

        <section className="v09-stage-wrap">
          <div className="v09-stage-toolbar">
            <div><b>{view === 'edit' ? 'Freeform Master Tile' : '3×3 Repeat Proof'}</b><span>{tileWidth} × {tileHeight} · {items.length} editable items</span></div>
            <div className="v09-view-switch">
              <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Edit</button>
              <button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button>
            </div>
          </div>

          <div className="v09-stage">
            {!assets.length ? (
              <div className="v09-empty"><strong>Manual control for Tossed & Paisley</strong><p>Upload SVG motifs. Generate a baseline or add them one by one, then move and size every motif independently.</p></div>
            ) : view === 'proof' ? (
              <RepeatProof assets={assets} items={items} tileWidth={tileWidth} tileHeight={tileHeight} background={background} />
            ) : (
              <svg
                ref={svgRef}
                className="v09-canvas"
                viewBox={`0 0 ${tileWidth} ${tileHeight}`}
                onPointerMove={onPointerMove}
                onPointerUp={finishInteraction}
                onPointerCancel={finishInteraction}
                onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null) }}
              >
                <defs><clipPath id="pf-v09-editor-clip"><rect width={tileWidth} height={tileHeight} /></clipPath></defs>
                <rect width={tileWidth} height={tileHeight} fill={background} />
                <g clipPath="url(#pf-v09-editor-clip)">
                  {items.filter((item) => item.visible).flatMap((item) => {
                    const asset = assetById.get(item.assetId)
                    if (!asset) return []
                    return WRAP_SHIFTS.flatMap((sx) => WRAP_SHIFTS.map((sy) => (
                      <ManualAsset key={`${item.id}-${sx}-${sy}`} item={item} asset={asset} dx={sx * tileWidth} dy={sy * tileHeight} opacity={sx === 0 && sy === 0 ? 1 : 0.78} />
                    )))
                  })}
                </g>

                {smartGuides && guides.x !== null ? <line x1={guides.x} x2={guides.x} y1="0" y2={tileHeight} className="v09-guide" /> : null}
                {smartGuides && guides.y !== null ? <line y1={guides.y} y2={guides.y} x1="0" x2={tileWidth} className="v09-guide" /> : null}

                {items.filter((item) => item.visible).map((item) => {
                  const isSelected = selectedId === item.id
                  const hasCollision = showCollisions && collisions.has(item.id)
                  return (
                    <g key={`hit-${item.id}`} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}>
                      <rect
                        x={-item.width / 2}
                        y={-item.height / 2}
                        width={item.width}
                        height={item.height}
                        className={`${isSelected ? 'v09-selection-box selected' : 'v09-selection-box'} ${hasCollision ? 'collision' : ''}`}
                        onPointerDown={(event) => startInteraction(event, 'drag', item)}
                      />
                      {isSelected ? (
                        <>
                          <line x1="0" y1={-item.height / 2} x2="0" y2={-item.height / 2 - 44} className="v09-handle-line" />
                          <circle cx="0" cy={-item.height / 2 - 52} r="12" className="v09-rotate-handle" onPointerDown={(event) => startInteraction(event, 'rotate', item)} />
                          <rect x={item.width / 2 - 11} y={item.height / 2 - 11} width="22" height="22" rx="4" className="v09-resize-handle" onPointerDown={(event) => startInteraction(event, 'resize', item)} />
                          {item.locked ? <text x={-item.width / 2 + 12} y={-item.height / 2 + 26} className="v09-lock-label">LOCKED</text> : null}
                        </>
                      ) : null}
                    </g>
                  )
                })}
                <rect width={tileWidth} height={tileHeight} className="v09-tile-boundary" pointerEvents="none" />
              </svg>
            )}
          </div>
          <div className="v09-status"><span>{message}</span><b className={collisions.size ? 'warn' : 'ok'}>{collisions.size ? `${collisions.size} items close/overlapping` : '✓ No obvious overlaps'}</b></div>
        </section>

        <aside className="v09-sidebar v09-right">
          <section>
            <h2>Master Tile</h2>
            <div className="v09-presets">{[800, 1200, 1600, 2000, 3000].map((size) => <button key={size} onClick={() => { setTileWidth(size); setTileHeight(size) }}>{size}</button>)}</div>
            <div className="v09-two-col">
              <label className="v09-field"><span>Width</span><input type="number" min="256" max="12000" value={tileWidth} onChange={(event) => setTileWidth(Math.max(256, Number(event.target.value)))} /></label>
              <label className="v09-field"><span>Height</span><input type="number" min="256" max="12000" value={tileHeight} onChange={(event) => setTileHeight(Math.max(256, Number(event.target.value)))} /></label>
            </div>
            <label className="v09-field"><span>Background</span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
            <label className="v09-check"><input type="checkbox" checked={smartGuides} onChange={(event) => setSmartGuides(event.target.checked)} /> Smart center guides</label>
            <label className="v09-check"><input type="checkbox" checked={showCollisions} onChange={(event) => setShowCollisions(event.target.checked)} /> Collision indicators</label>
          </section>

          <section>
            <h2>Selected Item</h2>
            {selected ? (
              <>
                <label className="v09-field"><span>Motif</span><select value={selected.assetId} onChange={(event) => patchItem(selected.id, { assetId: event.target.value })}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                <div className="v09-two-col">
                  <label className="v09-field"><span>X</span><input type="number" value={Math.round(selected.x)} onChange={(event) => patchItem(selected.id, { x: Number(event.target.value) })} /></label>
                  <label className="v09-field"><span>Y</span><input type="number" value={Math.round(selected.y)} onChange={(event) => patchItem(selected.id, { y: Number(event.target.value) })} /></label>
                  <label className="v09-field"><span>Width</span><input type="number" min="8" value={Math.round(selected.width)} onChange={(event) => updateSelectedSize('width', Number(event.target.value))} /></label>
                  <label className="v09-field"><span>Height</span><input type="number" min="8" value={Math.round(selected.height)} onChange={(event) => updateSelectedSize('height', Number(event.target.value))} /></label>
                </div>
                <label className="v09-check"><input type="checkbox" checked={linkRatio} onChange={(event) => setLinkRatio(event.target.checked)} /> Keep aspect ratio</label>
                <label className="v09-field"><span>Rotation</span><input type="number" step="1" value={Math.round(selected.rotation * 10) / 10} onChange={(event) => patchItem(selected.id, { rotation: Number(event.target.value) })} /></label>
                <div className="v09-button-grid">
                  <button className={selected.flipX ? 'active' : ''} onClick={() => patchItem(selected.id, { flipX: !selected.flipX })}>Flip H</button>
                  <button className={selected.flipY ? 'active' : ''} onClick={() => patchItem(selected.id, { flipY: !selected.flipY })}>Flip V</button>
                  <button onClick={() => patchItem(selected.id, { locked: !selected.locked })}>{selected.locked ? 'Unlock' : 'Lock'}</button>
                  <button onClick={() => duplicateItem(selected.id)}>Duplicate</button>
                  <button onClick={() => bringForward(selected.id)}>Forward</button>
                  <button onClick={() => sendBackward(selected.id)}>Backward</button>
                </div>
                <button className="v09-wide v09-danger" onClick={() => deleteItem(selected.id)} disabled={selected.locked}>Delete Item</button>
                <small>Drag motif to move. Bottom-right square resizes. Round handle rotates. Ctrl/Cmd+D duplicates; Delete removes unlocked items.</small>
              </>
            ) : <p className="v09-help">Select a motif on the tile or from Pattern Items.</p>}
          </section>

          <section>
            <h2>Seamless Behavior</h2>
            <div className="v09-info-card"><b>Edge wrapping is always ON</b><span>Move a motif across any edge. Its wrapped copies are rendered automatically, but it remains one editable item.</span></div>
            <div className="v09-info-card"><b>Freeze + Randomize</b><span>Lock the placements you like, then use Randomize Unlocked to keep only the weaker areas moving.</span></div>
          </section>
        </aside>
      </main>
    </div>
  )
}
