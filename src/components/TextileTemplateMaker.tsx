import { useMemo, useState } from 'react'

type Props = {
  onOpenCustom: () => void
  onOpenPlaid: () => void
}

type Category = 'Southeast Asian Woven Geometry' | 'Nordic / Sweater Geometry' | 'Universal Woven Geometry'

type TemplateKind =
  | 'diamond-tabur'
  | 'staggered-star'
  | 'bamboo-row'
  | 'tumpal-row'
  | 'chain-lattice'
  | 'checker-weave'
  | 'chevron-weave'
  | 'horizontal-bands'
  | 'nordic-diamond'
  | 'nordic-cross'
  | 'nordic-star'
  | 'nordic-oxo'
  | 'nordic-tree'
  | 'nordic-snow'
  | 'nordic-multiband'
  | 'nordic-medallion'
  | 'stepped-diamond'
  | 'arrow-band'
  | 'sawtooth'
  | 'interlock'
  | 'broken-stripe'
  | 'cross-lattice'
  | 'lozenge'
  | 'maze-weave'

type TextileTemplate = {
  id: string
  name: string
  category: Category
  hint: string
  kind: TemplateKind
  width: number
  height: number
  slotsUsed: number
}

const TEMPLATES: TextileTemplate[] = [
  { id: 'sea-tabur-diamond', name: 'Tabur Diamond', category: 'Southeast Asian Woven Geometry', hint: 'Sparse staggered diamond field', kind: 'diamond-tabur', width: 96, height: 96, slotsUsed: 5 },
  { id: 'sea-star-tabur', name: 'Star Tabur', category: 'Southeast Asian Woven Geometry', hint: 'Alternating star and diamond field', kind: 'staggered-star', width: 120, height: 120, slotsUsed: 6 },
  { id: 'sea-bamboo-row', name: 'Bamboo Shoot Row', category: 'Southeast Asian Woven Geometry', hint: 'Repeated upright triangle frieze', kind: 'bamboo-row', width: 132, height: 84, slotsUsed: 5 },
  { id: 'sea-tumpal-row', name: 'Opposed Triangle Row', category: 'Southeast Asian Woven Geometry', hint: 'Alternating up and down triangular border', kind: 'tumpal-row', width: 132, height: 88, slotsUsed: 6 },
  { id: 'sea-chain-lattice', name: 'Chain Diamond Lattice', category: 'Southeast Asian Woven Geometry', hint: 'Linked diamond lattice repeat', kind: 'chain-lattice', width: 108, height: 108, slotsUsed: 6 },
  { id: 'sea-checker-weave', name: 'Checker Weave', category: 'Southeast Asian Woven Geometry', hint: 'Geometric checker with woven accents', kind: 'checker-weave', width: 104, height: 104, slotsUsed: 5 },
  { id: 'sea-chevron-weave', name: 'Chevron Weave', category: 'Southeast Asian Woven Geometry', hint: 'Layered zigzag textile band', kind: 'chevron-weave', width: 144, height: 88, slotsUsed: 6 },
  { id: 'sea-horizontal-bands', name: 'Horizontal Woven Bands', category: 'Southeast Asian Woven Geometry', hint: 'Multi-band frieze structure', kind: 'horizontal-bands', width: 144, height: 176, slotsUsed: 8 },

  { id: 'nordic-diamond', name: 'Nordic Diamond Row', category: 'Nordic / Sweater Geometry', hint: 'Balanced diamond knit-style row', kind: 'nordic-diamond', width: 112, height: 84, slotsUsed: 5 },
  { id: 'nordic-cross', name: 'Nordic Cross Row', category: 'Nordic / Sweater Geometry', hint: 'Crosses with small separators', kind: 'nordic-cross', width: 112, height: 84, slotsUsed: 5 },
  { id: 'nordic-star', name: 'Nordic Star Row', category: 'Nordic / Sweater Geometry', hint: 'Eight-point geometric star rhythm', kind: 'nordic-star', width: 120, height: 96, slotsUsed: 6 },
  { id: 'nordic-oxo', name: 'Nordic OXO Row', category: 'Nordic / Sweater Geometry', hint: 'Circle-diamond-cross inspired row rhythm', kind: 'nordic-oxo', width: 156, height: 84, slotsUsed: 6 },
  { id: 'nordic-tree', name: 'Nordic Tree Row', category: 'Nordic / Sweater Geometry', hint: 'Pixel-like tree and diamond row', kind: 'nordic-tree', width: 132, height: 96, slotsUsed: 6 },
  { id: 'nordic-snow', name: 'Nordic Snow Row', category: 'Nordic / Sweater Geometry', hint: 'Geometric snowflake band', kind: 'nordic-snow', width: 112, height: 96, slotsUsed: 6 },
  { id: 'nordic-multiband', name: 'Nordic Multi Band', category: 'Nordic / Sweater Geometry', hint: 'Small-large-small band sequence', kind: 'nordic-multiband', width: 156, height: 184, slotsUsed: 8 },
  { id: 'nordic-medallion', name: 'Nordic Medallion', category: 'Nordic / Sweater Geometry', hint: 'Large repeated geometric medallion', kind: 'nordic-medallion', width: 144, height: 128, slotsUsed: 7 },

  { id: 'woven-stepped-diamond', name: 'Stepped Diamond', category: 'Universal Woven Geometry', hint: 'Stair-step rhombus repeat', kind: 'stepped-diamond', width: 108, height: 108, slotsUsed: 6 },
  { id: 'woven-arrow-band', name: 'Arrow Band', category: 'Universal Woven Geometry', hint: 'Repeated directional arrow frieze', kind: 'arrow-band', width: 144, height: 84, slotsUsed: 6 },
  { id: 'woven-sawtooth', name: 'Sawtooth Band', category: 'Universal Woven Geometry', hint: 'Alternating triangular teeth', kind: 'sawtooth', width: 144, height: 76, slotsUsed: 5 },
  { id: 'woven-interlock', name: 'Interlock Steps', category: 'Universal Woven Geometry', hint: 'Interlocking stepped blocks', kind: 'interlock', width: 120, height: 108, slotsUsed: 6 },
  { id: 'woven-broken-stripe', name: 'Broken Stripe', category: 'Universal Woven Geometry', hint: 'Offset stripe with block accents', kind: 'broken-stripe', width: 144, height: 96, slotsUsed: 7 },
  { id: 'woven-cross-lattice', name: 'Cross Lattice', category: 'Universal Woven Geometry', hint: 'Cross and diamond lattice', kind: 'cross-lattice', width: 108, height: 108, slotsUsed: 6 },
  { id: 'woven-lozenge', name: 'Lozenge Repeat', category: 'Universal Woven Geometry', hint: 'Nested lozenge all-over repeat', kind: 'lozenge', width: 108, height: 108, slotsUsed: 6 },
  { id: 'woven-maze', name: 'Maze Weave', category: 'Universal Woven Geometry', hint: 'Stepped meander maze repeat', kind: 'maze-weave', width: 132, height: 132, slotsUsed: 7 },
]

