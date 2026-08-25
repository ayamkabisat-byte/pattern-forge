import { useMemo, useState } from 'react'

type Props = {
  onOpenSeamless: () => void
  onOpenGuides: () => void
}

type Slot = 0 | 1 | 2 | 3

type Stripe = {
  slot: Slot
  width: number
  opacity?: number
}

type PlaidTemplate = {
  id: string
  name: string
  hint: string
  palette: [string, string, string, string]
  stripes: Stripe[]
  symmetric: boolean
}

const TEMPLATES: PlaidTemplate[] = [
  {
    id: 'classic-tartan', name: 'Classic Tartan', hint: 'Balanced sett with accent lines',
    palette: ['#173D31', '#7A1F24', '#D5B76D', '#111111'], symmetric: true,
    stripes: [{ slot: 0, width: 80 }, { slot: 1, width: 34 }, { slot: 3, width: 8 }, { slot: 2, width: 16 }],
  },
  {
    id: 'buffalo', name: 'Buffalo Check', hint: 'Large bold two-color check',
    palette: ['#C62828', '#111111', '#F3E7D3', '#FFFFFF'], symmetric: false,
    stripes: [{ slot: 0, width: 90 }, { slot: 1, width: 90 }],
  },
  {
    id: 'gingham', name: 'Gingham', hint: 'Light simple repeat for digital paper',
    palette: ['#D8E9F3', '#557A95', '#FFFFFF', '#243B53'], symmetric: false,
    stripes: [{ slot: 0, width: 54 }, { slot: 2, width: 54 }],
  },
  {
    id: 'windowpane', name: 'Windowpane', hint: 'Wide field with thin crossing lines',
    palette: ['#E8E2D5', '#243B53', '#B23A48', '#111111'], symmetric: false,
    stripes: [{ slot: 0, width: 150 }, { slot: 1, width: 8 }, { slot: 0, width: 34 }, { slot: 2, width: 5 }],
  },
  {
    id: 'holiday', name: 'Holiday Plaid', hint: 'Christmas / winter-friendly structure',
    palette: ['#0E5C3B', '#A51D2D', '#F1E7CF', '#162017'], symmetric: true,
    stripes: [{ slot: 0, width: 72 }, { slot: 1, width: 26 }, { slot: 2, width: 9 }, { slot: 3, width: 6 }],
  },
  {
    id: 'rustic', name: 'Rustic Plaid', hint: 'Warm farmhouse / autumn palette',
    palette: ['#6B4A2E', '#B65A32', '#D7B377', '#2B2118'], symmetric: true,
    stripes: [{ slot: 0, width: 86 }, { slot: 2, width: 22 }, { slot: 3, width: 7 }, { slot: 1, width: 30 }],
  },
  {
    id: 'pastel', name: 'Pastel Plaid', hint: 'Soft scrapbook / nursery palette',
    palette: ['#F7D8E5', '#C9E7F2', '#FFF4D7', '#BFD8C2'], symmetric: true,
    stripes: [{ slot: 0, width: 64 }, { slot: 1, width: 24 }, { slot: 2, width: 12 }, { slot: 3, width: 18 }],
  },
  {
    id: 'school', name: 'School Plaid', hint: 'Uniform-inspired structured sett',
    palette: ['#1E3557', '#7C2634', '#D9C8A9', '#10151D'], symmetric: true,
    stripes: [{ slot: 0, width: 78 }, { slot: 1, width: 28 }, { slot: 3, width: 7 }, { slot: 2, width: 12 }],
  },
  {
    id: 'madras', name: 'Madras Inspired', hint: 'Bright asymmetric multi-color rhythm',
    palette: ['#F08A24', '#2F80ED', '#E84A5F', '#F2D95C'], symmetric: false,
    stripes: [{ slot: 0, width: 46 }, { slot: 1, width: 18 }, { slot: 3, width: 34 }, { slot: 2, width: 12 }, { slot: 1, width: 8 }],
  },
]

