import { useEffect, useRef } from 'react';
import { scaleLinear, scaleSequential } from 'd3-scale';
import { extent } from 'd3-array';
import { interpolateOranges } from 'd3-scale-chromatic';
import styles from './TilePlot.module.scss';

/*
Tiles are grouped points that have the same tile index

We expect:
tiles : [ 
  {
    tile_index: 0,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]
  }
]
*/

const TilePlot = ({
  tiles,
  tileMeta,
  fill,
  stroke,
  size,
  symbol,
  xDomain,
  yDomain,
  width,
  height,
  onTileHover,
  onTileClick,
}) => {
  const container = useRef();
  // Screen-space rect per tile (built during draw), so hit-testing reuses the
  // exact same coordinates as the draw pass — no duplicated math.
  const rectsRef = useRef([]);

  useEffect(() => {
    if(xDomain && yDomain) {
      const xScale = scaleLinear()
        .domain(xDomain)
        .range([0, width])
      const yScale = scaleLinear()
        .domain(yDomain)
        .range([height, 0])

      const zScale = (t) => t/(.01 + xDomain[1] - xDomain[0])
      const canvas = container.current
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, width, height)
      // TODO: accomodate dark mode
      ctx.globalAlpha = 1
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, width, height)

      ctx.fillStyle = fill 
      ctx.strokeStyle = stroke
      ctx.globalAlpha = 0.75
      ctx.lineWidth = zScale(.75)

      if(!tiles.length) return

      let rw = zScale(width / tileMeta.cols * 2)

      // global extent of count
      let countExtent = extent(tiles.map(tile => tile.points.length))
      let colorScale = scaleSequential(interpolateOranges)
        .domain(countExtent)

      const rects = [];

      tiles.map((tile, i) => {
        if(!tile) return;
        let tx = xScale(tile.tile_index % tileMeta.cols * tileMeta.size - tileMeta.cols * tileMeta.size / 2)
        let ty = yScale(Math.floor(tile.tile_index / tileMeta.cols) * tileMeta.size - tileMeta.cols * tileMeta.size / 2 + tileMeta.size)
        // if(i < 5) console.log("tile", tile, tx, ty, rw)
        rects.push({ tile_index: tile.tile_index, x: tx, y: ty, w: rw, h: rw });

        if(fill){
          // calculate color based on the count
          let count = tile.points.length
          let color = colorScale(count)
          ctx.fillStyle = color
          ctx.fillRect(tx, ty, rw, rw);
        }
        if(stroke){
          ctx.strokeRect(tx, ty, rw, rw);
        }
        
      })
      rectsRef.current = rects
    }

  }, [tiles, tileMeta, fill, stroke, size, xDomain, yDomain, width, height])

  const hitTest = (e) => {
    const canvas = container.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // rects are top-left anchored with width/height w; tolerate small tiles.
    for (const r of rectsRef.current) {
      const w = Math.max(r.w, 3);
      if (mx >= r.x && mx <= r.x + w && my >= r.y && my <= r.y + w) return r.tile_index;
    }
    return null;
  };

  const interactive = !!(onTileHover || onTileClick);

  return (
    <canvas
      className={styles['tile-plot']}
      ref={container}
      width={width}
      height={height}
      style={interactive ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}
      onMouseMove={
        onTileHover ? (e) => onTileHover(hitTest(e), e.clientX, e.clientY) : undefined
      }
      onMouseLeave={onTileHover ? () => onTileHover(null) : undefined}
      onClick={
        onTileClick
          ? (e) => {
              const t = hitTest(e);
              if (t !== null && t !== undefined) onTileClick(t);
            }
          : undefined
      }
    />
  );
};

export default TilePlot;