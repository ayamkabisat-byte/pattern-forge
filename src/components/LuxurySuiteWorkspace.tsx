import MonogramMaker from './MonogramMaker'

type Props = {
  onOpenLibrary: () => void
  onSendToScarf: (svg: string, name: string) => void
}

export default function LuxurySuiteWorkspace({ onOpenLibrary, onSendToScarf }: Props) {
  return <div className="v15-luxury-suite">
    <div className="v15-luxury-tabs">
      <div><b>Luxury Pattern Suite</b><span>Original SVG shapes → seamless monogram. Finished scarf / hijab composition now lives in its own lightweight workspace.</span></div>
      <div><button className="active">Monogram Maker</button><button onClick={() => onSendToScarf('', 'Luxury Monogram Source')}>Open Scarf / Hijab Studio</button></div>
    </div>
    <MonogramMaker onOpenLibrary={onOpenLibrary} onSendToScarf={onSendToScarf}/>
  </div>
}
