// Shared two-moons dataset used by LensesMini and LensesView, so both
// figures render the exact same shape. Seeded so reloads are stable.

export type Pt = { x: number; y: number; c: 0 | 1; id: string }

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rng: () => number) {
  const u = 1 - rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Outline path hugging one crescent. The points are generated in arc
// order, so we can recover the crescent's spine (moving-average smooth
// along the index order), offset it perpendicular by ±w, and close the
// ribbon into a blob. Unlike a convex hull, this follows the crescent's
// curve — the two components stay visually disjoint, which is the whole
// point of the topology lens.
export function crescentOutline(
  pts: Pt[],
  xs: (v: number) => number,
  ys: (v: number) => number,
  w: number,
): [number, number][] {
  const n = pts.length
  if (n < 2) return []
  const win = Math.max(1, Math.round(n / 14))
  const spineAll: [number, number][] = pts.map((_, i) => {
    let sx = 0
    let sy = 0
    let c = 0
    for (let j = Math.max(0, i - win); j <= Math.min(n - 1, i + win); j++) {
      sx += xs(pts[j].x)
      sy += ys(pts[j].y)
      c++
    }
    return [sx / c, sy / c]
  })
  // Decimate to ~20 spine samples so the closed Catmull-Rom stays smooth.
  const stride = Math.max(1, Math.floor(n / 20))
  const spine = spineAll.filter(
    (_, i) => i % stride === 0 || i === spineAll.length - 1,
  )
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < spine.length; i++) {
    const p0 = spine[Math.max(0, i - 1)]
    const p1 = spine[Math.min(spine.length - 1, i + 1)]
    let nx = -(p1[1] - p0[1])
    let ny = p1[0] - p0[0]
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    left.push([spine[i][0] + nx * w, spine[i][1] + ny * w])
    right.push([spine[i][0] - nx * w, spine[i][1] - ny * w])
  }
  return left.concat(right.reverse())
}

export function buildTwoMoons(nPer = 80, seed = 7): Pt[] {
  const rng = mulberry32(seed)
  const data: Pt[] = []
  for (let i = 0; i < nPer; i++) {
    const t = i / (nPer - 1)
    const a = Math.PI * t
    data.push({
      x: Math.cos(a) + gaussian(rng) * 0.05,
      y: Math.sin(a) + gaussian(rng) * 0.05,
      c: 0,
      id: `a${i}`,
    })
  }
  for (let i = 0; i < nPer; i++) {
    const t = i / (nPer - 1)
    const a = Math.PI * t
    data.push({
      x: 1 - Math.cos(a) + gaussian(rng) * 0.05,
      y: 0.5 - Math.sin(a) + gaussian(rng) * 0.05,
      c: 1,
      id: `b${i}`,
    })
  }
  return data
}
