import { useState, useCallback } from 'react'
import { useWailsEvent } from './useWailsEvent'
import type { TaskStreamEvent } from '../types'

export function useClaudeStream(taskId: string | null) {
  const [logs, setLogs] = useState<TaskStreamEvent[]>([])

  useWailsEvent<TaskStreamEvent>('task:stream', (event) => {
    if (event.task_id === taskId) {
      setLogs((prev) => [...prev, event])
    }
  })

  const clear = useCallback(() => setLogs([]), [])

  return { logs, clear }
}
