import React, { useEffect, useRef, useState, useMemo } from 'react';
import { scaleDiverging, scaleSequential } from 'd3-scale';
import { interpolateBrBG, interpolateCool } from 'd3-scale-chromatic';

// import "./EmbeddingVis.css"

const EmbeddingVis = ({
  embedding,
  rows = embedding && embedding.length < 256 ? Math.floor(Math.sqrt(embedding.length)) : 16,
  spacing = 0.5,
  height: fixedHeight,
  width,
  domain = [-1, 0, 1],
  minValues = [],
  maxValues = [],
  difference = [],
}) => {
  const container = useRef();
  const parentRef = useRef();
  const [containerWidth, setContainerWidth] = useState(0);

  // Track parent container width
  useEffect(() => {
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(parentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Calculate dimensions
  const actualWidth = width || containerWidth;
  const calculatedWidth =
    embedding && !actualWidth
      ? (Math.ceil(embedding.length / rows) * (fixedHeight || rows * 4)) / rows
      : actualWidth;

  // Calculate dimensions to maintain square cells
  const len = embedding ? embedding.length : 0;
  const cols = len ? Math.ceil(len / rows) : 1;
  const squareSize = calculatedWidth / cols - spacing;

  // Add a small buffer to prevent cutoff (account for the last row's spacing)
  const calculatedHeight = useMemo(
    () => rows * (squareSize + spacing),
    [rows, squareSize, spacing]
  );

  // Use either fixed height if provided, or calculated height to maintain square cells
  const height = fixedHeight || calculatedHeight;

  useEffect(() => {
    if (!embedding || !embedding.length || !calculatedWidth) return;
    const colorScale = scaleDiverging(domain, interpolateBrBG);

    const len = embedding.length;
    const cols = Math.ceil(len / rows);
    // Use squareSize for both width and height of each cell
    const cellSize = calculatedWidth / cols - spacing;

    const canvas = container.current;
    if (!canvas) return;

    // Make sure canvas dimensions are accurate
    canvas.width = calculatedWidth;
    canvas.height = calculatedHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, calculatedWidth, height);

    embedding.forEach((d, i) => {
      const x = (i % cols) * (cellSize + spacing);
      const y = Math.floor(i / cols) * (cellSize + spacing);
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
      ctx.fillRect(x, y, cellSize, cellSize);
    });
  }, [embedding, rows, calculatedWidth, height, spacing, minValues, maxValues, difference, domain]);

  return (
    <div ref={parentRef} style={{ width: '100%' }}>
      <canvas
        className="embedding-vis"
        ref={container}
        width={calculatedWidth}
        height={calculatedHeight}
      />
    </div>
  );
};

export default EmbeddingVis;
