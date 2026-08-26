import { useState } from 'react'
import AppV08 from './AppV08'
import FreeformPatternEditorV091 from './components/FreeformPatternEditorV091'
import LayoutGuideBuilder from './components/LayoutGuideBuilder'
import PlaidTartanMaker from './components/PlaidTartanMaker'
import WovenTextileBuilder from './components/WovenTextileBuilder'

type Workspace = 'seamless' | 'guides' | 'plaid' | 'textile' | 'legacy'

function WorkspaceNav({ workspace, onChange }: { workspace: Workspace; onChange: (workspace: Workspace) => void }) {
  const items: Array<{ id: Workspace; label: string; hint: string }> = [
    { id: 'seamless', label: 'Seamless Builder', hint: 'Freeform + Radial Repeat' },
    { id: 'guides', label: 'Layout Guides', hint: 'Frame · Strip · Diagonal' },
    { id: 'plaid', label: 'Plaid / Tartan', hint: 'Template + HEX palette' },
    { id: 'textile', label: 'Woven / Textile', hint: 'Bands · zones · motif rows' },
    { id: 'legacy', label: 'Legacy Auto', hint: 'Old experimental presets' },
  ]

  return (
    <nav className="v10-global-nav">
      <div className="v10-nav-brand">
        <span>PF</span>
        <div><b>PatternForge</b><small>v1.0.1 Preview</small></div>
      </div>
      <div className="v10-nav-tabs">
        {items.map((item) => (
          <button key={item.id} className={workspace === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
            <b>{item.label}</b><span>{item.hint}</span>
          </button>
        ))}
      </div>
      <div className="v10-nav-rule">Motif stays yours. PatternForge controls structure.</div>
    </nav>
  )
}

export default function AppV10() {
  const [workspace, setWorkspace] = useState<Workspace>('seamless')

  return (
    <div className="v10-root">
      <WorkspaceNav workspace={workspace} onChange={setWorkspace} />

      {workspace === 'seamless' ? (
        <div className="v10-freeform-host">
          <FreeformPatternEditorV091 onOpenClassic={() => setWorkspace('legacy')} />
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
        <WovenTextileBuilder
          onOpenSeamless={() => setWorkspace('seamless')}
          onOpenGuides={() => setWorkspace('guides')}
          onOpenPlaid={() => setWorkspace('plaid')}
        />
      ) : null}

      {workspace === 'legacy' ? (
        <div className="v10-legacy-shell">
          <div className="v10-legacy-note">
            <div><b>Legacy Auto Builder</b><span>Paisley / Kawung / Parang auto presets are kept only for reference. New cultural pattern work should use Layout Guides, Woven / Textile, or Freeform.</span></div>
            <button onClick={() => setWorkspace('guides')}>Open Layout Guides</button>
          </div>
          <div className="v10-legacy-scroll"><AppV08 /></div>
        </div>
      ) : null}
    </div>
  )
}
