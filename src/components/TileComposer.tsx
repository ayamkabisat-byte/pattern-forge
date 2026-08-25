import TextLayerSvg from './TextLayerSvg'
import { blockBounds, findPlacementCoveringCell, isFreePlacement, mirrorLabel, spanCols, spanRows } from '../engine/builder'
import type { PatternGeometry, PatternInstance, PatternSettings, SvgAsset, TextLayer, TileCellPlacement } from '../types'

type Props = {
  assets: SvgAsset[]
  placements: TileCellPlacement[]
  instances: PatternInstance[]
  geometry: PatternGeometry
  settings: PatternSettings
  selectedKey: string | null
  activeAssetId: string | null
  erasing?: boolean
  wrapEdges?: boolean
  textLayers?: TextLayer[]
  selectedTextId?: string | null
  onTextSelect?: (id: string) => void
  onPlacementSelect?: (key: string) => void
  onCellClick: (row: number, col: number) => void
}

function Instance({ item, asset, dx = 0, dy = 0, opacity = 1 }: { item: PatternInstance; asset: SvgAsset; dx?: number; dy?: number; opacity?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g opacity={opacity} pointerEvents="none" transform={`translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function MirrorBadge({ x, y, label }: { x: number; y: number; label: string }) {
  const width = label === 'MXY' ? 54 : 44
  return (
    <g className="mirror-badge" pointerEvents="none">
      <rect x={x} y={y} width={width} height="22" rx="6" />
      <text x={x + width / 2} y={y + 15} textAnchor="middle">{label}</text>
    </g>
  )
}

export default function TileComposer({
  assets,
  placements,
  instances,
  geometry,
  settings,
  selectedKey,
  activeAssetId,
  erasing = false,
  wrapEdges = true,
  textLayers = [],
  selectedTextId = null,
  onTextSelect,
  onPlacementSelect,
  onCellClick,
}: Props) {
  const instanceByKey = new Map(instances.map((item) => [item.key, item]))
  const originX = geometry.originX ?? 0
  const originY = geometry.originY ?? 0
  const shifts = [
    [-geometry.tileWidth, 0], [geometry.tileWidth, 0],
    [0, -geometry.tileHeight], [0, geometry.tileHeight],
    [-geometry.tileWidth, -geometry.tileHeight], [geometry.tileWidth, -geometry.tileHeight],
    [-geometry.tileWidth, geometry.tileHeight], [geometry.tileWidth, geometry.tileHeight],
  ]

  return (
    <svg className="tile-editor" viewBox={`0 0 ${geometry.tileWidth} ${geometry.tileHeight}`} aria-label="PatternForge tile composer">
      <defs>
        <clipPath id="pf-builder-clip"><rect width={geometry.tileWidth} height={geometry.tileHeight} /></clipPath>
      </defs>
      <rect width={geometry.tileWidth} height={geometry.tileHeight} fill={settings.background} />

      <g clipPath="url(#pf-builder-clip)">
        {wrapEdges && instances.flatMap((item) => {
          const asset = assets[item.assetIndex]
          if (!asset) return []
          return shifts.map(([dx, dy]) => <Instance key={`ghost-${item.key}-${dx}-${dy}`} item={item} asset={asset} dx={dx} dy={dy} opacity={0.24} />)
        })}
        {instances.map((item) => {
          const asset = assets[item.assetIndex]
          return asset ? <Instance key={item.key} item={item} asset={asset} /> : null
        })}
      </g>

      {Array.from({ length: geometry.rows }).flatMap((_, row) =>
        Array.from({ length: geometry.columns }).map((__, col) => {
          const cell = `cell-${row}-${col}`
          const owner = findPlacementCoveringCell(placements, row, col)
          const occupied = !!owner && instanceByKey.has(owner.key)
          const selected = !!owner && selectedKey === owner.key
          const coveredChild = !!owner && owner.key !== cell
          const x = originX + col * geometry.stepX
          const y = originY + row * geometry.stepY
          return (
            <g key={cell} className="builder-cell" onClick={() => onCellClick(row, col)}>
              <rect x={x} y={y} width={geometry.cellWidth} height={geometry.cellHeight} className="builder-cell-guide" pointerEvents="none" />
              <rect
                x={x}
                y={y}
                width={Math.max(8, geometry.cellWidth)}
                height={Math.max(8, geometry.cellHeight)}
                className={`${selected ? 'builder-cell-hit selected' : 'builder-cell-hit'} ${occupied ? 'occupied' : ''} ${coveredChild ? 'span-child' : ''} ${erasing ? 'erase' : ''}`}
              />
            </g>
          )
        }),
      )}

      {placements.filter(isFreePlacement).map((item) => {
        const instance = instanceByKey.get(item.key)
        if (!instance) return null
        const selected = selectedKey === item.key
        const label = mirrorLabel(item.mirror)
        return (
          <g
            key={`free-hit-${item.key}`}
            className={`free-item-control ${selected ? 'selected' : ''}`}
            transform={`translate(${instance.x} ${instance.y}) rotate(${instance.rotation})`}
            onClick={(e) => { e.stopPropagation(); onPlacementSelect?.(item.key) }}
          >
            <rect
              x={-instance.width / 2}
              y={-instance.height / 2}
              width={instance.width}
              height={instance.height}
              className="free-item-hit"
            />
            {selected && <rect x={-instance.width / 2} y={-instance.height / 2} width={instance.width} height={instance.height} className="free-item-outline" pointerEvents="none" />}
            {label !== 'None' && <MirrorBadge x={-instance.width / 2 + 8} y={-instance.height / 2 + 8} label={label} />}
          </g>
        )
      })}

      {placements.filter((item) => !isFreePlacement(item)).map((item) => {
        if (!instanceByKey.has(item.key)) return null
        const cols = spanCols(item)
        const rows = spanRows(item)
        const mirror = mirrorLabel(item.mirror)
        if (cols === 1 && rows === 1 && selectedKey !== item.key && mirror === 'None') return null
        const bounds = blockBounds(item, geometry)
        const selected = selectedKey === item.key
        return (
          <g key={`span-${item.key}`} className={`builder-span ${selected ? 'selected' : ''}`} pointerEvents="none">
            <rect x={bounds.x + 2} y={bounds.y + 2} width={Math.max(1, bounds.width - 4)} height={Math.max(1, bounds.height - 4)} className="builder-span-outline" />
            {(cols > 1 || rows > 1) && (
              <g className="builder-span-badge">
                <rect x={bounds.x + 8} y={bounds.y + 8} width="48" height="22" rx="6" />
                <text x={bounds.x + 32} y={bounds.y + 23} textAnchor="middle">{cols}×{rows}</text>
              </g>
            )}
            {mirror !== 'None' && <MirrorBadge x={bounds.x + bounds.width - (mirror === 'MXY' ? 62 : 52)} y={bounds.y + 8} label={mirror} />}
          </g>
        )
      })}

      <g clipPath="url(#pf-builder-clip)" className="pf-text-layer-group">
        {textLayers.map((layer) => (
          <TextLayerSvg
            key={layer.id}
            layer={layer}
            selected={selectedTextId === layer.id}
            interactive
            onSelect={onTextSelect}
          />
        ))}
      </g>

      {(activeAssetId || erasing) && !selectedTextId && (
        <g className="builder-hint" pointerEvents="none">
          <rect x="10" y="10" width="252" height="30" rx="7" />
          <text x="22" y="30">{erasing ? 'Eraser: click any grid block' : 'Paint: click a canvas grid cell'}</text>
        </g>
      )}
    </svg>
  )
}
