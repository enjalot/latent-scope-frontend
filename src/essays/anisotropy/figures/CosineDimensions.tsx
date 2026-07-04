import { useMemo, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'

// Cosine similarity of random pairs of *uniformly random* unit vectors,
// as a function of dimension. Shows concentration of measure: the spread
// collapses like 1/sqrt(d), which is why a mean random-pair cosine of 0.6
// in 768 dimensions is enormous.

export const DEFAULTS = {
  dimStep: 5, // index into DIMS below
  pairs: 3000,
  seed: 0.27,
}

const DIMS = [2, 3, 4, 8, 16, 32, 64, 128, 384, 768]

export const PARAM_HINTS = {
  dimStep: { min: 0, max: DIMS.length - 1, step: 1 },
}

// Cosines between random gaussian vectors of dimension d (normalized).
function randomCosines(d: number, nPairs: number, seed: number): number[] {
  const normal = d3.randomNormal.source(d3.randomLcg(seed))(0, 1)
  const out: number[] = []
  for (let i = 0; i < nPairs; i++) {
    let dot = 0
    let na = 0
    let nb = 0
    for (let k = 0; k < d; k++) {
      const a = normal()
      const b = normal()
      dot += a * b
      na += a * a
      nb += b * b
    }
    out.push(dot / Math.sqrt(na * nb))
  }
  return out
}

export default function CosineDimensions(props: FigureProps) {
  const initialStep = num(props.dimStep, DEFAULTS.dimStep)
  const nPairs = num(props.pairs, DEFAULTS.pairs)
  const seed = num(props.seed, DEFAULTS.seed)
  const [step, setStep] = useState(Math.round(initialStep))
  const dim = DIMS[Math.max(0, Math.min(DIMS.length - 1, step))]

  const cosines = useMemo(() => randomCosines(dim, nPairs, seed), [dim, nPairs, seed])
  // Fixed reference: dimension 2, always drawn as an outline behind.
  const refCosines = useMemo(() => randomCosines(2, nPairs, seed), [nPairs, seed])

  const w = 640
  const h = 260
  const x = d3.scaleLinear([-1, 1], [46, w - 16])
  const thresholds = d3.range(-1, 1.0001, 0.025)
  const bins = useMemo(
    () => d3.bin().domain([-1, 1]).thresholds(thresholds)(cosines),
    [cosines],
  )
  const refBins = useMemo(
    () => d3.bin().domain([-1, 1]).thresholds(thresholds)(refCosines),
    [refCosines],
  )
  // Normalize each histogram to its own max so shape comparison is fair.
  const maxCount = d3.max(bins, (b) => b.length) ?? 1
  const refMax = d3.max(refBins, (b) => b.length) ?? 1
  const y = d3.scaleLinear([0, 1], [h - 40, 18])

  const refLine = d3
    .line<d3.Bin<number, number>>()
    .x((b) => (x(b.x0 ?? -1) + x(b.x1 ?? 1)) / 2)
    .y((b) => y(b.length / refMax))
    .curve(d3.curveStepAfter)

  const sigma = 1 / Math.sqrt(dim)

  return (
    <div style={{ fontFamily: 'var(--heading-font)' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Histogram of random-pair cosine similarity narrowing as dimension increases.">
        {bins.map((b, i) => (
          <rect
            key={i}
            x={x(b.x0 ?? -1) + 0.5}
            y={y(b.length / maxCount)}
            width={Math.max(0, x(b.x1 ?? 1) - x(b.x0 ?? -1) - 1)}
            height={h - 40 - y(b.length / maxCount)}
            fill="var(--accent)"
            opacity={0.75}
          />
        ))}
        <path d={refLine(refBins) ?? ''} fill="none" stroke="var(--text-2)" strokeWidth={1.2} opacity={0.5} strokeDasharray="4 3" />
        <text x={x(-0.72)} y={y(0.75)} fontSize={12} fill="var(--text-2)" opacity={0.8}>
          d = 2 for reference
        </text>
        <line x1={x(-1)} x2={x(1)} y1={h - 40} y2={h - 40} stroke="var(--text-2)" strokeWidth={1} />
        {[-1, -0.5, 0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={h - 40} y2={h - 36} stroke="var(--text-2)" />
            <text x={x(t)} y={h - 22} textAnchor="middle" fontSize={12} fill="var(--text-2)">
              {t}
            </text>
          </g>
        ))}
        <text x={(x(-1) + x(1)) / 2} y={h - 4} textAnchor="middle" fontSize={13} fill="var(--text-2)">
          cosine similarity of random pairs, uniform on the sphere in {dim} dimensions
        </text>
        <text x={x(0) + 8} y={26} fontSize={13} fill="var(--text)" fontWeight={600}>
          d = {dim}
        </text>
        <text x={x(0) + 8} y={44} fontSize={12} fill="var(--text-2)">
          typical spread ±{sigma.toFixed(sigma < 0.1 ? 3 : 2)}
        </text>
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>2</span>
        <input
          type="range"
          min={0}
          max={DIMS.length - 1}
          step={1}
          value={step}
          onChange={(e) => setStep(+e.target.value)}
          style={{ width: 300, accentColor: 'var(--accent)' }}
          aria-label="Embedding dimension"
        />
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>768 dimensions</span>
      </div>
    </div>
  )
}
