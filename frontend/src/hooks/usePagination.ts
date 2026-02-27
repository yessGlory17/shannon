import { useState, useMemo } from 'react'

interface UsePaginationOptions {
  pageSize?: number
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize = 10 } = options
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  // Reset to page 1 if current page exceeds total (e.g. after delete)
  const safePage = page > totalPages ? 1 : page

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)))
  }

  return {
    page: safePage,
    totalPages,
    totalItems: items.length,
    paginatedItems,
    goToPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  }
}
