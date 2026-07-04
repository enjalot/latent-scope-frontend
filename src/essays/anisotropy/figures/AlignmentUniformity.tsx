import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { num } from '../../runtime/lib/params'

// A toy contrastive training run on the circle (S^1). Points start
// clumped in a cone. An alignment force pulls positive pairs together;
// a uniformity force (gaussian-kernel repulsion, Wang & Isola) pushes
// every point away from every other. The live readout is the same
// statistic as the rest of the article: mean cosine of random pairs.

export const DEFAULTS = {
  pairs: 24,
  alignStrength: 1.0,
  uniformStrength: 1.0,
  seed: 0.31,
}

export const PARAM_HINTS = {
  pairs: { min: 4, max: 60, step: 1 },
  alignStrength: { min: 0, max: 3, step: 0.1 },
  uniformStrength: { min: 0, max: 3, step: 0.1 },
}

const CONE_SPREAD = 0.55 // radians; initial clump half-width
const KERNEL_T = 2

type Sim = { angles: number[]; meanHistory: number[]; step: number }

function initSim(nPairs: number, seed: number): Sim {
  const rand = d3.randomLcg(seed)
  const angles: number[] = []
  for (let p = 0; p < nPairs; p++) {
    const base = (rand() * 2 - 1) * CONE_SPREAD
    angles.push(base + (rand() * 2 - 1) * 0.06)
    angles.push(base + (rand() * 2 - 1) * 0.06)
  }
  return { angles, meanHistory: [], step: 0 }
}

function meanPairCosine(angles: number[]): number {
  // exact mean over all pairs via resultant: E[cos(θi-θj)] over i≠j
  let c = 0
  let s = 0
  for (const a of angles) {
    c += Math.cos(a)
    s += Math.sin(a)
  }
  const n = angles.length
  return (c * c + s * s - n) / (n * (n - 1))
}

