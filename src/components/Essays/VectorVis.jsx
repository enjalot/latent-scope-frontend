import React from 'react';
import styles from './VectorVis.module.scss';
import { interpolateSinebow } from 'd3-scale-chromatic';

const VectorVis = ({
  vectors,
  operation = '+',
  height = 300,
  resultLabel = 'Result',
  scale = 1,
}) => {
  const boxSize = height * 0.8;
  const boxPadding = height * 0.1;
  const totalWidth = boxSize + boxPadding * 2;

  // Calculate result vector by adding all input vectors
  const result = {
    vector: vectors.reduce((sum, v) => [sum[0] + v.vector[0], sum[1] + v.vector[1]], [0, 0]),
    label: resultLabel,
  };

  // Scale vectors to fit within our view
  const maxMagnitude = 1;
  const scaler = (boxSize / 2 / maxMagnitude) * 0.8 * scale;

  // Calculate center point of the box
  const center = { x: boxSize / 2 + boxPadding, y: boxSize / 2 + boxPadding + 30 };

  // Generate colors for vectors using d3's interpolateSinebow
  const getVectorColor = (index) => {
    // Space the colors evenly across the sinebow spectrum
    return interpolateSinebow(index / (vectors.length || 1));
  };

  const resultColor = '#000000'; // Black color for result vector

  // Function to draw a vector from center
  const drawVector = (vector, startX = center.x, startY = center.y) => {
    const endX = startX + vector[0] * scaler;
    const endY = startY - vector[1] * scaler; // Flip Y since SVG Y grows downward

    return {
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY,
    };
  };

  // Create vector lines - starting from origin for individual vectors
  // We'll keep this for reference but won't render them
  const vectorLines = vectors.map((v, i) => ({
    ...drawVector(v.vector),
    color: getVectorColor(i),
    id: `arrow-${i}`,
  }));

  // Result vector
  const resultLine = {
    ...drawVector(result.vector),
    color: resultColor,
    id: 'arrow-result',
  };

  // Create stacked vectors (tail-to-head)
  const stackedVectors = [];
  let currentPoint = { x: center.x, y: center.y };

  vectors.forEach((v, i) => {
    const nextPoint = {
      x: currentPoint.x + v.vector[0] * scaler,
      y: currentPoint.y - v.vector[1] * scaler,
    };

    stackedVectors.push({
      x1: currentPoint.x,
      y1: currentPoint.y,
      x2: nextPoint.x,
      y2: nextPoint.y,
      color: getVectorColor(i),
      id: `arrow-stacked-${i}`,
      label: v.label,
      midX: (currentPoint.x + nextPoint.x) / 2,
      midY: (currentPoint.y + nextPoint.y) / 2,
    });

    currentPoint = nextPoint;
  });

  // Helper function to add arrow to a line
  const createArrowMarker = (id, color, arrowSize = 4) => (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth={arrowSize}
      markerHeight={arrowSize}
      orient="auto"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );

  // Build the equation text with color-coded terms
  const equationElements = [];
  vectors.forEach((vector, index) => {
    // Add the vector label with its color
    equationElements.push(
      <tspan key={`eq-${index}`} fill={getVectorColor(index)}>
        {vector.label}
      </tspan>
    );

    // Add the operation symbol if not the last vector
    if (index < vectors.length - 1) {
      equationElements.push(
        <tspan key={`op-${index}`} fill="#333">
          {' '}
          {operation}{' '}
        </tspan>
      );
    }
  });

  // Add equals sign and result
  equationElements.push(
    <tspan key="equals" fill="#333">
      {' '}
      ={' '}
    </tspan>,
    <tspan key="result" fill={resultColor}>
      {result.label}
    </tspan>
  );

  return (
    <div className={styles.vectorVisContainer}>
      <svg width={totalWidth} height={height + 60}>
        <defs>
          {/* Create arrow markers for each vector */}
          {vectors.map((_, i) => createArrowMarker(`arrow-${i}`, getVectorColor(i)))}
          {vectors.map((_, i) => createArrowMarker(`arrow-stacked-${i}`, getVectorColor(i)))}
          {createArrowMarker('arrow-result', resultColor)}
        </defs>

        {/* Equation text at the top */}
        <text x={center.x} y={boxPadding} textAnchor="middle" className={styles.equation}>
          {equationElements}
        </text>

        {/* Coordinate system (optional grid lines) */}
        <line
          x1={center.x - (boxSize / 2) * 0.8}
          y1={center.y}
          x2={center.x + (boxSize / 2) * 0.8}
          y2={center.y}
          stroke="#ddd"
          strokeWidth="1"
        />
        <line
          x1={center.x}
          y1={center.y - (boxSize / 2) * 0.8}
          x2={center.x}
          y2={center.y + (boxSize / 2) * 0.8}
          stroke="#ddd"
          strokeWidth="1"
        />

        {/* Individual vectors from origin - removed as requested */}

        {/* Stacked vectors (tail-to-head) */}
        {stackedVectors.map((line, i) => (
          <line
            key={`stacked-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth="2"
            strokeDasharray="3,3"
            markerEnd={`url(#${line.id})`}
          />
        ))}

        {/* Result vector */}
        <line
          x1={center.x}
          y1={center.y}
          x2={resultLine.x2}
          y2={resultLine.y2}
          stroke={resultColor}
          strokeWidth="2.5"
          strokeDasharray="5,3"
          markerEnd={`url(#${resultLine.id})`}
        />

        {/* Vector labels positioned with customized positioning */}
        {stackedVectors.map((vector, i) => {
          const dx = vector.x2 - vector.x1;
          const dy = vector.y2 - vector.y1;
          const angle = Math.atan2(dy, dx);
          const offset = 5; // Distance to offset the label

          // Determine if arrow points right/left and adjust positioning
          const pointingRight = dx > 0;
          const offsetX = pointingRight ? offset : -offset;

          let labelX, labelY;

          if (i === 0) {
            // First vector - position at tip with offset based on direction
            labelX = vector.x2 + offsetX;
            labelY = vector.y2;
          } else if (i < stackedVectors.length) {
            // Operation vectors (middle vectors) - position at midpoint and to the right
            // Calculate perpendicular offset to position label to the right of the vector
            const perpOffset = 1;
            labelX = vector.midX - (dy / Math.sqrt(dx * dx + dy * dy)) * perpOffset + 7;
            labelY = vector.midY - (dx / Math.sqrt(dx * dx + dy * dy)) * perpOffset + 3;
          }

          return (
            <text
              key={`label-${i}`}
              x={labelX}
              y={labelY}
              fill={getVectorColor(i)}
              className={styles.vectorLabel}
              // textAnchor={pointingRight ? 'start' : 'end'}
              dominantBaseline="middle"
            >
              {vector.label}
            </text>
          );
        })}

        {/* Result label */}
        <text
          x={resultLine.x2 + 5}
          y={resultLine.y2 - 5}
          fill={resultColor}
          className={styles.vectorLabel}
          fontWeight="bold"
        >
          {result.label}
        </text>
      </svg>
    </div>
  );
};

export default VectorVis;
