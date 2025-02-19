import { useEffect, useRef } from 'react';
// import { scaleLinear } from 'd3-scale';
import { line, curveLinearClosed, curveCatmullRomClosed } from 'd3-shape';
import { select } from 'd3-selection';
import { baseColor, baseColorDark } from '../lib/colors';
import { transition } from 'd3-transition';
import { easeExpOut, easeExpIn, easeCubicInOut } from 'd3-ease';
// import { interpolate } from 'flubber';

import './HullPlot.css';

function calculateCentroid(points) {
  if (!points || points.length === 0) {
    return null;
  }

  let xSum = 0;
  let ySum = 0;

  points.forEach((point) => {
    xSum += point[0];
    ySum += point[1];
  });

  const centroidX = xSum / points.length;
  const centroidY = ySum / points.length;

  return [centroidX, centroidY];
}

function findHighestPoint(points) {
  if (!points || points.length === 0) {
    return null;
  }

  // Find the point with the maximum y-coordinate (points[1]), and then return the entire point
  const y = Math.max(...points.map((point) => point[1]));
  return points.find((point) => point[1] === y);
}

const HullPlot = ({
  hulls,
  fill,
  stroke,
  delay = 0,
  duration = 2000,
  strokeWidth,
  opacity = 0.75,
  darkMode = false,
  xDomain,
  yDomain,
  width,
  height,
  label = undefined,
}) => {
  const canvasRef = useRef();
  const prevHulls = useRef();

  const textColor = baseColor;

  const hasLabel = label !== undefined;
  let labelToShow = label;
  if (hasLabel) {
    labelToShow = label.label;
  }

  // Add this helper function to the component
  const hullToCanvasCoordinate = (point, xDomain, yDomain, width, height) => {
    const xScaleFactor = width / (xDomain[1] - xDomain[0]);
    const yScaleFactor = height / (yDomain[1] - yDomain[0]);
    const xOffset = width / 2 - (xScaleFactor * (xDomain[1] + xDomain[0])) / 2;
    const yOffset = height / 2 + (yScaleFactor * (yDomain[1] + yDomain[0])) / 2;

    return {
      x: point[0] * xScaleFactor + xOffset,
      y: -point[1] * yScaleFactor + yOffset,
    };
  };

  // Add this helper function near the top of the component
  const calculateScaledFontSize = (width, height) => {
    const baseFontSize = 12;
    const FACTOR = 900;
    const scaleFactor = Math.min(width, height) / FACTOR;
    return Math.max(baseFontSize * scaleFactor, 8);
  };

  const calculateTextWidth = (text, fontSize) => {
    // Approximate width per character (assuming monospace font)
    const charWidth = fontSize * 0.6; // Monospace fonts are typically ~60% as wide as they are tall
    return text.length * charWidth + 2 * fontSize; // Add padding of 1 character width on each side
  };

  useEffect(() => {
    if (!xDomain || !yDomain || !hulls.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    // Set up scaling and transformation
    const xScaleFactor = width / (xDomain[1] - xDomain[0]);
    const yScaleFactor = height / (yDomain[1] - yDomain[0]);
    const xOffset = width / 2 - (xScaleFactor * (xDomain[1] + xDomain[0])) / 2;
    const yOffset = height / 2 + (yScaleFactor * (yDomain[1] + yDomain[0])) / 2;

    // Draw hulls
    hulls.forEach((hullPoints) => {
      ctx.beginPath();
      ctx.globalAlpha = opacity;

      // Move to first point
      const start = hullToCanvasCoordinate(hullPoints[0], xDomain, yDomain, width, height);
      ctx.moveTo(start.x, start.y);

      // Draw lines to subsequent points
      for (let i = 1; i < hullPoints.length; i++) {
        const point = hullToCanvasCoordinate(hullPoints[i], xDomain, yDomain, width, height);
        ctx.lineTo(point.x, point.y);
      }

      // Close the path
      ctx.closePath();

      // Fill and stroke
      if (fill && fill !== 'none') {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }

      // Draw label if specified
      if (label) {
        const fontSize = calculateScaledFontSize(width, height);
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = '#7baf5a';
        ctx.textAlign = 'center';

        const highest = hullToCanvasCoordinate(
          findHighestPoint(hullPoints),
          xDomain,
          yDomain,
          width,
          height
        );

        // Draw label background
        const textWidth = ctx.measureText(label.label).width;
        const padding = fontSize / 2;

        ctx.globalAlpha = 0.85;
        ctx.fillRect(
          highest.x - textWidth / 2 - padding,
          highest.y - fontSize - 20,
          textWidth + padding * 2,
          fontSize + padding
        );

        // Draw label text
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'white';
        ctx.fillText(label.label, highest.x, highest.y - 20);
      }
    });
  }, [hulls, fill, stroke, strokeWidth, xDomain, yDomain, width, height, label, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className="hull-plot"
      width={width}
      height={height}
      style={{ width, height }}
    />
  );
};

export default HullPlot;

// const HullPlotCanvas = ({
//   points,
//   hulls,
//   fill,
//   stroke,
//   strokeWidth,
//   symbol,
//   xDomain,
//   yDomain,
//   width,
//   height
// }) => {
//   const container = useRef();

//   useEffect(() => {
//     if(xDomain && yDomain) {
//       const xScale = scaleLinear()
//         .domain(xDomain)
//         .range([0, width])
//       const yScale = scaleLinear()
//         .domain(yDomain)
//         .range([height, 0])

//       const zScale = (t) => t/(.1 + xDomain[1] - xDomain[0])
//       const canvas = container.current
//       const ctx = canvas.getContext('2d')
//       ctx.clearRect(0, 0, width, height)
//       ctx.fillStyle = fill
//       ctx.strokeStyle = stroke
//       ctx.font = `${zScale(strokeWidth)}px monospace`
//       ctx.globalAlpha = 0.75
//       let rw = zScale(strokeWidth)
//       if(!hulls.length || !points.length) return
//       hulls.forEach(hull => {
//         // a hull is a list of indices into points
//         if(!hull) return;
//         ctx.beginPath()
//         hull.forEach((index, i) => {
//           if(i === 0) {
//             ctx.moveTo(xScale(points[index][0]), yScale(points[index][1]))
//           } else {
//             ctx.lineTo(xScale(points[index][0]), yScale(points[index][1]))
//           }
//         })
//         ctx.lineTo(xScale(points[hull[0]][0]), yScale(points[hull[0]][1]))
//         if(fill)
//           ctx.fill()
//         if(stroke)
//           ctx.stroke()
//       })
//     }

//   }, [points, hulls, fill, stroke, strokeWidth, xDomain, yDomain, width, height])

//   return <canvas
//     className="hull-plot"
//     ref={container}
//     width={width}
//     height={height} />;
// };

// export default HullPlot;
