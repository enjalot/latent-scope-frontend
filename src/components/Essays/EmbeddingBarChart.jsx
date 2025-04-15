import React, { useEffect, useRef, useState } from 'react';
import { scaleDiverging, scaleSequential, scaleLinear } from 'd3-scale';
import { interpolateBrBG, interpolateCool } from 'd3-scale-chromatic';

const EmbeddingBarChart = ({
  embedding,
  height = 200, // Default height for the chart
  domain = [-1, 0, 1],
  minValues = [],
  maxValues = [],
  difference = [],
}) => {
  const containerRef = useRef();
  const canvasRef = useRef();
  const [containerWidth, setContainerWidth] = useState(0);

  // Setup ResizeObserver to watch container size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);

    // Initial width measurement
    setContainerWidth(containerRef.current.clientWidth);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Drawing effect
  useEffect(() => {
    if (!embedding || !embedding.length || !containerWidth) return;

    const canvas = canvasRef.current;
    canvas.width = containerWidth; // Set canvas width to match container

    // Set up color scale
    const colorScale = scaleDiverging(domain, interpolateBrBG);

    // Calculate bar width based on available space
    const barWidth = containerWidth / embedding.length;

    // Set up height scale
    const heightScale = scaleLinear()
      .domain([Math.min(...domain), Math.max(...domain)])
      .range([0, height]);

    // Calculate zero position
    const zeroY = heightScale(0);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, containerWidth, height);

    // Draw baseline (zero line)
    ctx.strokeStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(containerWidth, zeroY);
    ctx.stroke();

    // Draw each bar
    embedding.forEach((d, i) => {
      const x = i * barWidth;
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
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  }, [embedding, containerWidth, height, domain, minValues, maxValues, difference]);

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <canvas
        className="embedding-bar-chart"
        ref={canvasRef}
        height={height}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default EmbeddingBarChart;
