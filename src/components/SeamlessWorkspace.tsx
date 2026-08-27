import { useState } from 'react'
import FreeformPatternEditorV091 from './FreeformPatternEditorV091'
import MultiMotifComposer from './MultiMotifComposer'

type Props = { onOpenRepeat: () => void }
type Mode = 'freeform' | 'multi'

export default function SeamlessWorkspace({ onOpenRepeat }: Props) {
  const [mode, setMode] = useState<Mode>('freeform')
  return <div className="v19-seamless-suite">
    <div className="v19-seamless-tabs">
      <div><b>Seamless Pattern Studio</b><span>Freeform placement or the restored multi-SVG builder workflow.</span></div>
      <div><button className={mode === 'freeform' ? 'active' : ''} onClick={() => setMode('freeform')}>Freeform Composer</button><button className={mode === 'multi' ? 'active' : ''} onClick={() => setMode('multi')}>Multi-Motif Builder</button></div>
    </div>
    {mode === 'freeform' ? <div className="v10-freeform-host"><FreeformPatternEditorV091 onOpenClassic={onOpenRepeat}/></div> : <MultiMotifComposer/>}
  </div>
}
