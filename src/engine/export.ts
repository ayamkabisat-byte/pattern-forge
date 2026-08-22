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

export async function repeatedTilePng(
  tileSvg: string,
  tileWidth: number,
  tileHeight: number,
  outputWidth: number,
  outputHeight: number,
  tileScale = 100,
): Promise<Blob> {
  const { image, url } = await loadSvg(tileSvg)
  try {
    const scale = Math.max(0.1, tileScale / 100)
    const scaledWidth = Math.max(1, Math.round(tileWidth * scale))
    const scaledHeight = Math.max(1, Math.round(tileHeight * scale))

    const tileCanvas = document.createElement('canvas')
    tileCanvas.width = scaledWidth
    tileCanvas.height = scaledHeight
    const tileCtx = tileCanvas.getContext('2d')
    if (!tileCtx) throw new Error('Canvas is not available in this browser.')
    tileCtx.drawImage(image, 0, 0, scaledWidth, scaledHeight)

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(outputWidth))
    canvas.height = Math.max(1, Math.round(outputHeight))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available in this browser.')

    const pattern = ctx.createPattern(tileCanvas, 'repeat')
    if (!pattern) throw new Error('Could not create repeated canvas pattern.')
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
