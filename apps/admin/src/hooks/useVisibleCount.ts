import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const FALLBACK_PAGE_SIZE = 10;

// Module-level cache — fetched once, shared across all hook instances.
let _pageSize: number | null = null;
let _fetchPromise: Promise<number> | null = null;

function getPageSize(): Promise<number> {
  if (_pageSize !== null) return Promise.resolve(_pageSize);
  if (!_fetchPromise) {
    _fetchPromise = (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('pagination_page_size').single();
        _pageSize = data?.pagination_page_size ?? FALLBACK_PAGE_SIZE;
      } catch {
        _pageSize = FALLBACK_PAGE_SIZE;
      }
      return _pageSize as number;
    })();
  }
  return _fetchPromise;
}

/**
 * Paginate a list client-side. Page size is controlled by admin via app_settings
 * (the same setting used by the mobile app's lists). Hard cap is 3 pages; after
 * that shows a "use filters" message.
 *
 * @param list      The full filtered array to paginate.
 * @param resetKey  Change this value when filters change to reset back to the first page.
 */
export function useVisibleCount<T>(list: T[], resetKey?: string | number) {
  const [pageSize, setPageSize] = useState(FALLBACK_PAGE_SIZE);
  const [count, setCount]       = useState(FALLBACK_PAGE_SIZE);

  // Fetch page size once on first use (subsequent calls hit the cache synchronously).
  useEffect(() => {
    getPageSize().then(ps => {
      setPageSize(ps);
      setCount(ps);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to first page when filters or page size change.
  useEffect(() => {
    setCount(pageSize);
  }, [resetKey, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const hardCap        = pageSize * 3;
  const visible        = list.slice(0, count);
  const showLoadMore   = count < hardCap && list.length > count;
  const showCapMessage = count >= hardCap && list.length > hardCap;
  const loadMore       = () => setCount(c => Math.min(c + pageSize, hardCap));

  return { visible, showLoadMore, loadMore, showCapMessage, pageSize };
}
