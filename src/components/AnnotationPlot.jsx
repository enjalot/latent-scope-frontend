import React, { useEffect, useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import scaleCanvas from '../lib/canvas';

import './AnnotationPlot.css';

const AnnotationPlot = ({
  points,
  fill,
  stroke,
  size,
  symbol,
  xDomain,
  yDomain,
  width,
  height,
}) => {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    context.scale(window.devicePixelRatio, window.devicePixelRatio);
    scaleCanvas(canvas, context, width, height);
  }, [width, height]);

  useEffect(() => {
    if (xDomain && yDomain) {
      const xScale = scaleLinear().domain(xDomain).range([0, width]);
      const yScale = scaleLinear().domain(yDomain).range([height, 0]);

      // const zScale = (t) => t * (0.1 + xDomain[1] - xDomain[0]);
      const zScale = (t) => {
        const domainRange = xDomain[1] - xDomain[0];
        const minScale = 1; // Minimum scale factor (when zoomed in)
        const maxScale = 1.0; // Maximum scale factor (when zoomed out)

        // Normalize domain range to [0,1] assuming max domain is 2 (-1 to 1)
        const normalizedRange = domainRange / 2;

        // Linear interpolation between minScale and maxScale
        return t * (minScale + (maxScale - minScale) * normalizedRange);
      };
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.font = `${zScale(size)}px monospace`;
      ctx.globalAlpha = 0.75;
      let rw = zScale(size);
      if (!points.length) return;

      points.map((point) => {
        if (!point) return;
        if (fill) {
          // ctx.fillRect(xScale(point[0]) - rw/2, yScale(point[1]) - rw/2, rw, rw);
          ctx.beginPath();
          ctx.arc(xScale(point[0]), yScale(point[1]), rw / 2, 0, 2 * Math.PI);
          ctx.fill();
        }
        if (stroke) {
          ctx.stroke();
          // ctx.strokeRect(xScale(point[0]) - rw/2, yScale(point[1]) - rw/2, rw, rw)
        }
        if (symbol) {
          ctx.fillText(symbol, xScale(point[0]) - rw / 2.2, yScale(point[1]) + rw / 3.2);
        }
      });
    }
  }, [points, fill, stroke, size, xDomain, yDomain, width, height]);

  return <canvas className="annotation-plot" ref={canvasRef} width={width} height={height} />;
};

export default AnnotationPlot;
