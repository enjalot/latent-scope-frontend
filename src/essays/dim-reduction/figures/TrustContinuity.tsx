import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num, str } from '../../runtime/lib/params'
import { useFigureHighlight } from '../../runtime/store'

// Two small panels side-by-side: original space and embedded space.
// A toggle selects which failure mode the embedding exhibits:
//   - "faithful":   embedding preserves neighborhoods
//   - "false-near": embedding invents neighbors that weren't close (low trust)
//   - "torn":       embedding rips apart real neighborhoods (low continuity)
// Trust and continuity scores update with each mode, and the embedded
// panel MORPHS between layouts so the reader watches the projection
// commit the crime: clusters sliding together (false neighbors) or
// points being ripped out of their cluster (torn). Offending pairs are
// drawn in the warm color so the reader can see which neighborhoods broke.
//
// Scores use the rank-weighted Venna–Kaski definitions. The rank
// weighting matters pedagogically: an invented neighbor that was
// originally FAR costs trust a lot, and a torn point that lands FAR
// away costs continuity a lot — which is what makes the two scores
// genuinely asymmetric across the two failure modes. (A plain
// neighbor-set-overlap fraction is symmetric by construction and would
// show trust = continuity in every mode.)
//
// This figure has no counterpart in the original HTML article; it
// illustrates the trustworthiness/continuity paragraph of
// docs/dim-reduction/01-framing.html.

type Mode = 'faithful' | 'false-near' | 'torn'

const PANEL = { w: 260, h: 220 }
const MORPH_MS = 750

// Tweakable surface. Override per-instance from markdown:
//   :::figure{id=trust-continuity mode=torn k=8}
export const DEFAULTS = {
  mode: 'false-near', // failure mode shown first: faithful | false-near | torn
  k: 5, // neighborhood size for the trust/continuity computation
  n: 60, // total points (split evenly across two clusters)
  seed: 11, // RNG seed for the original layout
  collapse: 0.06, // x-compression in false-near mode (smaller = clusters merge harder; needs to be small enough that the clusters truly interleave, otherwise embedded neighbors stay same-cluster and trust barely moves)
  tornCount: 8, // points ripped out of cluster A in torn mode
}

// Knob-panel bounds: k must stay >= 1 and well below n; n is split
// across two clusters (step 2 keeps it even, 200 keeps panels legible);
// collapse is a compression fraction that only means anything in [0, 1];
// tornCount can't exceed cluster A's size (n/2 = 30 at default n).
export const PARAM_HINTS = {
  k: { min: 1, max: 20, step: 1 },
  n: { min: 8, max: 200, step: 2 },
  collapse: { min: 0, max: 1, step: 0.01 },
  tornCount: { min: 1, max: 30, step: 1 },
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = { x: number; y: number; c: 0 | 1; id: number }

// Build a simple "two blobs" original where neighborhoods are well
// defined within each blob.
function buildOriginal(n: number, seed: number): Pt[] {
  const rng = mulberry32(seed)
  const half = Math.floor(n / 2)
  const data: Pt[] = []
  for (let i = 0; i < half; i++) {
    data.push({
      x: 0.25 + rng() * 0.2 - 0.1 + (rng() - 0.5) * 0.04,
      y: 0.5 + (rng() - 0.5) * 0.45,
      c: 0,
      id: i,
    })
  }
  for (let i = 0; i < half; i++) {
    data.push({
      x: 0.75 + rng() * 0.2 - 0.1 + (rng() - 0.5) * 0.04,
      y: 0.5 + (rng() - 0.5) * 0.45,
      c: 1,
      id: i + half,
    })
  }
  return data
}

function buildEmbedding(
  orig: Pt[],
  mode: Mode,
  collapse: number,
  tornCount: number,
): Pt[] {
  // Start from the original. Each mode then perturbs it differently.
  const e: Pt[] = orig.map((p) => ({ ...p }))
  if (mode === 'faithful') {
    // tight near-identity layout, well separated by class
    return e.map((p) => ({
      ...p,
      x: p.c === 0 ? 0.28 + (p.x - 0.25) * 0.9 : 0.72 + (p.x - 0.75) * 0.9,
      y: p.y,
    }))
  }
  if (mode === 'false-near') {
    // Collapse the two clusters toward each other so many cross-cluster
    // points become embedded neighbors that weren't original neighbors.
    return e.map((p) => ({
      ...p,
      x: 0.5 + (p.x - 0.5) * collapse,
      y: p.y,
    }))
  }
  // 'torn': pick a few points from cluster 0 and move them far away,
  // ripping their original neighborhood apart.
  const half = Math.floor(orig.length / 2)
  const step = Math.max(1, Math.floor(half / Math.max(1, tornCount)))
  const tornIds = new Set<number>()
  for (let i = 0; i < tornCount; i++) {
    const id = 2 + i * step
    if (id < half) tornIds.add(id)
  }
  return e.map((p) => {
    if (p.c === 0 && tornIds.has(p.id)) {
      // Shoot them down to the bottom-right corner.
      return { ...p, x: 0.85 + (p.x - 0.25) * 0.1, y: 0.05 + p.y * 0.1 }
    }
    return p
  })
}

// For every point, the other points sorted by distance — both the
// k-neighbor sets and the full rank tables come from this.
function neighborOrder(pts: Pt[]): number[][] {
  return pts.map((p, i) =>
    pts
      .map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.j),
  )
}

