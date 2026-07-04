import { useEffect, useState } from 'react';
import { useEssay } from '../EssayContext';

// Fetch a JSON fixture from the essay's data directory
// (public/essays/<slug>/data/ by default — see EssayContext.fixtureBase).
// Returns undefined while loading, null when the file is missing.
export function useFixture<T>(name: string): T | null | undefined {
  const { fixtureBase } = useEssay();
  const [data, setData] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch(`${fixtureBase}/${name}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [name, fixtureBase]);
  return data;
}

export function FixtureFallback({ ready }: { ready: boolean }) {
  return (
    <div
      style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: 'var(--text-2)',
        fontFamily: 'var(--heading-font)',
        fontSize: 14,
      }}
    >
      {ready ? 'loading data…' : 'data fixture not baked yet — run the analysis script'}
    </div>
  );
}
