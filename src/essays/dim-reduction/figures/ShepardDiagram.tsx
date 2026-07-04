import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, str } from '../../runtime/lib/params'

// Shepard diagram: for every pair of points, plot original distance vs
// embedded distance. A perfect projection has all points on the diagonal.
// We toggle between two synthetic embeddings of the same data:
//   - "distance-preserving" (MDS-like): points hug the diagonal
//   - "neighborhood-preserving" (t-SNE-like): an S-curve — small
//     distances are roughly faithful, large distances get compressed
// Each dot is the SAME pair in both regimes (same original distance, so
// the same x), so toggling MORPHS the cloud vertically: the reader
// watches the large-distance pairs get squashed off the diagonal while
// the small-distance pairs barely move. The stress readout updates live
// during the morph.
// We also surface the stress score so the reader can see what a single
// number captures vs. what the scatter shows.
//
// This figure has no counterpart in the original HTML article; it
// illustrates the stress/Shepard-diagram paragraph of
// docs/dim-reduction/01-framing.html.

type Mode = 'mds' | 'tsne'

const PANEL = { w: 380, h: 320 }

// Tweakable surface. Override per-instance from markdown:
//   :::figure{id=shepard-diagram mode=tsne noise=0.1}
export const DEFAULTS = {
  mode: 'mds', // embedding shown first: mds (distance-preserving) | tsne (neighborhood-preserving)
  n: 80, // number of points; the diagram plots all n(n-1)/2 pairs
  seed: 23, // RNG seed for the synthetic distance distribution
  noise: 0.05, // jitter added to embedded distances (scatter width around the trend)
  steepness: 5, // sigmoid steepness of the t-SNE-like large-distance compression
}

