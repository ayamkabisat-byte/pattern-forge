import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  consumePendingPattern,
  decodeGridCells,
  encodeGridCells,
  exportPatternAssetJson,
  patternAssetToSvg,
  savePatternAsset,
  type PatternAsset,
} from '../patternLibrary'

type GridSize = 8 | 16 | 32 | 64 | 128 | 256
type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'picker'
type Symmetry = 'none' | 'x' | 'y' | 'xy' | 'quadrant'
type RepeatCount = 1 | 2 | 3 | 6 | 12
type BackgroundMode = 'transparent' | 'solid'
type CropBounds = { x: number; y: number; width: number; height: number }

type Props = {
  onOpenLibrary: () => void
  onOpenWoven: () => void
}

const GRID_SIZES: GridSize[] = [8, 16, 32, 64, 128, 256]
const REPEATS: RepeatCount[] = [1, 2, 3, 6, 12]
const DEFAULT_PALETTE = ['#15241F', '#D4B15A', '#7E2637', '#E9DEC7', '#2F5A4A', '#B9673B', '#27211C', '#F2EEE4']
const MAX_HISTORY = 35
const TRANSPARENT = 255

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function modulo(value: number, size: number) {
  return ((value % size) + size) % size
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

function normalizeHex(value: string) {
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const raw = v.slice(1)
    return `#${raw.split('').map((char) => char + char).join('').toUpperCase()}`
  }
  return null
}

function bresenham(x0: number, y0: number, x1: number, y1: number) {
  const points: Array<[number, number]> = []
  const dx = Math.abs(x1 - x0)
  const sx = x0 < x1 ? 1 : -1
  const dy = -Math.abs(y1 - y0)
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  while (true) {
    points.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
  return points
}

function nameSlug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pixel-pattern'
}

function dominantValue(cells: Uint8Array) {
  const counts = new Map<number, number>()
  cells.forEach((value) => {
    if (value !== TRANSPARENT) counts.set(value, (counts.get(value) ?? 0) + 1)
  })
  let bestValue = TRANSPARENT
  let bestCount = -1
  counts.forEach((count, value) => {
    if (count > bestCount) { bestCount = count; bestValue = value }
  })
  return bestValue
}

function circularCenterShift(values: number[], size: number) {
  const unique = Array.from(new Set(values)).sort((a, b) => a - b)
  if (!unique.length || unique.length >= size) return 0
  let largestGap = -1
  let intervalStart = unique[0]
  for (let index = 0; index < unique.length; index++) {
    const current = unique[index]
    const next = unique[(index + 1) % unique.length]
    const gap = modulo(next - current, size) || size
    if (gap > largestGap) {
      largestGap = gap
      intervalStart = next
    }
  }
  const span = size - largestGap + 1
  const currentCenter = modulo(intervalStart + (span - 1) / 2, size)
  const targetCenter = (size - 1) / 2
  let shift = Math.round(targetCenter - currentCenter)
  while (shift > size / 2) shift -= size
  while (shift < -size / 2) shift += size
  return shift
}

function shiftCells(cells: Uint8Array, size: number, dx: number, dy: number) {
  const next = new Uint8Array(cells.length).fill(TRANSPARENT)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = modulo(x + dx, size)
      const ny = modulo(y + dy, size)
      next[ny * size + nx] = cells[y * size + x]
    }
  }
  return next
}

