import { useEffect, useMemo, useState } from 'react'
import { camouflageLogicalSize, camouflageProofSvg, camouflageSvg, randomSeed } from '../engine/camouflage/generator'
import { CAMO_PRESETS, DEFAULT_DIGITAL, DEFAULT_ORGANIC, initialCamoData, normalizeCamoData } from '../engine/camouflage/presets'
import type { CamoEngine, CamoMode, CamoPatternData, DigitalResolution, OrganicDirection, OrganicFieldResolution, OrganicSvgDetail } from '../engine/camouflage/types'
import { consumePendingPattern, exportPatternAssetJson, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void; onOpenRepeat: () => void; onOpenPixel: () => void }
const EXPORT_PRESETS = [1024, 2048, 4096, 6000, 8000]
const REPEAT_PRESETS = [1, 2, 3, 6, 12]

const ENGINE_META: Array<{ id: CamoEngine; label: string; mode: CamoMode; note: string }> = [
  { id: 'digital-region', label: 'Digital Region', mode: 'digital', note: 'Connected orthogonal fields, not random rectangles.' },
  { id: 'interlocking', label: 'Interlocking', mode: 'organic', note: 'Large color regions with branches, coves and islands.' },
  { id: 'pebble', label: 'Pebble / Spot', mode: 'organic', note: 'Macro organic field plus nested micro-spots.' },
  { id: 'hybrid', label: 'Hybrid Breakup', mode: 'organic', note: 'Smooth macro regions with restrained digital breakup.' },
]

