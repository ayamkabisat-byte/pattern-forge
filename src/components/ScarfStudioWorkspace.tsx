import ScarfHijabComposer from './ScarfHijabComposer'

type Props = { onOpenLibrary: () => void }

export default function ScarfStudioWorkspace({ onOpenLibrary }: Props) {
  return <ScarfHijabComposer onOpenLibrary={onOpenLibrary}/>
}
