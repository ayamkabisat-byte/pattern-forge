import type { PatternGeometry, PatternInstance, PatternSettings, SvgAsset, TileCellPlacement } from '../types'

type Props = {
  assets: SvgAsset[]
  placements: TileCellPlacement[]
  instances: PatternInstance[]
  geometry: PatternGeometry
  settings: PatternSettings
  selectedKey: string | null
  activeAssetId: string | null
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

export default function TileComposer({ assets, placements, instances, geometry, settings, selectedKey, activeAssetId, onCellClick }: Props) {
  const byKey = new Map(placements.map((item) => [item.key, item]))
  const instanceByKey = new Map(instances.map((item) => [item.key, item]))
  const shifts = [
    [-geometry.tileWidth, 0], [geometry.tileWidth, 0],
    [0, -geometry.tileHeight], [0, geometry.tileHeight],
    [-geometry.tileWidth, -geometry.tileHeight], [geometry.tileWidth, -geometry.tileHeight],
    [-geometry.tileWidth, geometry.tileHeight], [geometry.tileWidth, geometry.tileHeight],
  ]

  return (
    <svg className="tile-editor" viewBox={`0 0 ${geometry.tileWidth} ${geometry.tileHeight}`} aria-label="Modular master tile editor">
      <defs>
        <clipPath id="pf-builder-clip"><rect width={geometry.tileWidth} height={geometry.tileHeight} /></clipPath>
      </defs>
      <rect width={geometry.tileWidth} height={geometry.tileHeight} fill={settings.background} />

      <g clipPath="url(#pf-builder-clip)">
        {instances.flatMap((item) => {
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
          const key = `cell-${row}-${col}`
          const occupied = byKey.has(key) && instanceByKey.has(key)
          const selected = selectedKey === key
          return (
            <g key={key} className="builder-cell" onClick={() => onCellClick(row, col)}>
              <rect
                x={col * geometry.stepX}
                y={row * geometry.stepY}
                width={geometry.cellWidth}
                height={geometry.cellHeight}
                className={`${selected ? 'builder-cell-hit selected' : 'builder-cell-hit'} ${occupied ? 'occupied' : ''}`}
              />
              {selected && (
                <rect
                  x={col * geometry.stepX + 3}
                  y={row * geometry.stepY + 3}
                  width={Math.max(1, geometry.cellWidth - 6)}
                  height={Math.max(1, geometry.cellHeight - 6)}
                  className="builder-selected-ring"
                  pointerEvents="none"
                />
              )}
            </g>
          )
        }),
      )}

      {activeAssetId && (
        <g className="builder-hint" pointerEvents="none">
          <rect x="10" y="10" width="148" height="30" rx="7" />
          <text x="22" y="30">Click a cell to paint motif</text>
        </g>
      )}
    </svg>
  )
}
