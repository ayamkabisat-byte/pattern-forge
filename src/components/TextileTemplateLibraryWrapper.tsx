import { useState } from 'react'
import { savePatternAsset } from '../patternLibrary'
import TextileTemplateMaker from './TextileTemplateMaker'

type Props = {
  onOpenCustom: () => void
  onOpenPlaid: () => void
}

export default function TextileTemplateLibraryWrapper({ onOpenCustom, onOpenPlaid }: Props) {
  const [message, setMessage] = useState('')

  function saveCurrentTemplate() {
    const shell = document.querySelector('.v102-template-shell')
    const stageName = shell?.querySelector('.v10-stage-head b')?.textContent?.trim() || 'Woven Template'
    const pattern = shell?.querySelector('pattern')
    if (!shell || !pattern) {
      setMessage('Could not read the current template preview.')
      return
    }

    const width = Number.parseFloat(pattern.getAttribute('width') || '100') || 100
    const height = Number.parseFloat(pattern.getAttribute('height') || '100') || 100
    const markup = pattern.innerHTML
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="p" width="${width}" height="${height}" patternUnits="userSpaceOnUse">${markup}</pattern></defs><rect width="${width}" height="${height}" fill="url(#p)"/></svg>`
    const palette = Array.from(shell.querySelectorAll('.v102-color-slots code')).map((node) => node.textContent?.trim() || '').filter(Boolean)

    try {
      savePatternAsset({
        name: stageName,
        sourceType: 'woven-template',
        svg,
        palette,
        meta: { width, height, origin: 'Woven / Textile Template Mode' },
      })
      setMessage(`${stageName} saved to My Patterns.`)
      window.setTimeout(() => setMessage(''), 2600)
    } catch {
      setMessage('Could not save. Browser pattern library may be full.')
    }
  }

  return (
    <div className="v11-template-library-wrapper">
      <TextileTemplateMaker onOpenCustom={onOpenCustom} onOpenPlaid={onOpenPlaid} />
      <div className="v11-template-save-float">
        <button onClick={saveCurrentTemplate}>Save Current to My Patterns</button>
        {message ? <span>{message}</span> : null}
      </div>
    </div>
  )
}