// Rank-weighted trustworthiness and continuity (Venna & Kaski).
// Trustworthiness penalizes embedded neighbors that were not original
// neighbors, weighted by HOW FAR (in original rank) they really were.
// Continuity penalizes original neighbors lost from the embedded
// neighborhood, weighted by how far away the embedding sent them.
function neighborhoodScores(orig: Pt[], emb: Pt[], k: number) {
  const n = orig.length
  const orderO = neighborOrder(orig)
  const orderE = neighborOrder(emb)
  const ko = orderO.map((arr) => new Set(arr.slice(0, k)))
  const ke = orderE.map((arr) => new Set(arr.slice(0, k)))
  // rank[i][j] = 1-based rank of j among i's neighbors
  const rankO = orderO.map((arr) => {
    const r = new Map<number, number>()
    arr.forEach((j, idx) => r.set(j, idx + 1))
    return r
  })
  const rankE = orderE.map((arr) => {
    const r = new Map<number, number>()
    arr.forEach((j, idx) => r.set(j, idx + 1))
    return r
  })
  // Per-pair penalties drive both the scores and the red lines' opacity:
  // a pair that barely slipped out of the neighborhood (rank k+1) is a
  // near-invisible line, a genuinely betrayed pair is a bright one.
  let trustPenalty = 0
  let contPenalty = 0
  const trustPairs: { a: number; b: number; w: number }[] = []
  const contPairs: { a: number; b: number; w: number }[] = []
  for (let i = 0; i < n; i++) {
    for (const j of ke[i]) {
      if (!ko[i].has(j)) {
        const w = (rankO[i].get(j) ?? n) - k
        trustPenalty += w
        if (i < j) trustPairs.push({ a: i, b: j, w })
      }
    }
    for (const j of ko[i]) {
      if (!ke[i].has(j)) {
        const w = (rankE[i].get(j) ?? n) - k
        contPenalty += w
        if (i < j) contPairs.push({ a: i, b: j, w })
      }
    }
  }
  // Standard normalizer; guard the degenerate k > (2n-1)/3 corner where
  // it flips sign (clamping keeps the readout in [0, 1] regardless).
  const denom = n * k * (2 * n - 3 * k - 1)
  const norm = denom > 0 ? 2 / denom : 0
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    trust: clamp(1 - norm * trustPenalty),
    continuity: clamp(1 - norm * contPenalty),
    trustPairs,
    contPairs,
  }
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'faithful', label: 'faithful' },
  { id: 'false-near', label: 'false neighbors' },
  { id: 'torn', label: 'torn neighborhood' },
]

