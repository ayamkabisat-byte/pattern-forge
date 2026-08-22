import type { PatternGeometry, PatternInstance, PatternSettings, SvgAsset } from '../types'

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

export function buildSvgFromGeometry(
  assets: SvgAsset[],
  instances: PatternInstance[],
  settings: PatternSettings,
  geometry: PatternGeometry,
) {
  const shiftsX = [-geometry.tileWidth, 0, geometry.tileWidth]
  const shiftsY = [-geometry.tileHeight, 0, geometry.tileHeight]
  const body = instances
    .flatMap((item) => {
      const asset = assets[item.assetIndex]
      if (!asset) return []
      return shiftsX.flatMap((dx) => shiftsY.map((dy) => renderInstance(item, asset, dx, dy)))
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${geometry.tileWidth}" height="${geometry.tileHeight}" viewBox="0 0 ${geometry.tileWidth} ${geometry.tileHeight}"><defs><clipPath id="pf-master-clip"><rect width="${geometry.tileWidth}" height="${geometry.tileHeight}"/></clipPath></defs><rect width="100%" height="100%" fill="${esc(settings.background)}"/><g clip-path="url(#pf-master-clip)">${body}</g></svg>`
}
