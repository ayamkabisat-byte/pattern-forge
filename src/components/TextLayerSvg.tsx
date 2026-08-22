import type { TextLayer } from '../types'

type Props = {
  layer: TextLayer
  selected?: boolean
  onSelect?: (id: string) => void
  interactive?: boolean
}

function anchorFor(align: TextLayer['align']) {
  if (align === 'left') return 'start'
  if (align === 'right') return 'end'
  return 'middle'
}

function estimatedWidth(layer: TextLayer) {
  const lines = layer.text.split(/\r?\n/)
  const longest = Math.max(1, ...lines.map((line) => Array.from(line).length))
  const base = longest * layer.fontSize * 0.62
  const tracking = Math.max(0, longest - 1) * layer.letterSpacing
  return Math.max(layer.fontSize * 1.5, base + tracking)
}

export default function TextLayerSvg({ layer, selected = false, onSelect, interactive = false }: Props) {
  const lines = layer.text.split(/\r?\n/)
  const lineStep = layer.fontSize * layer.lineHeight
  const firstY = -((lines.length - 1) * lineStep) / 2
  const estimateW = estimatedWidth(layer)
  const estimateH = Math.max(layer.fontSize * 1.15, (lines.length - 1) * lineStep + layer.fontSize * 1.15)
  const anchor = anchorFor(layer.align)
  const rectX = layer.align === 'left' ? 0 : layer.align === 'right' ? -estimateW : -estimateW / 2

  return (
    <g
      className={`pf-text-layer${selected ? ' selected' : ''}`}
      transform={`translate(${layer.x} ${layer.y}) rotate(${layer.rotation})`}
      opacity={layer.opacity}
      onClick={interactive && onSelect ? (event) => { event.stopPropagation(); onSelect(layer.id) } : undefined}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {selected && (
        <>
          <rect
            x={rectX - 12}
            y={-estimateH / 2 - 10}
            width={estimateW + 24}
            height={estimateH + 20}
            className="pf-text-selection"
            pointerEvents="none"
          />
          <circle cx="0" cy="0" r="5" className="pf-text-anchor" pointerEvents="none" />
        </>
      )}
      <text
        x="0"
        y="0"
        fill={layer.fill}
        fontFamily={`'${layer.fontFamily}', sans-serif`}
        fontSize={layer.fontSize}
        fontWeight={layer.fontWeight}
        letterSpacing={layer.letterSpacing}
        textAnchor={anchor}
        direction={layer.direction}
        unicodeBidi="plaintext"
        dominantBaseline="middle"
        style={{ fontKerning: 'normal' }}
      >
        {lines.map((line, index) => (
          <tspan key={`${layer.id}-${index}`} x="0" y={firstY + index * lineStep}>{line || ' '}</tspan>
        ))}
      </text>
    </g>
  )
}
