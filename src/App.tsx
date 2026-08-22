import { useMemo, useRef, useState } from 'react'
import { buildSvg, generatePattern, repeatCellSize } from './engine/pattern'
import { parseSvgAsset } from './engine/svg'
import type { PatternInstance, PatternSettings, RepeatMode, SvgAsset } from './types'

const initialSettings: PatternSettings = {
  tileWidth: 512,
  tileHeight: 512,
  background: '#f4efe4',
  motifSize: 104,
  repeatWidth: 148,
  repeatHeight: 148,
  sizeTileToArt: true,
  hSpacing: 36,
  vSpacing: 36,
  brickOffset: '1/2',
  overlapX: 'right',
  overlapY: 'bottom',
  rotation: 0,
  randomRotation: 35,
  density: 48,
  seed: 1287,
  copies: 3,
  dimCopies: true,
  dimCopiesPercent: 55,
  showBoundary: true,
  showSwatchBounds: false,
}

const modes: { id: RepeatMode; label: string; group: string }[] = [
  { id: 'grid', label: 'Grid', group: 'Pattern Options' },
  { id: 'brick-row', label: 'Brick by Row', group: 'Pattern Options' },
  { id: 'brick-column', label: 'Brick by Column', group: 'Pattern Options' },
  { id: 'hex-row', label: 'Hex by Row', group: 'Pattern Options' },
  { id: 'hex-column', label: 'Hex by Column', group: 'Pattern Options' },
  { id: 'toss', label: 'Tossed', group: 'Creative' },
  { id: 'ceplok', label: 'Ceplok', group: 'Batik Lab' },
  { id: 'kawung', label: 'Kawung-inspired', group: 'Batik Lab' },
]

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Instance({ item, asset, dx = 0, dy = 0 }: { item: PatternInstance; asset: SvgAsset; dx?: number; dy?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g transform={`translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function WrappedTile({ assets, instances, settings }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings }) {
  const shiftsX = [-settings.tileWidth, 0, settings.tileWidth]
  const shiftsY = [-settings.tileHeight, 0, settings.tileHeight]
  return (
    <>
      <rect width={settings.tileWidth} height={settings.tileHeight} fill={settings.background} />
      {instances.flatMap((item) => {
        const asset = assets[item.assetIndex]
        if (!asset) return []
        return shiftsX.flatMap((dx) => shiftsY.map((dy) => (
          <Instance key={`${item.key}-${dx}-${dy}`} item={item} asset={asset} dx={dx} dy={dy} />
        )))
      })}
    </>
  )
}

function PatternPreview({ assets, instances, settings }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings }) {
  const w = settings.tileWidth
  const h = settings.tileHeight
  const half = Math.floor(settings.copies / 2)
  const cell = repeatCellSize(settings)
  const tiles: JSX.Element[] = []

  for (let row = -half; row <= half; row++) {
    for (let col = -half; col <= half; col++) {
      const center = row === 0 && col === 0
      const opacity = center || !settings.dimCopies ? 1 : settings.dimCopiesPercent / 100
      tiles.push(
        <svg
          key={`${row}-${col}`}
          x={col * w}
          y={row * h}
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          overflow="hidden"
          opacity={opacity}
        >
          <WrappedTile assets={assets} instances={instances} settings={settings} />
        </svg>,
      )
    }
  }

  return (
    <svg
      className="proof"
      viewBox={`${-half * w} ${-half * h} ${settings.copies * w} ${settings.copies * h}`}
      aria-label="Seamless pattern preview"
    >
      {tiles}
      {settings.showBoundary && <rect x={0} y={0} width={w} height={h} className="tile-boundary" />}
      {settings.showSwatchBounds && (
        <rect
          x={(w - cell.width) / 2}
          y={(h - cell.height) / 2}
          width={cell.width}
          height={cell.height}
          className="swatch-boundary"
        />
      )}
    </svg>
  )
}

function NumberControl({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void }) {
  return (
    <label className="control">
      <span>{label}<b>{value}{suffix}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export default function App() {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [mode, setMode] = useState<RepeatMode>('brick-row')
  const [settings, setSettings] = useState<PatternSettings>(initialSettings)
  const [message, setMessage] = useState('Upload one or more SVG motifs to begin.')
  const inputRef = useRef<HTMLInputElement>(null)

  const instances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])
  const cell = useMemo(() => repeatCellSize(settings), [settings])

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('PatternForge currently accepts SVG vector files.')
      return
    }
    const next: SvgAsset[] = []
    for (const file of incoming) {
      try {
        const text = await file.text()
        const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
        next.push(parseSvgAsset(text, file.name, id))
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `Could not load ${file.name}`)
      }
    }
    if (next.length) {
      setAssets((current) => [...current, ...next])
      setMessage(`${next.length} SVG motif${next.length > 1 ? 's' : ''} added. Artwork stays in this browser session.`)
    }
  }

  function exportSvg() {
    if (!assets.length) return
    const svg = buildSvg(assets, instances, settings)
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `patternforge-${mode}-${settings.seed}.svg`)
  }

  function exportPng() {
    if (!assets.length) return
    const svg = buildSvg(assets, instances, settings)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = settings.tileWidth * scale
      canvas.height = settings.tileHeight * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, settings.tileWidth, settings.tileHeight)
      canvas.toBlob((png) => {
        if (png) downloadBlob(png, `patternforge-${mode}-${settings.seed}@2x.png`)
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  }

  const isBrick = mode === 'brick-row' || mode === 'brick-column'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand"><span>PF</span> PatternForge <small>v0.2</small></div>
          <p>Seamless vector pattern studio · Pattern Options · Batik Lab</p>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={() => patch('seed', Math.floor(Math.random() * 999999))}>Randomize</button>
          <button onClick={exportSvg} disabled={!assets.length}>Export SVG</button>
          <button className="accent" onClick={exportPng} disabled={!assets.length}>Export PNG</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar left-panel">
          <section>
            <h2>Assets</h2>
            <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }} onClick={() => inputRef.current?.click()}>
              <strong>Drop SVG motifs</strong>
              <span>or click to browse</span>
              <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            <p className="privacy">Local processing · files are not uploaded by this app.</p>
            <div className="asset-list">
              {assets.map((asset, index) => (
                <div className="asset-card" key={asset.id}>
                  <div className="asset-thumb"><svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} /></div>
                  <div><b>{asset.name}</b><span>Motif {index + 1}</span></div>
                  <button className="icon-button" onClick={() => setAssets((items) => items.filter((x) => x.id !== asset.id))}>×</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Tile Type</h2>
            <div className="mode-grid">
              {modes.map((item) => (
                <button key={item.id} className={mode === item.id ? 'mode active' : 'mode'} onClick={() => setMode(item.id)}>
                  <span>{item.group}</span>{item.label}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="stage-wrap">
          <div className="stage-toolbar">
            <div><b>Live Seamless Proof</b><span>{settings.copies} × {settings.copies} copies · center box is the master tile</span></div>
            <div className="toolbar-checks">
              <label className="check"><input type="checkbox" checked={settings.showBoundary} onChange={(e) => patch('showBoundary', e.target.checked)} /> Tile Edge</label>
              <label className="check"><input type="checkbox" checked={settings.showSwatchBounds} onChange={(e) => patch('showSwatchBounds', e.target.checked)} /> Swatch Bounds</label>
            </div>
          </div>
          <div className="stage">
            {assets.length ? <PatternPreview assets={assets} instances={instances} settings={settings} /> : (
              <div className="empty-stage"><div className="empty-mark">✦</div><h1>Start with an SVG motif</h1><p>Upload vector artwork, choose a tile type, then tune spacing like a desktop pattern editor.</p></div>
            )}
          </div>
          <div className="statusbar"><span>{message}</span><span>{assets.length} assets · {instances.length} master instances · repeat cell {Math.round(cell.width)} × {Math.round(cell.height)}</span></div>
        </section>

        <aside className="sidebar right-panel">
          <section>
            <h2>Master Artboard</h2>
            <div className="two-col">
              <label><span>Width</span><input type="number" min="128" max="2048" value={settings.tileWidth} onChange={(e) => patch('tileWidth', Number(e.target.value))} /></label>
              <label><span>Height</span><input type="number" min="128" max="2048" value={settings.tileHeight} onChange={(e) => patch('tileHeight', Number(e.target.value))} /></label>
            </div>
            <label className="color-row"><span>Background</span><input type="color" value={settings.background} onChange={(e) => patch('background', e.target.value)} /><code>{settings.background}</code></label>
          </section>

          <section>
            <h2>Pattern Options</h2>
            <label className="option-check"><input type="checkbox" checked={settings.sizeTileToArt} onChange={(e) => patch('sizeTileToArt', e.target.checked)} /><span><b>Size Tile to Art</b><small>Auto cell size from motif + spacing</small></span></label>

            {!settings.sizeTileToArt && (
              <div className="two-col compact">
                <label><span>Width</span><input type="number" min="16" max="1024" value={settings.repeatWidth} onChange={(e) => patch('repeatWidth', Number(e.target.value))} /></label>
                <label><span>Height</span><input type="number" min="16" max="1024" value={settings.repeatHeight} onChange={(e) => patch('repeatHeight', Number(e.target.value))} /></label>
              </div>
            )}

            {settings.sizeTileToArt && <>
              <NumberControl label="H Spacing" value={settings.hSpacing} min={-80} max={240} onChange={(v) => patch('hSpacing', v)} />
              <NumberControl label="V Spacing" value={settings.vSpacing} min={-80} max={240} onChange={(v) => patch('vSpacing', v)} />
            </>}

            {isBrick && (
              <label className="select-row"><span>Brick Offset</span><select value={settings.brickOffset} onChange={(e) => patch('brickOffset', e.target.value as PatternSettings['brickOffset'])}><option>1/4</option><option>1/3</option><option>1/2</option><option>2/3</option><option>3/4</option></select></label>
            )}

            <div className="option-subtitle">Overlap priority</div>
            <div className="overlap-grid">
              <button className={settings.overlapX === 'left' ? 'active' : ''} onClick={() => patch('overlapX', 'left')}>← Left</button>
              <button className={settings.overlapX === 'right' ? 'active' : ''} onClick={() => patch('overlapX', 'right')}>Right →</button>
              <button className={settings.overlapY === 'top' ? 'active' : ''} onClick={() => patch('overlapY', 'top')}>↑ Top</button>
              <button className={settings.overlapY === 'bottom' ? 'active' : ''} onClick={() => patch('overlapY', 'bottom')}>Bottom ↓</button>
            </div>
          </section>

          <section>
            <h2>Motif</h2>
            <NumberControl label="Motif size" value={settings.motifSize} min={24} max={280} onChange={(v) => patch('motifSize', v)} />
            <NumberControl label="Rotation" value={settings.rotation} min={-180} max={180} suffix="°" onChange={(v) => patch('rotation', v)} />
            {mode === 'toss' && <>
              <NumberControl label="Random rotation" value={settings.randomRotation} min={0} max={180} suffix="°" onChange={(v) => patch('randomRotation', v)} />
              <NumberControl label="Density" value={settings.density} min={5} max={100} suffix="%" onChange={(v) => patch('density', v)} />
            </>}
          </section>

          <section>
            <h2>Preview Copies</h2>
            <label className="select-row"><span>Copies</span><select value={settings.copies} onChange={(e) => patch('copies', Number(e.target.value))}><option value={3}>3 × 3</option><option value={5}>5 × 5</option><option value={7}>7 × 7</option><option value={9}>9 × 9</option></select></label>
            <label className="option-check"><input type="checkbox" checked={settings.dimCopies} onChange={(e) => patch('dimCopies', e.target.checked)} /><span><b>Dim Copies</b><small>Keep the master tile visually dominant</small></span></label>
            {settings.dimCopies && <NumberControl label="Dim copies to" value={settings.dimCopiesPercent} min={10} max={100} suffix="%" onChange={(v) => patch('dimCopiesPercent', v)} />}
          </section>

          <section className="batik-note">
            <h2>Less stacking by default</h2>
            <p><b>Size Tile to Art</b> now starts with positive spacing. Increase H/V Spacing for more breathing room; use negative values only when you intentionally want motif overlap.</p>
            <p><b>Brick by Row + 1/2</b> is the classic half-drop construction. Batik Lab remains available for Ceplok and Kawung-inspired layouts.</p>
          </section>
        </aside>
      </main>
    </div>
  )
}
