"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';

export interface BentoItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  locked?: boolean;
}

interface BentoGridProps<T extends BentoItem> {
  items: T[];
  isEditing: boolean;
  onLayoutChange: (items: T[]) => void;
  renderItem: (item: T) => ReactNode;
  className?: string;
  rowHeight?: number;
  gap?: number;
  gridScale?: number;
  onColsChange?: (cols: number) => void;
  onDropItem?: (payload: { type: string; x: number; y: number }) => void;
}

const getColsForWidth = (width: number) => {
  if (width < 640) return 1;
  if (width < 900) return 2;
  if (width < 1200) return 4;
  return 8;
};

const EDGE_HIT_SIZE = 8;
const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-bento-ignore-drag]',
].join(',');

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const collides = (a: BentoItem, b: BentoItem) => {
  if (a.id === b.id) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

const pushDownLayout = <T extends BentoItem>(items: T[], movedId: string) => {
  const clones = items.map((item) => ({ ...item })) as T[];
  const moved = clones.find((item) => item.id === movedId);
  if (!moved) return items;
  const others = clones.filter((item) => item.id !== movedId).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const ordered = [moved, ...others];
  const placed: T[] = [];

  ordered.forEach((item) => {
    let y = item.y;
    while (placed.some((p) => collides({ ...item, y }, p))) {
      y += 1;
    }
    placed.push({ ...item, y } as T);
  });

  const placedMap = new Map(placed.map((item) => [item.id, item]));
  return items.map((item) => placedMap.get(item.id) || item) as T[];
};

const compactLayout = <T extends BentoItem>(items: T[], cols: number) => {
  const sorted = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const placed: T[] = [];

  sorted.forEach((item) => {
    // First, ensure the item fits within the current column count.
    const w = Math.min(item.w, cols);
    const x = clamp(item.x, 0, Math.max(0, cols - w));
    
    // Start checking from the item's current Y position.
    let y = Math.max(0, item.y);
    let candidate = { ...item, x, y, w } as T;

    // Only move down if there is a collision at the current position.
    // We do NOT float items up (gravity) to preserve user's intended layout gaps.
    while (placed.some((p) => collides(candidate, p))) {
      y += 1;
      candidate = { ...item, x, y, w } as T;
    }

    placed.push(candidate);
  });

  return placed;
};

export function BentoGrid<T extends BentoItem>({
  items,
  isEditing,
  onLayoutChange,
  renderItem,
  className,
  rowHeight = 96,
  gap = 16,
  gridScale = 1,
  onColsChange,
  onDropItem,
}: BentoGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<T[]>(items);
  const [width, setWidth] = useState(0);
  const [cols, setCols] = useState(8 * gridScale);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'drag' | 'resize' | null>(null);
  const actionRef = useRef<{
    type: 'drag' | 'resize';
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originW: number;
    originH: number;
    resizeDir?: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
  } | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect?.width || 0;
      setWidth(nextWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (width === 0) return;
    const baseCols = getColsForWidth(width);
    const nextCols = Math.max(1, baseCols * gridScale);
    if (nextCols !== cols) {
      setCols(nextCols);
      onColsChange?.(nextCols);
    }
  }, [width, cols, onColsChange, gridScale]);

  useEffect(() => {
    if (!items.length || width === 0) return;
    const normalized = compactLayout(items, cols) as T[];
    const changed = normalized.some((item, idx) => {
      const current = items[idx];
      return !current || item.x !== current.x || item.y !== current.y || item.w !== current.w || item.h !== current.h;
    });
    if (changed) {
      onLayoutChange(normalized);
    }
  }, [cols, width]);

  const colWidth = useMemo(() => {
    if (!width || cols <= 0) return 0;
    return (width - gap * (cols - 1)) / cols;
  }, [width, cols, gap]);

  const effectiveRowHeight = useMemo(() => {
    if (!colWidth) return rowHeight;
    return colWidth;
  }, [colWidth, rowHeight]);

  const layoutHeight = useMemo(() => {
    if (!items.length) return rowHeight;
    const maxRow = Math.max(...items.map((item) => item.y + item.h));
    return maxRow * effectiveRowHeight + Math.max(0, maxRow - 1) * gap;
  }, [items, effectiveRowHeight, gap, rowHeight]);

  useEffect(() => {
    if (!isEditing) return;
    const handlePointerMove = (event: PointerEvent) => {
      if (!actionRef.current || colWidth <= 0) return;
      const action = actionRef.current;
      const deltaX = event.clientX - action.startX;
      const deltaY = event.clientY - action.startY;
      const deltaCols = Math.round(deltaX / (colWidth + gap));
      const deltaRows = Math.round(deltaY / (effectiveRowHeight + gap));
      const currentItems = itemsRef.current;
      const target = currentItems.find((item) => item.id === action.id);
      if (!target) return;

      if (action.type === 'drag') {
        const nextX = clamp(action.originX + deltaCols, 0, Math.max(0, cols - target.w));
        const nextY = Math.max(0, action.originY + deltaRows);
        const candidate = { ...target, x: nextX, y: nextY } as T;
        const updated = currentItems.map((item) => (item.id === candidate.id ? candidate : item));
        const pushed = pushDownLayout(updated as T[], candidate.id);
        onLayoutChange(pushed as T[]);
      } else if (action.type === 'resize') {
        const baseMinW = target.minW ?? 1;
        const baseMinH = target.minH ?? 1;
        const maxH = target.maxH ?? 8;
        const dir = action.resizeDir || {};
        let nextX = action.originX;
        let nextY = action.originY;
        let nextW = action.originW;
        let nextH = action.originH;

        if (dir.left) {
          nextX = clamp(action.originX + deltaCols, 0, action.originX + action.originW - baseMinW);
          nextW = action.originW + (action.originX - nextX);
        }
        if (dir.right) {
          nextW = action.originW + deltaCols;
        }
        if (dir.top) {
          nextY = clamp(action.originY + deltaRows, 0, action.originY + action.originH - baseMinH);
          nextH = action.originH + (action.originY - nextY);
        }
        if (dir.bottom) {
          nextH = action.originH + deltaRows;
        }

        const maxW = Math.min(target.maxW ?? cols, cols - nextX);
        
        // Custom constraint: No widget can have w=1 or h=1 except for 1x2 or 2x1
        // Adjust minW and minH dynamically to prevent invalid dimensions
        let effectiveMinW = baseMinW;
        let effectiveMinH = baseMinH;
        
        // If trying to make width 1, only allow it if height is 2
        if (nextW <= 1 && nextH !== 2) {
          effectiveMinW = 2; // Prevent w=1 unless h=2
        }
        // If trying to make height 1, only allow it if width is 2
        if (nextH <= 1 && nextW !== 2) {
          effectiveMinH = 2; // Prevent h=1 unless w=2
        }
        
        nextW = clamp(nextW, effectiveMinW, maxW);
        nextH = clamp(nextH, effectiveMinH, maxH);
        
        // Final validation: ensure we don't end up with invalid dimensions
        if (nextW === 1 && nextH !== 2) {
          nextW = 2;
        }
        if (nextH === 1 && nextW !== 2) {
          nextH = 2;
        }

        const candidate = { ...target, x: nextX, y: nextY, w: nextW, h: nextH } as T;
        const updated = currentItems.map((item) => (item.id === candidate.id ? candidate : item));
        const pushed = pushDownLayout(updated as T[], candidate.id);
        onLayoutChange(pushed as T[]);
      }
    };

    const handlePointerUp = () => {
      if (!actionRef.current) return;
      actionRef.current = null;
      setActiveId(null);
      setActiveType(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isEditing, cols, colWidth, gap, effectiveRowHeight, onLayoutChange]);

  const getResizeDirection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const isLeft = offsetX <= EDGE_HIT_SIZE;
    const isRight = offsetX >= rect.width - EDGE_HIT_SIZE;
    const isTop = offsetY <= EDGE_HIT_SIZE;
    const isBottom = offsetY >= rect.height - EDGE_HIT_SIZE;
    return { left: isLeft, right: isRight, top: isTop, bottom: isBottom };
  };

  const getCursorForDirection = (dir: { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }) => {
    if ((dir.left && dir.top) || (dir.right && dir.bottom)) return 'nwse-resize';
    if ((dir.right && dir.top) || (dir.left && dir.bottom)) return 'nesw-resize';
    if (dir.left || dir.right) return 'ew-resize';
    if (dir.top || dir.bottom) return 'ns-resize';
    return 'move';
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, item: T) => {
    if (!isEditing) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    event.preventDefault();
    const resizeDir = getResizeDirection(event);
    const isResize = resizeDir.left || resizeDir.right || resizeDir.top || resizeDir.bottom;
    actionRef.current = {
      type: isResize ? 'resize' : 'drag',
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: item.x,
      originY: item.y,
      originW: item.w,
      originH: item.h,
      resizeDir: isResize ? resizeDir : undefined,
    };
    setActiveId(item.id);
    setActiveType(isResize ? 'resize' : 'drag');
  };

  const handlePointerMoveHover = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    if (actionRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) {
      event.currentTarget.style.cursor = '';
      return;
    }
    const dir = getResizeDirection(event);
    event.currentTarget.style.cursor = getCursorForDirection(dir);
  };

  const gridStyle = isEditing && colWidth > 0 ? {
    backgroundImage: 'radial-gradient(circle at 0 0, rgba(148, 163, 184, 0.85) 3.2px, transparent 3.3px)',
    backgroundSize: `${colWidth + gap}px ${colWidth + gap}px`,
    backgroundPosition: '0 0',
    backgroundColor: 'rgba(248, 250, 252, 0.6)',
  } : {};

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', isEditing && 'select-none', className)}
      style={{ height: layoutHeight }}
      onDragOver={(event) => {
        if (!isEditing || !onDropItem) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!isEditing || !onDropItem || !containerRef.current || !colWidth) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/x-cultivated-widget');
        if (!raw) return;
        const rect = containerRef.current.getBoundingClientRect();
        const relX = event.clientX - rect.left;
        const relY = event.clientY - rect.top;
        const nextX = clamp(Math.round(relX / (colWidth + gap)), 0, Math.max(0, cols - 1));
        const nextY = Math.max(0, Math.round(relY / (effectiveRowHeight + gap)));
        onDropItem({ type: raw, x: nextX, y: nextY });
      }}
    >
      {isEditing && colWidth > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={gridStyle}
        />
      )}
      {items.map((item) => {
        const widthPx = item.w * colWidth + (item.w - 1) * gap;
        const heightPx = item.h * effectiveRowHeight + (item.h - 1) * gap;
        const leftPx = item.x * (colWidth + gap);
        const topPx = item.y * (effectiveRowHeight + gap);
        const isActive = activeId === item.id;
        const isResizing = isActive && activeType === 'resize';
        const transition = isActive
          ? 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1), width 140ms cubic-bezier(0.22, 1, 0.36, 1), height 140ms cubic-bezier(0.22, 1, 0.36, 1)'
          : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1), width 200ms cubic-bezier(0.22, 1, 0.36, 1), height 200ms cubic-bezier(0.22, 1, 0.36, 1)';

        return (
          <div
            key={item.id}
            data-bento-item-id={item.id}
            className="absolute z-10"
            style={{
              width: widthPx,
              height: heightPx,
              transform: `translate(${leftPx}px, ${topPx}px)`,
              transition,
              willChange: isActive ? 'transform, width, height' : undefined,
              touchAction: 'none',
            }}
            onPointerDown={(event) => handlePointerDown(event, item)}
            onPointerMove={handlePointerMoveHover}
            onPointerLeave={(event) => {
              if (!isEditing || actionRef.current) return;
              event.currentTarget.style.cursor = '';
            }}
          >
            <div className="h-full w-full">
              {renderItem(item)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
