"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { searchPostsByTitlePrefix } from '@/lib/forum/client';
import type { ForumPost } from '@/lib/types/forum';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  subreddit?: string | null;
}

export function SearchInline({ subreddit = null }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ForumPost[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const canSearch = useMemo(() => query.trim().length >= 3, [query]);

  useEffect(() => {
    let active = true;
    if (!canSearch) {
      setResults(null);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchPostsByTitlePrefix(query.trim(), subreddit || undefined, 8)
      .then((r) => {
        if (!active) return;
        setResults(r);
        setOpen(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query, subreddit, canSearch]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (canSearch) {
        router.push(`/forum/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-64">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search posts…"
          className="pl-9 h-9"
        />
      </div>
      
      {open && results && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
          )}
          {!loading && results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors border-b last:border-0"
              onClick={() => {
                router.push(`/forum/post?id=${encodeURIComponent(p.id)}`);
                setOpen(false);
              }}
            >
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">r/{p.subreddit || 'all'} · {new Date((p as any).createdAt).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


