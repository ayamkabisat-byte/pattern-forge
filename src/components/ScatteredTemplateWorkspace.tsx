import { useEffect, useMemo, useRef, useState } from 'react'
import { savePatternAsset } from '../patternLibrary'

type Props = { onOpenLibrary: () => void }
type ViewMode = 'proof' | 'tile' | 'guide'
type FillMode = 'cycle' | 'shuffle' | 'first'
type MotifAsset = { id: string; name: string; inner: string; x: number; y: number; width: number; height: number }
type Slot = { x: number; y: number; w: number; h: number; r: number }
type Template = { id: string; label: string; note: string; badge: string; slots: Slot[] }

const S = (x:number,y:number,w:number,h:number,r=0):Slot => ({x,y,w,h,r})

const TEMPLATES: Template[] = [
  { id:'rect-toss', label:'Scattered Cards', badge:'TOSS', note:'Irregular tilted placeholders inspired by scattered square-card layouts.', slots:[
    S(.08,.08,.14,.11,-18),S(.31,.09,.13,.12,8),S(.57,.07,.15,.11,-9),S(.82,.11,.12,.13,18),
    S(.18,.29,.17,.14,16),S(.48,.26,.13,.12,-22),S(.73,.31,.16,.13,7),S(.94,.30,.13,.11,-13),
    S(.05,.51,.15,.13,11),S(.31,.50,.12,.11,-6),S(.60,.54,.17,.14,21),S(.84,.53,.13,.12,-17),
    S(.17,.76,.13,.12,-21),S(.42,.72,.17,.14,8),S(.70,.78,.13,.11,-8),S(.93,.76,.15,.13,17),
    S(.07,.95,.13,.11,9),S(.53,.96,.15,.12,-15),S(.81,.96,.12,.11,20)
  ]},
  { id:'circle-scatter', label:'Round Pebble Scatter', badge:'ROUND', note:'Fixed circular rhythm with uneven spacing and no rows.', slots:[
    S(.10,.10,.12,.12),S(.31,.07,.10,.10),S(.54,.13,.13,.13),S(.79,.08,.11,.11),
    S(.18,.31,.10,.10),S(.43,.30,.13,.13),S(.69,.34,.10,.10),S(.91,.29,.12,.12),
    S(.07,.53,.11,.11),S(.29,.56,.14,.14),S(.57,.52,.10,.10),S(.80,.57,.13,.13),
    S(.17,.78,.13,.13),S(.44,.80,.10,.10),S(.67,.75,.14,.14),S(.92,.82,.10,.10),
    S(.04,.96,.11,.11),S(.34,.98,.12,.12),S(.75,.97,.10,.10)
  ]},
  { id:'directional-tiles', label:'Directional Tile Toss', badge:'ARROW', note:'Fixed angled placeholders for arrows, leaves, vehicles or other directional motifs.', slots:[
    S(.08,.08,.14,.12,-30),S(.34,.10,.13,.12,18),S(.62,.08,.15,.12,-8),S(.88,.15,.13,.12,34),
    S(.20,.31,.15,.13,9),S(.50,.30,.14,.12,-28),S(.78,.34,.13,.12,15),
    S(.06,.56,.14,.13,31),S(.35,.55,.16,.13,-12),S(.64,.57,.13,.12,26),S(.91,.54,.14,.13,-18),
    S(.18,.80,.14,.12,-10),S(.49,.78,.15,.13,35),S(.77,.82,.14,.12,-24),
    S(.04,.98,.13,.12,22),S(.39,.97,.15,.13,-32),S(.86,.97,.14,.12,8)
  ]},
  { id:'oval-flow', label:'Oval Flow', badge:'FLOW', note:'Organic oval placeholders with controlled rotation, similar to hand-built flowing templates.', slots:[
    S(.09,.10,.10,.17,14),S(.28,.08,.08,.14,-18),S(.51,.12,.12,.19,28),S(.76,.08,.09,.15,-9),S(.94,.14,.10,.17,21),
    S(.18,.36,.11,.18,-24),S(.41,.32,.08,.14,13),S(.65,.37,.13,.20,-13),S(.86,.34,.09,.15,31),
    S(.05,.60,.10,.16,-6),S(.29,.62,.13,.20,22),S(.54,.57,.09,.15,-29),S(.78,.63,.11,.18,8),
    S(.16,.84,.09,.16,25),S(.40,.82,.12,.19,-11),S(.68,.86,.08,.14,17),S(.92,.82,.12,.18,-26),
    S(.04,.98,.09,.15,12),S(.56,.99,.12,.18,27)
  ]},
  { id:'large-small', label:'Large + Small Pebbles', badge:'MIX', note:'Deliberate hero-and-filler layout with several large slots and smaller accents.', slots:[
    S(.12,.12,.21,.20,-10),S(.39,.08,.09,.09,12),S(.61,.15,.13,.12,-18),S(.86,.08,.10,.10,7),
    S(.29,.36,.11,.10,-20),S(.55,.38,.23,.22,14),S(.86,.35,.09,.09,-8),
    S(.09,.61,.10,.10,18),S(.31,.62,.17,.16,-13),S(.69,.63,.10,.10,25),S(.91,.59,.18,.17,-9),
    S(.17,.84,.20,.19,11),S(.48,.83,.09,.09,-17),S(.71,.86,.16,.15,8),S(.96,.87,.09,.09,21),
    S(.04,.98,.10,.10,-12),S(.54,.98,.19,.18,15)
  ]},
  { id:'diamond-pebbles', label:'Diamond Pebble Layout', badge:'DIAMOND', note:'A rotated diamond master with fixed pebble placeholders inspired by drawing-template workflows.', slots:[
    S(.50,.05,.11,.09,0),S(.32,.17,.10,.08,-15),S(.67,.19,.13,.10,16),
    S(.18,.35,.12,.09,20),S(.46,.34,.20,.15,-8),S(.76,.36,.09,.08,14),
    S(.08,.55,.09,.08,-17),S(.31,.56,.13,.10,7),S(.61,.57,.11,.09,-22),S(.87,.54,.15,.11,11),
    S(.20,.75,.10,.08,18),S(.48,.74,.16,.12,-12),S(.77,.76,.10,.08,22),
    S(.35,.91,.11,.09,-16),S(.64,.91,.13,.10,12),S(.50,.99,.09,.08,0)
  ]},
  { id:'botanical', label:'Botanical Flow', badge:'LEAF', note:'Fixed mixed-size flowing layout for flowers, leaves, fruit and decorative motifs.', slots:[
    S(.10,.09,.16,.14,-20),S(.35,.10,.10,.09,22),S(.59,.08,.13,.12,-8),S(.85,.14,.18,.15,18),
    S(.22,.31,.11,.10,11),S(.48,.31,.19,.16,-16),S(.75,.35,.10,.09,25),S(.95,.34,.13,.12,-10),
    S(.08,.55,.12,.11,17),S(.32,.58,.17,.15,-24),S(.61,.54,.11,.10,8),S(.84,.59,.19,.16,21),
    S(.18,.82,.18,.15,-13),S(.48,.79,.10,.09,25),S(.70,.84,.15,.13,-17),S(.95,.80,.11,.10,8),
    S(.05,.98,.13,.11,-18),S(.57,.97,.17,.14,13)
  ]},
  { id:'quiet-busy', label:'Quiet + Busy Scatter', badge:'BALANCE', note:'Designed calm pockets plus busy pockets without algorithmic placement.', slots:[
    S(.09,.10,.12,.11,-12),S(.28,.08,.09,.08,15),S(.50,.16,.18,.16,-5),S(.82,.09,.10,.09,20),
    S(.18,.35,.16,.14,13),S(.42,.32,.09,.08,-22),S(.72,.38,.12,.11,7),S(.93,.31,.09,.08,-10),
    S(.07,.61,.10,.09,18),S(.34,.59,.20,.18,-12),S(.65,.60,.09,.08,24),S(.87,.64,.15,.13,-5),
    S(.20,.84,.09,.08,-18),S(.45,.82,.13,.12,9),S(.72,.86,.19,.16,-14),S(.96,.87,.09,.08,20),
    S(.05,.98,.12,.10,12),S(.54,.98,.10,.09,-21)
  ]},
]

