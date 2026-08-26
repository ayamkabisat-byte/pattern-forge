import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePatternAsset,
  duplicatePatternAsset,
  exportPatternAssetJson,
  importPatternAssetJson,
  libraryEventName,
  loadPatternLibrary,
  patternAssetToSvg,
  renamePatternAsset,
  savePatternAsset,
  type PatternAsset,
  type PatternTarget,
} from '../patternLibrary'

type Props = {
  onUsePattern: (asset: PatternAsset, target: PatternTarget) => void
  onOpenPixel: () => void
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pattern'
}

function svgDimensions(svg: string) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  const viewBox = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number)
  if (viewBox && viewBox.length === 4 && viewBox.every(Number.isFinite)) return { width: Math.abs(viewBox[2]) || 100, height: Math.abs(viewBox[3]) || 100 }
  const width = Number.parseFloat(root.getAttribute('width') || '100') || 100
  const height = Number.parseFloat(root.getAttribute('height') || '100') || 100
  return { width, height }
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export default function MyPatternLibrary({ onUsePattern, onOpenPixel }: Props) {
  const [items, setItems] = useState<PatternAsset[]>(() => loadPatternLibrary())
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('Patterns saved here stay in this browser and can be reused across PatternForge builders.')
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const svgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const refresh = () => setItems(loadPatternLibrary())
    window.addEventListener(libraryEventName(), refresh)
    return () => window.removeEventListener(libraryEventName(), refresh)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => `${item.name} ${item.sourceType} ${(item.tags ?? []).join(' ')}`.toLowerCase().includes(q))
  }, [items, query])

  function rename(item: PatternAsset) {
    const next = window.prompt('Rename pattern', item.name)
    if (!next?.trim()) return
    renamePatternAsset(item.id, next)
    setMessage(`Renamed to ${next.trim()}.`)
  }

  function remove(item: PatternAsset) {
    if (!window.confirm(`Delete “${item.name}” from My Patterns?`)) return
    deletePatternAsset(item.id)
    setMessage(`${item.name} deleted from this browser library.`)
  }

  function duplicate(item: PatternAsset) {
    duplicatePatternAsset(item.id)
    setMessage(`${item.name} duplicated.`)
  }

  function exportSvg(item: PatternAsset) {
    downloadText(patternAssetToSvg(item), `${slug(item.name)}-seamless.svg`, 'image/svg+xml;charset=utf-8')
  }

  function exportJson(item: PatternAsset) {
    downloadText(exportPatternAssetJson(item), `${slug(item.name)}.pattern.json`, 'application/json;charset=utf-8')
  }

  async function importJsonFiles(files: FileList | null) {
    if (!files?.length) return
    let count = 0
    for (const file of Array.from(files)) {
      try {
        importPatternAssetJson(await file.text())
        count++
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `Could not import ${file.name}`)
      }
    }
    if (count) setMessage(`${count} PatternForge JSON asset${count > 1 ? 's' : ''} imported.`)
  }

  async function importSvgFiles(files: FileList | null) {
    if (!files?.length) return
    let count = 0
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.svg')) continue
      const svg = await file.text()
      const dims = svgDimensions(svg)
      savePatternAsset({
        name: file.name.replace(/\.svg$/i, ''),
        sourceType: 'imported-svg',
        svg,
        meta: { width: dims.width, height: dims.height },
      })
      count++
    }
    if (count) setMessage(`${count} SVG pattern asset${count > 1 ? 's' : ''} added to My Patterns.`)
  }

  return (
    <div className="v11-library-shell">
      <header className="v11-library-head">
        <div><b>My Pattern Library</b><span>Reusable local assets for Pixel, Seamless, Layout Guides and Woven/Textile.</span></div>
        <div><button onClick={onOpenPixel}>+ Create Pixel Pattern</button><button onClick={() => jsonInputRef.current?.click()}>Import Pattern JSON</button><button onClick={() => svgInputRef.current?.click()}>Import SVG</button></div>
        <input ref={jsonInputRef} hidden type="file" accept=".json,application/json" multiple onChange={(event) => importJsonFiles(event.target.files)} />
        <input ref={svgInputRef} hidden type="file" accept=".svg,image/svg+xml" multiple onChange={(event) => importSvgFiles(event.target.files)} />
      </header>

      <div className="v11-library-toolbar">
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, source or tag…" /></label>
        <div><b>{filtered.length}</b><span>pattern assets</span></div>
      </div>

      <main className="v11-library-main">
        {!filtered.length ? (
          <div className="v11-library-empty"><b>No saved patterns yet</b><p>Create one in Pixel Pattern Builder, save a Woven template, or import an SVG / PatternForge JSON file.</p><button onClick={onOpenPixel}>Open Pixel Pattern Builder</button></div>
        ) : (
          <div className="v11-library-grid">
            {filtered.map((item) => {
              const preview = patternAssetToSvg(item)
              return (
                <article key={item.id} className="v11-pattern-card">
                  <div className="v11-pattern-preview"><img src={svgDataUri(preview)} alt={`${item.name} pattern preview`} /></div>
                  <div className="v11-pattern-meta">
                    <div><b>{item.name}</b><span>{item.sourceType === 'grid' && item.grid ? `${item.grid.width}×${item.grid.height} editable grid` : item.sourceType.replace('-', ' ')}</span></div>
                    <small>{item.palette?.length ?? item.grid?.palette.length ?? 0} palette colors · updated {new Date(item.updatedAt).toLocaleDateString()}</small>
                  </div>
                  <div className="v11-use-row">
                    <button onClick={() => onUsePattern(item, 'seamless')}>Use in Seamless</button>
                    <button onClick={() => onUsePattern(item, 'guides')}>Use in Layout</button>
                    <button onClick={() => onUsePattern(item, 'woven')}>Use in Woven</button>
                    {item.grid ? <button className="active" onClick={() => onUsePattern(item, 'pixel')}>Edit Grid</button> : null}
                  </div>
                  <div className="v11-card-actions"><button onClick={() => exportSvg(item)}>SVG</button><button onClick={() => exportJson(item)}>JSON</button><button onClick={() => rename(item)}>Rename</button><button onClick={() => duplicate(item)}>Duplicate</button><button className="v09-danger" onClick={() => remove(item)}>Delete</button></div>
                </article>
              )
            })}
          </div>
        )}
      </main>
      <footer className="v11-library-status"><span>{message}</span><b>LOCAL BROWSER LIBRARY</b></footer>
    </div>
  )
}
