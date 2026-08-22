import type { PatternGeometry, PatternInstance, SvgAsset } from '../types'

function esc(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderInstance(item: PatternInstance, asset: SvgAsset) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})"><svg width="${item.width}" height="${item.height}" viewBox="${esc(asset.viewBox)}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
}

export function buildComposerSvg(
  assets: SvgAsset[],
  instances: PatternInstance[],
  background: string,
  geometry: PatternGeometry,
) {
  const body = instances
    .map((item) => {
      const asset = assets[item.assetIndex]
      return asset ? renderInstance(item, asset) : ''
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.tileWidth}" height="${geometry.tileHeight}" viewBox="0 0 ${geometry.tileWidth} ${geometry.tileHeight}"><defs><clipPath id="pf-final-canvas"><rect width="${geometry.tileWidth}" height="${geometry.tileHeight}"/></clipPath></defs><rect width="100%" height="100%" fill="${esc(background)}"/><g clip-path="url(#pf-final-canvas)">${body}</g></svg>`
}
