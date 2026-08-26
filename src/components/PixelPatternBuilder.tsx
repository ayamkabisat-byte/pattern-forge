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

export default function PixelPatternBuilder({ onOpenLibrary, onOpenWoven }: Props) {
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
  const [message, setMessage] = useState('Draw one master tile. Switch to 3×3, 6×6 or 12×12 Repeat Proof to judge the actual pattern rhythm.')
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([])
  const [redoStack, setRedoStack] = useState<Uint8Array[]>([])
  const editCanvasRef = useRef<HTMLCanvasElement>(null)
  const repeatCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const changedRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; snapshot: Uint8Array } | null>(null)
  const lastCellRef = useRef<{ x: number; y: number } | null>(null)

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
      setMessage('This saved grid cannot be edited in Pixel Pattern Builder because it is not a supported square grid.')
      return
    }
    setGridSize(width)
    setCells(decodeGridCells(pending.grid.cellsBase64, width * width))
    setPalette([...pending.grid.palette])
    setQuickHex(pending.grid.palette.join(', '))
    setPatternName(pending.name)
    setUndoStack([])
    setRedoStack([])
    setMessage(`${pending.name} loaded from My Pattern Library.`)
  }, [])

  useEffect(() => {
    drawEditor()
  }, [cells, gridSize, palette, showGrid])

  useEffect(() => {
    drawRepeat()
  }, [cells, gridSize, palette, repeatCount])

  function pushUndo(snapshot: Uint8Array) {
    setUndoStack((current) => [...current.slice(-(MAX_HISTORY - 1)), snapshot])
    setRedoStack([])
  }

  function commitCells(next: Uint8Array, snapshot?: Uint8Array) {
    const before = snapshot ?? cells
    if (next.every((value, index) => value === before[index])) return
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
    if (!drawingRef.current || (tool !== 'pencil' && tool !== 'eraser')) return
    const point = canvasCell(event)
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

  function transform(kind: 'flip-x' | 'flip-y' | 'rotate' | 'shift-left' | 'shift-right' | 'shift-up' | 'shift-down') {
    const next = new Uint8Array(cells.length).fill(TRANSPARENT)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let nx = x
        let ny = y
        if (kind === 'flip-x') nx = gridSize - 1 - x
        if (kind === 'flip-y') ny = gridSize - 1 - y
        if (kind === 'rotate') { nx = gridSize - 1 - y; ny = x }
        if (kind === 'shift-left') nx = (x - 1 + gridSize) % gridSize
        if (kind === 'shift-right') nx = (x + 1) % gridSize
        if (kind === 'shift-up') ny = (y - 1 + gridSize) % gridSize
        if (kind === 'shift-down') ny = (y + 1) % gridSize
        next[ny * gridSize + nx] = cells[y * gridSize + x]
      }
    }
    commitCells(next)
  }

  function clearGrid() {
    const next = new Uint8Array(cells.length).fill(0)
    commitCells(next)
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

  function exportSvg() {
    const asset = currentAsset()
    downloadText(patternAssetToSvg(asset), `${nameSlug(asset.name)}-${gridSize}x${gridSize}-seamless.svg`, 'image/svg+xml;charset=utf-8')
  }

  function exportJson() {
    const asset = currentAsset()
    downloadText(exportPatternAssetJson(asset), `${nameSlug(asset.name)}-${gridSize}x${gridSize}.pattern.json`, 'application/json;charset=utf-8')
  }

  return (
    <div className="v10-builder-shell v11-pixel-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>Grid Size</h2>
          <div className="v11-grid-sizes">{GRID_SIZES.map((size) => <button key={size} className={gridSize === size ? 'active' : ''} onClick={() => setGrid(size)}>{size}×{size}</button>)}</div>
          <small>8–32 is ideal for bold folk/pixel motifs. 64–256 gives enough resolution for much more complex mathematical patterns.</small>
        </section>

        <section>
          <h2>Drawing Tools</h2>
          <div className="v11-tool-grid">
            {([['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['line', 'Line'], ['rect', 'Rectangle'], ['picker', 'Picker']] as Array<[Tool, string]>).map(([id, label]) => <button key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}>{label}</button>)}
          </div>
          <label><span>Brush size</span><input type="range" min="1" max="7" step="1" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /><output>{brushSize}</output></label>
          <label><span>Live symmetry</span><select value={symmetry} onChange={(event) => setSymmetry(event.target.value as Symmetry)}><option value="none">None</option><option value="x">Mirror X</option><option value="y">Mirror Y</option><option value="xy">Mirror X + Y</option><option value="quadrant">4-way Rotation</option></select></label>
          <div className="v11-history-row"><button disabled={!undoStack.length} onClick={undo}>↶ Undo</button><button disabled={!redoStack.length} onClick={redo}>↷ Redo</button></div>
        </section>

        <section>
          <h2>Tile Transform</h2>
          <div className="v11-tool-grid"><button onClick={() => transform('flip-x')}>Flip X</button><button onClick={() => transform('flip-y')}>Flip Y</button><button onClick={() => transform('rotate')}>Rotate 90°</button><button onClick={() => transform('shift-left')}>← Wrap</button><button onClick={() => transform('shift-right')}>Wrap →</button><button onClick={() => transform('shift-up')}>↑ Wrap</button><button onClick={() => transform('shift-down')}>↓ Wrap</button><button className="v09-danger" onClick={clearGrid}>Clear</button></div>
          <small>Wrap shifts are especially useful for seam correction because pixels leaving one edge immediately re-enter on the opposite edge.</small>
        </section>

        <section className="v10-cultural-note">
          <h2>Pattern-first workflow</h2>
          <p>Build one tile here, inspect the repeated field, then save it as a reusable PatternForge asset. The saved tile can become a motif inside Seamless, Layout Guides or Woven/Textile.</p>
          <button onClick={onOpenLibrary}>Open My Patterns</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{patternName || 'Untitled Pixel Pattern'}</b><span>{gridSize}×{gridSize} master grid · {usedColors.size} colors used · {symmetry === 'none' ? 'manual' : symmetry}</span></div>
          <div className="v10-view-buttons"><button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')}>Edit Tile</button><button className={view === 'repeat' ? 'active' : ''} onClick={() => setView('repeat')}>Repeat Proof</button></div>
        </div>
        <div className="v10-preview-zone v11-pixel-stage">
          {view === 'edit' ? <canvas ref={editCanvasRef} className="v11-pixel-canvas" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={(event) => event.preventDefault()} /> : <canvas ref={repeatCanvasRef} className="v11-repeat-canvas" />}
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
          <small>6×6 and 12×12 are useful for spotting unintended lines, clusters and rhythm problems that can hide in a 3×3 preview.</small>
        </section>

        <section>
          <h2>Save Pattern Asset</h2>
          <label><span>Pattern name</span><input value={patternName} onChange={(event) => setPatternName(event.target.value)} /></label>
          <button className="v10-primary-action" onClick={saveLibrary}>Save to My Patterns</button>
          <button className="v10-wide-button" onClick={onOpenLibrary}>Browse My Pattern Library</button>
          <small>Grid data stays editable; PatternForge generates the vector SVG only when it is exported or reused by another builder.</small>
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
