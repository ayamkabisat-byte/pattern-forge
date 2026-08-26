import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { consumePendingPattern, decodeGridCells, encodeGridCells, exportPatternAssetJson, patternAssetToSvg, savePatternAsset, type PatternAsset } from '../patternLibrary'

type GridSize = 8 | 16 | 32 | 64 | 128 | 256
type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'picker'
type Symmetry = 'none' | 'x' | 'y' | 'xy' | 'quadrant'
type RepeatCount = 1 | 2 | 3 | 6 | 12
type BackgroundMode = 'transparent' | 'solid'
type Props = { onOpenLibrary: () => void; onOpenWoven: () => void }
type Bounds = { x: number; y: number; width: number; height: number }

const GRID_SIZES: GridSize[] = [8, 16, 32, 64, 128, 256]
const REPEATS: RepeatCount[] = [1, 2, 3, 6, 12]
const EXPORT_PRESETS = [1024, 2048, 4096, 6000, 8000]
const DEFAULT_PALETTE = ['#15241F', '#D4B15A', '#7E2637', '#E9DEC7', '#2F5A4A', '#B9673B', '#27211C', '#F2EEE4']
const TRANSPARENT = 255
const HISTORY_LIMIT = 35

const mod = (value: number, size: number) => ((value % size) + size) % size
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pixel-pattern'

