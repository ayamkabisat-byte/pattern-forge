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
type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'picker' | 'select'
type Symmetry = 'none' | 'x' | 'y' | 'xy' | 'quadrant'
type RepeatCount = 1 | 2 | 3 | 6 | 12
type Selection = { x: number; y: number; width: number; height: number }

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

function selectionFromPoints(x0: number, y0: number, x1: number, y1: number): Selection {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  return { x, y, width: Math.abs(x1 - x0) + 1, height: Math.abs(y1 - y0) + 1 }
}

export default function PixelPatternBuilderV111({ onOpenLibrary, onOpenWoven }: Props) {
  const [gridSize, setGridSize] = useState<GridSize>(32)
  const [cells, setCells] = useState<Uint8Array>(() => new Uint8Array(32 * 32).fill(0))
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
  const [message, setMessage] = useState('Draw one master tile. Use Select / Auto Center to choose the best repeat phase, then crop a reusable motif when needed.')
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([])
  const [redoStack, setRedoStack] = useState<Uint8Array[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [moveStep, setMoveStep] = useState(1)
  const [trimBackground, setTrimBackground] = useState('auto')
  const [transparentCropBackground, setTransparentCropBackground] = useState(true)
  const editCanvasRef = useRef<HTMLCanvasElement>(null)
  const repeatCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const changedRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; snapshot: Uint8Array } | null>(null)
  const lastCellRef = useRef<{ x: number; y: number } | null>(null)
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null)

  const usedColors = useMemo(() => {
    const set = new Set<number>()
    cells.forEach((value) => { if (value !== TRANSPARENT) set.add(value) })
    return set
  }, [cells])

  useEffect(() => {
    const pending = consumePendingPattern('pixel')
    if (!pending?.grid) return
    const width = pending.grid.width as GridSize
    if (!GRID_SIZES.includes(width) || pending.grid.width !== pending.grid.height) {
      setMessage('This saved grid is a cropped/rectangular asset. Use it in Seamless, Layout or Woven; Pixel editing currently uses the standard square grids.')
      return
    }
    setGridSize(width)
    setCells(decodeGridCells(pending.grid.cellsBase64, width * width))
    setPalette([...pending.grid.palette])
    setQuickHex(pending.grid.palette.join(', '))
    setPatternName(pending.name)
    setUndoStack([])
    setRedoStack([])
    setSelection(null)
    setMessage(`${pending.name} loaded from My Pattern Library.`)
  }, [])

  useEffect(() => {
    drawEditor()
  }, [cells, gridSize, palette, showGrid, selection])

  useEffect(() => {
    drawRepeat()
  }, [cells, gridSize, palette, repeatCount])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAll()
        return
      }
      if (event.key === 'Escape') {
        setSelection(null)
        return
      }
      if (!selection) return
      const step = event.shiftKey ? Math.max(4, moveStep) : moveStep
      if (event.key === 'ArrowLeft') { event.preventDefault(); moveSelectionBy(-step, 0) }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveSelectionBy(step, 0) }
      if (event.key === 'ArrowUp') { event.preventDefault(); moveSelectionBy(0, -step) }
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSelectionBy(0, step) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection, cells, gridSize, moveStep, trimBackground, palette])

  function pushUndo(snapshot: Uint8Array) {
    setUndoStack((current) => [...current.slice(-(MAX_HISTORY - 1)), snapshot])
    setRedoStack([])
  }

  function commitCells(next: Uint8Array, snapshot?: Uint8Array) {
    const before = snapshot ?? cells
    if (next.length === before.length && next.every((value, index) => value === before[index])) return
    pushUndo(before.slice())
    setCells(next)
  }

  function setGrid(nextSize: GridSize) {
    if (nextSize === gridSize) return
    const next = new Uint8Array(nextSize * nextSize).fill(0)
    const copy = Math.min(gridSize, nextSize)
    for (let y = 0; y < copy; y++) for (let x = 0; x < copy; x++) next[y * nextSize + x] = cells[y * gridSize + x]
    setGridSize(nextSize)
    setCells(next)
    setUndoStack([])
    setRedoStack([])
    setSelection(null)
    setMessage(`Grid changed to ${nextSize}×${nextSize}. Existing top-left artwork was preserved where possible.`)
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
    if (selection) {
      ctx.save()
      const x = selection.x * cellSize
      const y = selection.y * cellSize
      const width = selection.width * cellSize
      const height = selection.height * cellSize
      ctx.fillStyle = 'rgba(186,255,57,.08)'
      ctx.fillRect(x, y, width, height)
      ctx.strokeStyle = '#baff39'
      ctx.lineWidth = Math.max(1.5, Math.min(3, cellSize * 0.08))
      ctx.setLineDash([Math.max(4, cellSize * 0.25), Math.max(3, cellSize * 0.18)])
      ctx.strokeRect(x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 2))
      ctx.restore()
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
    const index = y * gridSize + x
    const target = cells[index]
    if (target === value) return
    const next = cells.slice()
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
    commitCells(next)
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = canvasCell(event)
    const index = point.y * gridSize + point.x
    if (tool === 'select') {
      drawingRef.current = true
      selectionStartRef.current = point
      setSelection({ x: point.x, y: point.y, width: 1, height: 1 })
      return
    }
    if (tool === 'picker') {
      const value = cells[index]
      if (value !== TRANSPARENT && value < palette.length) { setActiveColor(value); setMessage(`Picked ${palette[value]}.`) }
      return
    }
    if (tool === 'fill') {
      floodFill(point.x, point.y, activeColor)
      return
    }
    drawingRef.current = true
    changedRef.current = false
    startRef.current = { ...point, snapshot: cells.slice() }
    lastCellRef.current = point
    if (tool === 'pencil' || tool === 'eraser') {
      const next = cells.slice()
      paintPoint(next, point.x, point.y, tool === 'eraser' ? TRANSPARENT : activeColor)
      changedRef.current = next.some((value, i) => value !== cells[i])
      setCells(next)
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const point = canvasCell(event)
    if (tool === 'select') {
      const start = selectionStartRef.current
      if (start) setSelection(selectionFromPoints(start.x, start.y, point.x, point.y))
      return
    }
    if (tool !== 'pencil' && tool !== 'eraser') return
    const last = lastCellRef.current
    if (last && last.x === point.x && last.y === point.y) return
    const next = cells.slice()
    if (last) paintLine(next, last.x, last.y, point.x, point.y, tool === 'eraser' ? TRANSPARENT : activeColor)
    else paintPoint(next, point.x, point.y, tool === 'eraser' ? TRANSPARENT : activeColor)
    setCells(next)
    changedRef.current = true
    lastCellRef.current = point
  }

  function pointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    const point = canvasCell(event)
    if (tool === 'select') {
      const start = selectionStartRef.current
      if (start) {
        const nextSelection = selectionFromPoints(start.x, start.y, point.x, point.y)
        setSelection(nextSelection)
        setMessage(`Selected ${nextSelection.width}×${nextSelection.height} cells. Move with arrow keys/buttons, center it, or save the crop as a reusable motif.`)
      }
      selectionStartRef.current = null
      return
    }
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
    setRedoStack((current) => [...current, cells.slice()])
    setUndoStack((current) => current.slice(0, -1))
    setCells(previous.slice())
  }

  function redo() {
    if (!redoStack.length) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((current) => [...current, cells.slice()])
    setRedoStack((current) => current.slice(0, -1))
    setCells(next.slice())
  }

  function shiftBuffer(buffer: Uint8Array, dx: number, dy: number) {
    const next = new Uint8Array(buffer.length).fill(TRANSPARENT)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const nx = modulo(x + dx, gridSize)
        const ny = modulo(y + dy, gridSize)
        next[ny * gridSize + nx] = buffer[y * gridSize + x]
      }
    }
    return next
  }

  function transform(kind: 'flip-x' | 'flip-y' | 'rotate' | 'shift-left' | 'shift-right' | 'shift-up' | 'shift-down') {
    if (kind.startsWith('shift-')) {
      const dx = kind === 'shift-left' ? -moveStep : kind === 'shift-right' ? moveStep : 0
      const dy = kind === 'shift-up' ? -moveStep : kind === 'shift-down' ? moveStep : 0
      commitCells(shiftBuffer(cells, dx, dy))
      setMessage(`Tile phase shifted ${dx || dy} cell${Math.abs(dx || dy) === 1 ? '' : 's'} with seamless wrap.`)
      return
    }
    const next = new Uint8Array(cells.length).fill(TRANSPARENT)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let nx = x
        let ny = y
        if (kind === 'flip-x') nx = gridSize - 1 - x
        if (kind === 'flip-y') ny = gridSize - 1 - y
        if (kind === 'rotate') { nx = gridSize - 1 - y; ny = x }
        next[ny * gridSize + nx] = cells[y * gridSize + x]
      }
    }
    commitCells(next)
    setSelection(null)
  }

  function clearGrid() {
    const next = new Uint8Array(cells.length).fill(0)
    commitCells(next)
    setSelection(null)
  }

  function dominantBackgroundValue(buffer = cells) {
    const counts = new Map<number, number>()
    buffer.forEach((value) => {
      if (value === TRANSPARENT) return
      counts.set(value, (counts.get(value) ?? 0) + 1)
    })
    let best = TRANSPARENT
    let bestCount = -1
    counts.forEach((count, value) => {
      if (count > bestCount) { best = value; bestCount = count }
    })
    return best
  }

  function trimBackgroundValue(buffer = cells) {
    if (trimBackground === 'transparent') return TRANSPARENT
    if (trimBackground.startsWith('slot-')) {
      const value = Number(trimBackground.slice(5))
      return Number.isFinite(value) ? value : dominantBackgroundValue(buffer)
    }
    return dominantBackgroundValue(buffer)
  }

  function artworkBounds(buffer = cells): Selection | null {
    const background = trimBackgroundValue(buffer)
    let left = gridSize
    let top = gridSize
    let right = -1
    let bottom = -1
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = buffer[y * gridSize + x]
        const isArtwork = value !== TRANSPARENT && (background === TRANSPARENT || value !== background)
        if (!isArtwork) continue
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
    if (right < left || bottom < top) return null
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
  }

  function selectAll() {
    setSelection({ x: 0, y: 0, width: gridSize, height: gridSize })
    setTool('select')
    setView('edit')
    setMessage('Entire master tile selected. Arrow keys/buttons now shift the tile phase with seamless wrap.')
  }

  function selectArtwork() {
    const bounds = artworkBounds()
    if (!bounds) { setMessage('No artwork found after ignoring the selected trim background.'); return }
    setSelection(bounds)
    setTool('select')
    setView('edit')
    setMessage(`Artwork bounds selected: ${bounds.width}×${bounds.height}. Background detection is ${trimBackground === 'auto' ? 'automatic' : trimBackground}.`)
  }

  function moveSelectionBy(dx: number, dy: number) {
    if (!selection) return
    const fullTile = selection.x === 0 && selection.y === 0 && selection.width === gridSize && selection.height === gridSize
    if (fullTile) {
      commitCells(shiftBuffer(cells, dx, dy))
      setMessage(`Full tile moved ${dx || dy} cell${Math.abs(dx || dy) === 1 ? '' : 's'} with wrap. This changes the visible repeat phase without breaking seamlessness.`)
      return
    }

    const targetX = clamp(selection.x + dx, 0, gridSize - selection.width)
    const targetY = clamp(selection.y + dy, 0, gridSize - selection.height)
    const actualDx = targetX - selection.x
    const actualDy = targetY - selection.y
    if (!actualDx && !actualDy) return

    const background = trimBackgroundValue()
    const fillValue = background === TRANSPARENT ? TRANSPARENT : background
    const snapshot = cells.slice()
    const block = new Uint8Array(selection.width * selection.height)
    for (let y = 0; y < selection.height; y++) {
      for (let x = 0; x < selection.width; x++) {
        block[y * selection.width + x] = snapshot[(selection.y + y) * gridSize + selection.x + x]
      }
    }
    const next = snapshot.slice()
    for (let y = 0; y < selection.height; y++) {
      for (let x = 0; x < selection.width; x++) next[(selection.y + y) * gridSize + selection.x + x] = fillValue
    }
    for (let y = 0; y < selection.height; y++) {
      for (let x = 0; x < selection.width; x++) next[(targetY + y) * gridSize + targetX + x] = block[y * selection.width + x]
    }
    commitCells(next, snapshot)
    setSelection({ ...selection, x: targetX, y: targetY })
    setMessage(`Selection moved to (${targetX}, ${targetY}). Partial selections stay inside the canvas; Select All uses seamless wrap.`)
  }

  function centerSelection() {
    const chosen = selection ?? artworkBounds()
    if (!chosen) { setMessage('Nothing to center. Draw artwork or use Select Artwork first.'); return }
    if (!selection) setSelection(chosen)
    if (chosen.width === gridSize && chosen.height === gridSize) {
      autoCenterArtwork()
      return
    }
    const targetX = Math.floor((gridSize - chosen.width) / 2)
    const targetY = Math.floor((gridSize - chosen.height) / 2)
    const dx = targetX - chosen.x
    const dy = targetY - chosen.y
    const previous = selection
    if (!previous) setSelection(chosen)
    const background = trimBackgroundValue()
    const fillValue = background === TRANSPARENT ? TRANSPARENT : background
    const snapshot = cells.slice()
    const block = new Uint8Array(chosen.width * chosen.height)
    for (let y = 0; y < chosen.height; y++) for (let x = 0; x < chosen.width; x++) block[y * chosen.width + x] = snapshot[(chosen.y + y) * gridSize + chosen.x + x]
    const next = snapshot.slice()
    for (let y = 0; y < chosen.height; y++) for (let x = 0; x < chosen.width; x++) next[(chosen.y + y) * gridSize + chosen.x + x] = fillValue
    for (let y = 0; y < chosen.height; y++) for (let x = 0; x < chosen.width; x++) next[(targetY + y) * gridSize + targetX + x] = block[y * chosen.width + x]
    commitCells(next, snapshot)
    setSelection({ ...chosen, x: targetX, y: targetY })
    setMessage(`Selected artwork centered in the ${gridSize}×${gridSize} master tile.`)
  }

  function circularCenterShift(values: number[]) {
    const unique = Array.from(new Set(values)).sort((a, b) => a - b)
    if (!unique.length || unique.length >= gridSize) return 0
    let largestDistance = -1
    let intervalStart = unique[0]
    for (let index = 0; index < unique.length; index++) {
      const current = unique[index]
      const next = unique[(index + 1) % unique.length]
      const distance = modulo(next - current, gridSize) || gridSize
      if (distance > largestDistance) {
        largestDistance = distance
        intervalStart = next
      }
    }
    const intervalLength = gridSize - largestDistance + 1
    const currentCenter = modulo(intervalStart + (intervalLength - 1) / 2, gridSize)
    const targetCenter = (gridSize - 1) / 2
    let shift = Math.round(targetCenter - currentCenter)
    while (shift > gridSize / 2) shift -= gridSize
    while (shift < -gridSize / 2) shift += gridSize
    return shift
  }

  function autoCenterArtwork() {
    const background = trimBackgroundValue()
    const xs: number[] = []
    const ys: number[] = []
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const value = cells[y * gridSize + x]
        const isArtwork = value !== TRANSPARENT && (background === TRANSPARENT || value !== background)
        if (!isArtwork) continue
        xs.push(x)
        ys.push(y)
      }
    }
    if (!xs.length) { setMessage('No artwork detected for Auto Center.'); return }
    const dx = circularCenterShift(xs)
    const dy = circularCenterShift(ys)
    if (!dx && !dy) { selectArtwork(); setMessage('Artwork is already centered in the shortest seamless phase.'); return }
    const next = shiftBuffer(cells, dx, dy)
    commitCells(next)
    const backgroundAfter = trimBackgroundValue(next)
    let left = gridSize, top = gridSize, right = -1, bottom = -1
    for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
      const value = next[y * gridSize + x]
      const art = value !== TRANSPARENT && (backgroundAfter === TRANSPARENT || value !== backgroundAfter)
      if (art) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y) }
    }
    if (right >= left) setSelection({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 })
    setTool('select')
    setView('edit')
    setMessage(`Auto Center shifted the seamless phase by X ${dx}, Y ${dy}. The motif is now positioned in the shortest central span without changing the repeating pattern.`)
  }

  function applyHex() {
    const matches = quickHex.match(/#?[0-9a-f]{3,6}/gi) ?? []
    const colors = matches.map(normalizeHex).filter((entry): entry is string => Boolean(entry)).slice(0, 16)
    if (colors.length < 2) { setMessage('Paste at least 2 valid HEX colors. Pixel Pattern supports up to 16 palette slots.'); return }
    setPalette(colors)
    setActiveColor((current) => Math.min(current, colors.length - 1))
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
        cellsBase64: encodeGridCells(cells),
        palette: [...palette],
        transparentValue: TRANSPARENT,
      },
      meta: { symmetry, brushSize },
    }
  }

  function cropAsset(): PatternAsset | null {
    const chosen = selection ?? artworkBounds()
    if (!chosen) { setMessage('Select an area or use Select Artwork before creating a crop.'); return null }
    const background = trimBackgroundValue()
    const cropped = new Uint8Array(chosen.width * chosen.height).fill(TRANSPARENT)
    for (let y = 0; y < chosen.height; y++) {
      for (let x = 0; x < chosen.width; x++) {
        const source = cells[(chosen.y + y) * gridSize + chosen.x + x]
        cropped[y * chosen.width + x] = transparentCropBackground && source === background ? TRANSPARENT : source
      }
    }
    const stamp = new Date().toISOString()
    return {
      id: 'crop-preview',
      name: `${patternName.trim() || 'Pixel Pattern'} Crop`,
      sourceType: 'grid',
      createdAt: stamp,
      updatedAt: stamp,
      palette: [...palette],
      grid: {
        width: chosen.width,
        height: chosen.height,
        cellsBase64: encodeGridCells(cropped),
        palette: [...palette],
        transparentValue: TRANSPARENT,
      },
      tags: ['pixel-crop', 'motif'],
      meta: { cropped: true, sourceGrid: `${gridSize}x${gridSize}`, trimBackground, transparentCropBackground },
    }
  }

  function saveLibrary() {
    try {
      const asset = currentAsset()
      savePatternAsset({
        name: asset.name,
        sourceType: 'grid',
        palette: asset.palette,
        grid: asset.grid,
        meta: asset.meta,
      })
      setMessage(`${asset.name} saved to My Pattern Library. It can now be reused as an SVG motif in other builders.`)
    } catch {
      setMessage('Could not save to browser library. Local storage may be full; export JSON as a backup.')
    }
  }

  function saveCropLibrary() {
    try {
      const asset = cropAsset()
      if (!asset) return
      savePatternAsset({ name: asset.name, sourceType: 'grid', palette: asset.palette, grid: asset.grid, tags: asset.tags, meta: asset.meta })
      setMessage(`${asset.name} saved as a tight ${asset.grid?.width}×${asset.grid?.height} reusable motif. The master seamless tile remains unchanged.`)
    } catch {
      setMessage('Could not save cropped motif to the browser library. Try Export Cropped SVG instead.')
    }
  }

  function exportSvg() {
    const asset = currentAsset()
    downloadText(patternAssetToSvg(asset), `${nameSlug(asset.name)}-${gridSize}x${gridSize}-seamless.svg`, 'image/svg+xml;charset=utf-8')
  }

  function exportCropSvg() {
    const asset = cropAsset()
    if (!asset) return
    downloadText(patternAssetToSvg(asset), `${nameSlug(asset.name)}-${asset.grid?.width}x${asset.grid?.height}-motif.svg`, 'image/svg+xml;charset=utf-8')
    setMessage(`Cropped motif SVG exported at ${asset.grid?.width}×${asset.grid?.height} cells.`)
  }

  function exportJson() {
    const asset = currentAsset()
    downloadText(exportPatternAssetJson(asset), `${nameSlug(asset.name)}-${gridSize}x${gridSize}.pattern.json`, 'application/json;charset=utf-8')
  }

  const selectionLabel = selection ? `${selection.width}×${selection.height} at ${selection.x},${selection.y}` : 'No selection'
  const dominant = dominantBackgroundValue()

  return (
    <div className="v10-builder-shell v11-pixel-shell v111-pixel-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>Grid Size</h2>
          <div className="v11-grid-sizes">{GRID_SIZES.map((size) => <button key={size} className={gridSize === size ? 'active' : ''} onClick={() => setGrid(size)}>{size}×{size}</button>)}</div>
          <small>8–32 is ideal for bold motifs. 64–256 gives enough resolution for more complex mathematical patterns.</small>
        </section>

        <section>
          <h2>Drawing + Selection</h2>
          <div className="v11-tool-grid">
            {([['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['line', 'Line'], ['rect', 'Rectangle'], ['picker', 'Picker'], ['select', 'Select']] as Array<[Tool, string]>).map(([id, label]) => <button key={id} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); if (id === 'select') setView('edit') }}>{label}</button>)}
          </div>
          <label><span>Brush size</span><input type="range" min="1" max="7" step="1" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><output>{brushSize}</output></label>
          <label><span>Live symmetry</span><select value={symmetry} onChange={(event) => setSymmetry(event.target.value as Symmetry)}><option value="none">None</option><option value="x">Mirror X</option><option value="y">Mirror Y</option><option value="xy">Mirror X + Y</option><option value="quadrant">4-way Rotation</option></select></label>
          <div className="v11-history-row"><button disabled={!undoStack.length} onClick={undo}>↶ Undo</button><button disabled={!redoStack.length} onClick={redo}>↷ Redo</button></div>
        </section>

        <section className="v111-selection-section">
          <div className="v10-section-title"><h2>Select · Move · Center</h2><span>{selection ? `${selection.width}×${selection.height}` : '—'}</span></div>
          <div className="v111-selection-actions"><button onClick={selectAll}>Select All</button><button onClick={selectArtwork}>Select Artwork</button><button className="v111-center-button" onClick={autoCenterArtwork}>Auto Center Artwork</button><button onClick={centerSelection}>Center Selection</button></div>
          <label><span>Move step</span><input type="range" min="1" max={Math.min(16, Math.max(1, Math.floor(gridSize / 4)))} step="1" value={moveStep} onChange={(event) => setMoveStep(Number(event.target.value))} /><output>{moveStep}</output></label>
          <div className="v111-nudge-grid"><span /><button onClick={() => moveSelectionBy(0, -moveStep)}>↑</button><span /><button onClick={() => moveSelectionBy(-moveStep, 0)}>←</button><button onClick={() => setSelection(null)}>×</button><button onClick={() => moveSelectionBy(moveStep, 0)}>→</button><span /><button onClick={() => moveSelectionBy(0, moveStep)}>↓</button><span /></div>
          <small><b>{selectionLabel}</b>. Ctrl/Cmd+A selects the full tile; arrow keys move it. A full-tile selection wraps seamlessly, while a partial selection stays inside the canvas.</small>
        </section>

        <section>
          <h2>Tile Transform / Phase</h2>
          <div className="v11-tool-grid"><button onClick={() => transform('flip-x')}>Flip X</button><button onClick={() => transform('flip-y')}>Flip Y</button><button onClick={() => transform('rotate')}>Rotate 90°</button><button onClick={() => transform('shift-left')}>← Wrap {moveStep}</button><button onClick={() => transform('shift-right')}>Wrap {moveStep} →</button><button onClick={() => transform('shift-up')}>↑ Wrap {moveStep}</button><button onClick={() => transform('shift-down')}>↓ Wrap {moveStep}</button><button className="v09-danger" onClick={clearGrid}>Clear</button></div>
          <small>Wrap shifts change where the repeat seam falls without changing the infinite pattern itself. Auto Center uses this same principle intelligently.</small>
        </section>

        <section className="v10-cultural-note">
          <h2>Pattern-first workflow</h2>
          <p>Keep the original master tile for seamless export. Create a tight crop separately when you want the drawing to behave like a motif inside another builder.</p>
          <button onClick={onOpenLibrary}>Open My Patterns</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{patternName || 'Untitled Pixel Pattern'}</b><span>{gridSize}×{gridSize} master grid · {usedColors.size} colors used · {selection ? `selection ${selection.width}×${selection.height}` : symmetry === 'none' ? 'manual' : symmetry}</span></div>
          <div className="v10-view-buttons"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Edit Tile</button><button className={view === 'repeat' ? 'active' : ''} onClick={() => setView('repeat')}>Repeat Proof</button></div>
        </div>
        <div className="v10-preview-zone v11-pixel-stage">
          {view === 'edit' ? <canvas ref={editCanvasRef} className={`v11-pixel-canvas ${tool === 'select' ? 'v111-select-cursor' : ''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={(event) => event.preventDefault()} /> : <canvas ref={repeatCanvasRef} className="v11-repeat-canvas" />}
        </div>
        <div className="v10-stage-status"><span>{message}</span><b>{view === 'edit' ? 'MASTER TILE + SELECTION' : `${repeatCount}×${repeatCount} REPEAT PROOF`}</b></div>
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
          <small>6×6 and 12×12 are useful for spotting unintended lines, clusters and rhythm problems.</small>
        </section>

        <section className="v111-crop-section">
          <h2>Crop for Other Builders</h2>
          <label><span>Ignore as background</span><select value={trimBackground} onChange={(event) => setTrimBackground(event.target.value)}><option value="auto">Auto · most-used color {dominant !== TRANSPARENT && palette[dominant] ? palette[dominant] : ''}</option><option value="transparent">Transparent only</option>{palette.map((color, index) => <option key={index} value={`slot-${index}`}>Slot {index + 1} · {color}</option>)}</select></label>
          <label className="v10-check"><input type="checkbox" checked={transparentCropBackground} onChange={(event) => setTransparentCropBackground(event.target.checked)} /> Make ignored background transparent in cropped motif</label>
          <div className="v111-crop-readout"><b>{selection ? `${selection.width}×${selection.height}` : 'AUTO'}</b><span>{selection ? 'selected crop size' : 'uses detected artwork bounds'}</span></div>
          <button className="v10-primary-action" onClick={saveCropLibrary}>Save Cropped Motif to My Patterns</button>
          <button className="v10-wide-button" onClick={exportCropSvg}>Export Cropped SVG</button>
          <small>This creates a tight reusable motif asset; it does <b>not</b> destroy or resize the original seamless master tile.</small>
        </section>

        <section>
          <h2>Save Master Pattern</h2>
          <label><span>Pattern name</span><input value={patternName} onChange={(event) => setPatternName(event.target.value)} /></label>
          <button className="v10-primary-action" onClick={saveLibrary}>Save Master to My Patterns</button>
          <button className="v10-wide-button" onClick={onOpenLibrary}>Browse My Pattern Library</button>
          <small>The square master grid remains editable. Cropped motif assets can be rectangular and are intended for reuse by other builders.</small>
        </section>

        <section>
          <h2>Export Master</h2>
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
