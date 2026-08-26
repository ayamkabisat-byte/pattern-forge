import { useState } from 'react'
import AppV08 from './AppV08'
import CamouflageWorkspace from './components/CamouflageWorkspace'
import FreeformPatternEditorV091 from './components/FreeformPatternEditorV091'
import LayoutGuideBuilder from './components/LayoutGuideBuilder'
import MyPatternLibraryV111 from './components/MyPatternLibraryV111'
import PixelPatternBuilder from './components/PixelPatternBuilder'
import PlaidTartanMaker from './components/PlaidTartanMaker'
import RepeatLayoutWorkspace from './components/RepeatLayoutWorkspace'
import WovenTextileWorkspace from './components/WovenTextileWorkspace'
import { patternAssetToSvg, setPendingPattern, type PatternAsset, type PatternTarget } from './patternLibrary'

type Workspace = 'seamless' | 'guides' | 'plaid' | 'textile' | 'pixel' | 'repeat' | 'camouflage' | 'library' | 'legacy'

function WorkspaceNav({ workspace, onChange }: { workspace: Workspace; onChange: (workspace: Workspace) => void }) {
  const items: Array<{ id: Workspace; label: string; hint: string }> = [
    { id: 'seamless', label: 'Seamless', hint: 'Freeform + Radial' },
    { id: 'guides', label: 'Layout Guides', hint: 'Frame · Strip · Diagonal' },
    { id: 'plaid', label: 'Plaid / Tartan', hint: 'Template + HEX' },
    { id: 'textile', label: 'Woven / Textile', hint: 'Templates · Custom SVG' },
    { id: 'pixel', label: 'Pixel Pattern', hint: 'Grid · 4K SVG · Crop' },
    { id: 'repeat', label: 'Repeat Layout', hint: 'Grid · Brick · Hex' },
    { id: 'camouflage', label: 'Camouflage', hint: 'Digital · Organic · Seed' },
    { id: 'library', label: 'My Patterns', hint: 'Master + motifs' },
    { id: 'legacy', label: 'Legacy', hint: 'Old experiments' },
  ]

  return (
    <nav className="v10-global-nav v11-global-nav">
      <div className="v10-nav-brand">
        <span>PF</span>
        <div><b>PatternForge</b><small>v1.2 Preview</small></div>
      </div>
      <div className="v10-nav-tabs">
        {items.map((item) => (
          <button key={item.id} className={workspace === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
            <b>{item.label}</b><span>{item.hint}</span>
          </button>
        ))}
      </div>
      <div className="v10-nav-rule">Build · generate · repeat · reuse.</div>
    </nav>
  )
}

function dispatchSvgDrop(selector: string, asset: PatternAsset) {
  const target = document.querySelector<HTMLElement>(selector)
  if (!target) return false
  try {
    const svg = patternAssetToSvg(asset)
    const filename = `${asset.name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'pattern'}.svg`
    const file = new File([svg], filename, { type: 'image/svg+xml' })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer })
    target.dispatchEvent(event)
    return true
  } catch {
    return false
  }
}

export default function AppV10() {
  const [workspace, setWorkspace] = useState<Workspace>('seamless')

  function usePattern(asset: PatternAsset, target: PatternTarget) {
    if (target === 'pixel') {
      setPendingPattern('pixel', asset)
      setWorkspace('pixel')
      return
    }

    if (target === 'repeat') {
      setPendingPattern('repeat', asset)
      setWorkspace('repeat')
      return
    }

    if (target === 'camouflage') {
      setPendingPattern('camouflage', asset)
      setWorkspace('camouflage')
      return
    }

    if (target === 'seamless') {
      setWorkspace('seamless')
      window.setTimeout(() => dispatchSvgDrop('.v10-freeform-host .v09-dropzone', asset), 140)
      return
    }

    if (target === 'guides') {
      setWorkspace('guides')
      window.setTimeout(() => dispatchSvgDrop('.v10-builder-shell .v10-drop', asset), 140)
      return
    }

    setWorkspace('textile')
    window.setTimeout(() => {
      const customButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.v102-mode-tabs button')).find((button) => button.textContent?.includes('Custom SVG'))
      customButton?.click()
      window.setTimeout(() => dispatchSvgDrop('.v102-textile-content .v10-drop', asset), 120)
    }, 140)
  }

  return (
    <div className="v10-root">
      <WorkspaceNav workspace={workspace} onChange={setWorkspace} />

      {workspace === 'seamless' ? (
        <div className="v10-freeform-host">
          <FreeformPatternEditorV091 onOpenClassic={() => setWorkspace('repeat')} />
        </div>
      ) : null}

      {workspace === 'guides' ? (
        <LayoutGuideBuilder
          onOpenSeamless={() => setWorkspace('seamless')}
          onOpenPlaid={() => setWorkspace('plaid')}
        />
      ) : null}

      {workspace === 'plaid' ? (
        <PlaidTartanMaker
          onOpenSeamless={() => setWorkspace('seamless')}
          onOpenGuides={() => setWorkspace('guides')}
        />
      ) : null}

      {workspace === 'textile' ? (
        <WovenTextileWorkspace
          onOpenSeamless={() => setWorkspace('seamless')}
          onOpenGuides={() => setWorkspace('guides')}
          onOpenPlaid={() => setWorkspace('plaid')}
        />
      ) : null}

      {workspace === 'pixel' ? (
        <PixelPatternBuilder onOpenLibrary={() => setWorkspace('library')} onOpenWoven={() => setWorkspace('textile')} />
      ) : null}

      {workspace === 'repeat' ? (
        <RepeatLayoutWorkspace onOpenLibrary={() => setWorkspace('library')} onOpenPixel={() => setWorkspace('pixel')} />
      ) : null}

      {workspace === 'camouflage' ? (
        <CamouflageWorkspace onOpenLibrary={() => setWorkspace('library')} onOpenRepeat={() => setWorkspace('repeat')} onOpenPixel={() => setWorkspace('pixel')} />
      ) : null}

      {workspace === 'library' ? (
        <MyPatternLibraryV111 onUsePattern={usePattern} onOpenPixel={() => setWorkspace('pixel')} onOpenCamouflage={() => setWorkspace('camouflage')} />
      ) : null}

      {workspace === 'legacy' ? (
        <div className="v10-legacy-shell">
          <div className="v10-legacy-note">
            <div><b>Legacy Auto Builder</b><span>Older specialty experiments remain here. Grid, Brick, Brick Column and Hex Row now live in Repeat Layout; procedural Digital and Organic camouflage live in Camouflage.</span></div>
            <button onClick={() => setWorkspace('repeat')}>Open Repeat Layout</button>
          </div>
          <div className="v10-legacy-scroll"><AppV08 /></div>
        </div>
      ) : null}
    </div>
  )
}
