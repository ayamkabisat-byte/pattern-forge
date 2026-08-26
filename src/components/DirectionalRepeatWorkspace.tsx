import { useEffect, useMemo, useRef, useState } from 'react'
import { directionalMetrics, directionalPatternSvg, directionalProofSvg } from '../engine/directional/engine'
import { applyDirectionalPreset, DIRECTIONAL_PRESETS, initialDirectionalPattern } from '../engine/directional/presets'
import { parseDirectionalSvg } from '../engine/directional/svgMotif'
import type { DirectionalPatternData, DirectionalPresetId } from '../engine/directional/types'
import { consumePendingPattern, exportPatternAssetJson, patternAssetToSvg, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void }
const EXPORT_PRESETS = [1024,2048,4096,6000,8000]
const PROOF_PRESETS = [1,2,3,6]
const cloneData = (data: DirectionalPatternData) => JSON.parse(JSON.stringify(data)) as DirectionalPatternData
const slug = (name:string) => name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'directional-pattern'
const svgDataUri = (svg:string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function downloadText(text:string, filename:string, type:string) {
  const blob = new Blob([text],{type}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1200)
}

function Range({ label,value,min,max,step=1,suffix='',onChange }:{ label:string; value:number; min:number; max:number; step?:number; suffix?:string; onChange:(value:number)=>void }) {
  return <label className="v16-range"><span>{label}<b>{step < 1 ? value.toFixed(2) : Math.round(value)}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(Number(e.target.value))}/></label>
}

function currentAsset(name:string, data:DirectionalPatternData, svg:string): PatternAsset {
  const stamp = new Date().toISOString()
  return { id:'directional-preview', name:name.trim() || 'Directional Repeat', sourceType:'directional', createdAt:stamp, updatedAt:stamp, svg, directional:cloneData(data), tags:['directional',data.presetId,'seamless','textile'], meta:{ seamless:true, exactBounds:true, exportLongSide:data.exportLongSide, directionalPreset:data.presetId } }
}

