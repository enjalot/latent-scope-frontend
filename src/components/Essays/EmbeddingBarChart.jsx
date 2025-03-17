import React, { useEffect, useRef } from 'react';
import { scaleDiverging, scaleSequential, scaleLinear } from 'd3-scale';
import { interpolateBrBG, interpolateCool } from 'd3-scale-chromatic';

const EmbeddingBarChart = ({
  embedding,
  width = embedding ? embedding.length : 0, // 1 pixel per embedding element
  height = 200, // Default height for the chart
  domain = [-1, 0, 1],
  minValues = [],
  maxValues = [],
  difference = [],
}) => {
  const container = useRef();

  useEffect(() => {
    if (!embedding || !embedding.length) return;

    // Set up color scale
    const colorScale = scaleDiverging(domain, interpolateBrBG);

    // Set up height scale (maps domain values to pixel heights)
    const heightScale = scaleLinear()
      .domain([Math.min(...domain), Math.max(...domain)])
      .range([0, height]);

    // Calculate zero position
    const zeroY = heightScale(0);

    const canvas = container.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // Draw baseline (zero line)
    ctx.strokeStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();

    // Draw each bar
    embedding.forEach((d, i) => {
      const x = i; // 1 pixel per element

      // Determine bar properties based on value
      const barHeight = Math.abs(heightScale(d) - heightScale(0));
      const y = d >= 0 ? zeroY - barHeight : zeroY;

      // Set color
      let c = colorScale(d);
      if (minValues.length && maxValues.length) {
        if (difference.length) {
          c = scaleSequential(
            [maxValues[i] - minValues[i], 0],
            interpolateCool
          )(Math.abs(difference[i] - d));
        } else {
          c = scaleDiverging([minValues[i], 0, maxValues[i]], interpolateBrBG)(d);
        }
      }

      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, barHeight); // 1 pixel width bars
    });
  }, [embedding, width, height, domain, minValues, maxValues, difference]);

  return <canvas className="embedding-bar-chart" ref={container} width={width} height={height} />;
};

export default EmbeddingBarChart;