// Knob-panel bounds: the diagram renders n(n-1)/2 SVG circles, so the
// heuristic's n max of 500 (~125K nodes) would freeze the page — cap at
// 200; noise jitter past ~0.5 swamps the trend and step 0.001 is fiddly;
// steepness saturates visually past ~20 (heuristic offers 50).
export const PARAM_HINTS = {
  n: { min: 10, max: 200, step: 10 },
  noise: { min: 0, max: 0.5, step: 0.01 },
  steepness: { min: 0.5, max: 20, step: 0.5 },
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildPairs(n: number, seed: number) {
  const rng = mulberry32(seed)
  // Original distances drawn from a plausible high-dimensional cloud:
  // concentrated around the middle of the range, with a long tail.
  const dHigh: number[] = []
  for (let k = 0; k < (n * (n - 1)) / 2; k++) {
    // mixture: most distances ~ Normal(0.55, 0.12), a few small / large
    const u = rng()
    const base =
      u < 0.05
        ? 0.05 + rng() * 0.15 // small (true neighbors)
        : u > 0.95
          ? 0.85 + rng() * 0.12
          : 0.55 + (rng() - 0.5) * 0.25
    dHigh.push(Math.max(0.01, Math.min(0.99, base)))
  }
  return dHigh
}

function project(
  dHigh: number[],
  mode: Mode,
  seed: number,
  noiseAmp: number,
  steepness: number,
) {
  const rng = mulberry32(seed + 1)
  return dHigh.map((d) => {
    const noise = (rng() - 0.5) * noiseAmp
    if (mode === 'mds') {
      // near-diagonal with small noise (uniform isotropic distortion)
      return Math.max(0, Math.min(1, d + noise))
    }
    // t-SNE-like: faithful for small d, compressed sigmoid for large d
    const compressed = 1 / (1 + Math.exp(-(d - 0.4) * steepness))
    const out = 0.1 + compressed * 0.75 + noise * 0.5
    return Math.max(0, Math.min(1, out))
  })
}

function stress(dHigh: number[], dLow: number[]) {
  // Kruskal stress-1
  let num = 0
  let den = 0
  for (let i = 0; i < dHigh.length; i++) {
    num += (dHigh[i] - dLow[i]) ** 2
    den += dHigh[i] ** 2
  }
  return Math.sqrt(num / Math.max(den, 1e-9))
}

const MODES: { id: Mode; label: string; note: string }[] = [
  {
    id: 'mds',
    label: 'distance-preserving (MDS-like)',
    note: 'Points fall near the diagonal: pairwise distances are roughly preserved at every scale.',
  },
  {
    id: 'tsne',
    label: 'neighborhood-preserving (t-SNE-like)',
    note: 'Small distances are faithful; large distances get squashed into a narrow band. The diagonal bends into an S.',
  },
]

export default function ShepardDiagram(props: FigureProps) {
  const modeRaw = str(props.mode, DEFAULTS.mode)
  const mode0: Mode = MODES.some((m) => m.id === modeRaw)
    ? (modeRaw as Mode)
    : 'mds'
  const n = Math.max(2, Math.round(num(props.n, DEFAULTS.n)))
  const seed = num(props.seed, DEFAULTS.seed)
  const noise = num(props.noise, DEFAULTS.noise)
  const steepness = num(props.steepness, DEFAULTS.steepness)

  const [mode, setMode] = useState<Mode>(mode0)
  useEffect(() => setMode(mode0), [mode0])

  const dHigh = useMemo(() => buildPairs(n, seed), [n, seed])
  const dLow = useMemo(
    () => project(dHigh, mode, seed, noise, steepness),
    [dHigh, mode, seed, noise, steepness],
  )

  // Morph between regimes: each pair keeps its x (original distance) and
  // glides vertically from the old embedded distance to the new one, so
  // the compression of large distances is something the reader watches
  // happen rather than infers from two snapshots.
  const MORPH_MS = 850
  const [anim, setAnim] = useState<{ from: number[]; t: number } | null>(null)
  const prevLow = useRef<number[]>(dLow)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    const from = prevLow.current
    prevLow.current = dLow
    if (reduceMotion || from === dLow || from.length !== dLow.length) {
      setAnim(null)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / MORPH_MS)
      if (t < 1) {
        setAnim({ from, t })
        raf = requestAnimationFrame(tick)
      } else {
        setAnim(null)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [dLow, reduceMotion])

  const ease = anim ? d3.easeCubicInOut(anim.t) : 1
  const dLowShown = useMemo(
    () =>
      anim
        ? dLow.map((v, i) => anim.from[i] + (v - anim.from[i]) * ease)
        : dLow,
    [anim, dLow, ease],
  )
  // Stress tracks the dots: recomputed from the interpolated positions
  // so the number climbs/falls in sync with the cloud leaving or
  // rejoining the diagonal.
  const s = useMemo(() => stress(dHigh, dLowShown), [dHigh, dLowShown])

  const margin = { top: 14, right: 14, bottom: 36, left: 44 }
  const innerW = PANEL.w - margin.left - margin.right
  const innerH = PANEL.h - margin.top - margin.bottom
  const xs = d3.scaleLinear([0, 1], [0, innerW])
  const ys = d3.scaleLinear([0, 1], [innerH, 0])

  const xTicks = xs.ticks(5)
  const yTicks = ys.ticks(5)

  const active = MODES.find((m) => m.id === mode)!

  return (
    <div>
      <div className="controls">
        <div className="toggle-group">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={mode === m.id ? 'active' : ''}
              onClick={() => setMode(m.id)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${PANEL.w} ${PANEL.h}`}
        width="100%"
        style={{ maxHeight: PANEL.h }}
        role="img"
        aria-label="Shepard diagram scattering original pairwise distance against embedded distance, with a dashed identity diagonal and a stress readout."
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* axes */}
          <g className="axis" transform={`translate(0,${innerH})`}>
            <line x1={0} y1={0} x2={innerW} y2={0} stroke="var(--border)" />
            {xTicks.map((t) => (
              <g key={t} transform={`translate(${xs(t)},0)`}>
                <line y1={0} y2={4} stroke="var(--border)" />
                <text
                  y={16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--text-2)"
                  fontFamily="var(--heading-font)"
                >
                  {t.toFixed(1)}
                </text>
              </g>
            ))}
            <text
              x={innerW / 2}
              y={30}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--text-2)"
              fontFamily="var(--heading-font)"
            >
              original distance
            </text>
          </g>
          <g className="axis">
            <line x1={0} y1={0} x2={0} y2={innerH} stroke="var(--border)" />
            {yTicks.map((t) => (
              <g key={t} transform={`translate(0,${ys(t)})`}>
                <line x1={-4} x2={0} stroke="var(--border)" />
                <text
                  x={-8}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--text-2)"
                  fontFamily="var(--heading-font)"
                >
                  {t.toFixed(1)}
                </text>
              </g>
            ))}
            <text
              transform={`rotate(-90)`}
              x={-innerH / 2}
              y={-32}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--text-2)"
              fontFamily="var(--heading-font)"
            >
              embedded distance
            </text>
          </g>

          {/* identity reference */}
          <line
            x1={xs(0)}
            y1={ys(0)}
            x2={xs(1)}
            y2={ys(1)}
            stroke="var(--text-2)"
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={0.6}
          />

          {/* shepard scatter */}
          {dHigh.map((d, i) => (
            <circle
              key={i}
              cx={xs(d)}
              cy={ys(dLowShown[i])}
              r={1.6}
              fill={mode === 'mds' ? 'var(--accent)' : 'var(--warm)'}
              opacity={0.5}
            />
          ))}

          {/* stress readout */}
          <text
            x={innerW - 6}
            y={14}
            textAnchor="end"
            fontSize={11}
            fontFamily="var(--heading-font)"
            fill="var(--text-2)"
          >
            stress = {s.toFixed(3)}
          </text>
        </g>
      </svg>

      <p className="shepard-note">{active.note}</p>
    </div>
  )
}
