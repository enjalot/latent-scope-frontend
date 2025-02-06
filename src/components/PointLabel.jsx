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
    const baseFontSize = 6;
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

    // Remove label backgrounds
    svg.selectAll('rect.point-label-bg').remove();

    // Handle labels
    let labelSel = svg.selectAll('text.point-label').data(selectedPoints);
    labelSel.exit().remove();

    if (!xDomain || !yDomain || !selectedPoints?.length) return;

    const fontSize = calculateScaledFontSize(width, height);

    labelSel
      .enter()
      .append('text')
      .attr('class', 'point-label')
      .merge(labelSel)
      .attr('x', (d) => {
        const coord = pointToSvgCoordinate(d, xDomain, yDomain, width, height);
        return coord.x;
      })
      .attr('y', (d) => {
        const coord = pointToSvgCoordinate(d, xDomain, yDomain, width, height);
        return coord.y;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', 'white') // Use white text color
      .attr('font-family', 'monospace')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', fontSize)
      .text((d) => d.ls_index);
    //   .text((d) => d.index + 1);
  }, [selectedPoints, xDomain, yDomain, width, height, textColor]);

  return (
    <svg ref={svgRef} className={styles.pointLabelPlot} width={width} height={height}>
      <g className="point-label-container"></g>
    </svg>
  );
}

export default PointLabel;
