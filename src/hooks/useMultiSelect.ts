'use client';

import { useState, useCallback, useRef } from 'react';

interface UseMultiSelectOptions<T> {
  items: T[];
  getId: (item: T) => string;
}

interface UseMultiSelectReturn {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  isSelected: (id: string) => boolean;
  toggleSelection: (id: string, event?: React.MouseEvent) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectRange: (startId: string, endId: string) => void;
  selectedCount: number;
}

/**
 * Custom hook for multi-select functionality with shift+click range selection
 *
 * Usage:
 * const { selectedIds, toggleSelection, clearSelection, selectedCount } = useMultiSelect({
 *   items: myItems,
 *   getId: (item) => item.id,
 * });
 *
 * // In your checkbox onClick handler:
 * <input
 *   type="checkbox"
 *   checked={isSelected(item.id)}
 *   onClick={(e) => toggleSelection(item.id, e)}
 * />
 */
export function useMultiSelect<T>({
  items,
  getId,
}: UseMultiSelectOptions<T>): UseMultiSelectReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedIdRef = useRef<string | null>(null);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const selectRange = useCallback((startId: string, endId: string) => {
    const ids = items.map(getId);
    const startIndex = ids.indexOf(startId);
    const endIndex = ids.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    setSelectedIds(prev => {
      const next = new Set(prev);
      for (let i = minIndex; i <= maxIndex; i++) {
        next.add(ids[i]);
      }
      return next;
    });
  }, [items, getId]);

  const toggleSelection = useCallback((id: string, event?: React.MouseEvent) => {
    const isShiftClick = event?.shiftKey ?? false;

    if (isShiftClick && lastSelectedIdRef.current && lastSelectedIdRef.current !== id) {
      // Shift+click: select range from last selected to current
      selectRange(lastSelectedIdRef.current, id);
      lastSelectedIdRef.current = id;
    } else {
      // Normal click: toggle single item
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      lastSelectedIdRef.current = id;
    }
  }, [selectRange]);

  const selectAll = useCallback(() => {
    const allIds = items.map(getId);
    setSelectedIds(new Set(allIds));
    if (allIds.length > 0) {
      lastSelectedIdRef.current = allIds[allIds.length - 1];
    }
  }, [items, getId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastSelectedIdRef.current = null;
  }, []);

  return {
    selectedIds,
    lastSelectedId: lastSelectedIdRef.current,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    selectRange,
    selectedCount: selectedIds.size,
  };
}