const uid=()=>crypto.randomUUID().replaceAll('-','').slice(0,12)
const slug=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'template-pattern'
const dataUri=(svg:string)=>`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
function seeded(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

function sanitizeSvg(raw:string,prefix:string):MotifAsset{
  const doc=new DOMParser().parseFromString(raw,'image/svg+xml');const root=doc.documentElement
  if(root.tagName.toLowerCase()!=='svg'||doc.querySelector('parsererror'))throw new Error('Invalid SVG file.')
  root.querySelectorAll('script,foreignObject').forEach(n=>n.remove())
  const ids=new Map<string,string>()
  root.querySelectorAll<HTMLElement>('[id]').forEach(n=>{const old=n.id;if(!old)return;const next=`${prefix}-${old.replace(/[^a-zA-Z0-9_-]/g,'-')}`;ids.set(old,next);n.id=next})
  root.querySelectorAll<HTMLElement>('*').forEach(n=>Array.from(n.attributes).forEach(a=>{const key=a.name.toLowerCase();let value=a.value;if(key.startsWith('on')||/^javascript:/i.test(value)){n.removeAttribute(a.name);return}ids.forEach((next,old)=>{value=value.replaceAll(`url(#${old})`,`url(#${next})`);if(value===`#${old}`)value=`#${next}`});n.setAttribute(a.name,value)}))
  root.querySelectorAll('style').forEach(style=>{let css=style.textContent??'';ids.forEach((next,old)=>css=css.replaceAll(`#${old}`,`#${next}`));style.textContent=css})
  const vb=(root.getAttribute('viewBox')??'').trim().split(/[ ,]+/).map(Number);const wa=parseFloat(root.getAttribute('width')??'');const ha=parseFloat(root.getAttribute('height')??'')
  const x=vb.length===4&&vb.every(Number.isFinite)?vb[0]:0,y=vb.length===4&&vb.every(Number.isFinite)?vb[1]:0
  const width=vb.length===4&&vb.every(Number.isFinite)&&vb[2]>0?vb[2]:(Number.isFinite(wa)&&wa>0?wa:100);const height=vb.length===4&&vb.every(Number.isFinite)&&vb[3]>0?vb[3]:(Number.isFinite(ha)&&ha>0?ha:100)
  const inner=Array.from(root.childNodes).map(n=>new XMLSerializer().serializeToString(n)).join('')
  return{id:prefix,name:'motif.svg',inner,x,y,width,height}
}

