import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import {
  WindowMinimise,
  WindowToggleMaximise,
  WindowIsMaximised,
  Quit,
} from '../../../wailsjs/runtime/runtime'

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    WindowIsMaximised().then(setIsMaximized)

    const handleResize = () => {
      WindowIsMaximised().then(setIsMaximized)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMaximize = async () => {
    await WindowToggleMaximise()
    const maximized = await WindowIsMaximised()
    setIsMaximized(maximized)
  }

  return (
    <header className="titlebar select-none">
      <div className="titlebar-drag">
        <span className="titlebar-title">Shannon</span>
      </div>

      <div className="titlebar-controls">
        <button
          className="titlebar-btn titlebar-btn-default"
          onClick={WindowMinimise}
          aria-label="Minimize"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          className="titlebar-btn titlebar-btn-default"
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Copy size={12} strokeWidth={1.5} className="rotate-90" />
          ) : (
            <Square size={11} strokeWidth={1.5} />
          )}
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={Quit}
          aria-label="Close"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}
