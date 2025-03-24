import React, { useRef, useState, useEffect } from 'react';
import VectorVis from './VectorVis';
import { interpolateSinebow } from 'd3-scale-chromatic';
import styles from './VectorEquation.module.scss';

const VectorEquation = ({
  vectors = [],
  operations = [],
  resultLabel = 'Result',
  height = 300,
  scale = 1,
  showEquation = true,
}) => {
  if (vectors.length === 0) return null;

  const containerRef = useRef(null);
  const [vectorWidth, setVectorWidth] = useState(null);

  // Detect container width and calculate vector width
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateVectorWidths = () => {
      const containerWidth = containerRef.current.clientWidth;

      // If only one vector plus result, no need to resize
      if (vectors.length <= 1) {
        setVectorWidth(null);
        return;
      }

      // Reserve space for the result visualization at full width
      const resultVisualWidth = height;

      // Operation symbols need some fixed width (e.g., 30px)
      const operationSymbolsWidth = vectors.length * 30;

      // Available width for all non-result vectors
      const availableWidth = containerWidth - resultVisualWidth - operationSymbolsWidth;

      // Number of vectors to size (all except result)
      const vectorsToSizeCount = vectors.length;

      if (availableWidth <= 0 || vectorsToSizeCount <= 0) {
        // Not enough space, set a minimum
        setVectorWidth(Math.max(height * 0.4, 50));
      } else {
        // Distribute available width, but don't exceed the height
        const calculatedWidth = Math.min(height, availableWidth / vectorsToSizeCount);
        // Ensure a minimum width, but allow smaller on extremely small screens
        const minWidth = Math.min(50, containerWidth * 0.15);
        setVectorWidth(Math.max(calculatedWidth, minWidth));
      }
    };

    // Calculate initially
    calculateVectorWidths();

    // Recalculate on window resize
    const handleResize = () => calculateVectorWidths();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [vectors.length, height]);

  // Generate colors for vectors using d3's interpolateSinebow
  const getVectorColor = (index, total) => {
    return interpolateSinebow(index / (total || 1));
  };

  // Assign colors to all vectors
  const coloredVectors = vectors.map((v, i) => ({
    ...v,
    color: v.color || getVectorColor(i, vectors.length),
  }));

  // Calculate result vector based on operations
  const calculateResult = () => {
    if (vectors.length === 0) {
      return [0, 0];
    }

    // Start with the first vector
    const result = [...vectors[0].vector];

    // Apply operations for each subsequent vector
    for (let i = 1; i < vectors.length; i++) {
      const op = operations[i - 1] || '+'; // Default to addition if no operation specified
      const vector = vectors[i].vector;

      if (op === '+') {
        result[0] += vector[0];
        result[1] += vector[1];
      } else if (op === '-') {
        result[0] -= vector[0];
        result[1] -= vector[1];
      }
      // Can add other operations as needed
    }

    return result;
  };

  const resultVector = calculateResult();

  // Build the equation components
  const equationComponents = [];

  // Add all vectors with squeezed width
  vectors.forEach((vector, i) => {
    // First vector doesn't have an operation before it
    if (i > 0) {
      const op = operations[i - 1] || '+';
      equationComponents.push(
        <div key={`op-${i}`} className={styles.operationSymbol}>
          {op}
        </div>
      );
    }

    equationComponents.push(
      <div key={`vector-${i}`} className={styles.equationPart}>
        <VectorVis
          vectors={[coloredVectors[i]]}
          height={height}
          scale={scale}
          showResult={false}
          width={vectorWidth}
        />
      </div>
    );
  });

  // Add equals sign
  equationComponents.push(
    <div key="equals" className={styles.equalsSign}>
      =
    </div>
  );

  // Add result - always at full width
  equationComponents.push(
    <div key="result" className={styles.equationPart}>
      <VectorVis
        vectors={[
          ...coloredVectors,
          // { vector: resultVector, label: resultLabel, color: '#000000' },
        ]}
        resultLabel={resultLabel}
        height={height}
        scale={scale}
        // Keep full width for result
        width={null}
        // showResult={true}
      />
    </div>
  );

  // Build HTML equation elements with color-coded terms
  const textEquation = () => {
    if (!showEquation) return null;

    const elements = [];

    // Add first vector with its color
    elements.push(
      <span key={`eq-0`} style={{ color: coloredVectors[0].color }}>
        {coloredVectors[0].label || `v₁`}
      </span>
    );

    // Add operations and subsequent vectors
    for (let i = 1; i < coloredVectors.length; i++) {
      const op = operations[i - 1] || '+';

      // Add operation symbol
      elements.push(
        <span key={`op-${i}`} style={{ color: '#333', margin: '0 0.3em' }}>
          {op}
        </span>
      );

      // Add vector with its color
      elements.push(
        <span key={`eq-${i}`} style={{ color: coloredVectors[i].color }}>
          {coloredVectors[i].label || `v${i + 1}`}
        </span>
      );
    }

    // Add equals sign and result
    elements.push(
      <span key="equals" style={{ color: '#333', margin: '0 0.3em' }}>
        =
      </span>
    );

    elements.push(
      <span key="result" style={{ color: '#000000', fontWeight: 'bold' }}>
        {resultLabel}
      </span>
    );

    return <div className={styles.equation}>{elements}</div>;
  };

  return (
    <div className={styles.vectorEquation} ref={containerRef}>
      {textEquation()}
      <div className={styles.equationVisuals}>{equationComponents}</div>
    </div>
  );
};

export default VectorEquation;