function cloneData(data: CamoPatternData): CamoPatternData {
  return JSON.parse(JSON.stringify(data)) as CamoPatternData
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'camouflage-pattern'
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function normalizeHex(value: string) {
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v.slice(1).split('').map((c) => c + c).join('').toUpperCase()}`
  return null
}

function Range({ label, value, min = 0, max = 1, step = .01, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="v12-range"><span>{label}<b>{step < 1 ? value.toFixed(2) : Math.round(value)}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))}/></label>
}

function currentAsset(name: string, data: CamoPatternData, svg: string): PatternAsset {
  const stamp = new Date().toISOString()
  return {
    id: 'camouflage-preview',
    name: name.trim() || 'Camouflage Pattern',
    sourceType: 'camouflage',
    createdAt: stamp,
    updatedAt: stamp,
    svg,
    palette: [...data.palette],
    camo: cloneData(data),
    tags: ['camouflage', data.mode, data.engine, 'procedural', 'region-first', 'seamless'],
    meta: { camoMode: data.mode, camoEngine: data.engine, seed: data.seed, exportLongSide: data.exportLongSide, exactBounds: true, seamless: true, presetId: data.presetId, generatorVersion: data.generatorVersion },
  }
}

export default function CamouflageWorkspace({ onOpenLibrary, onOpenRepeat, onOpenPixel }: Props) {
  const [data, setData] = useState<CamoPatternData>(() => initialCamoData())
  const [name, setName] = useState('Forest Digital 01')
  const [view, setView] = useState<'tile' | 'proof'>('proof')
  const [proofCopies, setProofCopies] = useState(3)
  const [showBoundary, setShowBoundary] = useState(false)
  const [hexText, setHexText] = useState(() => initialCamoData().palette.join(', '))
  const [lockPalette, setLockPalette] = useState(true)
  const [message, setMessage] = useState('v1.3 region engine: color fields interlock across the tile before vector export. No SVG input is required.')

  useEffect(() => {
    const pending = consumePendingPattern('camouflage')
    if (!pending?.camo) return
    const restored = normalizeCamoData(pending.camo)
    setData(restored)
    setName(pending.name)
    setHexText(restored.palette.join(', '))
    setMessage(`${pending.name} reopened and normalized to the v1.3 region engine.`)
  }, [])

  const tileSvg = useMemo(() => camouflageSvg(data), [data])
  const proofSvg = useMemo(() => camouflageProofSvg(data, proofCopies), [data, proofCopies])
  const previewSvg = view === 'tile' ? tileSvg : proofSvg
  const logical = camouflageLogicalSize(data)
  const presets = CAMO_PRESETS.filter((preset) => preset.engine === data.engine)
  const activeEngine = ENGINE_META.find((item) => item.id === data.engine) ?? ENGINE_META[0]

  function applyPreset(id: string) {
    const preset = CAMO_PRESETS.find((item) => item.id === id)
    if (!preset) return
    setData((current) => {
      const palette = [...preset.palette]
      const weights = palette.map((_, index) => [34,26,19,13,8,6,4,3][index] ?? 3)
      const digital = { ...DEFAULT_DIGITAL, colorWeights: [...weights], ...(preset.digital ?? {}) }
      const organic = { ...DEFAULT_ORGANIC, colorWeights: [...weights], ...(preset.organic ?? {}) }
      return {
        ...current,
        mode: preset.mode,
        engine: preset.engine,
        generatorVersion: 2,
        presetId: preset.id,
        palette,
        backgroundColor: 0,
        tileWidth: preset.mode === 'digital' ? digital.resolution : organic.tileSize,
        tileHeight: preset.mode === 'digital' ? digital.resolution : organic.tileSize,
        digital,
        organic,
      }
    })
    setName(`${preset.name} 01`)
    setHexText(preset.palette.join(', '))
    setMessage(`${preset.name}: region topology preset loaded. Seed and all structural controls remain editable.`)
  }

  function switchEngine(engine: CamoEngine) {
    const preset = CAMO_PRESETS.find((item) => item.engine === engine)
    if (preset) applyPreset(preset.id)
  }

  function switchMode(mode: CamoMode) {
    switchEngine(mode === 'digital' ? 'digital-region' : 'interlocking')
  }

  function patchDigital<K extends keyof CamoPatternData['digital']>(key: K, value: CamoPatternData['digital'][K]) {
    setData((current) => {
      const digital = { ...current.digital, [key]: value }
      return { ...current, digital, tileWidth: key === 'resolution' ? Number(value) : current.tileWidth, tileHeight: key === 'resolution' ? Number(value) : current.tileHeight }
    })
  }

  function patchOrganic<K extends keyof CamoPatternData['organic']>(key: K, value: CamoPatternData['organic'][K]) {
    setData((current) => {
      const organic = { ...current.organic, [key]: value }
      return { ...current, organic, tileWidth: key === 'tileSize' ? Number(value) : current.tileWidth, tileHeight: key === 'tileSize' ? Number(value) : current.tileHeight }
    })
  }

  function applyHexPalette() {
    const colors = (hexText.match(/#?[0-9a-f]{3,6}/gi) ?? []).map(normalizeHex).filter((value): value is string => Boolean(value)).slice(0, 8)
    if (colors.length < 2) { setMessage('Paste at least 2 valid HEX colors.'); return }
    setData((current) => {
      const extend = (weights: number[]) => colors.map((_, index) => weights[index] ?? 10)
      return { ...current, palette: colors, backgroundColor: Math.min(current.backgroundColor, colors.length - 1), digital: { ...current.digital, colorWeights: extend(current.digital.colorWeights) }, organic: { ...current.organic, colorWeights: extend(current.organic.colorWeights) } }
    })
    setMessage(`${colors.length} colors loaded. Color Weight now controls approximate region coverage.`)
  }

  function updateColor(index: number, color: string) {
    setData((current) => ({ ...current, palette: current.palette.map((value, i) => i === index ? color.toUpperCase() : value) }))
  }

  function addColor() {
    setData((current) => {
      if (current.palette.length >= 8) return current
      return { ...current, palette: [...current.palette, '#FFFFFF'], digital: { ...current.digital, colorWeights: [...current.digital.colorWeights, 8] }, organic: { ...current.organic, colorWeights: [...current.organic.colorWeights, 8] } }
    })
  }

  function removeColor(index: number) {
    setData((current) => {
      if (current.palette.length <= 2) return current
      const palette = current.palette.filter((_, i) => i !== index)
      const filterWeight = (weights: number[]) => weights.filter((_, i) => i !== index)
      return { ...current, palette, backgroundColor: Math.min(current.backgroundColor, palette.length - 1), digital: { ...current.digital, colorWeights: filterWeight(current.digital.colorWeights) }, organic: { ...current.organic, colorWeights: filterWeight(current.organic.colorWeights) } }
    })
  }

  function rotatePalette() {
    if (lockPalette) { setMessage('Palette is locked. Turn off Lock Palette to rotate assignments.'); return }
    setData((current) => {
      if (current.palette.length < 2) return current
      const rotate = <T,>(items: T[]) => [...items.slice(1), items[0]]
      return { ...current, palette: rotate(current.palette), backgroundColor: modIndex(current.backgroundColor - 1, current.palette.length), digital: { ...current.digital, colorWeights: rotate(current.digital.colorWeights) }, organic: { ...current.organic, colorWeights: rotate(current.organic.colorWeights) } }
    })
  }

  function reversePalette() {
    if (lockPalette) { setMessage('Palette is locked. Turn off Lock Palette to reverse it.'); return }
    setData((current) => ({ ...current, palette: [...current.palette].reverse(), backgroundColor: current.palette.length - 1 - current.backgroundColor, digital: { ...current.digital, colorWeights: [...current.digital.colorWeights].reverse() }, organic: { ...current.organic, colorWeights: [...current.organic.colorWeights].reverse() } }))
  }

  function setWeight(index: number, value: number) {
    setData((current) => {
      const key = current.mode === 'digital' ? 'digital' : 'organic'
      const weights = [...current[key].colorWeights]
      weights[index] = value
      return key === 'digital' ? { ...current, digital: { ...current.digital, colorWeights: weights } } : { ...current, organic: { ...current.organic, colorWeights: weights } }
    })
  }

  function newSeed() {
    setData((current) => ({ ...current, seed: randomSeed() }))
    setMessage('New region seed generated. Palette and topology settings were preserved.')
  }

  function variation() {
    setData((current) => ({ ...current, seed: current.seed >= 2147483646 ? 1 : current.seed + 1 }))
    setMessage('One-step structural variation generated from the same setup.')
  }

  function saveAsset() {
    const asset = currentAsset(name, data, tileSvg)
    savePatternAsset({ name: asset.name, sourceType: 'camouflage', svg: asset.svg, palette: asset.palette, camo: asset.camo, tags: asset.tags, meta: asset.meta })
    setMessage(`${asset.name} saved to My Patterns with editable v1.3 region settings.`)
  }

  function exportSvg() {
    downloadText(tileSvg, `${slug(name)}-${data.engine}-${data.exportLongSide}x${data.exportLongSide}-seamless.svg`, 'image/svg+xml;charset=utf-8')
    setMessage(`Seamless ${activeEngine.label} SVG exported at ${data.exportLongSide}×${data.exportLongSide}.`)
  }

  function exportJson() {
    const asset = currentAsset(name, data, tileSvg)
    downloadText(exportPatternAssetJson(asset), `${slug(name)}.pattern.json`, 'application/json;charset=utf-8')
  }

  function exportPng() {
    const blob = new Blob([tileSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const size = Math.max(64, Math.min(8000, Math.round(data.exportLongSide)))
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return }
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(image, 0, 0, size, size)
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url)
        if (!png) { setMessage('Browser could not create the PNG. Try a smaller export size.'); return }
        const pngUrl = URL.createObjectURL(png)
        const anchor = document.createElement('a')
        anchor.href = pngUrl
        anchor.download = `${slug(name)}-${data.engine}-${size}x${size}-seamless.png`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1200)
        setMessage(`PNG exported at ${size}×${size}.`)
      }, 'image/png')
    }
    image.onerror = () => { URL.revokeObjectURL(url); setMessage('Could not rasterize SVG in this browser.') }
    image.src = url
  }

  const activeWeights = data.mode === 'digital' ? data.digital.colorWeights : data.organic.colorWeights

  return <div className="v10-builder-shell v12-camo-shell">
    <aside className="v10-panel v10-panel-left">
      <section className="v12-mode-section">
        <h2>Camouflage Family</h2>
        <div className="v12-mode-tabs"><button className={data.mode === 'digital' ? 'active' : ''} onClick={() => switchMode('digital')}>Digital</button><button className={data.mode === 'organic' ? 'active' : ''} onClick={() => switchMode('organic')}>Traditional / Organic</button></div>
        <small>All v1.3 engines are periodic from the math stage, so left/right and top/bottom are generated as one continuous field.</small>
      </section>

      <section>
        <h2>Shape Engine</h2>
        <div className="v12-preset-grid">{ENGINE_META.map((engine) => <button key={engine.id} className={data.engine === engine.id ? 'active' : ''} onClick={() => switchEngine(engine.id)}><b>{engine.label}</b><span>{engine.note}</span></button>)}</div>
      </section>

      <section><h2>{activeEngine.label} Presets</h2><div className="v12-preset-grid">{presets.map((preset) => <button key={preset.id} className={data.presetId === preset.id ? 'active' : ''} onClick={() => applyPreset(preset.id)}><b>{preset.name}</b><span>{preset.note}</span></button>)}</div></section>

      <section className="v12-seed-section"><h2>Seed / Variations</h2><label><span>Seed</span><input type="number" min="1" max="2147483646" value={data.seed} onChange={(event) => setData((current) => ({ ...current, seed: Math.max(1, Number(event.target.value) || 1) }))}/></label><div className="v12-seed-actions"><button onClick={newSeed}>New Seed</button><button onClick={variation}>+1 Variation</button></div><label className="v10-check"><input type="checkbox" checked={lockPalette} onChange={(event) => setLockPalette(event.target.checked)}/> Lock palette while exploring structure</label></section>

      {data.mode === 'digital' ? <section>
        <h2>Digital Region Topology</h2>
        <label><span>Grid resolution</span><select value={data.digital.resolution} onChange={(event) => patchDigital('resolution', Number(event.target.value) as DigitalResolution)}><option value="32">32×32</option><option value="64">64×64</option><option value="128">128×128</option><option value="256">256×256</option></select></label>
        <Range label="Block Scale" value={data.digital.blockScale} onChange={(v) => patchDigital('blockScale', v)}/>
        <Range label="Macro Region" value={data.digital.macroRegion} onChange={(v) => patchDigital('macroRegion', v)}/>
        <Range label="Medium Breakup" value={data.digital.mediumBreakup} onChange={(v) => patchDigital('mediumBreakup', v)}/>
        <Range label="Stair Step" value={data.digital.stairStep} onChange={(v) => patchDigital('stairStep', v)}/>
        <Range label="Fragmentation" value={data.digital.fragmentation} onChange={(v) => patchDigital('fragmentation', v)}/>
        <Range label="Small Islands" value={data.digital.islandAmount} onChange={(v) => patchDigital('islandAmount', v)}/>
        <Range label="Orthogonal Cleanup" value={data.digital.orthogonalCleanup} onChange={(v) => patchDigital('orthogonalCleanup', v)}/>
        <small>Colors are assigned to connected periodic regions first; the grid only pixelates those regions afterward.</small>
      </section> : <section>
        <h2>Organic Region Topology</h2>
        <label><span>Master tile</span><select value={data.organic.tileSize} onChange={(event) => patchOrganic('tileSize', Number(event.target.value) as 256 | 512 | 1024)}><option value="256">256 logical</option><option value="512">512 logical</option><option value="1024">1024 logical</option></select></label>
        <label><span>Field resolution</span><select value={data.organic.fieldResolution} onChange={(event) => patchOrganic('fieldResolution', Number(event.target.value) as OrganicFieldResolution)}><option value="48">48 · Clean</option><option value="64">64 · Light</option><option value="96">96 · Balanced</option><option value="128">128 · Detailed</option></select></label>
        <Range label="Macro Region" value={data.organic.macroScale} onChange={(v) => patchOrganic('macroScale', v)}/>
        <Range label="Medium Breakup" value={data.organic.mediumBreakup} onChange={(v) => patchOrganic('mediumBreakup', v)}/>
        <Range label="Edge Complexity" value={data.organic.edgeComplexity} onChange={(v) => patchOrganic('edgeComplexity', v)}/>
        <Range label="Branching / Necks" value={data.organic.branching} onChange={(v) => patchOrganic('branching', v)}/>
        <Range label="Small Islands" value={data.organic.islandAmount} onChange={(v) => patchOrganic('islandAmount', v)}/>
        <Range label="Contour Smoothness" value={data.organic.contourSmoothness} onChange={(v) => patchOrganic('contourSmoothness', v)}/>
        <label><span>Direction bias</span><select value={data.organic.direction} onChange={(event) => patchOrganic('direction', event.target.value as OrganicDirection)}><option value="none">None</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="diagonal">Diagonal</option></select></label>
        <label><span>SVG detail</span><select value={data.organic.detail} onChange={(event) => patchOrganic('detail', event.target.value as OrganicSvgDetail)}><option value="clean">Clean</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label>
        <Range label="Simplification" value={data.organic.simplification} onChange={(v) => patchOrganic('simplification', v)}/>
        {data.engine === 'pebble' ? <><Range label="Spot Amount" value={data.organic.spotAmount} onChange={(v) => patchOrganic('spotAmount', v)}/><Range label="Spot Scale" value={data.organic.spotScale} onChange={(v) => patchOrganic('spotScale', v)}/><Range label="Inner Spot Scale" value={data.organic.spotInnerScale} onChange={(v) => patchOrganic('spotInnerScale', v)}/></> : null}
        {data.engine === 'hybrid' ? <Range label="Digital Breakup" value={data.organic.hybridBlockAmount} onChange={(v) => patchOrganic('hybridBlockAmount', v)}/> : null}
        <small>Unlike the old blob engine, these colors divide one continuous periodic field, producing interlocking positive and negative shapes.</small>
      </section>}
    </aside>

    <main className="v10-center-stage">
      <div className="v10-stage-head"><div><b>{name}</b><span>{activeEngine.label} · {logical.width}×{logical.height} logical · {data.palette.length} colors · seed {data.seed}</span></div><div className="v10-view-buttons"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Master Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>Repeat Proof</button></div></div>
      <div className={`v10-preview-zone v12-camo-preview ${showBoundary ? 'show-boundary' : ''}`}><div className="v12-camo-image-wrap"><img src={svgDataUri(previewSvg)} alt={`${name} camouflage pattern preview`}/></div></div>
      <div className="v10-stage-status"><span>{message}</span><b>PERIODIC REGION ENGINE · SEAMLESS</b></div>
    </main>

    <aside className="v10-panel v10-panel-right">
      <section><h2>Palette · 2–8 HEX</h2><textarea className="v12-hex" rows={3} value={hexText} onChange={(event) => setHexText(event.target.value)} placeholder="#18251C, #344936, #68714A..."/><button className="v10-primary-action" onClick={applyHexPalette}>Apply HEX Palette</button><div className="v12-palette-actions"><button onClick={addColor}>+ Color</button><button onClick={reversePalette}>Reverse</button><button onClick={rotatePalette}>Rotate</button><button onClick={() => setHexText(data.palette.join(', '))}>Copy Current</button></div><div className="v12-palette">{data.palette.map((color, index) => <div className="v12-color-slot" key={`${index}-${color}`}><input type="color" value={color} onChange={(event) => updateColor(index, event.target.value)}/><span>{index + 1}</span><code>{color}</code><button onClick={() => removeColor(index)} disabled={data.palette.length <= 2}>×</button></div>)}</div></section>

      <section><h2>Color Region Weight</h2>{data.palette.map((color, index) => <label className="v12-weight" key={`weight-${index}`}><span><i style={{ background: color }}/><b>{Math.round(activeWeights[index] ?? 1)}</b><code>{color}</code></span><input type="range" min="1" max="60" step="1" value={activeWeights[index] ?? 1} onChange={(event) => setWeight(index, Number(event.target.value))}/></label>)}<small>Weights are converted to field quantiles, so they approximate real coverage instead of random stamp frequency.</small></section>

      <section><h2>Background</h2><div className="v12-palette-actions"><button className={data.backgroundMode === 'solid' ? 'active' : ''} onClick={() => setData((current) => ({ ...current, backgroundMode: 'solid' }))}>Solid</button><button className={data.backgroundMode === 'transparent' ? 'active' : ''} onClick={() => setData((current) => ({ ...current, backgroundMode: 'transparent' }))}>Transparent</button></div><label><span>Base region slot</span><select value={data.backgroundColor} onChange={(event) => setData((current) => ({ ...current, backgroundColor: Number(event.target.value) }))}>{data.palette.map((color, index) => <option key={color + index} value={index}>{index + 1} · {color}</option>)}</select></label></section>

      <section><h2>Repeat Proof / Seam</h2><div className="v11-repeat-buttons">{REPEAT_PRESETS.map((count) => <button key={count} className={proofCopies === count ? 'active' : ''} onClick={() => { setProofCopies(count); setView(count === 1 ? 'tile' : 'proof') }}>{count}×{count}</button>)}</div><label className="v10-check"><input type="checkbox" checked={showBoundary} onChange={(event) => setShowBoundary(event.target.checked)}/> Seam Inspector · show master tile boundary</label></section>

      <section><h2>Export / Save</h2><label><span>Pattern name</span><input value={name} onChange={(event) => setName(event.target.value)}/></label><div className="v12-export-presets">{EXPORT_PRESETS.map((size) => <button key={size} className={data.exportLongSide === size ? 'active' : ''} onClick={() => setData((current) => ({ ...current, exportLongSide: size }))}>{size}</button>)}</div><label><span>Custom long side</span><input type="number" min="64" max="20000" value={data.exportLongSide} onChange={(event) => setData((current) => ({ ...current, exportLongSide: Math.max(64, Math.min(20000, Number(event.target.value) || 4096)) }))}/></label><button className="v10-primary-action" onClick={saveAsset}>Save Editable Camo to My Patterns</button><div className="v12-palette-actions"><button onClick={exportSvg}>SVG</button><button onClick={exportPng}>PNG</button><button onClick={exportJson}>Pattern JSON</button><button onClick={() => setShowBoundary((value) => !value)}>Seam Inspector</button></div></section>

      <section><h2>Continue in PatternForge</h2><div className="v12-bridge-actions"><button onClick={onOpenLibrary}>My Patterns</button><button onClick={onOpenRepeat}>Repeat Layout</button><button onClick={onOpenPixel}>Pixel Pattern</button></div><small>Save first if you want the exact editable seed/settings preserved before moving to another builder.</small></section>
    </aside>
  </div>
}

function modIndex(value: number, size: number) {
  return ((value % size) + size) % size
}
