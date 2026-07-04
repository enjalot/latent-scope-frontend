import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { FigureProps } from './registry'
import { useFixture, FixtureFallback } from '../../runtime/lib/data'

// Real UMAP projections of 8,000 jokes in the GPT-2 space, before and
// after subtracting the dataset mean, plus a MiniLM reference map.
// Switching variants animates each joke to its new position. Hover a
// point to read the joke.

export const DEFAULTS = {
  variant: 'raw',
}

type UmapFile = {
  variants: Record<string, [number, number][]>
  texts: string[]
  clusters?: number[]
}

// Categorical palette for the k-means reference clusters.
const CLUSTER_COLORS = [
  '#4e79a7', '#f28e2c', '#59a14f', '#e15759', '#76b7b2',
  '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab',
]

const VARIANT_LABELS: [string, string][] = [
  ['raw', 'GPT-2, as-is'],
  ['centered', 'GPT-2, mean subtracted'],
  ['minilm', 'MiniLM, for reference'],
]

const SIZE = 560

export default function CenteringDemo(props: FigureProps) {
  const data = useFixture<UmapFile>('centering-umaps.json')
  const [variant, setVariant] = useState(String(props.variant ?? DEFAULTS.variant))
  const [hover, setHover] = useState<{ i: number; px: number; py: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // animated positions
  const posRef = useRef<Float32Array | null>(null)
  const targetRef = useRef<Float32Array | null>(null)
  const rafRef = useRef(0)

  const scale = useMemo(() => d3.scaleLinear([-1.05, 1.05], [10, SIZE - 10]), [])

  const accent = useAccentColor()

  useEffect(() => {
    if (!data) return
    const pts = data.variants[variant]
    if (!pts) return
    const n = pts.length
    const target = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      target[2 * i] = scale(pts[i][0])
      target[2 * i + 1] = scale(pts[i][1])
    }
    targetRef.current = target
    if (!posRef.current) posRef.current = target.slice()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pos = posRef.current
    const start = pos.slice()
    const t0 = performance.now()
    const dur = reduced ? 0 : 900
    cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const t = dur === 0 ? 1 : Math.min(1, (now - t0) / dur)
      const e = d3.easeCubicInOut(t)
      for (let i = 0; i < pos.length; i++) pos[i] = start[i] + (target[i] - start[i]) * e
      draw()
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, variant, scale, accent])

  function draw() {
    const canvas = canvasRef.current
    const pos = posRef.current
    if (!canvas || !pos) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr
      canvas.height = SIZE * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, SIZE, SIZE)
    const clusters = data?.clusters
    ctx.globalAlpha = 0.45
    for (let i = 0; i < pos.length / 2; i++) {
      ctx.fillStyle = clusters ? CLUSTER_COLORS[clusters[i] % 10] : accent
      ctx.beginPath()
      ctx.arc(pos[2 * i], pos[2 * i + 1], 1.7, 0, 2 * Math.PI)
      ctx.fill()
    }
    if (hover) {
      ctx.globalAlpha = 1
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(pos[2 * hover.i], pos[2 * hover.i + 1], 4, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  useEffect(draw)

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = posRef.current
    if (!pos || !data) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * SIZE
    const my = ((e.clientY - rect.top) / rect.height) * SIZE
    let best = -1
    let bestD = 12 * 12
    for (let i = 0; i < pos.length / 2; i++) {
      const dx = pos[2 * i] - mx
      const dy = pos[2 * i + 1] - my
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    setHover(best >= 0 ? { i: best, px: e.clientX - rect.left, py: e.clientY - rect.top } : null)
  }

  if (data === undefined) return <FixtureFallback ready />
  if (!data) return <FixtureFallback ready={false} />

  return (
    <div style={{ fontFamily: 'var(--heading-font)' }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {VARIANT_LABELS.filter(([k]) => data.variants[k]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setVariant(k)}
            style={{
              font: 'inherit',
              fontSize: 13.5,
              padding: '4px 14px',
              borderRadius: 999,
              border: `1px solid ${variant === k ? 'var(--accent)' : 'var(--border)'}`,
              background: variant === k ? 'var(--accent-light)' : 'var(--fig-bg)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative', maxWidth: SIZE, margin: '0 auto' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(hover.px + 12, SIZE - 240),
              top: hover.py + 12,
              maxWidth: 240,
              padding: '6px 9px',
              background: 'var(--fig-bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 12.5,
              fontFamily: 'var(--body-font)',
              color: 'var(--text)',
              pointerEvents: 'none',
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
            }}
          >
            {data.texts[hover.i]}
          </div>
        )}
      </div>
    </div>
  )
}

function useAccentColor(): string {
  const [color, setColor] = useState('#2563eb')
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    if (v) setColor(v)
  }, [])
  return color
}