const QUICK_PALETTES: Array<{ name: string; colors: [string, string, string, string] }> = [
  { name: 'Christmas', colors: ['#0D5A36', '#A61F2D', '#F2E7CE', '#142016'] },
  { name: 'Halloween', colors: ['#F57C00', '#151515', '#6A1B9A', '#F3E7D3'] },
  { name: 'Autumn', colors: ['#8A4B2A', '#D38B32', '#5C3D2E', '#E9D7B8'] },
  { name: 'Winter', colors: ['#153A5B', '#DDECF4', '#9D2436', '#FFFFFF'] },
  { name: 'Pastel', colors: ['#F4C7D9', '#BFDFF1', '#FFF0C8', '#BFD8C2'] },
  { name: 'Monochrome', colors: ['#111111', '#555555', '#BEBEBE', '#F2F2F2'] },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function expandSett(stripes: Stripe[], symmetric: boolean) {
  if (!symmetric || stripes.length < 2) return stripes
  const tail = stripes.slice(0, -1).reverse().map((stripe) => ({ ...stripe }))
  return [...stripes, ...tail]
}

function normalizeHex(value: string) {
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const raw = v.slice(1)
    return `#${raw.split('').map((c) => c + c).join('').toUpperCase()}`
  }
  return null
}

function shade(hex: string, factor: number) {
  const clean = hex.replace('#', '')
  const value = Number.parseInt(clean, 16)
  if (!Number.isFinite(value)) return hex
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  const next = [r, g, b].map((channel) => clamp(Math.round(channel * factor), 0, 255).toString(16).padStart(2, '0')).join('')
  return `#${next}`
}

