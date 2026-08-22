import type { PatternInstance, PatternSettings, RepeatMode, SvgAsset } from '../types'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dims(asset: SvgAsset, motifSize: number) {
  const ratio = asset.viewWidth / asset.viewHeight || 1
  return ratio >= 1
    ? { width: motifSize, height: motifSize / ratio }
    : { width: motifSize * ratio, height: motifSize }
}

function wrapped(instance: PatternInstance, w: number, h: number) {
  const out: PatternInstance[] = []
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      out.push({ ...instance, key: `${instance.key}-${dx}-${dy}`, x: instance.x + dx, y: instance.y + dy })
    }
  }
  return out
}

export function generatePattern(
  mode: RepeatMode,
  assets: SvgAsset[],
  s: PatternSettings,
): PatternInstance[] {
  if (!assets.length) return []
  const out: PatternInstance[] = []
  const stepX = Math.max(24, s.motifSize + s.gapX)
  const stepY = Math.max(24, s.motifSize + s.gapY)

  if (mode === 'toss') {
    const rand = mulberry32(s.seed)
    const count = Math.max(1, Math.round((s.density / 100) * 42))
    for (let i = 0; i < count; i++) {
      const assetIndex = i % assets.length
      const asset = assets[assetIndex]
      const d = dims(asset, s.motifSize * (0.72 + rand() * 0.56))
      const item: PatternInstance = {
        key: `toss-${i}`,
        assetIndex,
        x: rand() * s.tileWidth,
        y: rand() * s.tileHeight,
        width: d.width,
        height: d.height,
        rotation: s.rotation + (rand() * 2 - 1) * s.randomRotation,
        flipX: rand() > 0.72,
      }
      out.push(...wrapped(item, s.tileWidth, s.tileHeight))
    }
    return out
  }

  if (mode === 'kawung') {
    let index = 0
    for (let y = -stepY; y <= s.tileHeight + stepY; y += stepY) {
      for (let x = -stepX; x <= s.tileWidth + stepX; x += stepX) {
        const assetIndex = index++ % assets.length
        const asset = assets[assetIndex]
        const d = dims(asset, s.motifSize * 0.62)
        ;[0, 90, 180, 270].forEach((angle, arm) => {
          const radius = s.motifSize * 0.27
          const rad = (angle * Math.PI) / 180
          out.push({
            key: `k-${x}-${y}-${arm}`,
            assetIndex,
            x: x + Math.cos(rad) * radius,
            y: y + Math.sin(rad) * radius,
            width: d.width,
            height: d.height,
            rotation: angle + s.rotation,
          })
        })
      }
    }
    return out
  }

  let row = 0
  let counter = 0
  for (let y = -stepY; y <= s.tileHeight + stepY; y += stepY, row++) {
    let col = 0
    for (let x = -stepX; x <= s.tileWidth + stepX; x += stepX, col++) {
      const assetIndex = counter++ % assets.length
      const asset = assets[assetIndex]
      const d = dims(asset, s.motifSize)
      let px = x
      let py = y
      let rotation = s.rotation

      if (mode === 'half-drop' && col % 2 !== 0) py += stepY / 2
      if (mode === 'brick' && row % 2 !== 0) px += stepX / 2
      if (mode === 'ceplok') {
        px += row % 2 ? stepX / 2 : 0
        rotation += (row + col) % 2 ? 45 : 0
      }

      out.push({ key: `${mode}-${row}-${col}`, assetIndex, x: px, y: py, width: d.width, height: d.height, rotation })
    }
  }
  return out
}

function esc(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function buildSvg(assets: SvgAsset[], instances: PatternInstance[], s: PatternSettings) {
  const body = instances
    .map((item) => {
      const asset = assets[item.assetIndex]
      if (!asset) return ''
      const sx = item.flipX ? -1 : 1
      const sy = item.flipY ? -1 : 1
      return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})"><svg width="${item.width}" height="${item.height}" viewBox="${esc(asset.viewBox)}" preserveAspectRatio="xMidYMid meet">${asset.innerSvg}</svg></g>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.tileWidth}" height="${s.tileHeight}" viewBox="0 0 ${s.tileWidth} ${s.tileHeight}"><rect width="100%" height="100%" fill="${esc(s.background)}"/>${body}</svg>`
}
