import { useMemo, useRef, useState } from 'react'
import { parseSvgAsset } from '../engine/svg'
import type { SvgAsset } from '../types'

type TextileMode =
  | 'songket-border-body'
  | 'songket-tabur'
  | 'tenun-bands'
  | 'nordic-rows'
  | 'ugly-sweater'
  | 'native-rows'
  | 'ikat-stripe'

type ViewMode = 'tile' | 'proof'

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

type BandRect = {
  id: string
  x: number
  y: number
  width: number
  height: number
  fill: string
  opacity?: number
}

type Props = {
  onOpenSeamless: () => void
  onOpenGuides: () => void
  onOpenPlaid: () => void
}

const WRAPS = [-1, 0, 1]

const MODES: Array<{ id: TextileMode; label: string; hint: string; seamless: boolean }> = [
  { id: 'songket-border-body', label: 'Songket Border + Body', hint: 'Border zones · body field · center accent', seamless: false },
  { id: 'songket-tabur', label: 'Songket Tabur', hint: 'Sparse repeated motif field', seamless: true },
  { id: 'tenun-bands', label: 'Tenun Bands', hint: 'Repeated ornamental horizontal bands', seamless: true },
  { id: 'nordic-rows', label: 'Nordic Rows', hint: 'Symmetric geometric row structure', seamless: true },
  { id: 'ugly-sweater', label: 'Ugly Sweater Bands', hint: 'Multi-row seasonal motif bands', seamless: true },
  { id: 'native-rows', label: 'Native / Folk Rows', hint: 'Generic repeated folk-style rows', seamless: true },
  { id: 'ikat-stripe', label: 'Ikat / Woven Stripe', hint: 'Stripe field plus motif overlay', seamless: true },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function modulo(value: number, size: number) {
  if (!size) return value
  return ((value % size) + size) % size
}

function fitDims(asset: SvgAsset, size: number) {
  const ratio = asset.viewWidth / asset.viewHeight || 1
  return ratio >= 1 ? { width: size, height: size / ratio } : { width: size * ratio, height: size }
}

function downloadSvg(text: string, filename: string) {
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function TextileAsset({ placement, asset, dx = 0, dy = 0, dim = false }: { placement: Placement; asset: SvgAsset; dx?: number; dy?: number; dim?: boolean }) {
  const sx = placement.flipX ? -1 : 1
  const sy = placement.flipY ? -1 : 1
  return (
    <g
      pointerEvents="none"
      opacity={(placement.opacity ?? 1) * (dim ? 0.58 : 1)}
      transform={`translate(${placement.x + dx} ${placement.y + dy}) rotate(${placement.rotation}) scale(${sx} ${sy}) translate(${-placement.width / 2} ${-placement.height / 2})`}
    >
      <svg width={placement.width} height={placement.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

export default function WovenTextileBuilder({ onOpenSeamless, onOpenGuides, onOpenPlaid }: Props) {
  const [mode, setMode] = useState<TextileMode>('songket-border-body')
  const [view, setView] = useState<ViewMode>('tile')
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [secondaryId, setSecondaryId] = useState<string | null>(null)
  const [accentId, setAccentId] = useState<string | null>(null)
  const [tileWidth, setTileWidth] = useState(1600)
  const [tileHeight, setTileHeight] = useState(1600)
  const [background, setBackground] = useState('#15241f')
  const [bandA, setBandA] = useState('#6f1d2c')
  const [bandB, setBandB] = useState('#173f35')
  const [separatorColor, setSeparatorColor] = useState('#d6b76d')
  const [motifSize, setMotifSize] = useState(150)
  const [repeatCount, setRepeatCount] = useState(9)
  const [rows, setRows] = useState(5)
  const [rowGap, setRowGap] = useState(220)
  const [rowOffset, setRowOffset] = useState(0.5)
  const [borderDepth, setBorderDepth] = useState(180)
  const [separatorWidth, setSeparatorWidth] = useState(12)
  const [centerScale, setCenterScale] = useState(2.4)
  const [fillerDensity, setFillerDensity] = useState(0.65)
  const [alternate, setAlternate] = useState(true)
  const [reverseRows, setReverseRows] = useState(true)
  const [showGuides, setShowGuides] = useState(true)
  const [message, setMessage] = useState('Upload your own SVG motifs, then let the textile structure arrange them into zones, bands or repeated rows.')
  const inputRef = useRef<HTMLInputElement>(null)

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const primary = primaryId ? assetById.get(primaryId) ?? null : null
  const secondary = secondaryId ? assetById.get(secondaryId) ?? null : null
  const accent = accentId ? assetById.get(accentId) ?? null : null
  const modeMeta = MODES.find((entry) => entry.id === mode) ?? MODES[0]

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('Woven / Textile Builder accepts SVG vector motifs only.')
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
    if (!next.length) return
    setAssets((current) => [...current, ...next])
    setPrimaryId((current) => current ?? next[0].id)
    setSecondaryId((current) => current ?? next[Math.min(1, next.length - 1)].id)
    setAccentId((current) => current ?? next[Math.min(2, next.length - 1)].id)
    setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} loaded. Assign motif roles, then tune the textile structure.`)
  }

  const generated = useMemo(() => {
    const placements: Placement[] = []
    const bands: BandRect[] = []
    if (!primary) return { placements, bands }

    const secondaryAsset = secondary ?? primary
    const accentAsset = accent ?? secondaryAsset
    const n = clamp(Math.round(repeatCount), 2, 30)
    const rowCount = clamp(Math.round(rows), 1, 12)

    const push = (asset: SvgAsset, id: string, x: number, y: number, scale = 1, rotation = 0, flipX = false, flipY = false, opacity = 1) => {
      const dims = fitDims(asset, motifSize * scale)
      placements.push({ id, assetId: asset.id, x, y, width: dims.width, height: dims.height, rotation, flipX, flipY, opacity })
    }

    const pushRow = (asset: SvgAsset, row: number, y: number, count = n, scale = 1, rotation = 0) => {
      const stepX = tileWidth / count
      const offset = alternate && row % 2 === 1 ? stepX * rowOffset : 0
      for (let col = -1; col <= count; col++) {
        const x = modulo((col + 0.5) * stepX + offset, tileWidth)
        const reverse = reverseRows && row % 2 === 1
        push(asset, `row-${row}-${col}`, x, y, scale, reverse ? rotation + 180 : rotation, alternate && (row + col) % 2 !== 0)
      }
    }

    if (mode === 'songket-border-body') {
      bands.push({ id: 'top-band', x: 0, y: 0, width: tileWidth, height: borderDepth, fill: bandA, opacity: 0.55 })
      bands.push({ id: 'bottom-band', x: 0, y: tileHeight - borderDepth, width: tileWidth, height: borderDepth, fill: bandA, opacity: 0.55 })
      pushRow(primary, 0, borderDepth / 2, n, 0.95)
      pushRow(primary, 1, tileHeight - borderDepth / 2, n, 0.95, 180)

      const bodyTop = borderDepth + rowGap * 0.45
      const bodyBottom = tileHeight - borderDepth - rowGap * 0.45
      const bodyRows = Math.max(2, rowCount)
      const bodyStep = bodyRows === 1 ? 0 : (bodyBottom - bodyTop) / Math.max(1, bodyRows - 1)
      const bodyCount = Math.max(3, Math.round(n * fillerDensity))
      for (let row = 0; row < bodyRows; row++) {
        const y = bodyTop + row * bodyStep
        pushRow(row % 2 === 0 ? secondaryAsset : primary, row + 2, y, bodyCount, 0.7)
      }
      push(accentAsset, 'center-accent', tileWidth / 2, tileHeight / 2, centerScale, 0)
      return { placements, bands }
    }

    if (mode === 'songket-tabur') {
      const stepY = tileHeight / rowCount
      const count = Math.max(3, Math.round(n * fillerDensity))
      for (let row = 0; row < rowCount; row++) {
        const y = (row + 0.5) * stepY
        pushRow(row % 3 === 2 ? accentAsset : secondaryAsset, row, y, count, row % 3 === 2 ? 0.82 : 0.66)
      }
      return { placements, bands }
    }

    if (mode === 'tenun-bands' || mode === 'nordic-rows' || mode === 'ugly-sweater' || mode === 'native-rows') {
      const totalHeight = (rowCount - 1) * rowGap
      const startY = tileHeight / 2 - totalHeight / 2
      for (let row = 0; row < rowCount; row++) {
        const y = startY + row * rowGap
        const asset = row % 3 === 0 ? primary : row % 3 === 1 ? secondaryAsset : accentAsset
        const scale = mode === 'nordic-rows' ? 0.78 : mode === 'ugly-sweater' ? 0.9 : 0.82
        const bandHeight = Math.min(rowGap * 0.7, motifSize * 1.35)
        bands.push({ id: `band-${row}`, x: 0, y: y - bandHeight / 2, width: tileWidth, height: bandHeight, fill: row % 2 === 0 ? bandA : bandB, opacity: mode === 'ugly-sweater' ? 0.22 : 0.16 })
        pushRow(asset, row, y, n, scale)
        if (separatorWidth > 0) {
          bands.push({ id: `sep-${row}`, x: 0, y: modulo(y + rowGap / 2 - separatorWidth / 2, tileHeight), width: tileWidth, height: separatorWidth, fill: separatorColor, opacity: 0.72 })
        }
      }
      return { placements, bands }
    }

    if (mode === 'ikat-stripe') {
      const stripeCount = Math.max(4, Math.min(18, n))
      const stripeWidth = tileWidth / stripeCount
      for (let col = 0; col < stripeCount; col++) {
        bands.push({
          id: `stripe-${col}`,
          x: col * stripeWidth,
          y: 0,
          width: stripeWidth,
          height: tileHeight,
          fill: col % 3 === 0 ? bandA : col % 3 === 1 ? background : bandB,
          opacity: col % 3 === 1 ? 0.15 : 0.42,
        })
      }
      const totalHeight = (rowCount - 1) * rowGap
      const startY = tileHeight / 2 - totalHeight / 2
      for (let row = 0; row < rowCount; row++) {
        pushRow(row % 2 === 0 ? primary : secondaryAsset, row, startY + row * rowGap, Math.max(3, Math.round(n * 0.72)), 0.8)
      }
      return { placements, bands }
    }

    return { placements, bands }
  }, [primary, secondary, accent, mode, tileWidth, tileHeight, background, bandA, bandB, separatorColor, motifSize, repeatCount, rows, rowGap, rowOffset, borderDepth, separatorWidth, centerScale, fillerDensity, alternate, reverseRows])

  const { placements, bands } = generated
  const wrapShifts = modeMeta.seamless ? WRAPS : [0]

  function placementMarkup(placement: Placement, dx = 0, dy = 0) {
    const asset = assetById.get(placement.assetId)
    if (!asset) return ''
    const sx = placement.flipX ? -1 : 1
    const sy = placement.flipY ? -1 : 1
    return `<g opacity="${placement.opacity ?? 1}" transform="translate(${placement.x + dx} ${placement.y + dy}) rotate(${placement.rotation}) scale(${sx} ${sy}) translate(${-placement.width / 2} ${-placement.height / 2})"><svg width="${placement.width}" height="${placement.height}" viewBox="${asset.viewBox}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
  }

  function buildSvg() {
    const bandMarkup = bands.map((band) => `<rect x="${band.x}" y="${band.y}" width="${band.width}" height="${band.height}" fill="${band.fill}" fill-opacity="${band.opacity ?? 1}"/>`).join('')
    const motifMarkup = placements.flatMap((placement) => wrapShifts.flatMap((sx) => wrapShifts.map((sy) => placementMarkup(placement, sx * tileWidth, sy * tileHeight)))).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}"><defs><clipPath id="pf-textile-clip"><rect width="${tileWidth}" height="${tileHeight}"/></clipPath></defs><rect width="${tileWidth}" height="${tileHeight}" fill="${background}"/><g clip-path="url(#pf-textile-clip)">${bandMarkup}${motifMarkup}</g></svg>`
  }

  function exportTile() {
    if (!placements.length) return
    downloadSvg(buildSvg(), `patternforge-${mode}-${modeMeta.seamless ? 'seamless' : 'composition'}.svg`)
    setMessage(`${modeMeta.seamless ? 'Seamless textile tile' : 'Textile composition'} SVG exported.`)
  }

  function exportProof() {
    if (!placements.length) return
    const tile = buildSvg().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    const groups = Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => `<g transform="translate(${col * tileWidth} ${row * tileHeight})">${tile}</g>`)).join('')
    downloadSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth * 3}" height="${tileHeight * 3}" viewBox="0 0 ${tileWidth * 3} ${tileHeight * 3}">${groups}</svg>`, `patternforge-${mode}-3x3-proof.svg`)
  }

  function chooseMode(next: TextileMode) {
    setMode(next)
    setView('tile')
    if (next === 'songket-border-body') setMessage('Use your own border, body and accent motifs. This preset controls zones only; it does not generate a traditional motif.')
    else if (next === 'songket-tabur') setMessage('Songket Tabur creates a sparse repeating field from your uploaded motifs and exports it as a seamless tile.')
    else if (next === 'nordic-rows') setMessage('Nordic Rows is a generic symmetric band structure; upload your own snowflake, diamond or geometric SVGs.')
    else if (next === 'ugly-sweater') setMessage('Ugly Sweater Bands alternates SVG motifs across horizontal rows with optional separators.')
    else setMessage('This textile preset controls rows, bands and repeat rhythm while keeping your SVG artwork unchanged.')
  }

  return (
    <div className="v10-builder-shell v101-textile-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>SVG Textile Motifs</h2>
          <button className="v10-drop" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}>
            <b>Drop / Upload SVG</b><span>Primary · secondary · accent roles</span>
          </button>
          <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <div className="v10-asset-grid">
            {assets.map((asset) => <button key={asset.id} className={primaryId === asset.id ? 'active' : ''} onClick={() => setPrimaryId(asset.id)}><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /><span>{asset.name}</span></button>)}
          </div>
        </section>

        <section>
          <h2>Textile Structure</h2>
          <div className="v10-layout-list">
            {MODES.map((entry) => <button key={entry.id} className={mode === entry.id ? 'active' : ''} onClick={() => chooseMode(entry.id)}><b>{entry.label}</b><span>{entry.hint}</span></button>)}
          </div>
        </section>

        <section className="v10-cultural-note">
          <h2>Structure, not imitation</h2>
          <p>This workspace does not draw Songket, Tenun, Nordic or other cultural motifs for you. Supply the motif SVGs you want to use; PatternForge only manages zones, band rhythm, spacing, alternation and seamless repeat.</p>
          <button onClick={onOpenGuides}>Open Layout Guides</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{modeMeta.label}</b><span>{tileWidth} × {tileHeight} · {placements.length} motif placements · {bands.length} structural bands</span></div>
          <div className="v10-view-buttons"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Live Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>3×3 Proof</button></div>
        </div>

        <div className="v10-preview-zone">
          {!primary ? <div className="v10-empty-state"><b>Upload at least one SVG motif</b><p>Then choose a textile structure. The center preview stays fixed while both side panels scroll independently.</p></div> : view === 'proof' ? (
            <svg className="v10-proof-svg" viewBox={`0 0 ${tileWidth * 3} ${tileHeight * 3}`}>
              {Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => (
                <svg key={`${row}-${col}`} x={col * tileWidth} y={row * tileHeight} width={tileWidth} height={tileHeight} viewBox={`0 0 ${tileWidth} ${tileHeight}`} overflow="hidden">
                  <rect width={tileWidth} height={tileHeight} fill={background} />
                  {bands.map((band) => <rect key={band.id} x={band.x} y={band.y} width={band.width} height={band.height} fill={band.fill} opacity={band.opacity ?? 1} />)}
                  {placements.flatMap((placement) => wrapShifts.flatMap((sx) => wrapShifts.map((sy) => {
                    const asset = assetById.get(placement.assetId)
                    return asset ? <TextileAsset key={`${placement.id}-${sx}-${sy}`} placement={placement} asset={asset} dx={sx * tileWidth} dy={sy * tileHeight} /> : null
                  })))}
                  <rect width={tileWidth} height={tileHeight} className="v10-tile-outline" />
                </svg>
              )))}
            </svg>
          ) : (
            <svg className="v10-live-svg" viewBox={`0 0 ${tileWidth} ${tileHeight}`}>
              <defs><clipPath id="pf-textile-preview"><rect width={tileWidth} height={tileHeight} /></clipPath></defs>
              <rect width={tileWidth} height={tileHeight} fill={background} />
              <g clipPath="url(#pf-textile-preview)">
                {bands.map((band) => <rect key={band.id} x={band.x} y={band.y} width={band.width} height={band.height} fill={band.fill} opacity={band.opacity ?? 1} />)}
                {placements.flatMap((placement) => wrapShifts.flatMap((sx) => wrapShifts.map((sy) => {
                  const asset = assetById.get(placement.assetId)
                  return asset ? <TextileAsset key={`${placement.id}-${sx}-${sy}`} placement={placement} asset={asset} dx={sx * tileWidth} dy={sy * tileHeight} dim={sx !== 0 || sy !== 0} /> : null
                })))}
              </g>
              {showGuides && mode === 'songket-border-body' ? <><line x1="0" x2={tileWidth} y1={borderDepth} y2={borderDepth} className="v10-guide-line" /><line x1="0" x2={tileWidth} y1={tileHeight - borderDepth} y2={tileHeight - borderDepth} className="v10-guide-line" /></> : null}
              <rect width={tileWidth} height={tileHeight} className="v10-tile-outline" />
            </svg>
          )}
        </div>
        <div className="v10-stage-status"><span>{message}</span><b>{modeMeta.seamless ? 'SEAMLESS TEXTILE STRUCTURE' : 'TEXTILE COMPOSITION'}</b></div>
      </main>

      <aside className="v10-panel v10-panel-right">
        <section>
          <h2>Tile / Canvas</h2>
          <div className="v10-preset-row">{[800, 1200, 1600, 2000, 3000].map((size) => <button key={size} onClick={() => { setTileWidth(size); setTileHeight(size) }}>{size}</button>)}</div>
          <div className="v10-two"><label><span>Width</span><input type="number" min="256" max="12000" value={tileWidth} onChange={(event) => setTileWidth(Math.max(256, Number(event.target.value)))} /></label><label><span>Height</span><input type="number" min="256" max="12000" value={tileHeight} onChange={(event) => setTileHeight(Math.max(256, Number(event.target.value)))} /></label></div>
          <label><span>Background</span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
          <div className="v101-color-row"><label><span>Band A</span><input type="color" value={bandA} onChange={(event) => setBandA(event.target.value)} /></label><label><span>Band B</span><input type="color" value={bandB} onChange={(event) => setBandB(event.target.value)} /></label><label><span>Separator</span><input type="color" value={separatorColor} onChange={(event) => setSeparatorColor(event.target.value)} /></label></div>
          <label className="v10-check"><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} /> Show structural guides</label>
        </section>

        <section>
          <h2>Motif Roles</h2>
          <label><span>Primary</span><select value={primaryId ?? ''} onChange={(event) => setPrimaryId(event.target.value || null)}><option value="">Select motif</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          <label><span>Secondary</span><select value={secondaryId ?? ''} onChange={(event) => setSecondaryId(event.target.value || null)}><option value="">Use primary</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
          <label><span>Accent / center</span><select value={accentId ?? ''} onChange={(event) => setAccentId(event.target.value || null)}><option value="">Use secondary</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
        </section>

        <section>
          <h2>Textile Controls</h2>
          <label><span>Motif size</span><input type="range" min="40" max="600" value={motifSize} onChange={(event) => setMotifSize(Number(event.target.value))} /><output>{motifSize}px</output></label>
          <label><span>Repeat count</span><input type="number" min="2" max="30" value={repeatCount} onChange={(event) => setRepeatCount(clamp(Number(event.target.value), 2, 30))} /></label>
          <label><span>Rows / bands</span><input type="number" min="1" max="12" value={rows} onChange={(event) => setRows(clamp(Number(event.target.value), 1, 12))} /></label>
          <label><span>Row gap</span><input type="range" min="40" max="600" value={rowGap} onChange={(event) => setRowGap(Number(event.target.value))} /><output>{rowGap}px</output></label>
          <label><span>Alternate row offset</span><input type="range" min="0" max="1" step="0.05" value={rowOffset} onChange={(event) => setRowOffset(Number(event.target.value))} /><output>{Math.round(rowOffset * 100)}%</output></label>
          {mode === 'songket-border-body' ? <><label><span>Border depth</span><input type="range" min="80" max="500" value={borderDepth} onChange={(event) => setBorderDepth(Number(event.target.value))} /><output>{borderDepth}px</output></label><label><span>Center accent scale</span><input type="range" min="1" max="5" step="0.1" value={centerScale} onChange={(event) => setCenterScale(Number(event.target.value))} /><output>{centerScale.toFixed(1)}×</output></label></> : null}
          {(mode === 'songket-border-body' || mode === 'songket-tabur') ? <label><span>Filler density</span><input type="range" min="0.25" max="1" step="0.05" value={fillerDensity} onChange={(event) => setFillerDensity(Number(event.target.value))} /><output>{Math.round(fillerDensity * 100)}%</output></label> : null}
          {(mode === 'tenun-bands' || mode === 'nordic-rows' || mode === 'ugly-sweater' || mode === 'native-rows') ? <label><span>Separator width</span><input type="range" min="0" max="40" value={separatorWidth} onChange={(event) => setSeparatorWidth(Number(event.target.value))} /><output>{separatorWidth}px</output></label> : null}
          <label className="v10-check"><input type="checkbox" checked={alternate} onChange={(event) => setAlternate(event.target.checked)} /> Alternate / stagger rows</label>
          <label className="v10-check"><input type="checkbox" checked={reverseRows} onChange={(event) => setReverseRows(event.target.checked)} /> Reverse every other row</label>
        </section>

        <section>
          <h2>Export</h2>
          <button className="v10-primary-action" disabled={!placements.length} onClick={exportTile}>{modeMeta.seamless ? 'Export Textile Seamless SVG' : 'Export Textile Composition SVG'}</button>
          <button className="v10-wide-button" disabled={!placements.length} onClick={exportProof}>Export 3×3 Proof SVG</button>
          <small>{modeMeta.seamless ? 'This preset wraps motif placements across tile edges before export.' : 'Border + Body is a final textile composition by default rather than an all-over repeat tile.'}</small>
        </section>

        <section>
          <h2>Other workspaces</h2>
          <button className="v10-wide-button" onClick={onOpenPlaid}>Plaid / Tartan Maker</button>
          <button className="v10-wide-button" onClick={onOpenSeamless}>Freeform Seamless Builder</button>
        </section>
      </aside>
    </div>
  )
}
