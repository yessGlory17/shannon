import { useEffect, useRef } from 'react'

export function useWailsEvent<T = any>(eventName: string, callback: (data: T) => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!window.runtime) {
      console.warn(`[useWailsEvent] window.runtime not available for event: ${eventName}`)
      return
    }

    const handler = (...args: any[]) => {
      callbackRef.current(args[0] as T)
    }
    window.runtime.EventsOn(eventName, handler)
    return () => {
      window.runtime?.EventsOff(eventName)
    }
  }, [eventName])
}
