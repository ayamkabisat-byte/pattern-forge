import { useState } from 'react'
import { peekPendingPattern } from '../patternLibrary'
import TextileTemplateLibraryWrapper from './TextileTemplateLibraryWrapper'
import WovenTextileBuilder from './WovenTextileBuilder'

type Props = {
  onOpenSeamless: () => void
  onOpenGuides: () => void
  onOpenPlaid: () => void
}

type Mode = 'templates' | 'custom'

export default function WovenTextileWorkspace({ onOpenSeamless, onOpenGuides, onOpenPlaid }: Props) {
  const [mode, setMode] = useState<Mode>(() => peekPendingPattern('woven') ? 'custom' : 'templates')

  return (
    <div className="v102-textile-workspace">
      <div className="v102-textile-modebar">
        <div>
          <b>Woven / Textile Builder</b>
          <span>Fast mathematical templates or your own SVG motif structure.</span>
        </div>
        <div className="v102-mode-tabs">
          <button className={mode === 'templates' ? 'active' : ''} onClick={() => setMode('templates')}>
            <b>Templates</b><span>HEX palette · no SVG required</span>
          </button>
          <button className={mode === 'custom' ? 'active' : ''} onClick={() => setMode('custom')}>
            <b>Custom SVG</b><span>Upload your own motifs</span>
          </button>
        </div>
      </div>

      <div className="v102-textile-content">
        {mode === 'templates' ? (
          <TextileTemplateLibraryWrapper onOpenCustom={() => setMode('custom')} onOpenPlaid={onOpenPlaid} />
        ) : (
          <WovenTextileBuilder onOpenSeamless={onOpenSeamless} onOpenGuides={onOpenGuides} onOpenPlaid={onOpenPlaid} />
        )}
      </div>
    </div>
  )
}