const DEFAULT_PALETTE = ['#15241F', '#D4B15A', '#7E2637', '#E9DEC7', '#2F5A4A', '#B9673B', '#27211C', '#F2EEE4']

const QUICK_PALETTES: Array<{ name: string; colors: string[] }> = [
  { name: 'Gold Maroon', colors: ['#17251F', '#D4B15A', '#7A2535', '#EFE2C5', '#315B4B', '#A84F35', '#241D19', '#F7F0DF'] },
  { name: 'Indigo Earth', colors: ['#17263C', '#C69B55', '#8B4A35', '#E8DDC5', '#35566F', '#687A52', '#211C1A', '#F5EFE3'] },
  { name: 'Nordic Winter', colors: ['#10283B', '#E8EFF2', '#A52A37', '#C8DCE5', '#2D5967', '#D7B36A', '#172027', '#FFFFFF'] },
  { name: 'Forest Red', colors: ['#14352B', '#D5B76D', '#9B2634', '#F0E6D2', '#42705C', '#C76A43', '#1F2620', '#FCF6E9'] },
  { name: 'Desert Loom', colors: ['#4A2D22', '#D9A85A', '#B95E3F', '#E8D3AE', '#7E6A43', '#6A2F35', '#251D18', '#F3E6CC'] },
  { name: 'Jewel', colors: ['#173C45', '#D5AA3D', '#8A1E52', '#E7D7C0', '#1F6A5A', '#5E3D8C', '#171923', '#F7F1E8'] },
  { name: 'Monochrome', colors: ['#111111', '#F2F2F2', '#4A4A4A', '#C9C9C9', '#747474', '#9A9A9A', '#252525', '#FFFFFF'] },
  { name: 'Pastel Folk', colors: ['#F1D9D7', '#E8C66A', '#AFCBD5', '#FFF2D9', '#B8C9A5', '#C493B1', '#6A6460', '#FFF9EE'] },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function diamond(cx: number, cy: number, rx: number, ry: number, fill: string, stroke = 'none', sw = 0) {
  return `<polygon points="${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
}

function triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, fill: string) {
  return `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${fill}"/>`
}

function rect(x: number, y: number, width: number, height: number, fill: string, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" fill-opacity="${opacity}"/>`
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string, sw: number) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>`
}

function cellMarkup(kind: TemplateKind, colors: string[], width: number, height: number, lineWeight: number) {
  const [A, B, C, D, E, F, G, H] = colors
  const cx = width / 2
  const cy = height / 2
  const qx = width / 4
  const qy = height / 4
  const s = lineWeight

  switch (kind) {
    case 'diamond-tabur':
      return rect(0, 0, width, height, A) +
        diamond(cx, cy, width * 0.22, height * 0.27, B) +
        diamond(cx, cy, width * 0.11, height * 0.14, C) +
        diamond(0, 0, width * 0.16, height * 0.19, D) +
        diamond(width, height, width * 0.16, height * 0.19, D) +
        diamond(width, 0, width * 0.1, height * 0.12, E) +
        diamond(0, height, width * 0.1, height * 0.12, E)

    case 'staggered-star': {
      const star = `<polygon points="${cx},${height * 0.13} ${width * 0.59},${height * 0.36} ${width * 0.84},${cy} ${width * 0.59},${height * 0.64} ${cx},${height * 0.87} ${width * 0.41},${height * 0.64} ${width * 0.16},${cy} ${width * 0.41},${height * 0.36}" fill="${B}"/>`
      return rect(0, 0, width, height, A) + star + diamond(cx, cy, width * 0.15, height * 0.15, C) + diamond(cx, cy, width * 0.07, height * 0.07, D) +
        diamond(0, 0, width * 0.13, height * 0.13, E) + diamond(width, height, width * 0.13, height * 0.13, E) +
        diamond(width, 0, width * 0.09, height * 0.09, F) + diamond(0, height, width * 0.09, height * 0.09, F)
    }

    case 'bamboo-row':
      return rect(0, 0, width, height, A) + rect(0, height * 0.78, width, height * 0.22, E) +
        triangle(0, height * 0.78, qx, height * 0.16, width / 2, height * 0.78, B) +
        triangle(width / 2, height * 0.78, width * 0.75, height * 0.16, width, height * 0.78, B) +
        triangle(width * 0.13, height * 0.72, qx, height * 0.39, width * 0.37, height * 0.72, C) +
        triangle(width * 0.63, height * 0.72, width * 0.75, height * 0.39, width * 0.87, height * 0.72, C) +
        line(0, height * 0.78, width, height * 0.78, D, s)

    case 'tumpal-row':
      return rect(0, 0, width, height, A) +
        triangle(0, height, qx, height * 0.15, width / 2, height, B) +
        triangle(width / 2, 0, width * 0.75, height * 0.85, width, 0, C) +
        triangle(width * 0.13, height * 0.88, qx, height * 0.52, width * 0.37, height * 0.88, D) +
        triangle(width * 0.63, height * 0.12, width * 0.75, height * 0.48, width * 0.87, height * 0.12, E) +
        line(0, cy, width, cy, F, s)

    case 'chain-lattice':
      return rect(0, 0, width, height, A) +
        diamond(cx, cy, width * 0.43, height * 0.43, 'none', B, s * 1.35) +
        diamond(cx, cy, width * 0.28, height * 0.28, 'none', C, s) +
        diamond(cx, cy, width * 0.13, height * 0.13, D) +
        diamond(0, cy, width * 0.18, height * 0.18, E) + diamond(width, cy, width * 0.18, height * 0.18, E) +
        diamond(cx, 0, width * 0.18, height * 0.18, F) + diamond(cx, height, width * 0.18, height * 0.18, F)

    case 'checker-weave':
      return rect(0, 0, width, height, A) +
        rect(0, 0, width / 2, height / 2, B) + rect(width / 2, height / 2, width / 2, height / 2, B) +
        rect(width / 2, 0, width / 2, height / 2, C) + rect(0, height / 2, width / 2, height / 2, C) +
        rect(qx - s / 2, 0, s, height, D, 0.72) + rect(width * 0.75 - s / 2, 0, s, height, D, 0.72) +
        rect(0, qy - s / 2, width, s, E, 0.72) + rect(0, height * 0.75 - s / 2, width, s, E, 0.72)

    case 'chevron-weave':
      return rect(0, 0, width, height, A) +
        `<polyline points="0,${height * 0.68} ${qx},${height * 0.3} ${width / 2},${height * 0.68} ${width * 0.75},${height * 0.3} ${width},${height * 0.68}" fill="none" stroke="${B}" stroke-width="${height * 0.22}" stroke-linejoin="miter"/>` +
        `<polyline points="0,${height * 0.7} ${qx},${height * 0.42} ${width / 2},${height * 0.7} ${width * 0.75},${height * 0.42} ${width},${height * 0.7}" fill="none" stroke="${C}" stroke-width="${height * 0.08}"/>` +
        line(0, height * 0.12, width, height * 0.12, D, s) + line(0, height * 0.88, width, height * 0.88, E, s) +
        rect(0, height * 0.47 - s / 2, width, s, F, 0.72)

    case 'horizontal-bands':
      return rect(0, 0, width, height, A) +
        rect(0, 0, width, height * 0.16, B) + rect(0, height * 0.16, width, height * 0.1, C) +
        `<polyline points="0,${height * 0.4} ${qx},${height * 0.29} ${width / 2},${height * 0.4} ${width * 0.75},${height * 0.29} ${width},${height * 0.4}" fill="none" stroke="${D}" stroke-width="${height * 0.08}"/>` +
        rect(0, height * 0.48, width, height * 0.12, E) +
        diamond(qx, height * 0.54, width * 0.08, height * 0.055, F) + diamond(width * 0.75, height * 0.54, width * 0.08, height * 0.055, F) +
        rect(0, height * 0.66, width, height * 0.08, G) +
        `<polyline points="0,${height * 0.88} ${qx},${height * 0.77} ${width / 2},${height * 0.88} ${width * 0.75},${height * 0.77} ${width},${height * 0.88}" fill="none" stroke="${H}" stroke-width="${height * 0.07}"/>`

    case 'nordic-diamond':
      return rect(0, 0, width, height, A) + diamond(cx, cy, width * 0.28, height * 0.34, B) + diamond(cx, cy, width * 0.17, height * 0.2, C) + diamond(cx, cy, width * 0.07, height * 0.09, D) +
        diamond(0, cy, width * 0.1, height * 0.12, E) + diamond(width, cy, width * 0.1, height * 0.12, E)

    case 'nordic-cross':
      return rect(0, 0, width, height, A) +
        rect(cx - width * 0.08, height * 0.18, width * 0.16, height * 0.64, B) + rect(width * 0.2, cy - height * 0.1, width * 0.6, height * 0.2, B) +
        rect(cx - width * 0.035, height * 0.28, width * 0.07, height * 0.44, C) + rect(width * 0.3, cy - height * 0.045, width * 0.4, height * 0.09, C) +
        diamond(0, cy, width * 0.09, height * 0.1, D) + diamond(width, cy, width * 0.09, height * 0.1, E)

    case 'nordic-star': {
      const pts = `${cx},${height * 0.08} ${width * 0.58},${height * 0.34} ${width * 0.86},${cy} ${width * 0.58},${height * 0.66} ${cx},${height * 0.92} ${width * 0.42},${height * 0.66} ${width * 0.14},${cy} ${width * 0.42},${height * 0.34}`
      return rect(0, 0, width, height, A) + `<polygon points="${pts}" fill="${B}"/>` + diamond(cx, cy, width * 0.16, height * 0.17, C) + diamond(cx, cy, width * 0.07, height * 0.075, D) +
        rect(0, cy - s / 2, width * 0.13, s, E) + rect(width * 0.87, cy - s / 2, width * 0.13, s, F)
    }

    case 'nordic-oxo':
      return rect(0, 0, width, height, A) +
        `<circle cx="${width * 0.18}" cy="${cy}" r="${height * 0.21}" fill="none" stroke="${B}" stroke-width="${s * 1.4}"/>` +
        diamond(width / 2, cy, width * 0.12, height * 0.24, C) +
        rect(width * 0.78 - width * 0.045, height * 0.24, width * 0.09, height * 0.52, D) + rect(width * 0.67, cy - height * 0.055, width * 0.22, height * 0.11, D) +
        diamond(width * 0.18, cy, width * 0.055, height * 0.09, E) + diamond(width / 2, cy, width * 0.045, height * 0.09, F)

    case 'nordic-tree':
      return rect(0, 0, width, height, A) +
        triangle(width * 0.07, height * 0.72, width * 0.25, height * 0.12, width * 0.43, height * 0.72, B) + rect(width * 0.22, height * 0.72, width * 0.06, height * 0.16, C) +
        triangle(width * 0.57, height * 0.72, width * 0.75, height * 0.12, width * 0.93, height * 0.72, D) + rect(width * 0.72, height * 0.72, width * 0.06, height * 0.16, E) +
        diamond(cx, cy, width * 0.06, height * 0.09, F)

    case 'nordic-snow':
      return rect(0, 0, width, height, A) +
        line(cx, height * 0.12, cx, height * 0.88, B, s * 1.3) + line(width * 0.17, cy, width * 0.83, cy, B, s * 1.3) +
        line(width * 0.27, height * 0.24, width * 0.73, height * 0.76, C, s) + line(width * 0.73, height * 0.24, width * 0.27, height * 0.76, C, s) +
        diamond(cx, cy, width * 0.09, height * 0.1, D) + diamond(0, cy, width * 0.07, height * 0.08, E) + diamond(width, cy, width * 0.07, height * 0.08, F)

    case 'nordic-multiband':
      return rect(0, 0, width, height, A) + rect(0, 0, width, height * 0.12, B) +
        diamond(qx, height * 0.24, width * 0.08, height * 0.065, C) + diamond(width * 0.75, height * 0.24, width * 0.08, height * 0.065, C) +
        `<polyline points="0,${height * 0.42} ${qx},${height * 0.32} ${width / 2},${height * 0.42} ${width * 0.75},${height * 0.32} ${width},${height * 0.42}" fill="none" stroke="${D}" stroke-width="${height * 0.06}"/>` +
        diamond(cx, height * 0.6, width * 0.2, height * 0.11, E) + diamond(cx, height * 0.6, width * 0.09, height * 0.05, F) +
        rect(0, height * 0.76, width, height * 0.07, G) +
        `<polyline points="0,${height * 0.94} ${qx},${height * 0.86} ${width / 2},${height * 0.94} ${width * 0.75},${height * 0.86} ${width},${height * 0.94}" fill="none" stroke="${H}" stroke-width="${height * 0.045}"/>`

    case 'nordic-medallion':
      return rect(0, 0, width, height, A) + diamond(cx, cy, width * 0.38, height * 0.39, B) + diamond(cx, cy, width * 0.28, height * 0.29, C) +
        `<polygon points="${cx},${height * 0.24} ${width * 0.59},${height * 0.41} ${width * 0.76},${cy} ${width * 0.59},${height * 0.59} ${cx},${height * 0.76} ${width * 0.41},${height * 0.59} ${width * 0.24},${cy} ${width * 0.41},${height * 0.41}" fill="${D}"/>` +
        diamond(cx, cy, width * 0.08, height * 0.09, E) + diamond(0, cy, width * 0.09, height * 0.1, F) + diamond(width, cy, width * 0.09, height * 0.1, F) +
        diamond(cx, 0, width * 0.08, height * 0.09, G) + diamond(cx, height, width * 0.08, height * 0.09, G)

    case 'stepped-diamond':
      return rect(0, 0, width, height, A) +
        `<path d="M ${cx} ${height * 0.08} L ${width * 0.9} ${cy} L ${cx} ${height * 0.92} L ${width * 0.1} ${cy} Z M ${cx} ${height * 0.24} L ${width * 0.74} ${cy} L ${cx} ${height * 0.76} L ${width * 0.26} ${cy} Z" fill="${B}" fill-rule="evenodd"/>` +
        diamond(cx, cy, width * 0.18, height * 0.18, C) + diamond(cx, cy, width * 0.08, height * 0.08, D) +
        rect(0, cy - s / 2, width * 0.14, s, E) + rect(width * 0.86, cy - s / 2, width * 0.14, s, F)

    case 'arrow-band':
      return rect(0, 0, width, height, A) +
        `<polygon points="0,${height * 0.22} ${width * 0.38},${cy} 0,${height * 0.78} ${width * 0.18},${cy}" fill="${B}"/>` +
        `<polygon points="${width * 0.5},${height * 0.22} ${width * 0.88},${cy} ${width * 0.5},${height * 0.78} ${width * 0.68},${cy}" fill="${C}"/>` +
        rect(width * 0.38, cy - s, width * 0.12, s * 2, D) + rect(width * 0.88, cy - s, width * 0.12, s * 2, E) +
        line(0, height * 0.1, width, height * 0.1, F, s)

    case 'sawtooth':
      return rect(0, 0, width, height, A) +
        triangle(0, height * 0.82, width * 0.25, height * 0.18, width * 0.5, height * 0.82, B) +
        triangle(width * 0.5, height * 0.82, width * 0.75, height * 0.18, width, height * 0.82, C) +
        triangle(width * 0.12, height * 0.74, width * 0.25, height * 0.4, width * 0.38, height * 0.74, D) +
        triangle(width * 0.62, height * 0.74, width * 0.75, height * 0.4, width * 0.88, height * 0.74, D) + line(0, height * 0.86, width, height * 0.86, E, s)

    case 'interlock':
      return rect(0, 0, width, height, A) +
        `<path d="M0 ${height * 0.18} H${width * 0.44} V${height * 0.45} H${width * 0.72} V${height * 0.18} H${width} V${height * 0.38} H${width * 0.82} V${height * 0.62} H${width * 0.55} V${height * 0.82} H${width * 0.28} V${height * 0.55} H0 Z" fill="${B}"/>` +
        `<path d="M0 ${height * 0.62} H${width * 0.18} V${height * 0.38} H${width * 0.45} V${height * 0.18} H${width * 0.58} V${height * 0.48} H${width * 0.84} V${height * 0.82} H${width} V${height} H${width * 0.56} V${height * 0.73} H${width * 0.3} V${height} H0 Z" fill="${C}" fill-opacity="0.82"/>` +
        diamond(cx, cy, width * 0.08, height * 0.09, D) + line(0, 0, width, 0, E, s) + line(0, height, width, height, F, s)

    case 'broken-stripe':
      return rect(0, 0, width, height, A) + rect(0, 0, width * 0.18, height, B) + rect(width * 0.36, 0, width * 0.18, height, C) + rect(width * 0.72, 0, width * 0.18, height, D) +
        rect(width * 0.18, height * 0.18, width * 0.18, height * 0.2, E) + rect(width * 0.54, height * 0.62, width * 0.18, height * 0.2, F) +
        rect(width * 0.9, height * 0.18, width * 0.1, height * 0.2, E) + line(0, cy, width, cy, G, s)

    case 'cross-lattice':
      return rect(0, 0, width, height, A) + diamond(cx, cy, width * 0.42, height * 0.42, 'none', B, s) +
        rect(cx - width * 0.055, height * 0.25, width * 0.11, height * 0.5, C) + rect(width * 0.25, cy - height * 0.055, width * 0.5, height * 0.11, C) +
        diamond(cx, cy, width * 0.11, height * 0.11, D) + diamond(0, 0, width * 0.1, height * 0.1, E) + diamond(width, height, width * 0.1, height * 0.1, F)

    case 'lozenge':
      return rect(0, 0, width, height, A) + diamond(cx, cy, width * 0.45, height * 0.45, B) + diamond(cx, cy, width * 0.34, height * 0.34, C) +
        diamond(cx, cy, width * 0.22, height * 0.22, D) + diamond(cx, cy, width * 0.09, height * 0.09, E) +
        diamond(0, cy, width * 0.08, height * 0.11, F) + diamond(width, cy, width * 0.08, height * 0.11, F)

    case 'maze-weave':
      return rect(0, 0, width, height, A) +
        `<path d="M0 ${height * 0.18} H${width * 0.82} V${height * 0.82} H${width * 0.18} V${height * 0.36} H${width * 0.64} V${height * 0.64} H${width * 0.36} V${height * 0.5} H${width * 0.52}" fill="none" stroke="${B}" stroke-width="${s * 1.6}" stroke-linejoin="miter"/>` +
        `<path d="M${width} ${height * 0.82} H${width * 0.18} V${height * 0.18} H${width * 0.82} V${height * 0.64} H${width * 0.36} V${height * 0.36} H${width * 0.64} V${height * 0.5} H${width * 0.48}" fill="none" stroke="${C}" stroke-width="${s}" stroke-linejoin="miter"/>` +
        diamond(cx, cy, width * 0.07, height * 0.07, D) + rect(0, 0, width, s, E) + rect(0, height - s, width, s, F) + rect(0, 0, s, height, G)
  }
}

export default function TextileTemplateMaker({ onOpenCustom, onOpenPlaid }: Props) {
  const [category, setCategory] = useState<Category>('Southeast Asian Woven Geometry')
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [palette, setPalette] = useState<string[]>([...DEFAULT_PALETTE])
  const [quickHex, setQuickHex] = useState(DEFAULT_PALETTE.join(', '))
  const [repeatScale, setRepeatScale] = useState(1)
  const [stretchX, setStretchX] = useState(1)
  const [stretchY, setStretchY] = useState(1)
  const [lineWeight, setLineWeight] = useState(5)
  const [colorShift, setColorShift] = useState(0)
  const [reversePalette, setReversePalette] = useState(false)
  const [view, setView] = useState<'tile' | 'proof'>('tile')
  const [showBoundary, setShowBoundary] = useState(false)
  const [message, setMessage] = useState('Choose a mathematical textile template, paste up to 8 HEX colors, then export a seamless vector tile.')

  const template = TEMPLATES.find((entry) => entry.id === templateId) ?? TEMPLATES[0]
  const filtered = TEMPLATES.filter((entry) => entry.category === category)

  const effectivePalette = useMemo(() => {
    const base = reversePalette ? [...palette].reverse() : [...palette]
    return base.map((_, index) => base[(index + colorShift) % base.length])
  }, [palette, colorShift, reversePalette])

  const cellWidth = Math.max(24, template.width * repeatScale * stretchX)
  const cellHeight = Math.max(24, template.height * repeatScale * stretchY)
  const markup = useMemo(() => cellMarkup(template.kind, effectivePalette, cellWidth, cellHeight, lineWeight), [template, effectivePalette, cellWidth, cellHeight, lineWeight])
  const patternId = `pf-textile-template-${template.id}`

  function chooseTemplate(id: string) {
    setTemplateId(id)
    const next = TEMPLATES.find((entry) => entry.id === id)
    if (next) setMessage(`${next.name} loaded. This template uses ${next.slotsUsed} of the 8 available color slots.`)
  }

  function chooseCategory(next: Category) {
    setCategory(next)
    const first = TEMPLATES.find((entry) => entry.category === next)
    if (first) chooseTemplate(first.id)
  }

  function applyHex() {
    const matches = quickHex.match(/#?[0-9a-f]{3,6}/gi) ?? []
    const colors = matches.map(normalizeHex).filter((entry): entry is string => Boolean(entry)).slice(0, 8)
    if (colors.length < 2) {
      setMessage('Paste at least 2 valid HEX colors. You can use up to 8 colors.')
      return
    }
    setPalette((current) => {
      const next = [...current]
      colors.forEach((color, index) => { next[index] = color })
      return next
    })
    setMessage(`${colors.length} HEX colors applied. The template can use up to 8 palette slots.`)
  }

  function setColor(index: number, color: string) {
    setPalette((current) => current.map((entry, entryIndex) => entryIndex === index ? color : entry))
  }

  function applyPalette(colors: string[], name: string) {
    setPalette([...colors])
    setQuickHex(colors.join(', '))
    setColorShift(0)
    setReversePalette(false)
    setMessage(`${name} 8-color palette applied.`)
  }

  function buildTileSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${cellWidth}" height="${cellHeight}" viewBox="0 0 ${cellWidth} ${cellHeight}"><defs><pattern id="p" width="${cellWidth}" height="${cellHeight}" patternUnits="userSpaceOnUse">${markup}</pattern></defs><rect width="${cellWidth}" height="${cellHeight}" fill="url(#p)"/></svg>`
  }

  function exportTile() {
    downloadSvg(buildTileSvg(), `patternforge-${template.id}-seamless.svg`)
    setMessage(`Seamless SVG exported: ${Math.round(cellWidth)} × ${Math.round(cellHeight)} complete repeat cell.`)
  }

  function exportProof() {
    const width = cellWidth * 3
    const height = cellHeight * 3
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="p" width="${cellWidth}" height="${cellHeight}" patternUnits="userSpaceOnUse">${markup}</pattern></defs><rect width="${width}" height="${height}" fill="url(#p)"/></svg>`
    downloadSvg(svg, `patternforge-${template.id}-3x3-proof.svg`)
  }

  return (
    <div className="v10-builder-shell v102-template-shell">
      <aside className="v10-panel v10-panel-left">
        <section>
          <h2>Template Family</h2>
          <div className="v102-category-tabs">
            {(['Southeast Asian Woven Geometry', 'Nordic / Sweater Geometry', 'Universal Woven Geometry'] as Category[]).map((entry) => (
              <button key={entry} className={category === entry ? 'active' : ''} onClick={() => chooseCategory(entry)}>{entry}</button>
            ))}
          </div>
        </section>

        <section>
          <div className="v10-section-title"><h2>Mathematical Templates</h2><span className="v102-count">{filtered.length}</span></div>
          <div className="v10-layout-list v102-template-list">
            {filtered.map((entry) => (
              <button key={entry.id} className={templateId === entry.id ? 'active' : ''} onClick={() => chooseTemplate(entry.id)}>
                <b>{entry.name}</b><span>{entry.hint}</span><small>{entry.slotsUsed} color slots · {entry.width}×{entry.height} base cell</small>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>8-Color Presets</h2>
          <div className="v102-palette-presets">
            {QUICK_PALETTES.map((entry) => (
              <button key={entry.name} onClick={() => applyPalette(entry.colors, entry.name)}>
                <span>{entry.colors.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}</span><b>{entry.name}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="v10-cultural-note">
          <h2>Structure, not authenticity claim</h2>
          <p>These are mathematical woven structures built from diamonds, triangles, bands, crosses, chevrons and step geometry. For a specific traditional motif, use Custom SVG Mode with artwork you have created or verified.</p>
          <button onClick={onOpenCustom}>Open Custom SVG Mode</button>
        </section>
      </aside>

      <main className="v10-center-stage">
        <div className="v10-stage-head">
          <div><b>{template.name}</b><span>{category} · {Math.round(cellWidth)} × {Math.round(cellHeight)} repeat cell · {template.slotsUsed}/8 color slots</span></div>
          <div className="v10-view-buttons"><button className={view === 'tile' ? 'active' : ''} onClick={() => setView('tile')}>Live Tile</button><button className={view === 'proof' ? 'active' : ''} onClick={() => setView('proof')}>3×3 Proof</button></div>
        </div>

        <div className="v10-preview-zone v102-template-preview">
          {view === 'tile' ? (
            <svg className="v10-live-svg" viewBox={`0 0 ${cellWidth} ${cellHeight}`}>
              <defs><pattern id={patternId} width={cellWidth} height={cellHeight} patternUnits="userSpaceOnUse" dangerouslySetInnerHTML={{ __html: markup }} /></defs>
              <rect width={cellWidth} height={cellHeight} fill={`url(#${patternId})`} />
              {showBoundary ? <rect width={cellWidth} height={cellHeight} className="v10-tile-outline" /> : null}
            </svg>
          ) : (
            <svg className="v10-proof-svg" viewBox={`0 0 ${cellWidth * 3} ${cellHeight * 3}`}>
              <defs><pattern id={`${patternId}-proof`} width={cellWidth} height={cellHeight} patternUnits="userSpaceOnUse" dangerouslySetInnerHTML={{ __html: markup }} /></defs>
              <rect width={cellWidth * 3} height={cellHeight * 3} fill={`url(#${patternId}-proof)`} />
              {showBoundary ? Array.from({ length: 3 }).flatMap((_, row) => Array.from({ length: 3 }).map((__, col) => <rect key={`${row}-${col}`} x={col * cellWidth} y={row * cellHeight} width={cellWidth} height={cellHeight} className="v10-tile-outline" />)) : null}
            </svg>
          )}
        </div>
        <div className="v10-stage-status"><span>{message}</span><b>MATHEMATICAL SEAMLESS TEMPLATE</b></div>
      </main>

      <aside className="v10-panel v10-panel-right">
        <section>
          <h2>HEX Palette · up to 8</h2>
          <textarea className="v10-hex-input v102-hex-input" rows={4} value={quickHex} onChange={(event) => setQuickHex(event.target.value)} placeholder="#15241F, #D4B15A, #7E2637, #E9DEC7, #2F5A4A, #B9673B, #27211C, #F2EEE4" />
          <button className="v10-primary-action" onClick={applyHex}>Apply HEX Palette</button>
          <div className="v102-color-slots">
            {palette.map((color, index) => (
              <label key={index} className={index >= template.slotsUsed ? 'unused' : ''}>
                <span>{String.fromCharCode(65 + index)}</span>
                <input type="color" value={color} onChange={(event) => setColor(index, event.target.value)} />
                <code>{color.toUpperCase()}</code>
                <em>{index < template.slotsUsed ? 'USED' : 'READY'}</em>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2>Geometry Controls</h2>
          <label><span>Repeat scale</span><input type="range" min="0.4" max="3" step="0.05" value={repeatScale} onChange={(event) => setRepeatScale(Number(event.target.value))} /><output>{repeatScale.toFixed(2)}×</output></label>
          <label><span>Horizontal stretch</span><input type="range" min="0.55" max="1.8" step="0.05" value={stretchX} onChange={(event) => setStretchX(Number(event.target.value))} /><output>{stretchX.toFixed(2)}×</output></label>
          <label><span>Vertical stretch</span><input type="range" min="0.55" max="1.8" step="0.05" value={stretchY} onChange={(event) => setStretchY(Number(event.target.value))} /><output>{stretchY.toFixed(2)}×</output></label>
          <label><span>Line / separator weight</span><input type="range" min="1" max="16" step="1" value={lineWeight} onChange={(event) => setLineWeight(Number(event.target.value))} /><output>{lineWeight}px</output></label>
          <label><span>Palette shift</span><input type="range" min="0" max="7" step="1" value={colorShift} onChange={(event) => setColorShift(Number(event.target.value))} /><output>{colorShift}</output></label>
          <label className="v10-check"><input type="checkbox" checked={reversePalette} onChange={(event) => setReversePalette(event.target.checked)} /> Reverse color order</label>
          <label className="v10-check"><input type="checkbox" checked={showBoundary} onChange={(event) => setShowBoundary(event.target.checked)} /> Show repeat cell boundary</label>
          <button className="v10-wide-button" onClick={() => setColorShift((current) => (current + 1) % 8)}>Rotate Palette Assignment</button>
        </section>

        <section>
          <h2>Export</h2>
          <button className="v10-primary-action" onClick={exportTile}>Export Seamless SVG</button>
          <button className="v10-wide-button" onClick={exportProof}>Export 3×3 Proof SVG</button>
          <small>The SVG contains a complete mathematical repeat cell. No uploaded image, raster dependency or font is required in Template Mode.</small>
        </section>

        <section>
          <h2>Other Textile Modes</h2>
          <button className="v10-wide-button" onClick={onOpenCustom}>Custom SVG Textile</button>
          <button className="v10-wide-button" onClick={onOpenPlaid}>Plaid / Tartan Maker</button>
        </section>
      </aside>
    </div>
  )
}