export default function AlignmentUniformity(props: FigureProps) {
  const nPairs = num(props.pairs, DEFAULTS.pairs)
  const seed = num(props.seed, DEFAULTS.seed)
  const [alignOn, setAlignOn] = useState(true)
  const [uniformOn, setUniformOn] = useState(true)
  const alignStrength = num(props.alignStrength, DEFAULTS.alignStrength)
  const uniformStrength = num(props.uniformStrength, DEFAULTS.uniformStrength)
  const [, setTick] = useState(0)
  const sim = useRef<Sim>(initSim(nPairs, seed))
  const [running, setRunning] = useState(true)

  const reset = () => {
    sim.current = initSim(nPairs, seed)
    setRunning(true)
    setTick((t) => t + 1)
  }

  useEffect(() => {
    sim.current = initSim(nPairs, seed)
    setTick((t) => t + 1)
  }, [nPairs, seed])

  useEffect(() => {
    if (!running) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // jump straight to many steps so the end state is visible
      for (let i = 0; i < 600; i++) stepSim()
      setTick((t) => t + 1)
      setRunning(false)
      return
    }
    let raf = 0
    let last = performance.now()
    const loop = (t: number) => {
      if (t - last > 33) {
        stepSim()
        stepSim()
        setTick((k) => k + 1)
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, alignOn, uniformOn])

  function stepSim() {
    const { angles } = sim.current
    const n = angles.length
    const lr = 0.05
    const next = angles.slice()
    for (let i = 0; i < n; i++) {
      let force = 0
      if (alignOn) {
        const partner = i % 2 === 0 ? i + 1 : i - 1
        force -= alignStrength * 2 * Math.sin(angles[i] - angles[partner])
      }
      if (uniformOn) {
        let rep = 0
        for (let j = 0; j < n; j++) {
          if (j === i) continue
          const d = angles[i] - angles[j]
          rep += KERNEL_T * 2 * Math.sin(d) * Math.exp(-KERNEL_T * (2 - 2 * Math.cos(d)))
        }
        force += (uniformStrength * rep) / n
      }
      next[i] = angles[i] + lr * force
    }
    sim.current.angles = next
    sim.current.step++
    if (sim.current.step % 4 === 0) {
      sim.current.meanHistory.push(meanPairCosine(next))
      if (sim.current.meanHistory.length > 240) sim.current.meanHistory.shift()
    }
  }

  const { angles, meanHistory } = sim.current
  const meanCos = meanPairCosine(angles)

  const R = 110
  const cx = 150
  const cy = 140
  const w = 640

  // pair chords
  const chords = useMemo(() => {
    const out: [number, number][] = []
    for (let p = 0; p < Math.floor(angles.length / 2); p++) out.push([2 * p, 2 * p + 1])
    return out
  }, [angles.length])

  // mean-cosine trace
  const tw = 300
  const th = 200
  const tx = d3.scaleLinear([0, 240], [360, 360 + tw - 20])
  const ty = d3.scaleLinear([-0.2, 1], [th + 40, 40])
  const traceLine = d3
    .line<number>()
    .x((_, i) => tx(i))
    .y((v) => ty(v))

  return (
    <div style={{ fontFamily: 'var(--heading-font)' }}>
      <svg viewBox={`0 0 ${w} 300`} width="100%" role="img" aria-label="Toy contrastive training on a circle: clumped points spread out to cover the circle uniformly.">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--border)" strokeWidth={1.5} />
        {chords.map(([a, b], i) => (
          <line
            key={i}
            x1={cx + (R - 6) * Math.cos(angles[a])}
            y1={cy - (R - 6) * Math.sin(angles[a])}
            x2={cx + (R + 6) * Math.cos(angles[b])}
            y2={cy - (R + 6) * Math.sin(angles[b])}
            stroke="var(--text-2)"
            opacity={0.35}
          />
        ))}
        {angles.map((a, i) => {
          const r = i % 2 === 0 ? R - 6 : R + 6
          return (
            <circle
              key={i}
              cx={cx + r * Math.cos(a)}
              cy={cy - r * Math.sin(a)}
              r={3}
              fill="var(--accent)"
              opacity={0.85}
            />
          )
        })}
        <text x={cx} y={285} textAnchor="middle" fontSize={13} fill="var(--text-2)">
          embeddings on the circle, positive pairs joined
        </text>

        {/* mean cosine trace */}
        <line x1={tx(0)} x2={tx(240)} y1={ty(0)} y2={ty(0)} stroke="var(--text-2)" strokeDasharray="3 3" opacity={0.5} />
        <text x={tx(0) - 6} y={ty(0) + 4} textAnchor="end" fontSize={11} fill="var(--text-2)">0</text>
        <text x={tx(0) - 6} y={ty(1) + 4} textAnchor="end" fontSize={11} fill="var(--text-2)">1</text>
        <path d={traceLine(meanHistory) ?? ''} fill="none" stroke="var(--mean-marker, #d97706)" strokeWidth={2} />
        <text x={tx(0)} y={28} fontSize={13} fill="var(--text)">
          mean random-pair cosine: <tspan fontWeight={600}>{meanCos.toFixed(2)}</tspan>
        </text>
        <text x={tx(0)} y={ty(-0.2) + 22} fontSize={13} fill="var(--text-2)">
          training time
        </text>
      </svg>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', alignItems: 'center', marginTop: 4, fontSize: 14, color: 'var(--text)' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={alignOn} onChange={(e) => { setAlignOn(e.target.checked); setRunning(true) }} />
          alignment (pull pairs)
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={uniformOn} onChange={(e) => { setUniformOn(e.target.checked); setRunning(true) }} />
          uniformity (repel all)
        </label>
        <button
          onClick={reset}
          style={{
            font: 'inherit',
            fontSize: 13,
            padding: '2px 12px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--fig-bg)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          restart clumped
        </button>
      </div>
    </div>
  )
}
