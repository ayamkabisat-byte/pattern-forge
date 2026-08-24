import { useState } from 'react'
import AppV08 from './AppV08'
import FreeformPatternEditor from './components/FreeformPatternEditor'

export default function AppV09() {
  const [workspace, setWorkspace] = useState<'freeform' | 'classic'>('freeform')

  if (workspace === 'classic') {
    return (
      <div className="v09-classic-wrap">
        <div className="v09-classic-return">
          <div><b>PatternForge v0.9</b><span>Classic Auto Builder is still available unchanged.</span></div>
          <button onClick={() => setWorkspace('freeform')}>← Freeform Composer</button>
        </div>
        <AppV08 />
      </div>
    )
  }

  return <FreeformPatternEditor onOpenClassic={() => setWorkspace('classic')} />
}