export default function TrustContinuity(props: FigureProps) {
  const modeRaw = str(props.mode, DEFAULTS.mode)
  const mode0: Mode = MODES.some((m) => m.id === modeRaw)
    ? (modeRaw as Mode)
    : 'false-near'
  const k = Math.max(1, Math.round(num(props.k, DEFAULTS.k)))
  const n = Math.max(4, Math.round(num(props.n, DEFAULTS.n)))
  const seed = num(props.seed, DEFAULTS.seed)
  const collapse = num(props.collapse, DEFAULTS.collapse)
  const tornCount = Math.max(1, Math.round(num(props.tornCount, DEFAULTS.tornCount)))

  const [mode, setMode] = useState<Mode>(mode0)
  useEffect(() => setMode(mode0), [mode0])

  // Term highlighting: 'continuity' points at the original panel (where
  // torn neighborhoods are drawn), 'trust' at the embedded panel (where
  // invented neighbors are drawn).
  const { activePart } = useFigureHighlight(props.figureId as string)

  const original = useMemo(() => buildOriginal(n, seed), [n, seed])
  const embedded = useMemo(
    () => buildEmbedding(original, mode, collapse, tornCount),
    [original, mode, collapse, tornCount],
  )
  const scores = useMemo(
    () => neighborhoodScores(original, embedded, k),
    [original, embedded, k],
  )

  // Morph the embedded panel between layouts. `anim` carries the layout
  // we are leaving and an eased progress t in [0, 1]; while morphing,
  // points render at interpolated positions and the red broken-pair
  // lines fade in near the end (they only make sense at the destination).
  const [anim, setAnim] = useState<{ from: Pt[]; t: number } | null>(null)
  const prevEmbedded = useRef<Pt[]>(embedded)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    const from = prevEmbedded.current
    prevEmbedded.current = embedded
    if (reduceMotion || from === embedded || from.length !== embedded.length) {
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
  }, [embedded, reduceMotion])

  const ease = anim ? d3.easeCubicInOut(anim.t) : 1
  const shownX = (i: number) =>
    anim ? anim.from[i].x + (embedded[i].x - anim.from[i].x) * ease : embedded[i].x
  const shownY = (i: number) =>
    anim ? anim.from[i].y + (embedded[i].y - anim.from[i].y) * ease : embedded[i].y
  // Broken-pair lines belong to the destination layout: hold them back
  // until the morph is mostly done, then fade in.
  const lineReveal = anim ? Math.max(0, (anim.t - 0.55) / 0.45) : 1

  const xs = d3.scaleLinear([0, 1], [10, PANEL.w - 10])
  const ys = d3.scaleLinear([0, 1], [PANEL.h - 10, 10])

  // Line opacity scales with the pair's rank penalty so the worst
  // betrayals are the brightest lines.
  const trustWMax = d3.max(scores.trustPairs, (p) => p.w) ?? 1
  const contWMax = d3.max(scores.contPairs, (p) => p.w) ?? 1
  const lineOpacity = (w: number, wMax: number) =>
    0.12 + 0.6 * (w / Math.max(1, wMax))

  const panelStyle = (part: 'continuity' | 'trust') => ({
    opacity: activePart && activePart !== part ? 0.35 : 1,
    outline: activePart === part ? '2px solid var(--accent)' : 'none',
    outlineOffset: 2,
    borderRadius: 4,
    transition: 'opacity 120ms ease',
  })

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

      <div className="tc-grid">
        <div className="tc-panel" style={panelStyle('continuity')}>
          <div className="tc-label">original (high-dimensional)</div>
          <svg
            viewBox={`0 0 ${PANEL.w} ${PANEL.h}`}
            width="100%"
            style={{ maxHeight: PANEL.h }}
          >
            {/* Continuity: pairs that were close originally but got
                separated in the embedding are drawn here in red. */}
            {scores.contPairs.map(({ a, b, w }, i) => (
              <line
                key={i}
                x1={xs(original[a].x)}
                y1={ys(original[a].y)}
                x2={xs(original[b].x)}
                y2={ys(original[b].y)}
                stroke="var(--warm)"
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={lineOpacity(w, contWMax) * lineReveal}
              />
            ))}
            {original.map((p) => (
              <circle
                key={p.id}
                cx={xs(p.x)}
                cy={ys(p.y)}
                r={3}
                fill={p.c === 0 ? 'var(--accent)' : 'var(--text-2)'}
                opacity={0.9}
              />
            ))}
          </svg>
          <div className="tc-metric">
            <span>continuity</span>
            <span className="tc-num">{scores.continuity.toFixed(2)}</span>
          </div>
          <div className="tc-foot">red = real neighborhoods torn apart</div>
        </div>

        <div className="tc-panel" style={panelStyle('trust')}>
          <div className="tc-label">embedded (2D picture)</div>
          <svg
            viewBox={`0 0 ${PANEL.w} ${PANEL.h}`}
            width="100%"
            style={{ maxHeight: PANEL.h }}
          >
            {/* Trust: pairs that are close in the embedding but were
                NOT close in the original are drawn here in red. */}
            {scores.trustPairs.map(({ a, b, w }, i) => (
              <line
                key={i}
                x1={xs(shownX(a))}
                y1={ys(shownY(a))}
                x2={xs(shownX(b))}
                y2={ys(shownY(b))}
                stroke="var(--warm)"
                strokeWidth={1}
                strokeDasharray="2 2"
                opacity={lineOpacity(w, trustWMax) * lineReveal}
              />
            ))}
            {embedded.map((p, i) => (
              <circle
                key={p.id}
                cx={xs(shownX(i))}
                cy={ys(shownY(i))}
                r={3}
                fill={p.c === 0 ? 'var(--accent)' : 'var(--text-2)'}
                opacity={0.9}
              />
            ))}
          </svg>
          <div className="tc-metric">
            <span>trustworthiness</span>
            <span className="tc-num">{scores.trust.toFixed(2)}</span>
          </div>
          <div className="tc-foot">red = invented neighbors</div>
        </div>
      </div>
    </div>
  )
}