function initialAssignments(slotCount:number,assetCount:number,mode:FillMode,seed:number){
  if(!assetCount)return Array(slotCount).fill(-1)
  if(mode==='first')return Array(slotCount).fill(0)
  if(mode==='cycle')return Array.from({length:slotCount},(_,i)=>i%assetCount)
  const r=seeded(seed);return Array.from({length:slotCount},()=>Math.floor(r()*assetCount))
}

function slotCopies(slot:Slot){
  const xs=[0],ys=[0];const hw=slot.w*.55,hh=slot.h*.55
  if(slot.x-hw<0)xs.push(1);if(slot.x+hw>1)xs.push(-1);if(slot.y-hh<0)ys.push(1);if(slot.y+hh>1)ys.push(-1)
  return xs.flatMap(dx=>ys.map(dy=>({dx,dy})))
}

function buildTemplateSvg(template:Template,assets:MotifAsset[],assignments:number[],tileSize:number,background:string,showPlaceholders:boolean,guideOnly=false){
  const defs=assets.map((a,i)=>`<g id="fixed-motif-${i}">${a.inner}</g>`).join('');const parts:string[]=[]
  template.slots.forEach((slot,index)=>{
    const assetIndex=assignments[index]??-1;const asset=assets[assetIndex]
    if(guideOnly||!asset){
      slotCopies(slot).forEach(({dx,dy})=>{const cx=(slot.x+dx)*tileSize,cy=(slot.y+dy)*tileSize,w=slot.w*tileSize,h=slot.h*tileSize;parts.push(`<g transform="rotate(${slot.r} ${cx} ${cy})"><rect x="${cx-w/2}" y="${cy-h/2}" width="${w}" height="${h}" rx="${Math.min(w,h)*.18}" fill="${guideOnly?'#f8fafc':'#ffffff'}" fill-opacity="${guideOnly?'.04':'.08'}" stroke="#8b95a5" stroke-width="2" stroke-dasharray="9 7"/><circle cx="${cx}" cy="${cy}" r="16" fill="#111827"/><text x="${cx}" y="${cy+5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#fff">${index+1}</text></g>`)})
      return
    }
    const targetW=slot.w*tileSize*.82,targetH=slot.h*tileSize*.82;const factor=Math.min(targetW/asset.width,targetH/asset.height);const cx=asset.x+asset.width/2,cy=asset.y+asset.height/2
    slotCopies(slot).forEach(({dx,dy})=>{const px=(slot.x+dx)*tileSize,py=(slot.y+dy)*tileSize;parts.push(`<use href="#fixed-motif-${assetIndex}" transform="translate(${px} ${py}) rotate(${slot.r}) scale(${factor}) translate(${-cx} ${-cy})"/>`)})
    if(showPlaceholders)parts.push(`<g pointer-events="none" transform="rotate(${slot.r} ${slot.x*tileSize} ${slot.y*tileSize})"><rect x="${(slot.x-slot.w/2)*tileSize}" y="${(slot.y-slot.h/2)*tileSize}" width="${slot.w*tileSize}" height="${slot.h*tileSize}" rx="10" fill="none" stroke="#66d3a3" stroke-width="2" stroke-dasharray="8 6" opacity=".7"/><circle cx="${slot.x*tileSize}" cy="${slot.y*tileSize}" r="14" fill="#111827"/><text x="${slot.x*tileSize}" y="${slot.y*tileSize+5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#fff">${index+1}</text></g>`)
  })
  const bg=background==='transparent'?'':`<rect width="100%" height="100%" fill="${background}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" data-patternforge-seamless="true" data-patternforge-exact-bounds="true"><defs><clipPath id="fixed-template-clip"><rect width="${tileSize}" height="${tileSize}"/></clipPath>${defs}</defs>${bg}<g clip-path="url(#fixed-template-clip)">${parts.join('')}</g></svg>`
}

