import { useMemo, useRef, useState } from 'react'
import { buildSvg, generatePattern } from './engine/pattern'
import { parseSvgAsset } from './engine/svg'
import type { PatternInstance, PatternSettings, RepeatMode, SvgAsset } from './types'

const initialSettings: PatternSettings = {
  tileWidth: 512,
  tileHeight: 512,
  background: '#f4efe4',
  motifSize: 112,
  gapX: 28,
  gapY: 28,
  rotation: 0,
  randomRotation: 35,
  density: 55,
  seed: 1287,
  showBoundary: true,
}

const modes: { id: RepeatMode; label: string; group: string }[] = [
  { id: 'grid', label: 'Grid', group: 'Classic' },
  { id: 'half-drop', label: 'Half Drop', group: 'Classic' },
  { id: 'brick', label: 'Brick', group: 'Classic' },
  { id: 'toss', label: 'Tossed', group: 'Classic' },
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

function Instance({ item, asset }: { item: PatternInstance; asset: SvgAsset }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg
        width={item.width}
        height={item.height}
        viewBox={asset.viewBox}
        preserveAspectRatio="xMidYMid meet"
        dangerouslySetInnerHTML={{ __html: asset.innerSvg }}
      />
    </g>
  )
}

function PatternPreview({ assets, instances, settings }: { assets: SvgAsset[]; instances: PatternInstance[]; settings: PatternSettings }) {
  const w = settings.tileWidth
  const h = settings.tileHeight
  return (
    <svg className="proof" viewBox={`${-w} ${-h} ${w * 3} ${h * 3}`} aria-label="Seamless pattern preview">
      <defs>
        <pattern id="patternforge-live" width={w} height={h} patternUnits="userSpaceOnUse">
          <rect width={w} height={h} fill={settings.background} />
          {instances.map((item) => {
            const asset = assets[item.assetIndex]
            return asset ? <Instance key={item.key} item={item} asset={asset} /> : null
          })}
        </pattern>
      </defs>
      <rect x={-w} y={-h} width={w * 3} height={h * 3} fill="url(#patternforge-live)" />
      {settings.showBoundary && <rect x={0} y={0} width={w} height={h} className="tile-boundary" />}
    </svg>
  )
}

function NumberControl({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <label className="control">
      <span>{label}<b>{value}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export default function App() {
  const [assets, setAssets] = useState<SvgAsset[]>([])
  const [mode, setMode] = useState<RepeatMode>('half-drop')
  const [settings, setSettings] = useState<PatternSettings>(initialSettings)
  const [message, setMessage] = useState('Upload one or more SVG motifs to begin.')
  const inputRef = useRef<HTMLInputElement>(null)

  const instances = useMemo(() => generatePattern(mode, assets, settings), [mode, assets, settings])

  const patch = <K extends keyof PatternSettings>(key: K, value: PatternSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.svg'))
    if (!incoming.length) {
      setMessage('PatternForge v0.1 currently accepts SVG vector files.')
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand"><span>PF</span> PatternForge</div>
          <p>Seamless vector pattern studio · Batik Lab</p>
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
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
            >
              <strong>Drop SVG motifs</strong>
              <span>or click to browse</span>
              <input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} />
            </div>
            <p className="privacy">Local processing · files are not uploaded by this app.</p>
            <div className="asset-list">
              {assets.map((asset, index) => (
                <div className="asset-card" key={asset.id}>
                  <div className="asset-thumb">
                    <svg viewBox={asset.viewBox} dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
                  </div>
                  <div><b>{asset.name}</b><span>Motif {index + 1}</span></div>
                  <button className="icon-button" onClick={() => setAssets((items) => items.filter((x) => x.id !== asset.id))}>×</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Pattern Style</h2>
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
            <div><b>Live Seamless Proof</b><span>3 × 3 repeat · center box is the master tile</span></div>
            <label className="check"><input type="checkbox" checked={settings.showBoundary} onChange={(e) => patch('showBoundary', e.target.checked)} /> Show tile boundary</label>
          </div>
          <div className="stage">
            {assets.length ? <PatternPreview assets={assets} instances={instances} settings={settings} /> : (
              <div className="empty-stage"><div className="empty-mark">✦</div><h1>Start with an SVG motif</h1><p>Upload vector artwork, choose a repeat system, then export a seamless master tile.</p></div>
            )}
          </div>
          <div className="statusbar"><span>{message}</span><span>{assets.length} assets · {instances.length} rendered instances · seed {settings.seed}</span></div>
        </section>

        <aside className="sidebar right-panel">
          <section>
            <h2>Master Tile</h2>
            <div className="two-col">
              <label><span>Width</span><input type="number" min="128" max="2048" value={settings.tileWidth} onChange={(e) => patch('tileWidth', Number(e.target.value))} /></label>
              <label><span>Height</span><input type="number" min="128" max="2048" value={settings.tileHeight} onChange={(e) => patch('tileHeight', Number(e.target.value))} /></label>
            </div>
            <label className="color-row"><span>Background</span><input type="color" value={settings.background} onChange={(e) => patch('background', e.target.value)} /><code>{settings.background}</code></label>
          </section>

          <section>
            <h2>Motif Controls</h2>
            <NumberControl label="Motif size" value={settings.motifSize} min={24} max={280} onChange={(v) => patch('motifSize', v)} />
            <NumberControl label="Horizontal gap" value={settings.gapX} min={-60} max={180} onChange={(v) => patch('gapX', v)} />
            <NumberControl label="Vertical gap" value={settings.gapY} min={-60} max={180} onChange={(v) => patch('gapY', v)} />
            <NumberControl label="Rotation" value={settings.rotation} min={-180} max={180} onChange={(v) => patch('rotation', v)} />
            {mode === 'toss' && <>
              <NumberControl label="Random rotation" value={settings.randomRotation} min={0} max={180} onChange={(v) => patch('randomRotation', v)} />
              <NumberControl label="Density" value={settings.density} min={5} max={100} onChange={(v) => patch('density', v)} />
            </>}
          </section>

          <section className="batik-note">
            <h2>Batik Lab v0.1</h2>
            <p><b>Ceplok</b> builds an alternating geometric repeat. <b>Kawung-inspired</b> arranges the uploaded motif radially in four directions.</p>
            <p>Next targets: Lereng, Nitik, Isen-Isen filler, Tumpal borders, motif roles, palette mapping, and collision-aware placement.</p>
          </section>
        </aside>
      </main>
    </div>
  )
}
