"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function PracticeContent() {
  const searchParams = useSearchParams();
  const time = searchParams.get('time');

  return (
    <div style={{ maxWidth: "800px", margin: "50px auto", padding: "20px", textAlign: "center" }}>
      <h1>Practice Session</h1>
      {time ? (
        <p>Practice session started for <strong>{time} minutes</strong>.</p>
      ) : (
        <p>Loading practice session details...</p>
      )}
      <p style={{ marginTop: "20px", fontSize: "18px", color: "#555" }}>
        Your first question will appear here. Get ready!
      </p>
      {/* Placeholder for question display and interaction */}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<p>Loading practice session...</p>}>
      <PracticeContent />
    </Suspense>
  );
} 