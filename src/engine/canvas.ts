import type { CanvasLayout, CanvasMode } from '../types'

function clampPositive(value: number, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function computeCanvasLayout(
  tileWidth: number,
  tileHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  tileScale = 100,
  mode: CanvasMode = 'full-bleed',
  proofCopies = 3,
): CanvasLayout {
  const sourceW = clampPositive(tileWidth)
  const sourceH = clampPositive(tileHeight)
  const outW = Math.max(1, Math.round(canvasWidth))
  const outH = Math.max(1, Math.round(canvasHeight))
  const requestedScale = Math.max(0.05, tileScale / 100)

  let drawW = sourceW * requestedScale
  let drawH = sourceH * requestedScale
  let columns = 1
  let rows = 1

  if (mode === 'full-bleed') {
    columns = Math.max(1, Math.ceil(outW / drawW) + 2)
    rows = Math.max(1, Math.ceil(outH / drawH) + 2)
  } else if (mode === 'fit-full-tiles') {
    const fitDown = Math.min(1, outW / drawW, outH / drawH)
    drawW *= fitDown
    drawH *= fitDown
    columns = Math.max(1, Math.floor(outW / drawW))
    rows = Math.max(1, Math.floor(outH / drawH))
  } else if (mode === 'single-tile') {
    const fit = Math.min(outW / sourceW, outH / sourceH)
    drawW = sourceW * fit * requestedScale
    drawH = sourceH * fit * requestedScale
    columns = 1
    rows = 1
  } else {
    const copies = Math.max(1, Math.round(proofCopies))
    const fit = Math.min(outW / (sourceW * copies), outH / (sourceH * copies))
    drawW = sourceW * fit * requestedScale
    drawH = sourceH * fit * requestedScale
    columns = copies
    rows = copies
  }

  const patternWidth = drawW * columns
  const patternHeight = drawH * rows
  const originX = (outW - patternWidth) / 2
  const originY = (outH - patternHeight) / 2

  return {
    mode,
    canvasWidth: outW,
    canvasHeight: outH,
    tileWidth: drawW,
    tileHeight: drawH,
    columns,
    rows,
    originX,
    originY,
    patternWidth,
    patternHeight,
  }
}

export function canvasModeLabel(mode: CanvasMode) {
  if (mode === 'full-bleed') return 'Full Bleed'
  if (mode === 'fit-full-tiles') return 'Fit Full Tiles'
  if (mode === 'single-tile') return 'Single Tile'
  return 'Proof Sheet'
}
