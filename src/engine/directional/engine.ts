import type { DirectionalMetrics, DirectionalPatternData } from './types'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const mod = (value: number, size: number) => ((value % size) + size) % size
const esc = (value: string) => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')

function compatibleCount(raw: number, cycle: number, min: number, max: number) {
  const c = Math.max(1, Math.round(cycle))
  const center = Math.max(1, Math.round(raw / c))
  let best = c
  let error = Infinity
  for (let delta = -3; delta <= 3; delta++) {
    const value = clamp((center + delta) * c, Math.max(min, c), max)
    const next = Math.abs(value - raw)
    if (next < error || (Math.abs(next - error) < 1e-8 && value > best)) { best = value; error = next }
  }
  return Math.max(min, Math.min(max, Math.round(best)))
}

function angleDistance(a: number, b: number) {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

function windingForAngle(targetAngle: number, width: number, height: number) {
  const target = clamp(targetAngle, -90, 90)
  let best = { x:1, y:0, angle:0, error:Infinity, complexity:Infinity }
  for (let wx = 0; wx <= 7; wx++) {
    for (let wyAbs = 0; wyAbs <= 7; wyAbs++) {
      if (wx === 0 && wyAbs === 0) continue
      if (wx === 0 && Math.abs(target) < 45) continue
      if (wyAbs === 0 && Math.abs(target) > 45) continue
      const wy = target < 0 ? -wyAbs : wyAbs
      const angle = Math.atan2(wy * height, wx * width) * 180 / Math.PI
      const error = angleDistance(angle, target)
      const complexity = wx + wyAbs
      if (error < best.error - 1e-7 || (Math.abs(error - best.error) < 1e-7 && complexity < best.complexity)) best = { x:wx, y:wy, angle, error, complexity }
    }
  }
  return best
}

function viewBoxParts(raw: string) {
  const p = raw.trim().split(/[ ,]+/).map(Number)
  return p.length === 4 && p.every(Number.isFinite) ? p as [number,number,number,number] : [0,0,100,100] as [number,number,number,number]
}

export function directionalMotifBounds(data: DirectionalPatternData) {
  const motif = data.motif
  if (!motif) return { viewBox:'0 0 100 100', width:100, height:100 }
  const raw = data.trimArtwork && motif.tightTrimmed ? motif.tightViewBox : motif.originalViewBox
  const [x,y,wRaw,hRaw] = viewBoxParts(raw)
  const w = Math.max(1, Math.abs(wRaw))
  const h = Math.max(1, Math.abs(hRaw))
  const padding = data.trimArtwork ? Math.max(w,h) * clamp(data.trimPaddingPercent,0,20) / 100 : 0
  return { viewBox:`${x-padding} ${y-padding} ${w+padding*2} ${h+padding*2}`, width:w+padding*2, height:h+padding*2 }
}

function motifDimensions(data: DirectionalPatternData) {
  const bounds = directionalMotifBounds(data)
  const ratio = bounds.width / bounds.height || 1
  const longSide = clamp(data.motifLongSide, 12, Math.max(12, Math.min(data.tileWidth, data.tileHeight) * .95))
  return ratio >= 1 ? { width:longSide, height:longSide/ratio } : { width:longSide*ratio, height:longSide }
}

export function directionalMetrics(data: DirectionalPatternData): DirectionalMetrics {
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const winding = windingForAngle(data.targetAngle, width, height)
  const dx = winding.x * width
  const dy = winding.y * height
  const loopLength = Math.max(1, Math.hypot(dx,dy))
  const angle = Math.atan2(dy,dx) * 180 / Math.PI
  const motif = motifDimensions(data)
  const renderedRotation = (data.rotateWithLane ? angle : 0) + data.motifRotationOffset
  const delta = (renderedRotation - angle) * Math.PI / 180
  const alongExtent = Math.abs(motif.width * Math.cos(delta)) + Math.abs(motif.height * Math.sin(delta))
  const crossExtent = Math.abs(motif.width * Math.sin(delta)) + Math.abs(motif.height * Math.cos(delta))
  const wantedAlong = Math.max(4, alongExtent + data.alongGap)
  const stepCycle = data.alternateMotifFlip || data.alternateMotifRotation === 180 ? 2 : 1
  const stepsPerLoop = compatibleCount(loopLength / wantedAlong, stepCycle, 1, 120)
  const alongStep = loopLength / stepsPerLoop
  const rad = angle * Math.PI / 180
  const useYAxis = Math.abs(Math.cos(rad)) >= .22
  const normalSpan = Math.max(1, useYAxis ? height * Math.abs(Math.cos(rad)) : width * Math.abs(Math.sin(rad)))
  const wantedLane = Math.max(4, crossExtent + data.laneGap)
  const laneCycle = data.alternateLaneFlip ? 2 : 1
  const laneCount = compatibleCount(normalSpan / wantedLane, laneCycle, 1, 80)
  const laneSeparation = normalSpan / laneCount
  return {
    windingX:winding.x,
    windingY:winding.y,
    effectiveAngle:angle,
    stepsPerLoop,
    laneCount,
    alongStep,
    laneSeparation,
    alongExtent,
    crossExtent,
    effectiveAlongGap:alongStep-alongExtent,
    effectiveLaneGap:laneSeparation-crossExtent,
    motifWidth:motif.width,
    motifHeight:motif.height,
    laneAxis:useYAxis ? 'y' : 'x',
  }
}

type Center = { x:number; y:number; lane:number; step:number }

function baseCenters(data: DirectionalPatternData, metrics: DirectionalMetrics) {
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const dx = metrics.windingX * width
  const dy = metrics.windingY * height
  const ux = dx / metrics.stepsPerLoop
  const uy = dy / metrics.stepsPerLoop
  const centers: Center[] = []
  const seen = new Set<string>()
  for (let lane=0; lane<metrics.laneCount; lane++) {
    const startX = metrics.laneAxis === 'x' ? lane * width / metrics.laneCount : 0
    const startY = metrics.laneAxis === 'y' ? lane * height / metrics.laneCount : 0
    const phase = lane * clamp(data.lanePhase, -2, 2)
    for (let step=0; step<metrics.stepsPerLoop; step++) {
      const x = mod(startX + (step + phase) * ux, width)
      const y = mod(startY + (step + phase) * uy, height)
      const key = `${x.toFixed(4)}:${y.toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      centers.push({ x,y,lane,step })
    }
  }
  return centers
}

function motifGroup(data: DirectionalPatternData, metrics: DirectionalMetrics, center: Center, x:number, y:number, key:string) {
  if (!data.motif) return ''
  const bounds = directionalMotifBounds(data)
  let rotation = (data.rotateWithLane ? metrics.effectiveAngle : 0) + data.motifRotationOffset
  if (data.alternateMotifRotation === 180 && ((center.lane + center.step) & 1)) rotation += 180
  const flipLane = data.alternateLaneFlip && (center.lane & 1)
  const flipMotif = data.alternateMotifFlip && ((center.lane + center.step) & 1)
  const sx = flipLane !== flipMotif ? -1 : 1
  return `<g data-directional-instance="${key}" transform="translate(${x.toFixed(4)} ${y.toFixed(4)}) rotate(${rotation.toFixed(4)}) scale(${sx} 1) translate(${-metrics.motifWidth/2} ${-metrics.motifHeight/2})"><svg width="${metrics.motifWidth.toFixed(4)}" height="${metrics.motifHeight.toFixed(4)}" viewBox="${bounds.viewBox}" preserveAspectRatio="xMidYMid meet">${data.motif.innerSvg}</svg></g>`
}

function background(data: DirectionalPatternData, width:number, height:number) {
  return data.backgroundMode === 'solid' ? `<rect width="${width}" height="${height}" fill="${esc(data.backgroundColor || '#ffffff')}"/>` : ''
}

function documentSize(data: DirectionalPatternData) {
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const long = clamp(Math.round(data.exportLongSide),256,20000)
  const scale = long / Math.max(width,height)
  return { width:Math.max(1,Math.round(width*scale)), height:Math.max(1,Math.round(height*scale)) }
}

export function directionalPatternSvg(data: DirectionalPatternData) {
  const width = Math.max(100, data.tileWidth)
  const height = Math.max(100, data.tileHeight)
  const metrics = directionalMetrics(data)
  const centers = baseCenters(data,metrics)
  const dims = documentSize(data)
  const pieces:string[] = []
  for (const center of centers) {
    for (const sy of [-height,0,height]) for (const sx of [-width,0,width]) pieces.push(motifGroup(data,metrics,center,center.x+sx,center.y+sy,`${center.lane}-${center.step}-${sx}-${sy}`))
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${width} ${height}" data-patternforge-exact-bounds="true" data-patternforge-seamless="true" data-patternforge-source="directional-repeat" data-directional-angle="${metrics.effectiveAngle.toFixed(4)}" data-directional-winding="${metrics.windingX},${metrics.windingY}" data-directional-steps="${metrics.stepsPerLoop}" data-directional-lanes="${metrics.laneCount}"><defs><clipPath id="pf-directional-master"><rect width="${width}" height="${height}"/></clipPath></defs>${background(data,width,height)}<g clip-path="url(#pf-directional-master)">${pieces.join('')}</g></svg>`
}

export function directionalProofSvg(data: DirectionalPatternData, copies:number) {
  const count = clamp(Math.round(copies),1,8)
  const tileW = Math.max(100,data.tileWidth)
  const tileH = Math.max(100,data.tileHeight)
  const width = tileW * count
  const height = tileH * count
  const metrics = directionalMetrics(data)
  const centers = baseCenters(data,metrics)
  const pieces:string[] = []
  for (let ty=0;ty<count;ty++) for (let tx=0;tx<count;tx++) for (const center of centers) pieces.push(motifGroup(data,metrics,center,center.x+tx*tileW,center.y+ty*tileH,`${tx}-${ty}-${center.lane}-${center.step}`))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-patternforge-proof="directional-continuous">${background(data,width,height)}${pieces.join('')}</svg>`
}
