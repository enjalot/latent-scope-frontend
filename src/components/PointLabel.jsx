import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import styles from './PointLabel.module.scss';

function PointLabel({
  selectedPoints, // array of {x, y, index} objects
  xDomain,
  yDomain,
  width,
  height,
  fill = '#7baf5a', // same as HullPlot default
  textColor = 'white',
}) {
  const svgRef = useRef();

  // Reuse HullPlot's coordinate transformation helper
  const pointToSvgCoordinate = (point, xDomain, yDomain, width, height) => {
    const xScaleFactor = width / (xDomain[1] - xDomain[0]);
    const yScaleFactor = height / (yDomain[1] - yDomain[0]);
    const xOffset = width / 2 - (xScaleFactor * (xDomain[1] + xDomain[0])) / 2;
    const yOffset = height / 2 + (yScaleFactor * (yDomain[1] + yDomain[0])) / 2;

    return {
      x: point.x * xScaleFactor + xOffset,
      y: -point.y * yScaleFactor + yOffset,
    };
  };

  // Reuse HullPlot's font size calculation
  const calculateScaledFontSize = (width, height) => {
    const baseFontSize = 12;
    const FACTOR = 900;
    const scaleFactor = Math.min(width, height) / FACTOR;
    return Math.max(baseFontSize * scaleFactor, 8);
  };

  const calculateTextWidth = (text, fontSize) => {
    const charWidth = fontSize * 0.6;
    return text.length * charWidth + 2 * fontSize;
  };

  useEffect(() => {
    const svg = select(svgRef.current);
    // Handle label backgrounds
    let labelBgSel = svg.selectAll('rect.point-label-bg').data(selectedPoints);
    labelBgSel.exit().remove();

    // Handle labels
    let labelSel = svg.selectAll('text.point-label').data(selectedPoints);
    labelSel.exit().remove();

    if (!xDomain || !yDomain || !selectedPoints?.length) return;

    const fontSize = calculateScaledFontSize(width, height);

    labelBgSel
      .enter()
      .append('rect')
      .attr('class', 'point-label-bg')
      .merge(labelBgSel)
      .attr('fill', fill)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('opacity', 0.85)
      .attr('x', (d) => {
        const coord = pointToSvgCoordinate(d, xDomain, yDomain, width, height);
        const textWidth = calculateTextWidth(d.index.toString(), fontSize);
        return coord.x + 5; // Offset to the right of point
      })
      .attr('y', (d) => {
        const coord = pointToSvgCoordinate(d, xDomain, yDomain, width, height);
        return coord.y - 10; // Offset above point
      })
      .attr('width', (d) => calculateTextWidth(d.index.toString(), fontSize))
      .attr('height', fontSize * 1.5);

    labelSel
      .enter()
      .append('text')
      .attr('class', 'point-label')
      .merge(labelSel)
      .attr('x', (d) => {
        const coord = pointToSvgCoordinate(d, xDomain, yDomain, width, height);
        return coord.x + 12.5;
      })
      .attr('y', (d) => {
        const coord = pointToSvgCoordinate(d, xDomain, yDomain, width, height);
        return coord.y; // Align with point
      })
      .attr('text-anchor', 'start')
      .attr('fill', textColor)
      .attr('font-family', 'monospace')
      .attr('dominant-baseline', 'text-bottom')
      .attr('font-size', fontSize)
      .attr('dy', -2.5)
      .text((d) => d.index + 1);
  }, [selectedPoints, xDomain, yDomain, width, height, fill, textColor]);

  return (
    <svg ref={svgRef} className={styles.pointLabelPlot} width={width} height={height}>
      <g className="point-label-container"></g>
    </svg>
  );
}

export default PointLabel;