function scaledDimensions(width: number, height: number, longSide: number) {
  const logicalLong = Math.max(width, height) || 1
  const scale = longSide / logicalLong
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function normalizeHex(value: string) {
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v.slice(1).split('').map((c) => c + c).join('').toUpperCase()}`
  return null
}

function linePoints(x0: number, y0: number, x1: number, y1: number) {
  const out: Array<[number, number]> = []
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
  let err = dx + dy, x = x0, y = y0
  while (true) {
    out.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
  return out
}

function dominantValue(cells: Uint8Array) {
  const counts = new Map<number, number>()
  cells.forEach((v) => { if (v !== TRANSPARENT) counts.set(v, (counts.get(v) ?? 0) + 1) })
  let best = TRANSPARENT, count = -1
  counts.forEach((c, v) => { if (c > count) { count = c; best = v } })
  return best
}

function shiftBuffer(cells: Uint8Array, size: number, dx: number, dy: number) {
  const next = new Uint8Array(cells.length).fill(TRANSPARENT)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) next[mod(y + dy, size) * size + mod(x + dx, size)] = cells[y * size + x]
  return next
}

function circularCenterShift(values: number[], size: number) {
  const unique = Array.from(new Set(values)).sort((a, b) => a - b)
  if (!unique.length || unique.length >= size) return 0
  let largestGap = -1, intervalStart = unique[0]
  for (let i = 0; i < unique.length; i++) {
    const current = unique[i], next = unique[(i + 1) % unique.length]
    const gap = mod(next - current, size) || size
    if (gap > largestGap) { largestGap = gap; intervalStart = next }
  }
  const span = size - largestGap + 1
  const currentCenter = mod(intervalStart + (span - 1) / 2, size)
  let shift = Math.round((size - 1) / 2 - currentCenter)
  while (shift > size / 2) shift -= size
  while (shift < -size / 2) shift += size
  return shift
}

export default function PixelPatternBuilder({ onOpenLibrary, onOpenWoven }: Props) {
  const [gridSize, setGridSize] = useState<GridSize>(32)
  const [cells, setCells] = useState(() => new Uint8Array(32 * 32).fill(TRANSPARENT))
  const cellsRef = useRef(cells)
  const [palette, setPalette] = useState([...DEFAULT_PALETTE])
  const [quickHex, setQuickHex] = useState(DEFAULT_PALETTE.join(', '))
  const [activeColor, setActiveColor] = useState(1)
  const [tool, setTool] = useState<Tool>('pencil')
  const [symmetry, setSymmetry] = useState<Symmetry>('none')
  const [brushSize, setBrushSize] = useState(1)
  const [repeatCount, setRepeatCount] = useState<RepeatCount>(3)
  const [view, setView] = useState<'edit' | 'repeat'>('edit')
  const [showGrid, setShowGrid] = useState(true)
  const [patternName, setPatternName] = useState('Pixel Pattern 01')
  const [message, setMessage] = useState('Transparent master tile ready. Draw directly over the checkerboard.')
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([])
  const [redoStack, setRedoStack] = useState<Uint8Array[]>([])
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('transparent')
  const [backgroundColor, setBackgroundColor] = useState(0)
  const [selectedAll, setSelectedAll] = useState(false)
  const [moveStep, setMoveStep] = useState(1)
  const [removeCropBackground, setRemoveCropBackground] = useState(true)
  const [detectedCrop, setDetectedCrop] = useState('auto')
  const [exportLongSide, setExportLongSide] = useState(4096)
  const editCanvasRef = useRef<HTMLCanvasElement>(null)
  const repeatCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; snapshot: Uint8Array } | null>(null)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const changedRef = useRef(false)

  const setCellsNow = (next: Uint8Array) => { cellsRef.current = next; setCells(next) }
  const usedColors = useMemo(() => new Set(Array.from(cells).filter((v) => v !== TRANSPARENT)).size, [cells])

  useEffect(() => { cellsRef.current = cells }, [cells])

  useEffect(() => {
    const pending = consumePendingPattern('pixel')
    if (!pending?.grid) return
    const size = pending.grid.width as GridSize
    if (!GRID_SIZES.includes(size) || pending.grid.width !== pending.grid.height) {
      setMessage('Saved asset is not a supported square Pixel grid.')
      return
    }
    const loaded = decodeGridCells(pending.grid.cellsBase64, size * size)
    const bg = dominantValue(loaded)
    const savedExportSize = Number(pending.meta?.exportLongSide)
    setGridSize(size)
    setCellsNow(loaded)
    setPalette([...pending.grid.palette])
    setQuickHex(pending.grid.palette.join(', '))
    setPatternName(pending.name)
    setBackgroundMode(loaded.some((v) => v === TRANSPARENT) ? 'transparent' : 'solid')
    if (bg !== TRANSPARENT) setBackgroundColor(Math.min(bg, pending.grid.palette.length - 1))
    if (Number.isFinite(savedExportSize) && savedExportSize > 0) setExportLongSide(clamp(Math.round(savedExportSize), 64, 20000))
    setUndoStack([]); setRedoStack([])
    setMessage(`${pending.name} loaded from My Patterns.`)
  }, [])

  useEffect(() => { drawEditor() }, [cells, gridSize, palette, showGrid])
  useEffect(() => { drawRepeat() }, [cells, gridSize, palette, repeatCount])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); setSelectedAll(true); setMessage('Entire tile selected. Arrow keys move the wrapped repeat phase.'); return
      }
      if (!selectedAll) return
      const step = event.shiftKey ? Math.max(4, moveStep) : moveStep
      if (event.key === 'ArrowLeft') { event.preventDefault(); movePhase(-step, 0) }
      if (event.key === 'ArrowRight') { event.preventDefault(); movePhase(step, 0) }
      if (event.key === 'ArrowUp') { event.preventDefault(); movePhase(0, -step) }
      if (event.key === 'ArrowDown') { event.preventDefault(); movePhase(0, step) }
      if (event.key === 'Escape') setSelectedAll(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedAll, moveStep, gridSize])

  function pushUndo(snapshot: Uint8Array) {
    setUndoStack((s) => [...s.slice(-(HISTORY_LIMIT - 1)), snapshot])
    setRedoStack([])
  }

  function commit(next: Uint8Array, before = cellsRef.current) {
    if (next.every((v, i) => v === before[i])) return
    pushUndo(before.slice())
    setCellsNow(next)
  }

  function setGrid(size: GridSize) {
    if (size === gridSize) return
    const next = new Uint8Array(size * size).fill(backgroundMode === 'transparent' ? TRANSPARENT : backgroundColor)
    const current = cellsRef.current, copy = Math.min(size, gridSize)
    for (let y = 0; y < copy; y++) for (let x = 0; x < copy; x++) next[y * size + x] = current[y * gridSize + x]
    setGridSize(size); setCellsNow(next); setUndoStack([]); setRedoStack([]); setSelectedAll(false)
  }

  function drawEditor() {
    const canvas = editCanvasRef.current
    if (!canvas) return
    const size = 896
    if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size }
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const c = size / gridSize
    for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
      const value = cells[y * gridSize + x]
      if (value === TRANSPARENT || !palette[value]) continue
      ctx.fillStyle = palette[value]
      ctx.fillRect(x * c, y * c, Math.ceil(c + .5), Math.ceil(c + .5))
    }
    if (showGrid && c >= 3.5) {
      ctx.strokeStyle = 'rgba(20,24,30,.32)'; ctx.lineWidth = c >= 18 ? 1 : .55; ctx.beginPath()
      for (let i = 0; i <= gridSize; i++) { const p = Math.round(i * c) + .5; ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.moveTo(0, p); ctx.lineTo(size, p) }
      ctx.stroke()
    }
  }

  function drawTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, tile: number) {
    const c = tile / gridSize
    for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
      const value = cells[y * gridSize + x]
      if (value === TRANSPARENT || !palette[value]) continue
      ctx.fillStyle = palette[value]
      ctx.fillRect(ox + x * c, oy + y * c, Math.ceil(c + .4), Math.ceil(c + .4))
    }
  }

  function drawRepeat() {
    const canvas = repeatCanvasRef.current
    if (!canvas) return
    const size = 900
    if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size }
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const tile = size / repeatCount
    for (let y = 0; y < repeatCount; y++) for (let x = 0; x < repeatCount; x++) drawTile(ctx, x * tile, y * tile, tile)
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const r = event.currentTarget.getBoundingClientRect()
    return { x: clamp(Math.floor((event.clientX - r.left) / r.width * gridSize), 0, gridSize - 1), y: clamp(Math.floor((event.clientY - r.top) / r.height * gridSize), 0, gridSize - 1) }
  }

  function symmetricPoints(x: number, y: number) {
    const n = gridSize, pts: Array<[number, number]> = [[x, y]]
    if (symmetry === 'x' || symmetry === 'xy') pts.push([n - 1 - x, y])
    if (symmetry === 'y' || symmetry === 'xy') pts.push([x, n - 1 - y])
    if (symmetry === 'xy') pts.push([n - 1 - x, n - 1 - y])
    if (symmetry === 'quadrant') pts.push([n - 1 - y, x], [n - 1 - x, n - 1 - y], [y, n - 1 - x])
    const seen = new Set<string>()
    return pts.filter(([px, py]) => { const key = `${px}:${py}`; if (seen.has(key)) return false; seen.add(key); return px >= 0 && py >= 0 && px < n && py < n })
  }

  function paintPoint(buffer: Uint8Array, x: number, y: number, value: number) {
    const radius = Math.floor((brushSize - 1) / 2)
    for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
      const bx = x + ox, by = y + oy
      if (bx < 0 || by < 0 || bx >= gridSize || by >= gridSize) continue
      symmetricPoints(bx, by).forEach(([px, py]) => { buffer[py * gridSize + px] = value })
    }
  }

  const paintLine = (buffer: Uint8Array, x0: number, y0: number, x1: number, y1: number, value: number) => linePoints(x0, y0, x1, y1).forEach(([x, y]) => paintPoint(buffer, x, y, value))

  function paintRect(buffer: Uint8Array, x0: number, y0: number, x1: number, y1: number, value: number) {
    const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1)
    for (let x = l; x <= r; x++) { paintPoint(buffer, x, t, value); paintPoint(buffer, x, b, value) }
    for (let y = t; y <= b; y++) { paintPoint(buffer, l, y, value); paintPoint(buffer, r, y, value) }
  }

  function floodFill(x: number, y: number) {
    const before = cellsRef.current, target = before[y * gridSize + x]
    if (target === activeColor) return
    const next = before.slice(), seen = new Uint8Array(next.length), queue: Array<[number, number]> = [[x, y]]
    while (queue.length) {
      const [cx, cy] = queue.pop()!, i = cy * gridSize + cx
      if (seen[i] || next[i] !== target) continue
      seen[i] = 1; next[i] = activeColor
      if (cx) queue.push([cx - 1, cy]); if (cx + 1 < gridSize) queue.push([cx + 1, cy]); if (cy) queue.push([cx, cy - 1]); if (cy + 1 < gridSize) queue.push([cx, cy + 1])
    }
    commit(next, before)
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    const p = pointFromEvent(event), before = cellsRef.current, value = before[p.y * gridSize + p.x]
    if (tool === 'picker') { if (value !== TRANSPARENT && value < palette.length) { setActiveColor(value); setMessage(`Picked ${palette[value]}.`) } return }
    if (tool === 'fill') { floodFill(p.x, p.y); return }
    drawingRef.current = true; changedRef.current = false; startRef.current = { ...p, snapshot: before.slice() }; lastRef.current = p
    if (tool === 'pencil' || tool === 'eraser') {
      const next = before.slice(); paintPoint(next, p.x, p.y, tool === 'eraser' ? TRANSPARENT : activeColor)
      changedRef.current = next.some((v, i) => v !== before[i]); setCellsNow(next)
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || (tool !== 'pencil' && tool !== 'eraser')) return
    event.preventDefault()
    const p = pointFromEvent(event), last = lastRef.current
    if (last && last.x === p.x && last.y === p.y) return
    const next = cellsRef.current.slice(), value = tool === 'eraser' ? TRANSPARENT : activeColor
    if (last) paintLine(next, last.x, last.y, p.x, p.y, value); else paintPoint(next, p.x, p.y, value)
    setCellsNow(next); changedRef.current = true; lastRef.current = p
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault(); if (!drawingRef.current) return
    drawingRef.current = false
    const p = pointFromEvent(event), start = startRef.current
    if (!start) return
    if (tool === 'line' || tool === 'rect') {
      const next = start.snapshot.slice()
      if (tool === 'line') paintLine(next, start.x, start.y, p.x, p.y, activeColor); else paintRect(next, start.x, start.y, p.x, p.y, activeColor)
      commit(next, start.snapshot)
    } else if (changedRef.current) pushUndo(start.snapshot)
    startRef.current = null; lastRef.current = null
  }

  function undo() { if (!undoStack.length) return; const prev = undoStack.at(-1)!; setRedoStack((s) => [...s, cellsRef.current.slice()]); setUndoStack((s) => s.slice(0, -1)); setCellsNow(prev.slice()) }
  function redo() { if (!redoStack.length) return; const next = redoStack.at(-1)!; setUndoStack((s) => [...s, cellsRef.current.slice()]); setRedoStack((s) => s.slice(0, -1)); setCellsNow(next.slice()) }

  function transform(kind: 'flip-x' | 'flip-y' | 'rotate' | 'left' | 'right' | 'up' | 'down') {
    const before = cellsRef.current, next = new Uint8Array(before.length).fill(TRANSPARENT)
    for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
      let nx = x, ny = y
      if (kind === 'flip-x') nx = gridSize - 1 - x; if (kind === 'flip-y') ny = gridSize - 1 - y; if (kind === 'rotate') { nx = gridSize - 1 - y; ny = x }
      if (kind === 'left') nx = mod(x - 1, gridSize); if (kind === 'right') nx = mod(x + 1, gridSize); if (kind === 'up') ny = mod(y - 1, gridSize); if (kind === 'down') ny = mod(y + 1, gridSize)
      next[ny * gridSize + nx] = before[y * gridSize + x]
    }
    commit(next, before)
  }

  function movePhase(dx: number, dy: number) { const before = cellsRef.current; commit(shiftBuffer(before, gridSize, dx, dy), before); setSelectedAll(true); setMessage(`Repeat phase moved X ${dx}, Y ${dy}; wrap keeps it seamless.`) }

  function clearToTransparent() { const before = cellsRef.current; commit(new Uint8Array(before.length).fill(TRANSPARENT), before); setBackgroundMode('transparent'); setDetectedCrop('auto'); setMessage('Canvas cleared to transparent.') }
  function clearGrid() { const before = cellsRef.current; commit(new Uint8Array(before.length).fill(backgroundMode === 'transparent' ? TRANSPARENT : backgroundColor), before); setDetectedCrop('auto') }
  function applySolidBackground() { const before = cellsRef.current, next = before.slice(); next.forEach((v, i) => { if (v === TRANSPARENT) next[i] = backgroundColor }); commit(next, before); setBackgroundMode('solid'); setMessage(`Solid background applied from slot ${backgroundColor + 1}.`) }

  const backgroundValue = () => backgroundMode === 'transparent' ? TRANSPARENT : backgroundColor

  function artCoordinates(buffer: Uint8Array, background: number) {
    const xs: number[] = [], ys: number[] = []
    for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) { const v = buffer[y * gridSize + x]; if (v !== TRANSPARENT && v !== background) { xs.push(x); ys.push(y) } }
    return { xs, ys }
  }

  function bounds(buffer: Uint8Array, background: number): Bounds | null {
    let left: number = gridSize, top: number = gridSize, right = -1, bottom = -1
    for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
      const v = buffer[y * gridSize + x]
      if (v === TRANSPARENT || v === background) continue
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
    }
    return right < left ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
  }

  function autoCenter() {
    const before = cellsRef.current, bg = backgroundValue(), { xs, ys } = artCoordinates(before, bg)
    if (!xs.length) { setMessage('No motif detected. Draw something first or choose the correct background mode.'); return }
    const dx = circularCenterShift(xs, gridSize), dy = circularCenterShift(ys, gridSize), next = shiftBuffer(before, gridSize, dx, dy)
    if (dx || dy) commit(next, before)
    const b = bounds(next, bg); setDetectedCrop(b ? `${b.width}×${b.height}` : 'auto'); setSelectedAll(true)
    setMessage(dx || dy ? `Auto Center moved phase X ${dx}, Y ${dy}.` : 'Artwork is already centered.')
  }

  function applyHex() {
    const colors = (quickHex.match(/#?[0-9a-f]{3,6}/gi) ?? []).map(normalizeHex).filter((v): v is string => Boolean(v)).slice(0, 16)
    if (colors.length < 2) { setMessage('Paste at least 2 valid HEX colors.'); return }
    setPalette(colors); setActiveColor((v) => Math.min(v, colors.length - 1)); setBackgroundColor((v) => Math.min(v, colors.length - 1)); setMessage(`${colors.length} HEX colors loaded.`)
  }

  function currentAsset(): PatternAsset {
    const stamp = new Date().toISOString()
    return { id: 'preview', name: patternName.trim() || 'Pixel Pattern', sourceType: 'grid', createdAt: stamp, updatedAt: stamp, palette: [...palette], grid: { width: gridSize, height: gridSize, cellsBase64: encodeGridCells(cellsRef.current), palette: [...palette], transparentValue: TRANSPARENT }, meta: { symmetry, brushSize, backgroundMode, backgroundColor, exportLongSide } }
  }

  function cropAsset(): PatternAsset | null {
    const before = cellsRef.current, bg = backgroundValue(), coords = artCoordinates(before, bg)
    if (!coords.xs.length) return null
    const centered = shiftBuffer(before, gridSize, circularCenterShift(coords.xs, gridSize), circularCenterShift(coords.ys, gridSize)), b = bounds(centered, bg)
    if (!b) return null
    const cropped = new Uint8Array(b.width * b.height).fill(TRANSPARENT)
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) { const source = centered[(b.y + y) * gridSize + b.x + x]; cropped[y * b.width + x] = removeCropBackground && source === bg ? TRANSPARENT : source }
    setDetectedCrop(`${b.width}×${b.height}`)
    const stamp = new Date().toISOString()
    return { id: 'crop-preview', name: `${patternName.trim() || 'Pixel Pattern'} Crop`, sourceType: 'grid', createdAt: stamp, updatedAt: stamp, palette: [...palette], grid: { width: b.width, height: b.height, cellsBase64: encodeGridCells(cropped), palette: [...palette], transparentValue: TRANSPARENT }, tags: ['pixel-crop', 'motif'], meta: { cropped: true, sourceGrid: `${gridSize}x${gridSize}`, transparentCropBackground: removeCropBackground, exportLongSide } }
  }

  function saveMaster() { const a = currentAsset(); savePatternAsset({ name: a.name, sourceType: 'grid', palette: a.palette, grid: a.grid, meta: a.meta }); setMessage(`${a.name} saved as editable master tile with ${exportLongSide}px SVG output size.`) }
  function saveCrop() { const a = cropAsset(); if (!a) { setMessage('No motif detected to crop.'); return } savePatternAsset({ name: a.name, sourceType: 'grid', palette: a.palette, grid: a.grid, tags: a.tags, meta: a.meta }); setMessage(`${a.name} saved as reusable motif with ${exportLongSide}px long-side SVG output.`) }
  function exportSvg() { const a = currentAsset(); const d = scaledDimensions(gridSize, gridSize, exportLongSide); downloadText(patternAssetToSvg(a), `${slug(a.name)}-${d.width}x${d.height}-seamless.svg`, 'image/svg+xml;charset=utf-8'); setMessage(`Seamless SVG exported at ${d.width}×${d.height}; logical grid remains ${gridSize}×${gridSize}.`) }
  function exportCrop() { const a = cropAsset(); if (!a || !a.grid) { setMessage('No motif detected to crop.'); return } const d = scaledDimensions(a.grid.width, a.grid.height, exportLongSide); downloadText(patternAssetToSvg(a), `${slug(a.name)}-${d.width}x${d.height}-motif.svg`, 'image/svg+xml;charset=utf-8'); setMessage(`Cropped SVG exported at ${d.width}×${d.height} with aspect ratio preserved.`) }
  function exportJson() { const a = currentAsset(); downloadText(exportPatternAssetJson(a), `${slug(a.name)}-${gridSize}x${gridSize}.pattern.json`, 'application/json;charset=utf-8') }

  return <div className="v10-builder-shell v11-pixel-shell v113-pixel-shell v114-pixel-shell">
    <aside className="v10-panel v10-panel-left">
      <section><h2>Grid Size</h2><div className="v11-grid-sizes">{GRID_SIZES.map((s) => <button key={s} className={gridSize === s ? 'active' : ''} onClick={() => setGrid(s)}>{s}×{s}</button>)}</div><small>Grid size controls drawing complexity only. SVG document size is set separately on the right.</small></section>

      <section className="v113-background-section"><h2>Canvas Background</h2><div className="v113-bg-modes"><button className={backgroundMode === 'transparent' ? 'active' : ''} onClick={() => setBackgroundMode('transparent')}>Transparent</button><button className={backgroundMode === 'solid' ? 'active' : ''} onClick={() => setBackgroundMode('solid')}>Solid</button></div><label><span>Solid background slot</span><select value={backgroundColor} onChange={(e) => setBackgroundColor(Number(e.target.value))}>{palette.map((c, i) => <option key={`${c}-${i}`} value={i}>Slot {i + 1} · {c.toUpperCase()}</option>)}</select></label><div className="v113-bg-actions"><button onClick={clearToTransparent}>Clear to Transparent</button><button onClick={applySolidBackground}>Apply Solid Background</button></div><small>Transparent cells stay empty in SVG/JSON and are ideal for motifs reused in other builders.</small></section>

      <section><h2>Drawing Tools</h2><div className="v11-tool-grid">{([['pencil','Pencil'],['eraser','Eraser'],['fill','Fill'],['line','Line'],['rect','Rectangle'],['picker','Picker']] as Array<[Tool,string]>).map(([id,label]) => <button key={id} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setSelectedAll(false); setView('edit') }}>{label}</button>)}</div><label><span>Brush size</span><input type="range" min="1" max="7" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))}/><output>{brushSize}</output></label><label><span>Live symmetry</span><select value={symmetry} onChange={(e) => setSymmetry(e.target.value as Symmetry)}><option value="none">None</option><option value="x">Mirror X</option><option value="y">Mirror Y</option><option value="xy">Mirror X + Y</option><option value="quadrant">4-way Rotation</option></select></label><div className="v11-history-row"><button disabled={!undoStack.length} onClick={undo}>↶ Undo</button><button disabled={!redoStack.length} onClick={redo}>↷ Redo</button></div></section>

      <section><h2>Tile Transform</h2><div className="v11-tool-grid"><button onClick={() => transform('flip-x')}>Flip X</button><button onClick={() => transform('flip-y')}>Flip Y</button><button onClick={() => transform('rotate')}>Rotate 90°</button><button onClick={() => transform('left')}>← Wrap</button><button onClick={() => transform('right')}>Wrap →</button><button onClick={() => transform('up')}>↑ Wrap</button><button onClick={() => transform('down')}>↓ Wrap</button><button className="v09-danger" onClick={clearGrid}>Clear</button></div></section>

      <section className="v113-phase-section"><div className="v10-section-title"><h2>Select / Center / Crop</h2><button className={selectedAll ? 'active' : ''} onClick={() => { setSelectedAll(true); setMessage('Entire tile selected. Use arrows to move the wrapped phase.') }}>Select All</button></div><label><span>Move step</span><input type="range" min="1" max="8" value={moveStep} onChange={(e) => setMoveStep(Number(e.target.value))}/><output>{moveStep}</output></label><div className="v113-nudge"><span/><button onClick={() => movePhase(0,-moveStep)}>↑</button><span/><button onClick={() => movePhase(-moveStep,0)}>←</button><button onClick={() => setSelectedAll(false)}>×</button><button onClick={() => movePhase(moveStep,0)}>→</button><span/><button onClick={() => movePhase(0,moveStep)}>↓</button><span/></div><button className="v10-primary-action" onClick={autoCenter}>Auto Center Artwork</button><div className="v113-crop-readout"><span>BG <b>{backgroundMode === 'transparent' ? 'Transparent' : palette[backgroundColor]}</b></span><span>Crop <b>{detectedCrop}</b></span></div><label className="v10-check"><input type="checkbox" checked={removeCropBackground} onChange={(e) => setRemoveCropBackground(e.target.checked)}/> Remove background in cropped motif</label><button className="v10-wide-button" onClick={saveCrop}>Save Tight Crop to My Patterns</button><button className="v10-wide-button" onClick={exportCrop}>Export Cropped SVG</button></section>

      <section className="v10-cultural-note"><h2>Pattern-first workflow</h2><p>Keep the master tile for seamless editing, then save a tight transparent crop when you need the motif itself elsewhere.</p><button onClick={onOpenLibrary}>Open My Patterns</button></section>
    </aside>

    <main className="v10-center-stage"><div className="v10-stage-head"><div><b>{patternName || 'Untitled Pixel Pattern'}</b><span>{gridSize}×{gridSize} grid · {exportLongSide}px SVG · {usedColors} colors · {backgroundMode} · {tool}</span></div><div className="v10-view-buttons"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Edit Tile</button><button className={view === 'repeat' ? 'active' : ''} onClick={() => setView('repeat')}>Repeat Proof</button></div></div><div className="v10-preview-zone v11-pixel-stage">{view === 'edit' ? <canvas ref={editCanvasRef} className="v11-pixel-canvas v113-interactive-canvas" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={(e) => e.preventDefault()}/> : <canvas ref={repeatCanvasRef} className="v11-repeat-canvas"/>}</div><div className="v10-stage-status"><span>{message}</span><b>{view === 'edit' ? 'MASTER TILE EDITOR' : `${repeatCount}×${repeatCount} REPEAT PROOF`}</b></div></main>

    <aside className="v10-panel v10-panel-right">
      <section><h2>Pattern Palette · up to 16 HEX</h2><textarea className="v10-hex-input v11-pixel-hex" rows={4} value={quickHex} onChange={(e) => setQuickHex(e.target.value)}/><button className="v10-primary-action" onClick={applyHex}>Apply HEX Palette</button><div className="v11-pixel-palette">{palette.map((color,index) => <button key={`${color}-${index}`} className={activeColor === index ? 'active' : ''} onClick={() => setActiveColor(index)}><i style={{background:color}}/><span>{index + 1}</span><input aria-label={`Color ${index + 1}`} type="color" value={color} onClick={(e) => e.stopPropagation()} onChange={(e) => setPalette((p) => p.map((c,i) => i === index ? e.target.value : c))}/></button>)}</div><button className="v10-wide-button" disabled={palette.length >= 16} onClick={() => setPalette((p) => [...p,'#FFFFFF'])}>+ Add Color Slot</button></section>
      <section><h2>Repeat Proof</h2><div className="v11-repeat-buttons">{REPEATS.map((r) => <button key={r} className={repeatCount === r ? 'active' : ''} onClick={() => { setRepeatCount(r); setView('repeat') }}>{r}×{r}</button>)}</div><label className="v10-check"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)}/> Show editor grid lines</label><small>6×6 and 12×12 help reveal unintended seams and rhythm problems.</small></section>
      <section className="v114-export-size"><h2>SVG Output Size</h2><div className="v114-export-presets">{EXPORT_PRESETS.map((size) => <button key={size} className={exportLongSide === size ? 'active' : ''} onClick={() => setExportLongSide(size)}>{size >= 1000 ? `${size / 1000}K` : size}</button>)}</div><label><span>Custom long side</span><input type="number" min="64" max="20000" step="64" value={exportLongSide} onChange={(e) => setExportLongSide(clamp(Math.round(Number(e.target.value) || 4096), 64, 20000))}/></label><div className="v114-output-readout"><span>Master SVG <b>{exportLongSide}×{exportLongSide}</b></span><span>Logical grid <b>{gridSize}×{gridSize}</b></span></div><small>The grid stays small and editable, but exported/saved SVG assets get a practical document size. Cropped motifs preserve their aspect ratio using this value as the long side.</small></section>
      <section><h2>Save Pattern Asset</h2><label><span>Pattern name</span><input value={patternName} onChange={(e) => setPatternName(e.target.value)}/></label><button className="v10-primary-action" onClick={saveMaster}>Save Master to My Patterns</button><button className="v10-wide-button" onClick={onOpenLibrary}>Browse My Pattern Library</button><small>SVG output size is stored with the asset, so Use in Seamless/Layout/Woven receives the larger SVG automatically.</small></section>
      <section><h2>Export</h2><button className="v10-primary-action" onClick={exportSvg}>Export Seamless SVG · {exportLongSide}px</button><button className="v10-wide-button" onClick={exportJson}>Export Editable Pattern JSON</button></section>
      <section><h2>Other Builder</h2><button className="v10-wide-button" onClick={onOpenWoven}>Open Woven / Textile</button></section>
    </aside>
  </div>
}