function buildProofSvg(tileSvg:string,tileSize:number){const uri=dataUri(tileSvg),side=tileSize*3;let images='';for(let y=0;y<3;y++)for(let x=0;x<3;x++)images+=`<image href="${uri}" x="${x*tileSize}" y="${y*tileSize}" width="${tileSize}" height="${tileSize}"/>`;return`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">${images}</svg>`}
function downloadText(text:string,name:string){const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function downloadPng(svg:string,name:string,size:number){const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('render failed'));image.src=url});const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(url);return}ctx.drawImage(image,0,0,size,size);URL.revokeObjectURL(url);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)return;const png=URL.createObjectURL(blob),a=document.createElement('a');a.href=png;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(png),1000)}

export default function ScatteredTemplateWorkspace({onOpenLibrary}:Props){
  const [assets,setAssets]=useState<MotifAsset[]>([]),[templateId,setTemplateId]=useState('rect-toss'),[fillMode,setFillMode]=useState<FillMode>('cycle'),[assignments,setAssignments]=useState<number[]>([])
  const [tileSize,setTileSize]=useState(1600),[background,setBackground]=useState('transparent'),[solidBackground,setSolidBackground]=useState('#FFFDF7'),[view,setView]=useState<ViewMode>('guide'),[showPlaceholders,setShowPlaceholders]=useState(false),[seed,setSeed]=useState(8127)
  const [name,setName]=useState('Fixed Scatter Pattern 01'),[message,setMessage]=useState('Choose a fixed template. Every numbered placeholder can be replaced with any SVG you upload.');const inputRef=useRef<HTMLInputElement>(null)
  const template=useMemo(()=>TEMPLATES.find(t=>t.id===templateId)??TEMPLATES[0],[templateId])
  useEffect(()=>setAssignments(initialAssignments(template.slots.length,assets.length,fillMode,seed)),[template.id,assets.length,fillMode,seed])
  const bg=background==='transparent'?'transparent':solidBackground
  const tileSvg=useMemo(()=>buildTemplateSvg(template,assets,assignments,tileSize,bg,showPlaceholders,false),[template,assets,assignments,tileSize,bg,showPlaceholders])
  const guideSvg=useMemo(()=>buildTemplateSvg(template,[],Array(template.slots.length).fill(-1),tileSize,'#fff',false,true),[template,tileSize])
  const previewSvg=useMemo(()=>view==='proof'?buildProofSvg(tileSvg,tileSize):view==='guide'?guideSvg:tileSvg,[view,tileSvg,guideSvg,tileSize])
  async function addFiles(files:FileList|null){const incoming=Array.from(files??[]).filter(f=>f.name.toLowerCase().endsWith('.svg'));if(!incoming.length){setMessage('Please choose SVG files.');return}const parsed:MotifAsset[]=[];for(const file of incoming){try{const a=sanitizeSvg(await file.text(),`fixed-${uid()}`);parsed.push({...a,name:file.name})}catch(e){setMessage(e instanceof Error?`${file.name}: ${e.message}`:`Could not read ${file.name}`)}}if(!parsed.length)return;setAssets(c=>[...c,...parsed].slice(0,24));setMessage(`${parsed.length} SVG motif${parsed.length===1?'':'s'} added. Use Placeholder Mapping to replace each numbered position.`)}
  function setSlot(index:number,value:number){setAssignments(current=>{const next=[...current];next[index]=value;return next})}
  function removeAsset(index:number){setAssets(c=>c.filter((_,i)=>i!==index));setAssignments(current=>current.map(v=>v===index?-1:v>index?v-1:v));setMessage('Motif removed; placeholder mapping was preserved where possible.')}
  function refill(){setSeed(Math.floor(Math.random()*999999));setMessage('Placeholder assignments refilled. The template geometry itself did not move.')}
  function exportSvg(){if(!assets.length){setMessage('Upload at least one SVG motif first.');return}downloadText(tileSvg,`${slug(name)}-${template.id}-seamless.svg`);setMessage('Fixed-layout seamless SVG exported.')}
  function exportGuide(){downloadText(guideSvg,`${slug(name)}-${template.id}-placeholder-guide.svg`);setMessage('Blank numbered placeholder template exported.')}
  async function exportPng(){if(!assets.length){setMessage('Upload at least one SVG motif first.');return}await downloadPng(tileSvg,`${slug(name)}-${template.id}-4096.png`,4096);setMessage('4096 PNG exported.')}
  function saveLibrary(){if(!assets.length){setMessage('Upload at least one SVG motif first.');return}savePatternAsset({name:name.trim()||'Fixed Scatter Pattern',sourceType:'imported-svg',svg:tileSvg,tags:['fixed-template','scatter',template.id,'seamless'],meta:{width:tileSize,height:tileSize,exactBounds:true,template:template.id,slotCount:template.slots.length}});setMessage('Saved to My Patterns.')}
  return <div className="v20-scatter-shell v21-fixed-shell">
    <aside className="v20-scatter-panel v20-scatter-left">
      <div className="v20-scatter-heading"><span>FIXED TEMPLATE</span><h1>Scattered Layouts</h1><p>No scatter algorithm. Pick a finished layout, then replace each numbered placeholder with your own SVG.</p></div>
      <section><div className="v20-section-title"><b>1 · Choose Template</b><small>Geometry is fixed and repeat-tested</small></div><div className="v20-template-grid">{TEMPLATES.map(t=><button key={t.id} className={template.id===t.id?'active':''} onClick={()=>{setTemplateId(t.id);setView('guide')}}><span>{t.badge}</span><b>{t.label}</b><small>{t.note}</small></button>)}</div></section>
      <section><div className="v20-section-title"><b>2 · Upload SVG Motifs</b><small>1–24 SVGs · no rasterization</small></div><button className="v20-scatter-drop" onClick={()=>inputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void addFiles(e.dataTransfer.files)}}><b>Drop SVG motifs here</b><span>or click to choose files</span></button><input ref={inputRef} type="file" accept=".svg,image/svg+xml" multiple hidden onChange={e=>void addFiles(e.target.files)}/><div className="v20-motif-list">{assets.map((a,i)=><div key={a.id}><span>{i+1}</span><b title={a.name}>{a.name}</b><button onClick={()=>removeAsset(i)}>×</button></div>)}</div></section>
      <section><div className="v20-section-title"><b>3 · Quick Fill</b><small>Only fills slots; never moves the template</small></div><label>Fill method<select value={fillMode} onChange={e=>setFillMode(e.target.value as FillMode)}><option value="cycle">Cycle through all SVGs</option><option value="shuffle">Seeded mixed assignment</option><option value="first">Use first SVG everywhere</option></select></label><button className="v21-refill" onClick={refill}>Refill placeholders</button></section>
    </aside>
    <main className="v20-scatter-stage"><div className="v20-stage-toolbar"><div><b>{template.label}</b><span>{template.slots.length} fixed placeholders · zero algorithmic movement · exact edge wrap</span></div><div className="v20-view-tabs"><button className={view==='guide'?'active':''} onClick={()=>setView('guide')}>Placeholder Guide</button><button className={view==='tile'?'active':''} onClick={()=>setView('tile')}>Master Tile</button><button className={view==='proof'?'active':''} onClick={()=>setView('proof')}>3×3 Proof</button></div></div><div className="v20-preview-wrap"><div className={`v20-preview ${view}`}><img src={dataUri(previewSvg)} alt="Fixed seamless pattern template"/></div></div><div className="v20-message">{message}</div></main>
    <aside className="v20-scatter-panel v20-scatter-right">
      <section><div className="v20-section-title"><b>Placeholder Mapping</b><small>Replace every slot individually</small></div><div className="v21-slot-map">{template.slots.map((_,i)=><label key={i}><b>#{i+1}</b><select value={assignments[i]??-1} onChange={e=>setSlot(i,Number(e.target.value))}><option value={-1}>Empty / placeholder</option>{assets.map((a,ai)=><option value={ai} key={a.id}>{a.name}</option>)}</select></label>)}</div></section>
      <section><div className="v20-section-title"><b>Pattern Setup</b><small>Template positions stay unchanged</small></div><label>Pattern name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Master tile<select value={tileSize} onChange={e=>setTileSize(Number(e.target.value))}><option value={1000}>1000 × 1000</option><option value={1600}>1600 × 1600</option><option value={2048}>2048 × 2048</option><option value={3000}>3000 × 3000</option><option value={4096}>4096 × 4096</option></select></label><label>Background<select value={background} onChange={e=>setBackground(e.target.value)}><option value="transparent">Transparent</option><option value="solid">Solid</option></select></label>{background==='solid'?<label>Background HEX<input type="color" value={solidBackground} onChange={e=>setSolidBackground(e.target.value)}/><input value={solidBackground} onChange={e=>setSolidBackground(e.target.value)}/></label>:null}<label className="v21-check"><input type="checkbox" checked={showPlaceholders} onChange={e=>setShowPlaceholders(e.target.checked)}/> Show slot outlines over artwork</label></section>
      <section><div className="v20-section-title"><b>Export</b><small>Fixed template + your SVGs</small></div><div className="v20-export-stack"><button className="primary" onClick={exportSvg}>Export Seamless SVG</button><button onClick={()=>void exportPng()}>Export 4096 PNG</button><button onClick={exportGuide}>Export Blank Placeholder SVG</button><button onClick={saveLibrary}>Save to My Patterns</button><button onClick={onOpenLibrary}>Open My Patterns</button></div></section>
      <div className="v20-tip"><b>Workflow</b><span>Choose a template → upload SVGs → map each numbered placeholder → inspect 3×3 Proof → export. There is no procedural scatter step anymore.</span></div>
    </aside>
  </div>
}
