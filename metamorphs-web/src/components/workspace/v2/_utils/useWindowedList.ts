// src/components/workspace/v2/_utils/useWindowedList.ts
import * as React from "react";

export function useWindowedList<T>(items: T[], chunk = 200) {
  const [count, setCount] = React.useState(Math.min(items.length, chunk));
  const visible = React.useMemo(() => items.slice(0, count), [items, count]);
  const loadMore = () => setCount((c) => Math.min(items.length, c + chunk));
  const canLoadMore = count < items.length;
  return { visible, canLoadMore, loadMore, count, total: items.length };
}