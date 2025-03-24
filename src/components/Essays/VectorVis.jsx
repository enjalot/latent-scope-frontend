import React, { useId } from 'react';
import styles from './VectorVis.module.scss';
import { interpolateSinebow } from 'd3-scale-chromatic';

const VectorVis = ({
  vectors,
  operation = '+',
  height = 300,
  width,
  resultLabel = 'Result',
  scale = 1,
  showResult = true,
  showEquation = false,
  extraPadding = 0,
}) => {
  // Generate a unique ID prefix for this component instance
  const id = useId();

  const boxSize = height; // * 0.99;
  const boxPadding = 0; //height * 0.01;
  const totalWidth = width || boxSize + boxPadding * 2;

  // Use the provided width for horizontal calculations if available
  const effectiveWidth = width || boxSize;

  // Calculate result vector by adding all input vectors
  const result = {
    vector: vectors.reduce((sum, v) => [sum[0] + v.vector[0], sum[1] + v.vector[1]], [0, 0]),
    label: resultLabel,
  };

  // Scale vectors to fit within our view
  const maxMagnitude = 1;
  const scaler = (boxSize / 2 / maxMagnitude) * 0.9 * scale;

  // Calculate center point of the box
  const center = { x: effectiveWidth / 2 + boxPadding, y: boxSize / 2 + boxPadding };

  // Generate colors for vectors if not already provided
  const getVectorColor = (vector, index) => {
    return vector.color || interpolateSinebow(index / (vectors.length || 1));
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
    color: getVectorColor(v, i),
    id: `${id}-arrow-${i}`,
  }));

  // Result vector
  const resultLine = {
    ...drawVector(result.vector),
    color: resultColor,
    id: `${id}-arrow-result`,
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
      color: getVectorColor(v, i),
      id: `${id}-arrow-stacked-${i}`,
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
      <tspan key={`eq-${index}`} fill={getVectorColor(vector, index)}>
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
      <svg width={totalWidth} height={height + extraPadding}>
        <defs>
          {/* Create arrow markers for each vector */}
          {vectors.map((v, i) => createArrowMarker(`${id}-arrow-${i}`, getVectorColor(v, i)))}
          {vectors.map((v, i) =>
            createArrowMarker(`${id}-arrow-stacked-${i}`, getVectorColor(v, i))
          )}
          {createArrowMarker(`${id}-arrow-result`, resultColor)}
        </defs>

        {/* Equation text at the top (only shown when showResult is true) */}
        {showEquation && (
          <text x={center.x} y={boxPadding} textAnchor="middle" className={styles.equation}>
            {equationElements}
          </text>
        )}

        {/* Coordinate system (optional grid lines) */}
        <line
          x1={center.x - effectiveWidth / 2}
          y1={center.y}
          x2={center.x + effectiveWidth / 2}
          y2={center.y}
          stroke="#ddd"
          strokeWidth="1"
        />
        <line
          x1={center.x}
          y1={center.y - boxSize / 2}
          x2={center.x}
          y2={center.y + boxSize / 2}
          stroke="#ddd"
          strokeWidth="1"
        />

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

        {/* Result vector - only shown when showResult is true */}
        {showResult && (
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
        )}

        {/* Vector labels positioned with customized positioning */}
        {stackedVectors.map((vector, i) => {
          const dx = vector.x2 - vector.x1;
          const dy = vector.y2 - vector.y1;
          const angle = Math.atan2(dy, dx);
          const offset = 5; // Distance to offset the label

          // Determine if arrow points right/left and adjust positioning
          const pointingRight = dx > 0;
          const pointingUp = dy > 0;
          const offsetX = pointingRight ? offset : -offset;
          const offsetY = pointingUp ? offset : -offset;

          let labelX, labelY;

          if (i === 0) {
            // First vector - position at tip with offset based on direction
            labelX = vector.x2 + offsetX;
            labelY = vector.y2 + offsetY;
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
              fill={vector.color}
              className={styles.vectorLabel}
              dominantBaseline="middle"
            >
              {vector.label}
            </text>
          );
        })}

        {/* Result label - only shown when showResult is true */}
        {showResult && (
          <text
            x={resultLine.x2 + 5}
            y={resultLine.y2 - 5}
            fill={resultColor}
            className={styles.vectorLabel}
            fontWeight="bold"
          >
            {result.label}
          </text>
        )}
      </svg>
    </div>
  );
};

export default VectorVis;
