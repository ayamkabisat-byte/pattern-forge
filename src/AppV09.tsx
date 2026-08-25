import { useState } from 'react'
import AppV08 from './AppV08'
import FreeformPatternEditorV091 from './components/FreeformPatternEditorV091'

export default function AppV09() {
  const [workspace, setWorkspace] = useState<'freeform' | 'classic'>('freeform')

  if (workspace === 'classic') {
    return (
      <div className="v09-classic-wrap">
        <div className="v09-classic-return">
          <div><b>PatternForge v0.9.1</b><span>Classic Auto Builder is still available unchanged.</span></div>
          <button onClick={() => setWorkspace('freeform')}>← Freeform + Mirror</button>
        </div>
        <AppV08 />
      </div>
    )
  }

  return <FreeformPatternEditorV091 onOpenClassic={() => setWorkspace('classic')} />
}
