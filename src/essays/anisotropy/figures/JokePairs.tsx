import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { useFixture, FixtureFallback } from '../../runtime/lib/data'

// Draw a random pair of jokes (or a nearest-neighbor pair) and show its
// cosine similarity in each of the four embedding spaces, against the
// backdrop of what random pairs score in that space.

export const DEFAULTS = {
  startIndex: 3, // which precomputed pair to show on load
}

type Pair = { i: number; j: number; cos: Record<string, number> }
type PairsFile = {
  random: Pair[]
  nn: Pair[]
  texts: Record<string, string>
  spaces: Record<string, string>
}
type SpaceStats = Record<
  string,
  { label: string; mean_cos: number; p05: number; p95: number }
>

const SPACE_ORDER = ['minilm', 'jina-v5-nano', 'colbert-pooled', 'gpt2-pooled']
const SHORT_LABELS: Record<string, string> = {
  minilm: 'MiniLM',
  'jina-v5-nano': 'jina-v5-nano',
  'colbert-pooled': 'ColBERT (pooled)',
  'gpt2-pooled': 'GPT-2 (pooled)',
}

export default function JokePairs(props: FigureProps) {
  const data = useFixture<PairsFile>('joke-pairs.json')
  const stats = useFixture<SpaceStats>('space-stats.json')
  const [mode, setMode] = useState<'random' | 'nn'>('random')
  const [idx, setIdx] = useState(Number(props.startIndex ?? DEFAULTS.startIndex))

  const pair = useMemo(() => {
    if (!data) return null
    const list = data[mode]
    return list[idx % list.length]
  }, [data, mode, idx])

  if (data === undefined || stats === undefined) return <FixtureFallback ready />
  if (!data || !stats || !pair) return <FixtureFallback ready={false} />

  const w = 620
  const x = d3.scaleLinear([-0.3, 1], [190, w - 60])

  return (
    <div style={{ fontFamily: 'var(--heading-font)' }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
        <button style={btn(mode === 'random')} onClick={() => { setMode('random'); setIdx((k) => (mode === 'random' ? k + 1 : k)) }}>
          draw a random pair
        </button>
        <button style={btn(mode === 'nn')} onClick={() => { setMode('nn'); setIdx((k) => (mode === 'nn' ? k + 1 : k)) }}>
          draw a similar pair
        </button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[pair.i, pair.j].map((t, k) => (
          <blockquote
            key={k}
            style={{
              flex: '1 1 240px',
              margin: 0,
              padding: '0.6rem 0.9rem',
              borderLeft: '3px solid var(--border)',
              fontFamily: 'var(--body-font)',
              fontSize: 15,
              color: 'var(--text)',
            }}
          >
            {data.texts[String(t)]}
          </blockquote>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${SPACE_ORDER.length * 34 + 40}`} width="100%" style={{ marginTop: 10 }} role="img" aria-label="Cosine similarity of the shown pair in each embedding space, compared to the random-pair range.">
        {SPACE_ORDER.map((s, row) => {
          const y = 22 + row * 34
          const st = stats[s]
          const c = pair.cos[s]
          if (st == null || c == null) return null
          return (
            <g key={s}>
              <text x={182} y={y + 4} textAnchor="end" fontSize={13} fill="var(--text)">
                {SHORT_LABELS[s] ?? s}
              </text>
              <line x1={x(-0.3)} x2={x(1)} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              {/* random-pair band p05–p95 */}
              <rect x={x(st.p05)} y={y - 5} width={Math.max(1, x(st.p95) - x(st.p05))} height={10} fill="var(--text-2)" opacity={0.18} />
              <line x1={x(st.mean_cos)} x2={x(st.mean_cos)} y1={y - 7} y2={y + 7} stroke="var(--text-2)" strokeWidth={1.5} />
              <circle cx={x(c)} cy={y} r={6} fill="var(--accent)" />
              <text x={x(c)} y={y - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--accent)">
                {c >= 0.99 && c < 1 ? c.toFixed(3) : c.toFixed(2)}
              </text>
            </g>
          )
        })}
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={22 + SPACE_ORDER.length * 34 - 20} y2={22 + SPACE_ORDER.length * 34 - 16} stroke="var(--text-2)" />
            <text x={x(t)} y={22 + SPACE_ORDER.length * 34 - 2} textAnchor="middle" fontSize={12} fill="var(--text-2)">
              {t}
            </text>
          </g>
        ))}
        <text x={(x(-0.3) + x(1)) / 2} y={22 + SPACE_ORDER.length * 34 + 14} textAnchor="middle" fontSize={12.5} fill="var(--text-2)">
          cosine similarity · gray band = middle 90% of random pairs, tick = their mean
        </text>
      </svg>
    </div>
  )
}

function btn(active: boolean): React.CSSProperties {
  return {
    font: 'inherit',
    fontSize: 13.5,
    padding: '4px 14px',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-light)' : 'var(--fig-bg)',
    color: 'var(--text)',
    cursor: 'pointer',
  }
}
