"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function JoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const slug = searchParams?.get('ref') || '';
    const qs = slug ? `?ref=${encodeURIComponent(slug)}` : '';
    router.replace(`/signup${qs}`);
  }, [router, searchParams]);
  return <div className="min-h-screen ambient-bg" />;
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen ambient-bg" />}>
      <JoinInner />
    </Suspense>
  );
}


