import type { PatternGeometry, PatternInstance, SvgAsset, TextLayer } from '../types'

function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderInstance(item: PatternInstance, asset: SvgAsset, dx = 0, dy = 0) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return `<g transform="translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})"><svg width="${item.width}" height="${item.height}" viewBox="${esc(asset.viewBox)}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
}

function textAnchor(align: TextLayer['align']) {
  if (align === 'left') return 'start'
  if (align === 'right') return 'end'
  return 'middle'
}

function renderTextLayer(layer: TextLayer) {
  const lines = layer.text.split(/\r?\n/)
  const lineStep = layer.fontSize * layer.lineHeight
  const firstY = -((lines.length - 1) * lineStep) / 2
  const tspans = lines
    .map((line, index) => `<tspan x="0" y="${firstY + index * lineStep}">${esc(line || ' ')}</tspan>`)
    .join('')

  return `<g transform="translate(${layer.x} ${layer.y}) rotate(${layer.rotation})" opacity="${layer.opacity}"><text x="0" y="0" fill="${esc(layer.fill)}" font-family="${esc(layer.fontFamily)}, sans-serif" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" letter-spacing="${layer.letterSpacing}" text-anchor="${textAnchor(layer.align)}" direction="${layer.direction}" unicode-bidi="plaintext" dominant-baseline="middle">${tspans}</text></g>`
}

export function buildComposerSvg(
  assets: SvgAsset[],
  instances: PatternInstance[],
  background: string,
  geometry: PatternGeometry,
  textLayers: TextLayer[] = [],
  wrapEdges = false,
) {
  const shiftsX = wrapEdges ? [-geometry.tileWidth, 0, geometry.tileWidth] : [0]
  const shiftsY = wrapEdges ? [-geometry.tileHeight, 0, geometry.tileHeight] : [0]
  const motifBody = instances
    .flatMap((item) => {
      const asset = assets[item.assetIndex]
      if (!asset) return []
      return shiftsX.flatMap((dx) => shiftsY.map((dy) => renderInstance(item, asset, dx, dy)))
    })
    .join('')

  const textBody = textLayers.map(renderTextLayer).join('')
  const clipId = wrapEdges ? 'pf-seamless-tile' : 'pf-final-canvas'

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.tileWidth}" height="${geometry.tileHeight}" viewBox="0 0 ${geometry.tileWidth} ${geometry.tileHeight}"><defs><clipPath id="${clipId}"><rect width="${geometry.tileWidth}" height="${geometry.tileHeight}"/></clipPath></defs><rect width="100%" height="100%" fill="${esc(background)}"/><g clip-path="url(#${clipId})">${motifBody}${textBody}</g></svg>`
}