export default function DirectionalRepeatWorkspace({ onOpenLibrary }:Props) {
  const [data,setData] = useState<DirectionalPatternData>(()=>initialDirectionalPattern())
  const [name,setName] = useState('Parang Directional 01')
  const [view,setView] = useState<'tile'|'proof'>('proof')
  const [proofCopies,setProofCopies] = useState(3)
  const [showBoundary,setShowBoundary] = useState(false)
  const [message,setMessage] = useState('Upload one SVG motif. Directional Repeat fits the lane lattice to an exact seamless torus instead of forcing a normal grid.')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{
    const pending = consumePendingPattern('directional')
    if (!pending) return
    if (pending.directional) {
      setData(cloneData(pending.directional)); setName(pending.name); setMessage(`${pending.name} reopened as an editable Directional Repeat.`); return
    }
    const svg = patternAssetToSvg(pending)
    parseDirectionalSvg(svg, pending.name).then((motif)=>{
      setData((current)=>({...current,motif})); setName(`${pending.name} Directional`); setMessage(`${pending.name} loaded as the directional motif.`)
    }).catch((error)=>setMessage(error instanceof Error ? error.message : 'Could not load the pattern as a motif.'))
  },[])

  const metrics = useMemo(()=>directionalMetrics(data),[data])
  const tileSvg = useMemo(()=>directionalPatternSvg(data),[data])
  const proofSvg = useMemo(()=>directionalProofSvg(data,proofCopies),[data,proofCopies])
  const previewSvg = view === 'tile' ? tileSvg : proofSvg

  function patch<K extends keyof DirectionalPatternData>(key:K,value:DirectionalPatternData[K]) { setData((current)=>({...current,[key]:value})) }

  async function loadSvgFile(file?:File|null) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.svg')) { setMessage('Directional Repeat accepts SVG vector motifs.'); return }
    try {
      const motif = await parseDirectionalSvg(await file.text(),file.name.replace(/\.svg$/i,''))
      setData((current)=>({...current,motif}))
      setName((current)=>current === 'Parang Directional 01' ? `${motif.name} Directional` : current)
      setMessage(motif.tightTrimmed ? `${motif.name} loaded. Tight Artwork Bounds detected automatically.` : `${motif.name} loaded. The SVG visual bounds could not be tightened, so the original viewBox is available.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read the SVG.') }
  }

  function usePreset(id:DirectionalPresetId) {
    setData((current)=>applyDirectionalPreset(current,id))
    const preset = DIRECTIONAL_PRESETS.find((item)=>item.id===id)
    if (preset) setMessage(`${preset.name}: ${preset.note}`)
  }

  function saveAsset() {
    if (!data.motif) { setMessage('Upload an SVG motif before saving.'); return }
    savePatternAsset({ name:name.trim() || 'Directional Repeat', sourceType:'directional', svg:tileSvg, directional:cloneData(data), tags:['directional',data.presetId,'seamless','textile'], meta:{ seamless:true, exactBounds:true, exportLongSide:data.exportLongSide, directionalPreset:data.presetId } })
    setMessage(`${name || 'Directional Repeat'} saved to My Patterns with its editable lane settings and source motif.`)
  }

  function exportSvg() {
    if (!data.motif) { setMessage('Upload an SVG motif before export.'); return }
    downloadText(tileSvg,`${slug(name)}-${data.exportLongSide}-seamless.svg`,'image/svg+xml;charset=utf-8')
    setMessage(`Seamless SVG exported. Effective angle ${metrics.effectiveAngle.toFixed(2)}°, winding ${metrics.windingX}:${metrics.windingY}.`)
  }

  function exportJson() {
    if (!data.motif) return
    downloadText(exportPatternAssetJson(currentAsset(name,data,tileSvg)),`${slug(name)}.pattern.json`,'application/json;charset=utf-8')
  }

  function exportPng() {
    if (!data.motif) return
    const blob = new Blob([tileSvg],{type:'image/svg+xml;charset=utf-8'}); const url=URL.createObjectURL(blob); const image=new Image()
    image.onload=()=>{ const long=Math.max(256,Math.min(8000,Math.round(data.exportLongSide))); const scale=long/Math.max(data.tileWidth,data.tileHeight); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(data.tileWidth*scale)); canvas.height=Math.max(1,Math.round(data.tileHeight*scale)); const ctx=canvas.getContext('2d'); if(!ctx){URL.revokeObjectURL(url);return} ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height); canvas.toBlob((png)=>{URL.revokeObjectURL(url);if(!png)return;const out=URL.createObjectURL(png);const a=document.createElement('a');a.href=out;a.download=`${slug(name)}-${canvas.width}x${canvas.height}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(out),1200)},'image/png') }
    image.onerror=()=>URL.revokeObjectURL(url); image.src=url
  }

  return <div className="v10-builder-shell v16-directional-shell">
    <aside className="v10-panel v10-panel-left">
      <section className="v16-intro"><h2>Directional Repeat</h2><small>Exact toroidal lanes for diagonal Parang-style placement, horizontal textile rows, vertical strips and repeating ornament bands.</small></section>
      <section><h2>1 · Structure Preset</h2><div className="v16-preset-grid">{DIRECTIONAL_PRESETS.map((preset)=><button key={preset.id} className={data.presetId===preset.id?'active':''} onClick={()=>usePreset(preset.id)}><b>{preset.name}</b><span>{preset.note}</span></button>)}</div></section>
      <section><h2>2 · SVG Motif</h2><button className="v09-primary" onClick={()=>inputRef.current?.click()}>{data.motif ? 'Replace SVG Motif' : 'Upload SVG Motif'}</button><input ref={inputRef} hidden type="file" accept=".svg,image/svg+xml" onChange={(e)=>loadSvgFile(e.target.files?.[0])}/>{data.motif ? <div className="v16-motif-info"><b>{data.motif.name}</b><span>{data.motif.tightTrimmed ? 'Tight artwork bounds available' : 'Original viewBox only'}</span></div> : <div className="v16-empty-motif">Your uploaded artwork remains the motif. The engine only arranges and wraps it.</div>}<label className="v10-check"><input type="checkbox" checked={data.trimArtwork} disabled={!data.motif?.tightTrimmed} onChange={(e)=>patch('trimArtwork',e.target.checked)}/> Trim Artwork Bounds</label><Range label="Trim Padding" value={data.trimPaddingPercent} min={0} max={10} step={.25} suffix="%" onChange={(v)=>patch('trimPaddingPercent',v)}/></section>
      <section><h2>3 · Direction</h2><div className="v16-angle-buttons">{[-45,-35,0,45,90].map((angle)=><button key={angle} className={Math.abs(data.targetAngle-angle)<.01?'active':''} onClick={()=>patch('targetAngle',angle)}>{angle}°</button>)}</div><Range label="Target Angle" value={data.targetAngle} min={-90} max={90} step={1} suffix="°" onChange={(v)=>patch('targetAngle',v)}/><div className="v16-metric-line"><span>Effective seamless angle</span><b>{metrics.effectiveAngle.toFixed(2)}°</b></div><div className="v16-metric-line"><span>Toroidal winding</span><b>{metrics.windingX}:{metrics.windingY}</b></div><label className="v10-check"><input type="checkbox" checked={data.rotateWithLane} onChange={(e)=>patch('rotateWithLane',e.target.checked)}/> Rotate SVG with lane</label><Range label="Motif Rotation Offset" value={data.motifRotationOffset} min={-180} max={180} suffix="°" onChange={(v)=>patch('motifRotationOffset',v)}/></section>
      <section><h2>4 · Lane Fit</h2><Range label="Motif Long Side" value={data.motifLongSide} min={30} max={500} onChange={(v)=>patch('motifLongSide',v)}/><Range label="Along Gap" value={data.alongGap} min={-220} max={260} onChange={(v)=>patch('alongGap',v)}/><Range label="Lane Gap" value={data.laneGap} min={-220} max={260} onChange={(v)=>patch('laneGap',v)}/><Range label="Lane Phase" value={data.lanePhase} min={-1} max={1} step={.05} onChange={(v)=>patch('lanePhase',v)}/><div className="v16-fit-report"><span>Requested gaps are targets. Seamless Fit snaps them to a compatible torus.</span><b>Actual Along Gap {metrics.effectiveAlongGap.toFixed(1)}</b><b>Actual Lane Gap {metrics.effectiveLaneGap.toFixed(1)}</b><small>{metrics.stepsPerLoop} steps/loop · {metrics.laneCount} lanes</small></div></section>
      <section><h2>5 · Alternation</h2><label className="v10-check"><input type="checkbox" checked={data.alternateLaneFlip} onChange={(e)=>patch('alternateLaneFlip',e.target.checked)}/> Mirror every second lane</label><label className="v10-check"><input type="checkbox" checked={data.alternateMotifFlip} onChange={(e)=>patch('alternateMotifFlip',e.target.checked)}/> Mirror every second motif</label><label><span>Alternate rotation</span><select value={data.alternateMotifRotation} onChange={(e)=>patch('alternateMotifRotation',Number(e.target.value) as 0|180)}><option value={0}>None</option><option value={180}>180°</option></select></label></section>
    </aside>

    <main className={`v10-stage v16-stage ${showBoundary?'show-boundary':''}`}>
      <header className="v10-stage-head"><div><b>{name}</b><span>{data.motif ? data.motif.name : 'Upload an SVG motif'} · {data.tileWidth}×{data.tileHeight} tile</span></div><div className="v16-view-tabs"><button className={view==='tile'?'active':''} onClick={()=>setView('tile')}>Master Tile</button><button className={view==='proof'?'active':''} onClick={()=>setView('proof')}>Repeat Proof</button></div></header>
      <div className="v16-preview"><div className="v16-preview-wrap">{data.motif ? <img src={svgDataUri(previewSvg)} alt="Directional seamless repeat preview"/> : <div className="v16-stage-empty"><b>Upload one SVG motif</b><span>Parang and directional repeats are generated from your artwork, not from an auto-made cultural motif.</span><button onClick={()=>inputRef.current?.click()}>Choose SVG</button></div>}</div></div>
      <footer className="v10-stage-foot"><div className="v16-proof-row">{PROOF_PRESETS.map((count)=><button key={count} className={proofCopies===count && view==='proof'?'active':''} onClick={()=>{setProofCopies(count);setView(count===1?'tile':'proof')}}>{count}×{count}</button>)}<label className="v10-check"><input type="checkbox" checked={showBoundary} onChange={(e)=>setShowBoundary(e.target.checked)}/> Seam Inspector</label></div><span>{message}</span></footer>
    </main>

    <aside className="v10-panel v10-panel-right">
      <section><h2>Document</h2><label><span>Name</span><input value={name} onChange={(e)=>setName(e.target.value)}/></label><div className="v16-size-grid"><label><span>Tile W</span><input type="number" min="200" max="4000" value={data.tileWidth} onChange={(e)=>patch('tileWidth',Math.max(200,Number(e.target.value)||800))}/></label><label><span>Tile H</span><input type="number" min="200" max="4000" value={data.tileHeight} onChange={(e)=>patch('tileHeight',Math.max(200,Number(e.target.value)||800))}/></label></div></section>
      <section><h2>Background</h2><label><span>Mode</span><select value={data.backgroundMode} onChange={(e)=>patch('backgroundMode',e.target.value as 'solid'|'transparent')}><option value="transparent">Transparent</option><option value="solid">Solid</option></select></label>{data.backgroundMode==='solid'?<label><span>Color</span><input type="color" value={data.backgroundColor} onChange={(e)=>patch('backgroundColor',e.target.value.toUpperCase())}/></label>:null}</section>
      <section><h2>Seamless Fit</h2><div className="v16-stat-grid"><div><span>Angle</span><b>{metrics.effectiveAngle.toFixed(2)}°</b></div><div><span>Winding</span><b>{metrics.windingX}:{metrics.windingY}</b></div><div><span>Along Step</span><b>{metrics.alongStep.toFixed(1)}</b></div><div><span>Lane Sep.</span><b>{metrics.laneSeparation.toFixed(1)}</b></div><div><span>Loop Steps</span><b>{metrics.stepsPerLoop}</b></div><div><span>Lanes</span><b>{metrics.laneCount}</b></div></div><small>The effective values are the exact repeat values used by the exported master tile.</small></section>
      <section><h2>SVG / PNG Output</h2><div className="v16-export-grid">{EXPORT_PRESETS.map((size)=><button key={size} className={data.exportLongSide===size?'active':''} onClick={()=>patch('exportLongSide',size)}>{size}</button>)}</div><label><span>Custom long side</span><input type="number" min="256" max="20000" value={data.exportLongSide} onChange={(e)=>patch('exportLongSide',Math.max(256,Math.min(20000,Number(e.target.value)||4096)))}/></label><button className="v09-primary" onClick={saveAsset}>Save Editable Directional</button><button onClick={exportSvg}>Export Seamless SVG</button><button onClick={exportPng}>Export PNG</button><button onClick={exportJson}>Export Pattern JSON</button><button onClick={onOpenLibrary}>Open My Patterns</button></section>
    </aside>
  </div>
}
