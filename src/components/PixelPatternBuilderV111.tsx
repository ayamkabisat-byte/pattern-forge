import { useEffect, useState } from 'react'
import PixelPatternBuilder from './PixelPatternBuilder'
import { encodeGridCells, patternAssetToSvg, savePatternAsset, type PatternAsset } from '../patternLibrary'

type Props = {
  onOpenLibrary: () => void
  onOpenWoven: () => void
}

const TRANSPARENT = 255

function modulo(value: number, size: number) {
  return ((value % size) + size) % size
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
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

function slug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pixel-pattern'
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function circularCenterShift(values: number[], size: number) {
  const unique = Array.from(new Set(values)).sort((a, b) => a - b)
  if (!unique.length || unique.length >= size) return 0
  let largestDistance = -1
  let intervalStart = unique[0]
  for (let index = 0; index < unique.length; index++) {
    const current = unique[index]
    const next = unique[(index + 1) % unique.length]
    const distance = modulo(next - current, size) || size
    if (distance > largestDistance) {
      largestDistance = distance
      intervalStart = next
    }
  }
  const intervalLength = size - largestDistance + 1
  const currentCenter = modulo(intervalStart + (intervalLength - 1) / 2, size)
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

export default function PixelPatternBuilderV111({ onOpenLibrary, onOpenWoven }: Props) {
  const [selectedAll, setSelectedAll] = useState(false)
  const [moveStep, setMoveStep] = useState(1)
  const [transparentCropBackground, setTransparentCropBackground] = useState(true)
  const [status, setStatus] = useState('Select All lets you move the whole repeat phase. Auto Center finds the shortest wrapped span, then Crop creates a tight motif for other builders.')
  const [detected, setDetected] = useState<{ grid: number; background: string; crop?: string } | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelectedAll(true)
        setStatus('Entire master tile selected. Arrow keys now shift the seamless phase.')
        return
      }
      if (!selectedAll) return
      const step = event.shiftKey ? Math.max(4, moveStep) : moveStep
      if (event.key === 'ArrowLeft') { event.preventDefault(); void moveMaster(-step, 0) }
      if (event.key === 'ArrowRight') { event.preventDefault(); void moveMaster(step, 0) }
      if (event.key === 'ArrowUp') { event.preventDefault(); void moveMaster(0, -step) }
      if (event.key === 'ArrowDown') { event.preventDefault(); void moveMaster(0, step) }
      if (event.key === 'Escape') setSelectedAll(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedAll, moveStep])

  async function ensureEditView() {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.v111-pixel-wrapper .v10-view-buttons button'))
    const edit = buttons.find((button) => button.textContent?.includes('Edit Tile'))
    if (edit && !edit.classList.contains('active')) {
      edit.click()
      await sleep(90)
    }
  }

  function getGridSize() {
    const active = Array.from(document.querySelectorAll<HTMLButtonElement>('.v111-pixel-wrapper .v11-grid-sizes button')).find((button) => button.classList.contains('active'))
    const match = active?.textContent?.match(/(8|16|32|64|128|256)/)
    return match ? Number(match[1]) : 32
  }

  function getPatternName() {
    const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('.v111-pixel-wrapper label'))
    const label = labels.find((entry) => entry.querySelector('span')?.textContent?.trim() === 'Pattern name')
    const input = label?.querySelector<HTMLInputElement>('input')
    return input?.value.trim() || 'Pixel Pattern'
  }

  function getPalette() {
    return Array.from(document.querySelectorAll<HTMLInputElement>('.v111-pixel-wrapper .v11-pixel-palette input[type="color"]')).map((input) => input.value.toUpperCase())
  }

  async function sampleMaster() {
    await ensureEditView()
    const canvas = document.querySelector<HTMLCanvasElement>('.v111-pixel-wrapper .v11-pixel-canvas')
    if (!canvas) throw new Error('Pixel editor canvas is not available.')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read the Pixel editor canvas.')
    const grid = getGridSize()
    const palette = getPalette()
    const cells = new Uint8Array(grid * grid).fill(TRANSPARENT)
    const counts = new Map<number, number>()
    const cellSize = canvas.width / grid

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const px = Math.min(canvas.width - 1, Math.floor((x + 0.5) * cellSize))
        const py = Math.min(canvas.height - 1, Math.floor((y + 0.5) * cellSize))
        const [r, g, b, a] = ctx.getImageData(px, py, 1, 1).data
        if (a < 8) continue
        const hex = rgbToHex(r, g, b)
        let index = palette.findIndex((color) => color.toUpperCase() === hex)
        if (index < 0) {
          palette.push(hex)
          index = palette.length - 1
        }
        cells[y * grid + x] = index
        counts.set(index, (counts.get(index) ?? 0) + 1)
      }
    }

    let background = TRANSPARENT
    let best = -1
    counts.forEach((count, index) => {
      if (count > best) { best = count; background = index }
    })
    const backgroundHex = background !== TRANSPARENT && palette[background] ? palette[background] : 'transparent'
    setDetected((current) => ({ grid, background: backgroundHex, crop: current?.crop }))
    return { grid, palette, cells, background }
  }

  function findWrapButton(kind: 'left' | 'right' | 'up' | 'down') {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.v111-pixel-wrapper .v10-panel-left button'))
    return buttons.find((button) => {
      const text = button.textContent ?? ''
      if (kind === 'left') return text.includes('← Wrap')
      if (kind === 'right') return text.includes('Wrap →')
      if (kind === 'up') return text.includes('↑ Wrap')
      return text.includes('↓ Wrap')
    })
  }

  async function clickWrap(kind: 'left' | 'right' | 'up' | 'down', count: number) {
    const button = findWrapButton(kind)
    if (!button) throw new Error('Wrap controls were not found.')
    for (let index = 0; index < count; index++) {
      button.click()
      await sleep(12)
    }
  }

  async function moveMaster(dx: number, dy: number) {
    try {
      if (dx < 0) await clickWrap('left', Math.abs(dx))
      if (dx > 0) await clickWrap('right', dx)
      if (dy < 0) await clickWrap('up', Math.abs(dy))
      if (dy > 0) await clickWrap('down', dy)
      setSelectedAll(true)
      setStatus(`Master tile phase moved X ${dx}, Y ${dy}. Pixels wrap across opposite edges, so seamlessness is preserved.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not move the master tile.')
    }
  }

  function artworkCoordinates(cells: Uint8Array, grid: number, background: number) {
    const xs: number[] = []
    const ys: number[] = []
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const value = cells[y * grid + x]
        if (value === TRANSPARENT || value === background) continue
        xs.push(x)
        ys.push(y)
      }
    }
    return { xs, ys }
  }

  async function autoCenter() {
    try {
      const sample = await sampleMaster()
      const { xs, ys } = artworkCoordinates(sample.cells, sample.grid, sample.background)
      if (!xs.length) { setStatus('No artwork detected after ignoring the most-used background color.'); return }
      const dx = circularCenterShift(xs, sample.grid)
      const dy = circularCenterShift(ys, sample.grid)
      if (!dx && !dy) {
        setSelectedAll(true)
        setStatus('Artwork is already centered in the shortest seamless phase.')
        return
      }
      await moveMaster(dx, dy)
      await sleep(80)
      const centered = await sampleMaster()
      const crop = cropBounds(centered.cells, centered.grid, centered.background)
      setDetected({ grid: centered.grid, background: centered.background !== TRANSPARENT ? centered.palette[centered.background] : 'transparent', crop: crop ? `${crop.width}×${crop.height}` : undefined })
      setStatus(`Auto Center shifted the seamless phase by X ${dx}, Y ${dy}. The repeat stays identical, but the visible motif is now centered better inside the master tile.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Auto Center failed.')
    }
  }

  function cropBounds(cells: Uint8Array, grid: number, background: number) {
    let left = grid
    let top = grid
    let right = -1
    let bottom = -1
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const value = cells[y * grid + x]
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

  async function buildCropAsset() {
    const sample = await sampleMaster()
    const coords = artworkCoordinates(sample.cells, sample.grid, sample.background)
    if (!coords.xs.length) throw new Error('No artwork detected to crop.')

    const dx = circularCenterShift(coords.xs, sample.grid)
    const dy = circularCenterShift(coords.ys, sample.grid)
    const centeredCells = shiftCells(sample.cells, sample.grid, dx, dy)
    const bounds = cropBounds(centeredCells, sample.grid, sample.background)
    if (!bounds) throw new Error('Could not find crop bounds.')

    const cropped = new Uint8Array(bounds.width * bounds.height).fill(TRANSPARENT)
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const source = centeredCells[(bounds.y + y) * sample.grid + bounds.x + x]
        cropped[y * bounds.width + x] = transparentCropBackground && source === sample.background ? TRANSPARENT : source
      }
    }

    const name = `${getPatternName()} Crop`
    const stamp = new Date().toISOString()
    const asset: PatternAsset = {
      id: 'crop-preview',
      name,
      sourceType: 'grid',
      createdAt: stamp,
      updatedAt: stamp,
      palette: [...sample.palette],
      grid: {
        width: bounds.width,
        height: bounds.height,
        cellsBase64: encodeGridCells(cropped),
        palette: [...sample.palette],
        transparentValue: TRANSPARENT,
      },
      tags: ['pixel-crop', 'motif'],
      meta: {
        cropped: true,
        sourceGrid: `${sample.grid}x${sample.grid}`,
        autoCenteredForCrop: true,
        transparentCropBackground,
      },
    }
    setDetected({ grid: sample.grid, background: sample.background !== TRANSPARENT ? sample.palette[sample.background] : 'transparent', crop: `${bounds.width}×${bounds.height}` })
    return asset
  }

  async function saveCrop() {
    try {
      const asset = await buildCropAsset()
      savePatternAsset({ name: asset.name, sourceType: 'grid', palette: asset.palette, grid: asset.grid, tags: asset.tags, meta: asset.meta })
      setStatus(`${asset.name} saved to My Patterns as a tight ${asset.grid?.width}×${asset.grid?.height} motif. It is ready for Seamless, Layout Guides or Woven.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save cropped motif.')
    }
  }

  async function exportCrop() {
    try {
      const asset = await buildCropAsset()
      downloadText(patternAssetToSvg(asset), `${slug(asset.name)}-${asset.grid?.width}x${asset.grid?.height}-motif.svg`, 'image/svg+xml;charset=utf-8')
      setStatus(`Cropped motif SVG exported at ${asset.grid?.width}×${asset.grid?.height} cells.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not export cropped motif.')
    }
  }

  return (
    <div className="v111-pixel-wrapper">
      <PixelPatternBuilder onOpenLibrary={onOpenLibrary} onOpenWoven={onOpenWoven} />

      <div className={`v111-phase-dock ${selectedAll ? 'selected' : ''}`}>
        <div className="v111-phase-head">
          <div><b>Selection / Phase / Crop</b><span>{selectedAll ? 'ALL TILE SELECTED' : 'Select the whole master tile to move its repeat phase'}</span></div>
          <button className={selectedAll ? 'active' : ''} onClick={() => { setSelectedAll(true); setStatus('Entire master tile selected. Arrow buttons/keys shift it with seamless wrap.') }}>Select All</button>
        </div>

        <div className="v111-phase-body">
          <div className="v111-phase-move">
            <label><span>Move step</span><input type="range" min="1" max="8" value={moveStep} onChange={(event) => setMoveStep(Number(event.target.value))} /><output>{moveStep}</output></label>
            <div className="v111-mini-nudge"><span /><button onClick={() => void moveMaster(0, -moveStep)}>↑</button><span /><button onClick={() => void moveMaster(-moveStep, 0)}>←</button><button onClick={() => setSelectedAll(false)}>×</button><button onClick={() => void moveMaster(moveStep, 0)}>→</button><span /><button onClick={() => void moveMaster(0, moveStep)}>↓</button><span /></div>
            <button className="v111-auto-center" onClick={() => void autoCenter()}>Auto Center Artwork</button>
          </div>

          <div className="v111-phase-crop">
            <label className="v10-check"><input type="checkbox" checked={transparentCropBackground} onChange={(event) => setTransparentCropBackground(event.target.checked)} /> Transparent background in crop</label>
            <div className="v111-detect-row"><span>Grid <b>{detected?.grid ?? '—'}</b></span><span>BG <b>{detected?.background ?? 'auto'}</b></span><span>Crop <b>{detected?.crop ?? 'auto'}</b></span></div>
            <button className="v111-save-crop" onClick={() => void saveCrop()}>Save Tight Crop to My Patterns</button>
            <button onClick={() => void exportCrop()}>Export Cropped SVG</button>
          </div>
        </div>
        <div className="v111-phase-status">{status}</div>
      </div>
    </div>
  )
}
