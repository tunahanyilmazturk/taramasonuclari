import { useState, useMemo } from 'react';

/**
 * Sayfalama hook'u — herhangi bir listeyi sayfalara böler.
 * Sayfa boyutu localStorage'da saklanır, yenilemede korunur.
 */
export const usePagination = <T,>(items: T[], storageKey: string, defaultPageSize = 7) => {
  const [pageSize, setPageSizeState] = useState<number>(() => {
    const saved = localStorage.getItem(`mediscan_page_${storageKey}`);
    return saved ? parseInt(saved) : defaultPageSize;
  });
  const [currentPage, setCurrentPage] = useState(1);

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    localStorage.setItem(`mediscan_page_${storageKey}`, String(size));
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Geçerli sayfa total'i aşmasın — clamp
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage) setCurrentPage(safePage);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    paginatedItems,
    currentPage: safePage,
    totalPages,
    pageSize,
    setCurrentPage,
    setPageSize,
    totalItems: items.length,
    startIndex: (safePage - 1) * pageSize,
    endIndex: Math.min(safePage * pageSize, items.length),
  };
};
