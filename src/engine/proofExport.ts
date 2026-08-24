function innerSvg(svg: string) {
  const start = svg.indexOf('>')
  const end = svg.lastIndexOf('</svg>')
  if (start < 0 || end < 0) return svg
  return svg.slice(start + 1, end)
}

export function buildRepeatProofSvg(tileSvg: string, tileWidth: number, tileHeight: number, copies = 3) {
  const safeCopies = Math.max(2, Math.min(9, Math.round(copies)))
  const body = innerSvg(tileSvg)
  const tiles: string[] = []

  for (let row = 0; row < safeCopies; row++) {
    for (let col = 0; col < safeCopies; col++) {
      tiles.push(`<svg x="${col * tileWidth}" y="${row * tileHeight}" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}" overflow="hidden">${body}</svg>`)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth * safeCopies}" height="${tileHeight * safeCopies}" viewBox="0 0 ${tileWidth * safeCopies} ${tileHeight * safeCopies}">${tiles.join('')}</svg>`
}
