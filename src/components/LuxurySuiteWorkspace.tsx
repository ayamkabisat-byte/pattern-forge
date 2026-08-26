import { useState } from 'react'
import MonogramMaker from './MonogramMaker'
import ScarfHijabComposer from './ScarfHijabComposer'
import { peekPendingPattern } from '../patternLibrary'

type Props = { onOpenLibrary: () => void }
type LuxuryMode = 'monogram' | 'scarf'

export default function LuxurySuiteWorkspace({ onOpenLibrary }: Props) {
  const [mode, setMode] = useState<LuxuryMode>(() => peekPendingPattern('scarf') ? 'scarf' : 'monogram')
  const [sourcePattern, setSourcePattern] = useState<{ svg: string; name: string } | null>(null)

  function sendToScarf(svg: string, name: string) {
    setSourcePattern({ svg, name })
    setMode('scarf')
  }

  return <div className="v15-luxury-suite">
    <div className="v15-luxury-tabs">
      <div><b>Luxury Pattern Suite</b><span>Original SVG shapes → seamless monogram → finished scarf / hijab composition</span></div>
      <div><button className={mode === 'monogram' ? 'active' : ''} onClick={() => setMode('monogram')}>Monogram Maker</button><button className={mode === 'scarf' ? 'active' : ''} onClick={() => setMode('scarf')}>Scarf / Hijab Composer</button></div>
    </div>
    {mode === 'monogram' ? <MonogramMaker onOpenLibrary={onOpenLibrary} onSendToScarf={sendToScarf}/> : <ScarfHijabComposer onOpenLibrary={onOpenLibrary} sourcePattern={sourcePattern}/>} 
  </div>
}
