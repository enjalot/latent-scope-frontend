import React, { useEffect, useRef } from 'react';
import { scaleDiverging, scaleSequential } from 'd3-scale';
import { interpolateBrBG, interpolateCool } from 'd3-scale-chromatic';

// import "./EmbeddingVis.css"

const EmbeddingVis = ({
  embedding,
  rows = embedding && embedding.length < 256 ? Math.floor(Math.sqrt(embedding.length)) : 16,
  spacing = 0.5,
  height = rows * 4,
  width = embedding ? (Math.ceil(embedding.length / rows) * height) / rows : 0,
  domain = [-1, 0, 1],
  minValues = [],
  maxValues = [],
  difference = [],
}) => {
  const container = useRef();

  useEffect(() => {
    if (!embedding || !embedding.length) return;
    const colorScale = scaleDiverging(domain, interpolateBrBG);

    const len = embedding.length;
    const cols = Math.ceil(len / rows);
    const rh = height / rows - spacing;
    const rw = width / cols - spacing;

    const canvas = container.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    embedding.forEach((d, i) => {
      const x = (i % cols) * (rw + spacing);
      const y = Math.floor(i / cols) * (rh + spacing);
      let c = colorScale(d);
      if (minValues.length && maxValues.length) {
        if (difference.length) {
          c = scaleSequential(
            [maxValues[i] - minValues[i], 0],
            [1, 0],
            interpolateCool
          )(Math.abs(difference[i] - d));
        } else {
          c = scaleDiverging([minValues[i], 0, maxValues[i]], interpolateBrBG)(d);
        }
      }
      ctx.fillStyle = c;
      ctx.fillRect(x, y, rw, rh);
    });
  }, [embedding, rows, width, height, spacing, minValues, maxValues, difference]);

  return <canvas className="embedding-vis" ref={container} width={width} height={height} />;
};

export default EmbeddingVis;
