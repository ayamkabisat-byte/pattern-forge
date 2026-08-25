import { useMemo, useRef, useState } from 'react'
import { parseSvgAsset } from '../engine/svg'
import type { SvgAsset } from '../types'

type LayoutMode = 'frame' | 'frame-center' | 'horizontal' | 'bands' | 'diagonal' | 'grid' | 'center'
type ViewMode = 'edit' | 'proof'

type Placement = {
  id: string
  assetId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipX?: boolean
  flipY?: boolean
  opacity?: number
}

type Props = {
  onOpenSeamless: () => void
  onOpenPlaid: () => void
}

const WRAPS = [-1, 0, 1]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function modulo(value: number, size: number) {
  if (!size) return value
  return ((value % size) + size) % size
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fitDims(asset: SvgAsset, size: number) {
  const ratio = asset.viewWidth / asset.viewHeight || 1
  return ratio >= 1 ? { width: size, height: size / ratio } : { width: size * ratio, height: size }
}

function LayoutAsset({ placement, asset, dx = 0, dy = 0, dim = false }: { placement: Placement; asset: SvgAsset; dx?: number; dy?: number; dim?: boolean }) {
  const sx = placement.flipX ? -1 : 1
  const sy = placement.flipY ? -1 : 1
  return (
    <g
      pointerEvents="none"
      opacity={(placement.opacity ?? 1) * (dim ? 0.55 : 1)}
      transform={`translate(${placement.x + dx} ${placement.y + dy}) rotate(${placement.rotation}) scale(${sx} ${sy}) translate(${-placement.width / 2} ${-placement.height / 2})`}
    >
      <svg width={placement.width} height={placement.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

const MODES: Array<{ id: LayoutMode; label: string; hint: string }> = [
  { id: 'frame', label: 'Frame', hint: 'Scarf · border · copy space' },
  { id: 'frame-center', label: 'Frame + Center', hint: 'Border with focal motif' },
  { id: 'horizontal', label: 'Horizontal Strip', hint: 'Pucuk Rebung · parade rows' },
  { id: 'bands', label: 'Multi Band', hint: 'Ugly sweater · ornamental rows' },
  { id: 'diagonal', label: 'Diagonal Strip', hint: 'Parang / Lereng guide' },
  { id: 'grid', label: 'Structured Grid', hint: 'Kawung / Ceplok placement guide' },
  { id: 'center', label: 'Center + Fillers', hint: 'Medallion · focal composition' },
]

export default function LayoutGuideBuilder({ onOpenSeamless, onOpenPlaid }: Props) {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [accentId, setAccentId] = useState<string | null>(null)
  const [mode, setMode] = useState<LayoutMode>('frame')
  const [view, setView] = useState<ViewMode>('edit')
  const [tileWidth, setTileWidth] = useState(1600)
  const [tileHeight, setTileHeight] = useState(1600)
  const [background, setBackground] = useState('#f4efe4')
  const [motifSize, setMotifSize] = useState(180)
  const [repeatCount, setRepeatCount] = useState(8)
  const [rows, setRows] = useState(3)
  const [margin, setMargin] = useState(130)
  const [rowGap, setRowGap] = useState(220)
  const [rowOffset, setRowOffset] = useState(0.5)
  const [angle, setAngle] = useState(45)
  const [centerScale, setCenterScale] = useState(2.6)
  const [cornerScale, setCornerScale] = useState(1.15)
  const [alternate, setAlternate] = useState(true)
  const [rotateAlong, setRotateAlong] = useState(true)
  const [inward, setInward] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [message, setMessage] = useState('Choose a structural guide. PatternForge arranges your SVG motif; it does not invent or redraw the motif.')
  const inputRef = useRef<HTMLInputElement>(null)

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const primary = primaryId ? assetById.get(primaryId) ?? null : null
  const accent = accentId ? assetById.get(accentId) ?? null : null
  const isRepeatLayout = mode === 'horizontal' || mode === 'bands' || mode === 'diagonal' || mode === 'grid'

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('Layout Guides accepts SVG vector motifs only.')
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
      setPrimaryId((current) => current ?? next[0].id)
      setAccentId((current) => current ?? next[Math.min(1, next.length - 1)].id)
      setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} loaded. Select a guide and tune the structure.`)
    }
  }

  const placements = useMemo<Placement[]>(() => {
    if (!primary) return []
    const out: Placement[] = []
    const primaryDims = fitDims(primary, motifSize)
    const accentAsset = accent ?? primary
    const accentDims = fitDims(accentAsset, motifSize)
    const n = clamp(Math.round(repeatCount), 2, 30)
    const rowCount = clamp(Math.round(rows), 1, 12)

    const push = (asset: SvgAsset, id: string, x: number, y: number, sizeScale = 1, rotation = 0, flipX = false, flipY = false, opacity = 1) => {
      const dims = fitDims(asset, motifSize * sizeScale)
      out.push({ id, assetId: asset.id, x, y, width: dims.width, height: dims.height, rotation, flipX, flipY, opacity })
    }

    if (mode === 'frame' || mode === 'frame-center') {
      const usableW = Math.max(20, tileWidth - margin * 2)
      const usableH = Math.max(20, tileHeight - margin * 2)
      const topY = margin
      const bottomY = tileHeight - margin
      const leftX = margin
      const rightX = tileWidth - margin
      const sideCount = Math.max(2, Math.round(n * usableH / Math.max(1, usableW)))

      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1)
        const x = margin + usableW * t
        const flip = alternate && i % 2 === 1
        push(primary, `top-${i}`, x, topY, 1, rotateAlong ? (inward ? 0 : 180) : 0, flip)
        push(primary, `bottom-${i}`, x, bottomY, 1, rotateAlong ? (inward ? 180 : 0) : 0, flip)
      }

      for (let i = 1; i < sideCount - 1; i++) {
        const t = i / (sideCount - 1)
        const y = margin + usableH * t
        const flip = alternate && i % 2 === 1
        push(primary, `left-${i}`, leftX, y, 1, rotateAlong ? (inward ? 90 : -90) : 0, flip)
        push(primary, `right-${i}`, rightX, y, 1, rotateAlong ? (inward ? -90 : 90) : 0, flip)
      }

      const corners: Array<[number, number, number]> = [
        [leftX, topY, inward ? 45 : 225],
        [rightX, topY, inward ? -45 : 135],
        [leftX, bottomY, inward ? 135 : -45],
        [rightX, bottomY, inward ? -135 : 45],
      ]
      corners.forEach(([x, y, rotation], index) => push(accentAsset, `corner-${index}`, x, y, cornerScale, rotateAlong ? rotation : 0))

      if (mode === 'frame-center') {
        push(accentAsset, 'center-hero', tileWidth / 2, tileHeight / 2, centerScale, 0)
      }
      return out
    }

    if (mode === 'horizontal' || mode === 'bands') {
      const stepX = tileWidth / n
      const effectiveRows = mode === 'bands' ? Math.max(3, rowCount) : rowCount
      const totalHeight = (effectiveRows - 1) * rowGap
      const startY = tileHeight / 2 - totalHeight / 2
      for (let row = 0; row < effectiveRows; row++) {
        const rowAsset = mode === 'bands' && accent && row % 2 === 1 ? accent : primary
        const offset = alternate && row % 2 === 1 ? stepX * rowOffset : 0
        for (let col = -1; col <= n; col++) {
          const x = modulo((col + 0.5) * stepX + offset, tileWidth)
          const y = startY + row * rowGap
          const rot = alternate && row % 2 === 1 ? 180 : 0
          push(rowAsset, `row-${row}-${col}`, x, y, 1, rot)
        }
      }
      return out
    }

    if (mode === 'diagonal') {
      const stepX = tileWidth / n
      const rad = angle * Math.PI / 180
      const slope = Math.tan(rad)
      const baseGap = Math.max(40, rowGap)
      const effectiveRows = Math.max(2, rowCount)
      for (let row = -1; row <= effectiveRows; row++) {
        const rowBase = (row + 0.5) * (tileHeight / effectiveRows)
        const offset = alternate && row % 2 !== 0 ? stepX * rowOffset : 0
        for (let col = -2; col <= n + 1; col++) {
          const rawX = (col + 0.5) * stepX + offset
          const x = modulo(rawX, tileWidth)
          const y = modulo(rowBase + slope * (rawX - tileWidth / 2) + row * (baseGap - tileHeight / effectiveRows) * 0.2, tileHeight)
          push(primary, `diag-${row}-${col}`, x, y, 1, rotateAlong ? angle : 0, alternate && (row + col) % 2 !== 0)
        }
      }
      return out
    }

    if (mode === 'grid') {
      const columns = n
      const stepX = tileWidth / columns
      const stepY = tileHeight / rowCount
      for (let row = 0; row < rowCount; row++) {
        const offset = alternate && row % 2 === 1 ? stepX * rowOffset : 0
        for (let col = 0; col < columns; col++) {
          const x = modulo((col + 0.5) * stepX + offset, tileWidth)
          const y = (row + 0.5) * stepY
          const asset = accent && alternate && (row + col) % 2 === 1 ? accent : primary
          push(asset, `grid-${row}-${col}`, x, y, 1, alternate && (row + col) % 2 === 1 ? 180 : 0)
        }
      }
      return out
    }

    if (mode === 'center') {
      push(accentAsset, 'center', tileWidth / 2, tileHeight / 2, centerScale, 0)
      const radius = Math.min(tileWidth, tileHeight) * 0.31
      const count = clamp(n, 4, 20)
      for (let i = 0; i < count; i++) {
        const theta = (Math.PI * 2 * i) / count
        const x = tileWidth / 2 + Math.cos(theta) * radius
        const y = tileHeight / 2 + Math.sin(theta) * radius
        push(primary, `filler-${i}`, x, y, 0.82, rotateAlong ? theta * 180 / Math.PI + 90 : 0, alternate && i % 2 === 1)
      }
      return out
    }

    // Keeps TS aware these values are intentionally used by the generator.
    void primaryDims
    void accentDims
    return out
  }, [primary, accent, mode, tileWidth, tileHeight, margin, motifSize, repeatCount, rows, rowGap, rowOffset, angle, centerScale, cornerScale, alternate, rotateAlong, inward])

  function placementMarkup(placement: Placement, dx = 0, dy = 0) {
    const asset = assetById.get(placement.assetId)
    if (!asset) return ''
    const sx = placement.flipX ? -1 : 1
    const sy = placement.flipY ? -1 : 1
    return `<g opacity="${placement.opacity ?? 1}" transform="translate(${placement.x + dx} ${placement.y + dy}) rotate(${placement.rotation}) scale(${sx} ${sy}) translate(${-placement.width / 2} ${-placement.height / 2})"><svg width="${placement.width}" height="${placement.height}" viewBox="${asset.viewBox}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
  }

  function buildSvg() {
    const shifts = isRepeatLayout ? WRAPS : [0]
    const markup = placements.flatMap((placement) => shifts.flatMap((sx) => shifts.map((sy) => placementMarkup(placement, sx * tileWidth, sy * tileHeight)))).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}"><defs><clipPath id="pf-guide-clip"><rect width="${tileWidth}" height="${tileHeight}"/></clipPath></defs><rect width="${tileWidth}" height="${tileHeight}" fill="${background}"/><g clip-path="url(#pf-guide-clip)">${markup}</g></svg>`
  }

  function exportSvg() {
    if (!placements.length) return
    const label = isRepeatLayout ? 'seamless-tile' : 'composition'
    downloadText(buildSvg(), `patternforge-${mode}-${label}.svg`)
    setMessage(`${isRepeatLayout ? 'Seamless tile' : 'Layout composition'} SVG exported.`)
  }

  function exportProof() {
    if (!placements.length) return
    const tile = buildSvg().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    const groups = Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => `<g transform="translate(${col * tileWidth} ${row * tileHeight})">${tile}</g>`)).join('')
    downloadText(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth * 3}" height="${tileHeight * 3}" viewBox="0 0 ${tileWidth * 3} ${tileHeight * 3}">${groups}</svg>`, `patternforge-${mode}-3x3-proof.svg`)
  }

  function useMode(nextMode: LayoutMode) {
    setMode(nextMode)
    setView('edit')
    if (nextMode === 'diagonal') setMessage('Diagonal Strip is a placement guide: upload one correct Parang/Lereng SVG unit, then tune angle, spacing and rows.')
    else if (nextMode === 'grid') setMessage('Structured Grid guides placement only. Build the Kawung/Ceplok motif itself as SVG; PatternForge will not redraw it.')
    else if (nextMode === 'horizontal' || nextMode === 'bands') setMessage('Horizontal guides work for parade/border structures such as Pucuk Rebung, Itik Pulang Patang and decorative sweater rows.')
    else setMessage('Tune the structural guide while keeping the live center preview visible.')
  }

  const guideLabel = MODES.find((entry) => entry.id === mode)?.label ?? mode
  const previewShifts = isRepeatLayout ? WRAPS : [0]

  return (
    <div className="v10-builder-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>SVG Motifs</h2>
          <button className="v10-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}>
            <b>Drop / Upload SVG</b><span>Your motif artwork stays untouched.</span>
          </button>
          <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <div className="v10-asset-grid">
            {assets.map((asset) => <button key={asset.id} className={primaryId === asset.id ? 'active' : ''} onClick={() => setPrimaryId(asset.id)}><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /><span>{asset.name}</span></button>)}
          </div>
        </section>

        <section>
          <h2>Layout Guide</h2>
          <div className="v10-layout-list">
            {MODES.map((entry) => <button key={entry.id} className={mode === entry.id ? 'active' : ''} onClick={() => useMode(entry.id)}><b>{entry.label}</b><span>{entry.hint}</span></button>)}
          </div>
        </section>

        <section className="v10-cultural-note">
          <h2>Guide, not generator</h2>
          <p>Parang, Kawung, Ceplok, Mega Mendung and other cultural motifs are no longer auto-drawn here. Create a correct SVG motif, then use the structural guide that fits it. Organic work such as Mega Mendung belongs in the Freeform Seamless Builder.</p>
          <button onClick={onOpenSeamless}>Open Freeform Builder</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{guideLabel}</b><span>{tileWidth} × {tileHeight} · {placements.length} generated placements</span></div>
          <div className="v10-view-buttons"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Live Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>3×3 Proof</button></div>
        </div>

        <div className="v10-preview-zone">
          {!primary ? <div className="v10-empty-state"><b>Upload one SVG motif to start</b><p>For Parang, for example, make one correct motif unit. PatternForge will build the diagonal rows and seamless structure.</p></div> : view === 'proof' ? (
            <svg className="v10-proof-svg" viewBox={`0 0 ${tileWidth * 3} ${tileHeight * 3}`}>
              {Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => (
                <svg key={`${row}-${col}`} x={col * tileWidth} y={row * tileHeight} width={tileWidth} height={tileHeight} viewBox={`0 0 ${tileWidth} ${tileHeight}`} overflow="hidden">
                  <rect width={tileWidth} height={tileHeight} fill={background} />
                  {placements.flatMap((placement) => previewShifts.flatMap((sx) => previewShifts.map((sy) => {
                    const asset = assetById.get(placement.assetId)
                    return asset ? <LayoutAsset key={`${placement.id}-${sx}-${sy}`} placement={placement} asset={asset} dx={sx * tileWidth} dy={sy * tileHeight} /> : null
                  })))}
                  <rect width={tileWidth} height={tileHeight} className="v10-tile-outline" />
                </svg>
              )))}
            </svg>
          ) : (
            <svg className="v10-live-svg" viewBox={`0 0 ${tileWidth} ${tileHeight}`}>
              <defs><clipPath id="pf-guide-preview"><rect width={tileWidth} height={tileHeight} /></clipPath></defs>
              <rect width={tileWidth} height={tileHeight} fill={background} />
              <g clipPath="url(#pf-guide-preview)">
                {placements.flatMap((placement) => previewShifts.flatMap((sx) => previewShifts.map((sy) => {
                  const asset = assetById.get(placement.assetId)
                  return asset ? <LayoutAsset key={`${placement.id}-${sx}-${sy}`} placement={placement} asset={asset} dx={sx * tileWidth} dy={sy * tileHeight} dim={sx !== 0 || sy !== 0} /> : null
                })))}
              </g>
              {showGuides && (mode === 'frame' || mode === 'frame-center') ? <rect x={margin} y={margin} width={Math.max(1, tileWidth - margin * 2)} height={Math.max(1, tileHeight - margin * 2)} className="v10-guide-line" /> : null}
              {showGuides && mode === 'center' ? <><line x1={tileWidth / 2} x2={tileWidth / 2} y1="0" y2={tileHeight} className="v10-guide-line" /><line y1={tileHeight / 2} y2={tileHeight / 2} x1="0" x2={tileWidth} className="v10-guide-line" /></> : null}
              <rect width={tileWidth} height={tileHeight} className="v10-tile-outline" />
            </svg>
          )}
        </div>
        <div className="v10-stage-status"><span>{message}</span><b>{isRepeatLayout ? 'SEAMLESS REPEAT GUIDE' : 'FINAL COMPOSITION GUIDE'}</b></div>
      </main>

      <aside className="v10-panel v10-panel-right">
        <section>
          <h2>Tile / Canvas</h2>
          <div className="v10-preset-row">{[800, 1200, 1600, 2000, 3000].map((size) => <button key={size} onClick={() => { setTileWidth(size); setTileHeight(size) }}>{size}</button>)}</div>
          <div className="v10-two"><label><span>Width</span><input type="number" value={tileWidth} min="256" max="12000" onChange={(event) => setTileWidth(Math.max(256, Number(event.target.value)))} /></label><label><span>Height</span><input type="number" value={tileHeight} min="256" max="12000" onChange={(event) => setTileHeight(Math.max(256, Number(event.target.value)))} /></label></div>
          <label><span>Background</span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
          <label className="v10-check"><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} /> Show construction guides</label>
        </section>

        <section>
          <h2>Motif Roles</h2>
          <label><span>Primary motif</span><select value={primaryId ?? ''} onChange={(event) => setPrimaryId(event.target.value || null)}><option value="">Select motif</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          <label><span>Accent / center / alternating motif</span><select value={accentId ?? ''} onChange={(event) => setAccentId(event.target.value || null)}><option value="">Use primary</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
        </section>

        <section>
          <h2>Structure Controls</h2>
          <label><span>Motif size</span><input type="range" min="40" max="700" value={motifSize} onChange={(event) => setMotifSize(Number(event.target.value))} /><output>{motifSize}px</output></label>
          <label><span>Repeat count / columns</span><input type="number" min="2" max="30" value={repeatCount} onChange={(event) => setRepeatCount(clamp(Number(event.target.value), 2, 30))} /></label>
          {(mode === 'horizontal' || mode === 'bands' || mode === 'diagonal' || mode === 'grid') ? <label><span>Rows / bands</span><input type="number" min="1" max="12" value={rows} onChange={(event) => setRows(clamp(Number(event.target.value), 1, 12))} /></label> : null}
          {(mode === 'horizontal' || mode === 'bands' || mode === 'diagonal') ? <label><span>Row gap</span><input type="range" min="40" max="600" value={rowGap} onChange={(event) => setRowGap(Number(event.target.value))} /><output>{rowGap}px</output></label> : null}
          {(mode === 'horizontal' || mode === 'bands' || mode === 'diagonal' || mode === 'grid') ? <label><span>Alternate row offset</span><input type="range" min="0" max="1" step="0.05" value={rowOffset} onChange={(event) => setRowOffset(Number(event.target.value))} /><output>{Math.round(rowOffset * 100)}%</output></label> : null}
          {(mode === 'frame' || mode === 'frame-center') ? <><label><span>Frame margin</span><input type="range" min="20" max="500" value={margin} onChange={(event) => setMargin(Number(event.target.value))} /><output>{margin}px</output></label><label><span>Corner scale</span><input type="range" min="0.5" max="3" step="0.05" value={cornerScale} onChange={(event) => setCornerScale(Number(event.target.value))} /><output>{cornerScale.toFixed(2)}×</output></label></> : null}
          {(mode === 'frame-center' || mode === 'center') ? <label><span>Center scale</span><input type="range" min="1" max="6" step="0.1" value={centerScale} onChange={(event) => setCenterScale(Number(event.target.value))} /><output>{centerScale.toFixed(1)}×</output></label> : null}
          {mode === 'diagonal' ? <label><span>Diagonal angle</span><input type="range" min="15" max="75" step="1" value={angle} onChange={(event) => setAngle(Number(event.target.value))} /><output>{angle}°</output></label> : null}
          <label className="v10-check"><input type="checkbox" checked={alternate} onChange={(event) => setAlternate(event.target.checked)} /> Alternate / stagger placements</label>
          <label className="v10-check"><input type="checkbox" checked={rotateAlong} onChange={(event) => setRotateAlong(event.target.checked)} /> Rotate motif along guide direction</label>
          {(mode === 'frame' || mode === 'frame-center') ? <label className="v10-check"><input type="checkbox" checked={inward} onChange={(event) => setInward(event.target.checked)} /> Frame motifs point inward</label> : null}
        </section>

        <section>
          <h2>Export</h2>
          <button className="v10-primary-action" disabled={!placements.length} onClick={exportSvg}>{isRepeatLayout ? 'Export Seamless Tile SVG' : 'Export Composition SVG'}</button>
          <button className="v10-wide-button" disabled={!placements.length} onClick={exportProof}>Export 3×3 Proof SVG</button>
          <small>{isRepeatLayout ? 'Horizontal, multi-band, diagonal and grid guides are exported as wrapped seamless tiles.' : 'Frame and center modes are final compositions by default; use Empty Center for buyer-added text or logos.'}</small>
        </section>

        <section>
          <h2>Next workspace</h2>
          <button className="v10-wide-button" onClick={onOpenPlaid}>Open Plaid / Tartan Maker</button>
        </section>
      </aside>
    </div>
  )
}
