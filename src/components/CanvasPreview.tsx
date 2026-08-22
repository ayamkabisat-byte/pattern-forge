import { computeCanvasLayout } from '../engine/canvas'
import type { ExportSettings, PatternGeometry, PatternInstance, PatternSettings, SvgAsset } from '../types'

type Props = {
  assets: SvgAsset[]
  instances: PatternInstance[]
  geometry: PatternGeometry
  settings: PatternSettings
  exportSettings: ExportSettings
}

function Instance({ item, asset, dx = 0, dy = 0 }: { item: PatternInstance; asset: SvgAsset; dx?: number; dy?: number }) {
  const sx = item.flipX ? -1 : 1
  const sy = item.flipY ? -1 : 1
  return (
    <g pointerEvents="none" transform={`translate(${item.x + dx} ${item.y + dy}) rotate(${item.rotation}) scale(${sx} ${sy}) translate(${-item.width / 2} ${-item.height / 2})`}>
      <svg width={item.width} height={item.height} viewBox={asset.viewBox} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: asset.innerSvg }} />
    </g>
  )
}

function Tile({ assets, instances, geometry, settings }: Omit<Props, 'exportSettings'>) {
  const shiftsX = [-geometry.tileWidth, 0, geometry.tileWidth]
  const shiftsY = [-geometry.tileHeight, 0, geometry.tileHeight]
  return (
    <>
      <rect width={geometry.tileWidth} height={geometry.tileHeight} fill={settings.background} />
      {instances.flatMap((item) => {
        const asset = assets[item.assetIndex]
        if (!asset) return []
        return shiftsX.flatMap((dx) => shiftsY.map((dy) => (
          <Instance key={`${item.key}-${dx}-${dy}`} item={item} asset={asset} dx={dx} dy={dy} />
        )))
      })}
    </>
  )
}

export default function CanvasPreview({ assets, instances, geometry, settings, exportSettings }: Props) {
  const mode = exportSettings.canvasMode ?? 'full-bleed'
  const layout = computeCanvasLayout(
    geometry.tileWidth,
    geometry.tileHeight,
    exportSettings.width,
    exportSettings.height,
    exportSettings.tileScale,
    mode,
    exportSettings.proofCopies ?? 3,
  )

  const tiles = []
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.columns; col++) {
      const x = layout.originX + col * layout.tileWidth
      const y = layout.originY + row * layout.tileHeight
      tiles.push(
        <svg
          key={`${row}-${col}`}
          x={x}
          y={y}
          width={layout.tileWidth}
          height={layout.tileHeight}
          viewBox={`0 0 ${geometry.tileWidth} ${geometry.tileHeight}`}
          overflow="hidden"
        >
          <Tile assets={assets} instances={instances} geometry={geometry} settings={settings} />
        </svg>,
      )
    }
  }

  return (
    <svg className="canvas-preview" viewBox={`0 0 ${layout.canvasWidth} ${layout.canvasHeight}`} aria-label="Final export canvas preview">
      <rect width={layout.canvasWidth} height={layout.canvasHeight} fill={settings.background} />
      {tiles}
      {settings.showBoundary && (
        <g className="canvas-tile-guides">
          {Array.from({ length: layout.rows }).flatMap((_, row) =>
            Array.from({ length: layout.columns }).map((__, col) => (
              <rect
                key={`g-${row}-${col}`}
                x={layout.originX + col * layout.tileWidth}
                y={layout.originY + row * layout.tileHeight}
                width={layout.tileWidth}
                height={layout.tileHeight}
              />
            )),
          )}
        </g>
      )}
      <rect className="canvas-frame" x="0" y="0" width={layout.canvasWidth} height={layout.canvasHeight} />
    </svg>
  )
}