export default function PlaidTartanMaker({ onOpenSeamless, onOpenGuides }: Props) {
  const [templateId, setTemplateId] = useState('classic-tartan')
  const template = TEMPLATES.find((entry) => entry.id === templateId) ?? TEMPLATES[0]
  const [palette, setPalette] = useState<[string, string, string, string]>([...template.palette])
  const [stripes, setStripes] = useState<Stripe[]>(template.stripes.map((stripe) => ({ ...stripe })))
  const [symmetric, setSymmetric] = useState(template.symmetric)
  const [quickHex, setQuickHex] = useState(template.palette.join(', '))
  const [scale, setScale] = useState(1)
  const [crossOpacity, setCrossOpacity] = useState(0.72)
  const [darkenCross, setDarkenCross] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [view, setView] = useState<'tile' | 'proof'>('tile')
  const [message, setMessage] = useState('Pick a plaid template, paste HEX colors, then export the seamless SVG tile.')

  const sett = useMemo(() => expandSett(stripes, symmetric), [stripes, symmetric])
  const unit = useMemo(() => Math.max(20, sett.reduce((sum, stripe) => sum + Math.max(1, stripe.width * scale), 0)), [sett, scale])

  function applyTemplate(id: string) {
    const next = TEMPLATES.find((entry) => entry.id === id)
    if (!next) return
    setTemplateId(id)
    setPalette([...next.palette])
    setStripes(next.stripes.map((stripe) => ({ ...stripe })))
    setSymmetric(next.symmetric)
    setQuickHex(next.palette.join(', '))
    setMessage(`${next.name} loaded. Change only the HEX palette for a fast variation, or edit stripe widths for a new sett.`)
  }

  function updatePalette(index: number, value: string) {
    setPalette((current) => {
      const next = [...current] as [string, string, string, string]
      next[index] = value
      return next
    })
  }

  function applyHexInput() {
    const matches = quickHex.match(/#?[0-9a-f]{3,6}/gi) ?? []
    const colors = matches.map(normalizeHex).filter((entry): entry is string => Boolean(entry)).slice(0, 4)
    if (colors.length < 2) {
      setMessage('Paste at least two valid HEX colors, for example #173D31, #7A1F24, #D5B76D, #111111.')
      return
    }
    setPalette((current) => {
      const next = [...current] as [string, string, string, string]
      colors.forEach((color, index) => { next[index] = color })
      return next
    })
    setMessage(`${colors.length} HEX colors applied to the current template.`)
  }

  function updateStripe(index: number, patch: Partial<Stripe>) {
    setStripes((current) => current.map((stripe, stripeIndex) => stripeIndex === index ? { ...stripe, ...patch } : stripe))
  }

  function addStripe() {
    setStripes((current) => [...current, { slot: (current.length % 4) as Slot, width: 12 }])
  }

  function removeStripe(index: number) {
    if (stripes.length <= 2) return
    setStripes((current) => current.filter((_, stripeIndex) => stripeIndex !== index))
  }

  function stripeRects(axis: 'x' | 'y') {
    let cursor = 0
    return sett.map((stripe, index) => {
      const width = Math.max(1, stripe.width * scale)
      const position = cursor
      cursor += width
      const base = palette[stripe.slot]
      const fill = axis === 'y' && darkenCross ? shade(base, 0.86) : base
      const opacity = clamp((stripe.opacity ?? 1) * (axis === 'y' ? crossOpacity : 0.88), 0.08, 1)
      return { index, position, width, fill, opacity }
    })
  }

  const vertical = stripeRects('x')
  const horizontal = stripeRects('y')

  function buildSvg() {
    const v = vertical.map((stripe) => `<rect x="${stripe.position}" y="0" width="${stripe.width}" height="${unit}" fill="${stripe.fill}" fill-opacity="${stripe.opacity}"/>`).join('')
    const h = horizontal.map((stripe) => `<rect x="0" y="${stripe.position}" width="${unit}" height="${stripe.width}" fill="${stripe.fill}" fill-opacity="${stripe.opacity}"/>`).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${unit}" height="${unit}" viewBox="0 0 ${unit} ${unit}"><rect width="${unit}" height="${unit}" fill="${palette[0]}"/>${v}${h}</svg>`
  }

  function exportTile() {
    downloadText(buildSvg(), `patternforge-${templateId}-seamless.svg`)
    setMessage('Plaid seamless SVG exported. The tile dimensions equal one complete sett repeat.')
  }

  function exportProof() {
    const tile = buildSvg().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    const groups = Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => `<g transform="translate(${col * unit} ${row * unit})">${tile}</g>`)).join('')
    downloadText(`<svg xmlns="http://www.w3.org/2000/svg" width="${unit * 3}" height="${unit * 3}" viewBox="0 0 ${unit * 3} ${unit * 3}">${groups}</svg>`, `patternforge-${templateId}-3x3-proof.svg`)
  }

  return (
    <div className="v10-builder-shell v10-plaid-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>Plaid Templates</h2>
          <div className="v10-layout-list">
            {TEMPLATES.map((entry) => <button key={entry.id} className={templateId === entry.id ? 'active' : ''} onClick={() => applyTemplate(entry.id)}><b>{entry.name}</b><span>{entry.hint}</span></button>)}
          </div>
        </section>

        <section>
          <h2>Quick Palettes</h2>
          <div className="v10-palette-presets">
            {QUICK_PALETTES.map((entry) => <button key={entry.name} onClick={() => { setPalette([...entry.colors]); setQuickHex(entry.colors.join(', ')); setMessage(`${entry.name} palette applied.`) }}><span>{entry.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><b>{entry.name}</b></button>)}
          </div>
        </section>

        <section className="v10-cultural-note">
          <h2>Fast production workflow</h2>
          <p>Keep one structure, change the HEX palette, export a new seamless SVG. Then change stripe widths or pick another template for a genuinely different plaid family.</p>
          <button onClick={onOpenGuides}>Open Layout Guides</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{template.name}</b><span>{Math.round(unit)} × {Math.round(unit)} SVG tile · {sett.length} stripe steps</span></div>
          <div className="v10-view-buttons"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Live Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>3×3 Proof</button></div>
        </div>

        <div className="v10-preview-zone v10-plaid-preview">
          {view === 'tile' ? (
            <svg className="v10-live-svg" viewBox={`0 0 ${unit} ${unit}`}>
              <rect width={unit} height={unit} fill={palette[0]} />
              {vertical.map((stripe) => <rect key={`v-${stripe.index}`} x={stripe.position} y="0" width={stripe.width} height={unit} fill={stripe.fill} opacity={stripe.opacity} />)}
              {horizontal.map((stripe) => <rect key={`h-${stripe.index}`} x="0" y={stripe.position} width={unit} height={stripe.width} fill={stripe.fill} opacity={stripe.opacity} />)}
              {showGrid ? <rect width={unit} height={unit} className="v10-tile-outline" /> : null}
            </svg>
          ) : (
            <svg className="v10-proof-svg" viewBox={`0 0 ${unit * 3} ${unit * 3}`}>
              {Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => (
                <g key={`${row}-${col}`} transform={`translate(${col * unit} ${row * unit})`}>
                  <rect width={unit} height={unit} fill={palette[0]} />
                  {vertical.map((stripe) => <rect key={`v-${stripe.index}`} x={stripe.position} y="0" width={stripe.width} height={unit} fill={stripe.fill} opacity={stripe.opacity} />)}
                  {horizontal.map((stripe) => <rect key={`h-${stripe.index}`} x="0" y={stripe.position} width={unit} height={stripe.width} fill={stripe.fill} opacity={stripe.opacity} />)}
                  {showGrid ? <rect width={unit} height={unit} className="v10-tile-outline" /> : null}
                </g>
              )))}
            </svg>
          )}
        </div>
        <div className="v10-stage-status"><span>{message}</span><b>PLAID / TARTAN SEAMLESS</b></div>
      </main>

      <aside className="v10-panel v10-panel-right">
        <section>
          <h2>HEX Palette</h2>
          <textarea className="v10-hex-input" rows={3} value={quickHex} onChange={(event) => setQuickHex(event.target.value)} placeholder="#173D31, #7A1F24, #D5B76D, #111111" />
          <button className="v10-primary-action" onClick={applyHexInput}>Apply HEX Palette</button>
          <div className="v10-color-slots">
            {palette.map((color, index) => <label key={index}><span>{String.fromCharCode(65 + index)}</span><input type="color" value={color} onChange={(event) => updatePalette(index, event.target.value)} /><code>{color.toUpperCase()}</code></label>)}
          </div>
        </section>

        <section>
          <h2>Sett Controls</h2>
          <label className="v10-check"><input type="checkbox" checked={symmetric} onChange={(event) => setSymmetric(event.target.checked)} /> Symmetric sett</label>
          <label><span>Stripe scale</span><input type="range" min="0.35" max="3" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} /><output>{scale.toFixed(2)}×</output></label>
          <label><span>Cross opacity</span><input type="range" min="0.15" max="1" step="0.05" value={crossOpacity} onChange={(event) => setCrossOpacity(Number(event.target.value))} /><output>{Math.round(crossOpacity * 100)}%</output></label>
          <label className="v10-check"><input type="checkbox" checked={darkenCross} onChange={(event) => setDarkenCross(event.target.checked)} /> Darken horizontal crossing bands</label>
          <label className="v10-check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> Show tile boundary</label>
        </section>

        <section>
          <div className="v10-section-title"><h2>Stripe Editor</h2><button onClick={addStripe}>+ Stripe</button></div>
          <div className="v10-stripe-editor">
            {stripes.map((stripe, index) => (
              <div key={index} className="v10-stripe-row">
                <select value={stripe.slot} onChange={(event) => updateStripe(index, { slot: Number(event.target.value) as Slot })}>
                  {[0, 1, 2, 3].map((slot) => <option key={slot} value={slot}>{String.fromCharCode(65 + slot)}</option>)}
                </select>
                <input type="number" min="1" max="300" value={stripe.width} onChange={(event) => updateStripe(index, { width: clamp(Number(event.target.value), 1, 300) })} />
                <span>px</span>
                <button disabled={stripes.length <= 2} onClick={() => removeStripe(index)}>×</button>
              </div>
            ))}
          </div>
          <small>Symmetric sett mirrors the sequence automatically. Disable it for asymmetric Madras-like or modern plaid layouts.</small>
        </section>

        <section>
          <h2>Export</h2>
          <button className="v10-primary-action" onClick={exportTile}>Export Plaid Seamless SVG</button>
          <button className="v10-wide-button" onClick={exportProof}>Export 3×3 Proof SVG</button>
          <small>The exported SVG contains one complete vector sett repeat. No external images or fonts are required.</small>
        </section>

        <section>
          <h2>Other workspace</h2>
          <button className="v10-wide-button" onClick={onOpenSeamless}>Open Seamless Builder</button>
        </section>
      </aside>
    </div>
  )
}
