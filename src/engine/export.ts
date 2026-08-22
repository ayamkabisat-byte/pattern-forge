import { computeCanvasLayout } from './canvas'
import type { CanvasMode } from '../types'

function loadSvg(svg: string) {
  return new Promise<{ image: HTMLImageElement; url: string }>((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not rasterize the SVG tile.'))
    }
    image.src = url
  })
}

export async function canvasAwarePng(
  tileSvg: string,
  tileWidth: number,
  tileHeight: number,
  outputWidth: number,
  outputHeight: number,
  tileScale = 100,
  mode: CanvasMode = 'full-bleed',
  proofCopies = 3,
  background = '#ffffff',
): Promise<Blob> {
  const { image, url } = await loadSvg(tileSvg)
  try {
    const layout = computeCanvasLayout(
      tileWidth,
      tileHeight,
      outputWidth,
      outputHeight,
      tileScale,
      mode,
      proofCopies,
    )

    const canvas = document.createElement('canvas')
    canvas.width = layout.canvasWidth
    canvas.height = layout.canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available in this browser.')

    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.columns; col++) {
        const x = layout.originX + col * layout.tileWidth
        const y = layout.originY + row * layout.tileHeight
        ctx.drawImage(image, x, y, layout.tileWidth, layout.tileHeight)
      }
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function repeatedTilePng(
  tileSvg: string,
  tileWidth: number,
  tileHeight: number,
  outputWidth: number,
  outputHeight: number,
  tileScale = 100,
): Promise<Blob> {
  return canvasAwarePng(
    tileSvg,
    tileWidth,
    tileHeight,
    outputWidth,
    outputHeight,
    tileScale,
    'full-bleed',
    3,
    '#ffffff',
  )
}
