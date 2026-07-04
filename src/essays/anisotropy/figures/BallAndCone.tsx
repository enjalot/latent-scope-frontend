import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'

// Points on the unit sphere sampled from a von Mises–Fisher distribution.
// concentration=0 is the uniform "ball"; higher values tighten the cloud
// into a cone. The linked histogram shows cosine similarities of random
// pairs drawn from the same sample.

export const DEFAULTS = {
  concentration: 0.38, // slider position in [0,1], mapped to kappa log-scale
  points: 420,
  pairs: 2500,
  seed: 0.11,
}

export const PARAM_HINTS = {
  concentration: { min: 0, max: 1, step: 0.01 },
  points: { min: 50, max: 1000, step: 10 },
  seed: { min: 0, max: 0.99, step: 0.01 },
}

const KAPPA_MIN = 0.3
const KAPPA_MAX = 400

function kappaFromSlider(s: number): number {
  if (s <= 0.001) return 0
  return Math.exp(Math.log(KAPPA_MIN) + s * (Math.log(KAPPA_MAX) - Math.log(KAPPA_MIN)))
}

// Sample n unit vectors from vMF on S^2 with mean direction +z.
function sampleVMF(n: number, kappa: number, seed: number): [number, number, number][] {
  const rand = d3.randomLcg(seed)
  const pts: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    let w: number
    if (kappa < 1e-6) {
      w = 2 * rand() - 1
    } else {
      const xi = rand()
      w = 1 + Math.log(xi + (1 - xi) * Math.exp(-2 * kappa)) / kappa
    }
    const theta = 2 * Math.PI * rand()
    const r = Math.sqrt(Math.max(0, 1 - w * w))
    pts.push([r * Math.cos(theta), r * Math.sin(theta), w])
  }
  return pts
}

function pairCosines(pts: [number, number, number][], nPairs: number, seed: number): number[] {
  const rand = d3.randomLcg(seed + 0.5)
  const out: number[] = []
  const n = pts.length
  for (let i = 0; i < nPairs; i++) {
    const a = pts[Math.floor(rand() * n)]
    const b = pts[Math.floor(rand() * n)]
    if (a === b) continue
    out.push(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])
  }
  return out
}

export default function BallAndCone(props: FigureProps) {
  const initial = num(props.concentration, DEFAULTS.concentration)
  const nPoints = num(props.points, DEFAULTS.points)
  const nPairs = num(props.pairs, DEFAULTS.pairs)
  const seed = num(props.seed, DEFAULTS.seed)

  const [slider, setSlider] = useState(initial)
  const [angle, setAngle] = useState(0.6)
  const kappa = kappaFromSlider(slider)

  // Slow rotation for depth; skipped under prefers-reduced-motion.
  const frame = useRef<number>(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let last = performance.now()
    const tick = (t: number) => {
      if (t - last > 40) {
        setAngle((a) => a + 0.004 * (t - last) * 0.06)
        last = t
      }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [])

  const pts = useMemo(() => sampleVMF(nPoints, kappa, seed), [nPoints, kappa, seed])
  const cosines = useMemo(() => pairCosines(pts, nPairs, seed), [pts, nPairs, seed])
  const meanCos = useMemo(() => d3.mean(cosines) ?? 0, [cosines])

  // ---- sphere projection ----
  const R = 130
  const cx = 160
  const cy = 155
  const tilt = 0.42
  const projected = useMemo(() => {
    const ca = Math.cos(angle)
    const sa = Math.sin(angle)
    const ct = Math.cos(tilt)
    const st = Math.sin(tilt)
    return pts
      .map(([x, y, z]) => {
        // rotate around y (spin), then around x (fixed tilt)
        const x1 = x * ca + z * sa
        const z1 = -x * sa + z * ca
        const y1 = y * ct - z1 * st
        const z2 = y * st + z1 * ct
        return { sx: cx + R * x1, sy: cy - R * y1, depth: z2 }
      })
      .sort((a, b) => a.depth - b.depth)
  }, [pts, angle])

  // ---- histogram ----
  const hw = 320
  const hh = 230
  const hx = d3.scaleLinear([-1, 1], [40, hw - 12])
  const bins = useMemo(
    () => d3.bin().domain([-1, 1]).thresholds(d3.range(-1, 1.0001, 0.05))(cosines),
    [cosines],
  )
  const maxCount = d3.max(bins, (b) => b.length) ?? 1
  const hy = d3.scaleLinear([0, maxCount], [hh - 34, 16])

  return (
    <div style={{ fontFamily: 'var(--heading-font)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        <svg viewBox="0 0 320 310" width="100%" style={{ flex: '1 1 270px', maxWidth: 330 }} role="img" aria-label="Points on a sphere concentrating into a cone as the slider increases.">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth={1.5} />
          {projected.map((p, i) => (
            <circle
              key={i}
              cx={p.sx}
              cy={p.sy}
              r={p.depth > 0 ? 2.4 : 1.8}
              fill="var(--accent)"
              opacity={0.18 + 0.55 * (p.depth + 1) * 0.5}
            />
          ))}
          <text x={cx} y={302} textAnchor="middle" fontSize={13} fill="var(--text-2)">
            the embedding cloud on the unit sphere
          </text>
        </svg>
        <svg viewBox={`0 0 ${hw} 310`} width="100%" style={{ flex: '1 1 270px', maxWidth: 330 }} role="img" aria-label="Histogram of cosine similarity between random pairs of points.">
          {bins.map((b, i) => (
            <rect
              key={i}
              x={hx(b.x0 ?? -1) + 0.5}
              y={hy(b.length)}
              width={Math.max(0, hx(b.x1 ?? 1) - hx(b.x0 ?? -1) - 1)}
              height={hh - 34 - hy(b.length)}
              fill="var(--accent)"
              opacity={0.75}
            />
          ))}
          {/* axis */}
          <line x1={hx(-1)} x2={hx(1)} y1={hh - 34} y2={hh - 34} stroke="var(--text-2)" strokeWidth={1} />
          {[-1, -0.5, 0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={hx(t)} x2={hx(t)} y1={hh - 34} y2={hh - 30} stroke="var(--text-2)" />
              <text x={hx(t)} y={hh - 16} textAnchor="middle" fontSize={12} fill="var(--text-2)">
                {t}
              </text>
            </g>
          ))}
          {/* zero reference */}
          <line x1={hx(0)} x2={hx(0)} y1={16} y2={hh - 34} stroke="var(--text-2)" strokeDasharray="3 3" opacity={0.5} />
          {/* mean marker */}
          <line x1={hx(meanCos)} x2={hx(meanCos)} y1={16} y2={hh - 34} stroke="var(--mean-marker, #d97706)" strokeWidth={2} />
          <text
            x={Math.min(hx(meanCos) + 6, hw - 90)}
            y={30}
            fontSize={13}
            fill="var(--mean-marker, #d97706)"
          >
            mean {meanCos.toFixed(2)}
          </text>
          <text x={(hx(-1) + hx(1)) / 2} y={hh - 0} textAnchor="middle" fontSize={13} fill="var(--text-2)">
            cosine similarity of random pairs
          </text>
          <text x={(hx(-1) + hx(1)) / 2} y={302} textAnchor="middle" fontSize={13} fill="var(--text-2)" opacity={0}>
            .
          </text>
        </svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>ball</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={slider}
          onChange={(e) => setSlider(+e.target.value)}
          style={{ width: 260, accentColor: 'var(--accent)' }}
          aria-label="Cloud concentration"
        />
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>cone</span>
      </div>
    </div>
  )
}
