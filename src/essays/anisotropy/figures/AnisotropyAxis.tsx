import { useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { useFixture, FixtureFallback } from '../../runtime/lib/data'

// Small-multiples ridgeline: the random-pair cosine distribution of every
// measured space on a shared axis, sorted by mean. A toggle switches to
// the same distributions after subtracting the dataset mean, previewing
// the centering fix.

export const DEFAULTS = {
  showTokens: true,
}

type SpaceStats = Record<
  string,
  {
    label: string
    kind: 'pooled' | 'tokens'
    mean_cos: number
    hist: number[]
    hist_centered: number[]
    mean_cos_centered: number
    norm_of_mean: number
    dim: number
  }
>

export default function AnisotropyAxis(props: FigureProps) {
  const stats = useFixture<SpaceStats>('space-stats.json')
  const [centered, setCentered] = useState(false)
  const showTokens = String(props.showTokens ?? DEFAULTS.showTokens) !== 'false'

  if (stats === undefined) return <FixtureFallback ready />
  if (!stats) return <FixtureFallback ready={false} />

  const entries = Object.entries(stats)
    .filter(([, s]) => showTokens || s.kind === 'pooled')
    .sort((a, b) => a[1].mean_cos - b[1].mean_cos)

  const w = 660
  const rowH = 56
  const h = entries.length * rowH + 54
  const x = d3.scaleLinear([-0.6, 1], [230, w - 24])
  const binEdges = d3.range(-1, 1.0001, 2 / 80)

  return (
    <div style={{ fontFamily: 'var(--heading-font)' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Random-pair cosine distributions of six embedding spaces on a shared axis.">
        {entries.map(([key, s], row) => {
          const y0 = 18 + row * rowH
          const hist = centered ? s.hist_centered : s.hist
          const mean = centered ? s.mean_cos_centered : s.mean_cos
          const maxC = d3.max(hist) ?? 1
          const yScale = d3.scaleLinear([0, maxC], [y0 + rowH - 16, y0 + 6])
          const area = d3
            .area<number>()
            .x((_, i) => x((binEdges[i] + binEdges[i + 1]) / 2))
            .y0(y0 + rowH - 16)
            .y1((c) => yScale(c))
            .curve(d3.curveBasis)
          return (
            <g key={key}>
              <text x={222} y={y0 + rowH - 22} textAnchor="end" fontSize={13} fill="var(--text)">
                {s.label.split(' (')[0]}
              </text>
              <text x={222} y={y0 + rowH - 8} textAnchor="end" fontSize={11.5} fill="var(--text-2)">
                {s.dim}d{s.kind === 'tokens' ? ' · tokens' : ''}
              </text>
              <line x1={x(-0.6)} x2={x(1)} y1={y0 + rowH - 16} y2={y0 + rowH - 16} stroke="var(--border)" />
              <path d={area(hist) ?? ''} fill="var(--accent)" opacity={0.55} />
              <line x1={x(0)} x2={x(0)} y1={y0 + 4} y2={y0 + rowH - 16} stroke="var(--text-2)" strokeDasharray="2 3" opacity={0.4} />
              <line x1={x(mean)} x2={x(mean)} y1={y0 + 2} y2={y0 + rowH - 14} stroke="var(--mean-marker, #d97706)" strokeWidth={2} />
              <text
                x={mean > 0.72 ? x(mean) - 5 : x(mean) + 5}
                y={y0 + 12}
                textAnchor={mean > 0.72 ? 'end' : 'start'}
                fontSize={12}
                fill="var(--mean-marker, #d97706)"
                fontWeight={600}
              >
                {mean >= 0.99 ? mean.toFixed(3) : mean.toFixed(2)}
              </text>
            </g>
          )
        })}
        {[-0.5, 0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={h - 36} y2={h - 32} stroke="var(--text-2)" />
            <text x={x(t)} y={h - 18} textAnchor="middle" fontSize={12} fill="var(--text-2)">
              {t}
            </text>
          </g>
        ))}
        <text x={(x(-0.6) + x(1)) / 2} y={h - 2} textAnchor="middle" fontSize={13} fill="var(--text-2)">
          cosine similarity of random pairs
        </text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, color: 'var(--text)' }}>
          <input type="checkbox" checked={centered} onChange={(e) => setCentered(e.target.checked)} />
          subtract each space's mean vector first
        </label>
      </div>
    </div>
  )
}