export default function PixelPatternBuilder({ onOpenLibrary, onOpenWoven }: Props) {
  const [gridSize, setGridSize] = useState<GridSize>(32)
  const [cells, setCells] = useState<Uint8Array>(() => new Uint8Array(32 * 32).fill(TRANSPARENT))
  const cellsRef = useRef(cells)
  const [palette, setPalette] = useState<string[]>([...DEFAULT_PALETTE])
  const [quickHex, setQuickHex] = useState(DEFAULT_PALETTE.join(', '))
  const [activeColor, setActiveColor] = useState(1)
  const [tool, setTool] = useState<Tool>('pencil')
  const [symmetry, setSymmetry] = useState<Symmetry>('none')
  const [brushSize, setBrushSize] = useState(1)
  const [repeatCount, setRepeatCount] = useState<RepeatCount>(3)
  const [view, setView] = useState<'edit' | 'repeat'>('edit')
  const [showGrid, setShowGrid] = useState(true)
  const [patternName, setPatternName] = useState('Pixel Pattern 01')
  const [message, setMessage] = useState('Transparent master tile ready. Draw a motif, then check 3×3, 6×6 or 12×12 Repeat Proof.')
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([])
  const [redoStack, setRedoStack] = useState<Uint8Array[]>([])
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('transparent')
  const [backgroundColor, setBackgroundColor] = useState(0)
  const [selectedAll, setSelectedAll] = useState(false)
  const [moveStep, setMoveStep] = useState(1)
  const [transparentCropBackground, setTransparentCropBackground] = useState(true)
  const [detectedCrop, setDetectedCrop] = useState<string>('auto')
  const editCanvasRef = useRef<HTMLCanvasElement>(null)
  const repeatCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const changedRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; snapshot: Uint8Array } | null>(null)
  const lastCellRef = useRef<{ x: number; y: number } | null>(null)

  function updateCells(next: Uint8Array) {
    cellsRef.current = next
    setCells(next)
  }

  const usedColors = useMemo(() => {
    const set = new Set<number>()
    cells.forEach((value) => { if (value !== TRANSPARENT) set.add(value) })
    return set
  }, [cells])

  useEffect(() => {
    cellsRef.current = cells
  }, [cells])

  useEffect(() => {
    const pending = consumePendingPattern('pixel')
    if (!pending?.grid) return
    const width = pending.grid.width as GridSize
    if (!GRID_SIZES.includes(width) || pending.grid.width !== pending.grid.height) {
      setMessage('This saved grid cannot be edited here because it is not a supported square Pixel grid.')
      return
    }
    const loaded = decodeGridCells(pending.grid.cellsBase64, width * width)
    const hasTransparency = loaded.some((value) => value === TRANSPARENT)
    const inferredBackground = dominantValue(loaded)
    setGridSize(width)
    updateCells(loaded)
    setPalette([...pending.grid.palette])
    setQuickHex(pending.grid.palette.join(', '))
    setPatternName(pending.name)
    setBackgroundMode(hasTransparency ? 'transparent' : 'solid')
    if (inferredBackground !== TRANSPARENT) setBackgroundColor(Math.min(inferredBackground, pending.grid.palette.length - 1))
    setUndoStack([])
    setRedoStack([])
    setMessage(`${pending.name} loaded from My Pattern Library.`)
  }, [])

  useEffect(() => { drawEditor() }, [cells, gridSize, palette, showGrid])
  useEffect(() => { drawRepeat() }, [cells, gridSize, palette, repeatCount])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelectedAll(true)
        setMessage('Entire tile selected. Arrow keys move the repeat phase with wrap.')
        return
      }
      if (!selectedAll) return
      const step = event.shiftKey ? Math.max(4, moveStep) : moveStep
      if (event.key === 'ArrowLeft') { event.preventDefault(); movePhase(-step, 0) }
      if (event.key === 'ArrowRight') { event.preventDefault(); movePhase(step, 0) }
      if (event.key === 'ArrowUp') { event.preventDefault(); movePhase(0, -step) }
      if (event.key === 'ArrowDown') { event.preventDefault(); movePhase(0, step) }
      if (event.key === 'Escape') setSelectedAll(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedAll, moveStep, gridSize])

  function pushUndo(snapshot: Uint8Array) {
    setUndoStack((current) => [...current.slice(-(MAX_HISTORY - 1)), snapshot])
    setRedoStack([])
  }

  function commitCells(next: Uint8Array, snapshot?: Uint8Array) {
    const before = snapshot ?? cellsRef.current
    if (next.every((value, index) => value === before[index])) return
    pushUndo(before.slice())
    updateCells(next)
  }

  function setGrid(nextSize: GridSize) {
    if (nextSize === gridSize) return
    const fill = backgroundMode === 'transparent' ? TRANSPARENT : backgroundColor
    const next = new Uint8Array(nextSize * nextSize).fill(fill)
    const current = cellsRef.current
    const copy = Math.min(gridSize, nextSize)
    for (let y = 0; y < copy; y++) for (let x = 0; x < copy; x++) next[y * nextSize + x] = current[y * gridSize + x]
    setGridSize(nextSize)
    updateCells(next)
    setUndoStack([])
    setRedoStack([])
    setSelectedAll(false)
    setMessage(`Grid changed to ${nextSize}×${nextSize}. Existing artwork was preserved from the top-left area.`)
  }

  function drawEditor() {
    const canvas = editCanvasRef.current
    if (!canvas) return
    const size = 896
    if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const cellSize = size / gridSize
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = cells[y * gridSize + x]
        if (value === TRANSPARENT || !palette[value]) continue
        ctx.fillStyle = palette[value]
        ctx.fillRect(x * cellSize, y * cellSize, Math.ceil(cellSize + 0.5), Math.ceil(cellSize + 0.5))
      }
    }
    if (showGrid && cellSize >= 3.5) {
      ctx.strokeStyle = 'rgba(20,24,30,.32)'
      ctx.lineWidth = cellSize >= 18 ? 1 : 0.55
      ctx.beginPath()
      for (let i = 0; i <= gridSize; i++) {
        const p = Math.round(i * cellSize) + 0.5
        ctx.moveTo(p, 0); ctx.lineTo(p, size)
        ctx.moveTo(0, p); ctx.lineTo(size, p)
      }
      ctx.stroke()
    }
  }

  function drawTileToContext(ctx: CanvasRenderingContext2D, x0: number, y0: number, tileSize: number) {
    const cellSize = tileSize / gridSize
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = cells[y * gridSize + x]
        if (value === TRANSPARENT || !palette[value]) continue
        ctx.fillStyle = palette[value]
        ctx.fillRect(x0 + x * cellSize, y0 + y * cellSize, Math.ceil(cellSize + 0.4), Math.ceil(cellSize + 0.4))
      }
    }
  }

  function drawRepeat() {
    const canvas = repeatCanvasRef.current
    if (!canvas) return
    const size = 900
    if (canvas.width !== size || canvas.height !== size) { canvas.width = size; canvas.height = size }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    const tileSize = size / repeatCount
    for (let row = 0; row < repeatCount; row++) for (let col = 0; col < repeatCount; col++) drawTileToContext(ctx, col * tileSize, row * tileSize, tileSize)
  }

  function canvasCell(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp(Math.floor((event.clientX - rect.left) / rect.width * gridSize), 0, gridSize - 1),
      y: clamp(Math.floor((event.clientY - rect.top) / rect.height * gridSize), 0, gridSize - 1),
    }
  }

  function symmetryPoints(x: number, y: number) {
    const n = gridSize
    const points: Array<[number, number]> = [[x, y]]
    if (symmetry === 'x' || symmetry === 'xy') points.push([n - 1 - x, y])
    if (symmetry === 'y' || symmetry === 'xy') points.push([x, n - 1 - y])
    if (symmetry === 'xy') points.push([n - 1 - x, n - 1 - y])
    if (symmetry === 'quadrant') points.push([n - 1 - y, x], [n - 1 - x, n - 1 - y], [y, n - 1 - x])
    const seen = new Set<string>()
    return points.filter(([px, py]) => {
      const key = `${px}-${py}`
      if (seen.has(key)) return false
      seen.add(key)
      return px >= 0 && py >= 0 && px < n && py < n
    })
  }

  function paintPoint(buffer: Uint8Array, x: number, y: number, value: number) {
    const radius = Math.max(0, Math.floor((brushSize - 1) / 2))
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        const bx = x + ox
        const by = y + oy
        if (bx < 0 || by < 0 || bx >= gridSize || by >= gridSize) continue
        symmetryPoints(bx, by).forEach(([px, py]) => { buffer[py * gridSize + px] = value })
      }
    }
  }

  function paintLine(buffer: Uint8Array, x0: number, y0: number, x1: number, y1: number, value: number) {
    bresenham(x0, y0, x1, y1).forEach(([x, y]) => paintPoint(buffer, x, y, value))
  }

  function paintRect(buffer: Uint8Array, x0: number, y0: number, x1: number, y1: number, value: number) {
    const left = Math.min(x0, x1)
    const right = Math.max(x0, x1)
    const top = Math.min(y0, y1)
    const bottom = Math.max(y0, y1)
    for (let x = left; x <= right; x++) { paintPoint(buffer, x, top, value); paintPoint(buffer, x, bottom, value) }
    for (let y = top; y <= bottom; y++) { paintPoint(buffer, left, y, value); paintPoint(buffer, right, y, value) }
  }

  function floodFill(x: number, y: number, value: number) {
    const current = cellsRef.current
    const index = y * gridSize + x
    const target = current[index]
    if (target === value) return
    const next = current.slice()
    const queue: Array<[number, number]> = [[x, y]]
    const seen = new Uint8Array(gridSize * gridSize)
    while (queue.length) {
      const [cx, cy] = queue.pop()!
      const ci = cy * gridSize + cx
      if (seen[ci] || next[ci] !== target) continue
      seen[ci] = 1
      next[ci] = value
      if (cx > 0) queue.push([cx - 1, cy])
      if (cx + 1 < gridSize) queue.push([cx + 1, cy])
      if (cy > 0) queue.push([cx, cy - 1])
      if (cy + 1 < gridSize) queue.push([cx, cy + 1])
    }
    commitCells(next, current)
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = canvasCell(event)
    const current = cellsRef.current
    const index = point.y * gridSize + point.x
    if (tool === 'picker') {
      const value = current[index]
      if (value !== TRANSPARENT && value < palette.length) {
        setActiveColor(value)
        setMessage(`Picked ${palette[value]}.`)
      } else {
        setMessage('Transparent cell picked. Choose a palette color to draw.')
      }
      return
    }
    if (tool === 'fill') {
      floodFill(point.x, point.y, activeColor)
      return
    }
    drawingRef.current = true
    changedRef.current = false
    startRef.current = { ...point, snapshot: current.slice() }
    lastCellRef.current = point
    if (tool === 'pencil' || tool === 'eraser') {
      const next = current.slice()
      paintPoint(next, point.x, point.y, tool === 'eraser' ? TRANSPARENT : activeColor)
      changedRef.current = next.some((value, i) => value !== current[i])
      updateCells(next)
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || (tool !== 'pencil' && tool !== 'eraser')) return
    event.preventDefault()
    const point = canvasCell(event)
    const last = lastCellRef.current
    if (last && last.x === point.x && last.y === point.y) return
    const next = cellsRef.current.slice()
    if (last) paintLine(next, last.x, last.y, point.x, point.y, tool === 'eraser' ? TRANSPARENT : activeColor)
    else paintPoint(next, point.x, point.y, tool === 'eraser' ? TRANSPARENT : activeColor)
    updateCells(next)
    changedRef.current = true
    lastCellRef.current = point
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    if (!drawingRef.current) return
    drawingRef.current = false
    const point = canvasCell(event)
    const start = startRef.current
    if (!start) return
    if (tool === 'line' || tool === 'rect') {
      const next = start.snapshot.slice()
      if (tool === 'line') paintLine(next, start.x, start.y, point.x, point.y, activeColor)
      else paintRect(next, start.x, start.y, point.x, point.y, activeColor)
      commitCells(next, start.snapshot)
    } else if (changedRef.current) {
      pushUndo(start.snapshot)
    }
    startRef.current = null
    lastCellRef.current = null
  }

  function undo() {
    if (!undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    setRedoStack((current) => [...current, cellsRef.current.slice()])
    setUndoStack((current) => current.slice(0, -1))
    updateCells(previous.slice())
  }

  function redo() {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((current) => [...current, cellsRef.current.slice()])
    setRedoStack((current) => current.slice(0, -1))
    updateCells(next.slice())
  }

  function transform(kind: 'flip-x' | 'flip-y' | 'rotate' | 'shift-left' | 'shift-right' | 'shift-up' | 'shift-down') {
    const current = cellsRef.current
    const next = new Uint8Array(current.length).fill(TRANSPARENT)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let nx = x
        let ny = y
        if (kind === 'flip-x') nx = gridSize - 1 - x
        if (kind === 'flip-y') ny = gridSize - 1 - y
        if (kind === 'rotate') { nx = gridSize - 1 - y; ny = x }
        if (kind === 'shift-left') nx = modulo(x - 1, gridSize)
        if (kind === 'shift-right') nx = modulo(x + 1, gridSize)
        if (kind === 'shift-up') ny = modulo(y - 1, gridSize)
        if (kind === 'shift-down') ny = modulo(y + 1, gridSize)
        next[ny * gridSize + nx] = current[y * gridSize + x]
      }
    }
    commitCells(next, current)
  }

  function movePhase(dx: number, dy: number) {
    const current = cellsRef.current
    const next = shiftCells(current, gridSize, dx, dy)
    commitCells(next, current)
    setSelectedAll(true)
    setMessage(`Repeat phase moved X ${dx}, Y ${dy}. Edge wrap preserves seamlessness.`)
  }

  function clearGrid() {
    const fill = backgroundMode === 'transparent' ? TRANSPARENT : backgroundColor
    commitCells(new Uint8Array(gridSize * gridSize).fill(fill), cellsRef.current)
    setDetectedCrop('auto')
  }

  function clearToTransparent() {
    const current = cellsRef.current
    commitCells(new Uint8Array(gridSize * gridSize).fill(TRANSPARENT), current)
    setBackgroundMode('transparent')
    setSelectedAll(false)
    setDetectedCrop('auto')
    setMessage('Canvas cleared to transparent. Draw the motif directly over the checkerboard.')
  }

  function applySolidBackground() {
    const current = cellsRef.current
    const next = current.slice()
    for (let index = 0; index < next.length; index++) if (next[index] === TRANSPARENT) next[index] = backgroundColor
    commitCells(next, current)
    setBackgroundMode('solid')
    setMessage(`Solid background applied from palette slot ${backgroundColor + 1}. Existing artwork was preserved.`)
  }

  function backgroundValue() {
    if (backgroundMode === 'transparent') return TRANSPARENT
    if (backgroundColor < palette.length) return backgroundColor
    return dominantValue(cellsRef.current)
  }

  function artworkCoordinates(buffer: Uint8Array, background: number) {
    const xs: number[] = []
    const ys: number[] = []
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = buffer[y * gridSize + x]
        if (value === TRANSPARENT || value === background) continue
        xs.push(x)
        ys.push(y)
      }
    }
    return { xs, ys }
  }

  function cropBounds(buffer: Uint8Array, background: number): CropBounds | null {
    let left = gridSize
    let top = gridSize
    let right = -1
    let bottom = -1
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = buffer[y * gridSize + x]
        if (value === TRANSPARENT || value === background) continue
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
    if (right < left || bottom < top) return null
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
  }

  function autoCenter() {
    const current = cellsRef.current
    const background = backgroundValue()
    const { xs, ys } = artworkCoordinates(current, background)
    if (!xs.length) {
      setMessage('No motif detected. Add artwork first, or choose the correct background mode.')
      return
    }
    const dx = circularCenterShift(xs, gridSize)
    const dy = circularCenterShift(ys, gridSize)
    const next = shiftCells(current, gridSize, dx, dy)
    if (dx || dy) commitCells(next, current)
    const bounds = cropBounds(next, background)
    setSelectedAll(true)
    setDetectedCrop(bounds ? `${bounds.width}×${bounds.height}` : 'auto')
    setMessage(dx || dy ? `Auto Center moved the repeat phase X ${dx}, Y ${dy}. Seamless repeat is unchanged.` : 'Artwork is already centered in its shortest wrapped span.')
  }

  function applyHex() {
    const matches = quickHex.match(/#?[0-9a-f]{3,6}/gi) ?? []
    const colors = matches.map(normalizeHex).filter((entry): entry is string => Boolean(entry)).slice(0, 16)
    if (colors.length < 2) { setMessage('Paste at least 2 valid HEX colors. Pixel Pattern supports up to 16 palette slots.'); return }
    setPalette(colors)
    setActiveColor((current) => Math.min(current, colors.length - 1))
    setBackgroundColor((current) => Math.min(current, colors.length - 1))
    setMessage(`${colors.length} HEX colors loaded. Pick a slot and draw.`)
  }

  function setPaletteColor(index: number, value: string) {
    setPalette((current) => current.map((color, i) => i === index ? value : color))
  }

  function addColor() {
    if (palette.length >= 16) return
    setPalette((current) => [...current, '#FFFFFF'])
  }

  function currentAsset(): PatternAsset {
    return {
      id: 'preview',
      name: patternName.trim() || 'Pixel Pattern',
      sourceType: 'grid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      palette: [...palette],
      grid: {
        width: gridSize,
        height: gridSize,
        cellsBase64: encodeGridCells(cellsRef.current),
        palette: [...palette],
        transparentValue: TRANSPARENT,
      },
      meta: { symmetry, brushSize, backgroundMode, backgroundColor },
    }
  }

  function buildCropAsset(): PatternAsset | null {
    const current = cellsRef.current
    const background = backgroundValue()
    const coords = artworkCoordinates(current, background)
    if (!coords.xs.length) return null
    const dx = circularCenterShift(coords.xs, gridSize)
    const dy = circularCenterShift(coords.ys, gridSize)
    const centered = shiftCells(current, gridSize, dx, dy)
    const bounds = cropBounds(centered, background)
    if (!bounds) return null
    const cropped = new Uint8Array(bounds.width * bounds.height).fill(TRANSPARENT)
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const source = centered[(bounds.y + y) * gridSize + bounds.x + x]
        cropped[y * bounds.width + x] = transparentCropBackground && source === background ? TRANSPARENT : source
      }
    }
    setDetectedCrop(`${bounds.width}×${bounds.height}`)
    const stamp = new Date().toISOString()
    return {
      id: 'crop-preview',
      name: `${patternName.trim() || 'Pixel Pattern'} Crop`,
      sourceType: 'grid',
      createdAt: stamp,
      updatedAt: stamp,
      palette: [...palette],
      grid: {
        width: bounds.width,
        height: bounds.height,
        cellsBase64: encodeGridCells(cropped),
        palette: [...palette],
        transparentValue: TRANSPARENT,
      },
      tags: ['pixel-crop', 'motif'],
      meta: { cropped: true, sourceGrid: `${gridSize}x${gridSize}`, transparentCropBackground },
    }
  }

  function saveLibrary() {
    try {
      const asset = currentAsset()
      savePatternAsset({ name: asset.name, sourceType: 'grid', palette: asset.palette, grid: asset.grid, meta: asset.meta })
      setMessage(`${asset.name} saved as editable master tile in My Patterns.`)
    } catch {
      setMessage('Could not save to browser library. Export JSON as a backup.')
    }
  }

  function saveCrop() {
    try {
      const asset = buildCropAsset()
      if (!asset) { setMessage('No motif detected to crop.'); return }
      savePatternAsset({ name: asset.name, sourceType: 'grid', palette: asset.palette, grid: asset.grid, tags: asset.tags, meta: asset.meta })
      setMessage(`${asset.name} saved as a tight reusable motif for Seamless, Layout Guides and Woven.`)
    } catch {
      setMessage('Could not save cropped motif to My Patterns.')
    }
  }

  function exportSvg() {
    const asset = currentAsset()
    downloadText(patternAssetToSvg(asset), `${nameSlug(asset.name)}-${gridSize}x${gridSize}-seamless.svg`, 'image/svg+xml;charset=utf-8')
  }

  function exportCrop() {
    const asset = buildCropAsset()
    if (!asset) { setMessage('No motif detected to crop.'); return }
    downloadText(patternAssetToSvg(asset), `${nameSlug(asset.name)}-${asset.grid?.width}x${asset.grid?.height}-motif.svg`, 'image/svg+xml;charset=utf-8')
    setMessage(`Cropped motif SVG exported at ${asset.grid?.width}×${asset.grid?.height} cells.`)
  }

  function exportJson() {
    const asset = currentAsset()
    downloadText(exportPatternAssetJson(asset), `${nameSlug(asset.name)}-${gridSize}x${gridSize}.pattern.json`, 'application/json;charset=utf-8')
  }

  return (
    <div className="v10-builder-shell v11-pixel-shell v113-pixel-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>Grid Size</h2>
          <div className="v11-grid-sizes">{GRID_SIZES.map((size) => <button key={size} className={gridSize === size ? 'active' : ''} onClick={() => setGrid(size)}>{size}×{size}</button>)}</div>
          <small>8–32 for bold pixel motifs; 64–256 for more complex geometric work.</small>
        </section>

        <section className="v113-background-section">
          <h2>Canvas Background</h2>
          <div className="v113-bg-modes">
            <button className={backgroundMode === 'transparent' ? 'active' : ''} onClick={() => setBackgroundMode('transparent')}>Transparent</button>
            <button className={backgroundMode === 'solid' ? 'active' : ''} onClick={() => setBackgroundMode('solid')}>Solid</button>
          </div>
          <label><span>Solid background slot</span><select value={backgroundColor} onChange={(event) => setBackgroundColor(Number(event.target.value))}>{palette.map((color, index) => <option key={`${color}-${index}`} value={index}>Slot {index + 1} · {color.toUpperCase()}</option>)}</select></label>
          <div className="v113-bg-actions"><button onClick={clearToTransparent}>Clear to Transparent</button><button onClick={applySolidBackground}>Apply Solid Background</button></div>
          <small>Transparent mode leaves empty cells clear, so the motif can be reused directly in other PatternForge builders.</small>
        </section>

        <section>
          <h2>Drawing Tools</h2>
          <div className="v11-tool-grid">
            {([['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['line', 'Line'], ['rect', 'Rectangle'], ['picker', 'Picker']] as Array<[Tool, string]>).map(([id, label]) => <button key={id} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setSelectedAll(false); setView('edit') }}>{label}</button>)}
          </div>
          <label><span>Brush size</span><input type="range" min="1" max="7" step="1" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><output>{brushSize}</output></label>
          <label><span>Live symmetry</span><select value={symmetry} onChange={(event) => setSymmetry(event.target.value as Symmetry)}><option value="none">None</option><option value="x">Mirror X</option><option value="y">Mirror Y</option><option value="xy">Mirror X + Y</option><option value="quadrant">4-way Rotation</option></select></label>
          <div className="v11-history-row"><button disabled={!undoStack.length} onClick={undo}>↶ Undo</button><button disabled={!redoStack.length} onClick={redo}>↷ Redo</button></div>
        </section>

        <section>
          <h2>Tile Transform</h2>
          <div className="v11-tool-grid"><button onClick={() => transform('flip-x')}>Flip X</button><button onClick={() => transform('flip-y')}>Flip Y</button><button onClick={() => transform('rotate')}>Rotate 90°</button><button onClick={() => transform('shift-left')}>← Wrap</button><button onClick={() => transform('shift-right')}>Wrap →</button><button onClick={() => transform('shift-up')}>↑ Wrap</button><button onClick={() => transform('shift-down')}>↓ Wrap</button><button className="v09-danger" onClick={clearGrid}>Clear</button></div>
        </section>

        <section className="v113-phase-section">
          <div className="v10-section-title"><h2>Select / Center / Crop</h2><button className={selectedAll ? 'active' : ''} onClick={() => { setSelectedAll(true); setMessage('Entire tile selected. Use arrows or keyboard arrows to move the wrapped phase.') }}>Select All</button></div>
          <label><span>Move step</span><input type="range" min="1" max="8" step="1" value={moveStep} onChange={(event) => setMoveStep(Number(event.target.value))} /><output>{moveStep}</output></label>
          <div className="v113-nudge"><span /><button onClick={() => movePhase(0, -moveStep)}>↑</button><span /><button onClick={() => movePhase(-moveStep, 0)}>←</button><button onClick={() => setSelectedAll(false)}>×</button><button onClick={() => movePhase(moveStep, 0)}>→</button><span /><button onClick={() => movePhase(0, moveStep)}>↓</button><span /></div>
          <button className="v10-primary-action" onClick={autoCenter}>Auto Center Artwork</button>
          <div className="v113-crop-readout"><span>BG <b>{backgroundMode === 'transparent' ? 'Transparent' : palette[backgroundColor] ?? 'Auto'}</b></span><span>Crop <b>{detectedCrop}</b></span></div>
          <label className="v10-check"><input type="checkbox" checked={transparentCropBackground} onChange={(event) => setTransparentCropBackground(event.target.checked)} /> Remove background in cropped motif</label>
          <button className="v10-wide-button" onClick={saveCrop}>Save Tight Crop to My Patterns</button>
          <button className="v10-wide-button" onClick={exportCrop}>Export Cropped SVG</button>
        </section>

        <section className="v10-cultural-note">
          <h2>Pattern-first workflow</h2>
          <p>Keep the master tile for seamless editing, then save a tight transparent crop when you want the motif itself for another builder.</p>
          <button onClick={onOpenLibrary}>Open My Patterns</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{patternName || 'Untitled Pixel Pattern'}</b><span>{gridSize}×{gridSize} master grid · {usedColors.size} colors used · {backgroundMode} background · {tool}</span></div>
          <div className="v10-view-buttons"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Edit Tile</button><button className={view === 'repeat' ? 'active' : ''} onClick={() => setView('repeat')}>Repeat Proof</button></div>
        </div>
        <div className="v10-preview-zone v11-pixel-stage">
          {view === 'edit' ? <canvas ref={editCanvasRef} className="v11-pixel-canvas v113-interactive-canvas" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={(event) => event.preventDefault()} /> : <canvas ref={repeatCanvasRef} className="v11-repeat-canvas" />}
        </div>
        <div className="v10-stage-status"><span>{message}</span><b>{view === 'edit' ? 'MASTER TILE EDITOR' : `${repeatCount}×${repeatCount} REPEAT PROOF`}</b></div>
      </main>

      <aside className="v10-panel v10-panel-right">
        <section>
          <h2>Pattern Palette · up to 16 HEX</h2>
          <textarea className="v10-hex-input v11-pixel-hex" rows={4} value={quickHex} onChange={(event) => setQuickHex(event.target.value)} placeholder="#15241F, #D4B15A, #7E2637..." />
          <button className="v10-primary-action" onClick={applyHex}>Apply HEX Palette</button>
          <div className="v11-pixel-palette">
            {palette.map((color, index) => <button key={`${color}-${index}`} className={activeColor === index ? 'active' : ''} onClick={() => setActiveColor(index)} title={`Slot ${index + 1}: ${color}`}><i style={{ background: color }} /><span>{index + 1}</span><input aria-label={`Color ${index + 1}`} type="color" value={color} onClick={(event) => event.stopPropagation()} onChange={(event) => setPaletteColor(index, event.target.value)} /></button>)}
          </div>
          <button className="v10-wide-button" disabled={palette.length >= 16} onClick={addColor}>+ Add Color Slot</button>
        </section>

        <section>
          <h2>Repeat Proof</h2>
          <div className="v11-repeat-buttons">{REPEATS.map((repeat) => <button key={repeat} className={repeatCount === repeat ? 'active' : ''} onClick={() => { setRepeatCount(repeat); setView('repeat') }}>{repeat}×{repeat}</button>)}</div>
          <label className="v10-check"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> Show editor grid lines</label>
          <small>6×6 and 12×12 help reveal unintended seams, clusters and rhythm problems.</small>
        </section>

        <section>
          <h2>Save Pattern Asset</h2>
          <label><span>Pattern name</span><input value={patternName} onChange={(event) => setPatternName(event.target.value)} /></label>
          <button className="v10-primary-action" onClick={saveLibrary}>Save Master to My Patterns</button>
          <button className="v10-wide-button" onClick={onOpenLibrary}>Browse My Pattern Library</button>
          <small>Master grid stays editable. Cropped motifs are saved separately for reuse in other builders.</small>
        </section>

        <section>
          <h2>Export</h2>
          <button className="v10-primary-action" onClick={exportSvg}>Export Seamless SVG</button>
          <button className="v10-wide-button" onClick={exportJson}>Export Editable Pattern JSON</button>
        </section>

        <section>
          <h2>Other Builder</h2>
          <button className="v10-wide-button" onClick={onOpenWoven}>Open Woven / Textile</button>
        </section>
      </aside>
    </div>
  )
}
