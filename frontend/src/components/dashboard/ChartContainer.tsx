import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'

interface ChartContainerProps {
  width?: string | number
  height: number
  children: (width: number, height: number) => ReactNode
}

/**
 * Lightweight replacement for Recharts' ResponsiveContainer.
 * Measures parent width once on mount + debounced window resize.
 * Avoids per-instance ResizeObserver overhead that tanks FPS with 7+ charts.
 */
export function ChartContainer({ width: _width = '100%', height, children }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [measuredWidth, setMeasuredWidth] = useState(0)

  const measure = useCallback(() => {
    if (ref.current) {
      setMeasuredWidth(ref.current.clientWidth)
    }
  }, [])

  useEffect(() => {
    measure()

    let timer: ReturnType<typeof setTimeout>
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(measure, 200)
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [measure])

  return (
    <div ref={ref} style={{ width: typeof _width === 'number' ? _width : '100%', height }}>
      {measuredWidth > 0 && children(measuredWidth, height)}
    </div>
  )
}
