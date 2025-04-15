import React, { useEffect, useRef, useState } from 'react';
import { scaleLinear, scaleSequential } from 'd3-scale';
import { interpolateRdBu } from 'd3-scale-chromatic';
import { max } from 'd3-array';
const EmbeddingDifferenceChart = ({
  embedding1,
  embedding2,
  height = 200,
  domain = [-1, 1], // Domain for difference magnitude
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
    if (!embedding1 || !embedding2 || !embedding1.length || !embedding2.length || !containerWidth)
      return;
    if (embedding1.length !== embedding2.length) {
      console.error('Embeddings must have the same length');
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = containerWidth;

    // Calculate differences between embeddings
    const differences = embedding1.map((val, idx) => Math.abs(val - embedding2[idx]));
    console.log('DIFFS', max(differences));
    console.log('DOMAIN', domain);

    // Calculate bar width based on available space
    const barWidth = containerWidth / differences.length;

    // Set up height scale
    const heightScale = scaleLinear()
      .domain([0, domain[2] - domain[0]])
      .range([0, height]); // Half of height for scaling as bars are centered

    // Calculate center position
    const centerY = height / 2;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, containerWidth, height);

    // Draw horizontal center line
    ctx.strokeStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(containerWidth, centerY);
    ctx.stroke();

    // Draw each difference bar
    differences.forEach((diff, i) => {
      const x = i * barWidth;
      const magnitude = Math.abs(diff);
      const barHeight = heightScale(magnitude);

      // Position bar centered vertically
      const y = centerY - barHeight / 2;

      // Set color based on magnitude
      ctx.fillStyle = 'salmon';
      ctx.fillRect(x, y, barWidth, barHeight);
    });
  }, [embedding1, embedding2, containerWidth, height, domain]);

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <canvas
        className="embedding-difference-chart"
        ref={canvasRef}
        height={height}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default EmbeddingDifferenceChart;
