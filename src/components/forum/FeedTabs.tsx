"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  basePath: string; // e.g., "/forum" or "/forum/r"
  query?: string; // e.g., "slug=math"
}

export function FeedTabs({ basePath, query }: Props) {
  const pathname = usePathname();

  const tabs = [
    { slug: '', label: 'Hot' },
    { slug: '/new', label: 'New' },
    { slug: '/top', label: 'Top' },
  ];

  return (
    <div className="flex gap-2 mt-6 mb-6">
      {tabs.map((t) => {
        const hrefPath = `${basePath}${t.slug}`;
        const href = query ? `${hrefPath}?${query}` : hrefPath;
        const active = pathname === href || (t.slug === '' && pathname === basePath);
        return (
          <Button
            key={t.slug || 'hot'}
            variant={active ? "secondary" : "outline"}
            size="sm"
            asChild
          >
            <Link href={href}>
              {t.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}


