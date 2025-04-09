import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
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
  scalable = false,
  inverseK = false,
  targetVector = { vector: [0, 0], label: 'Target' },
  scaleDomain = [-3, 3],
  interactive = true,
}) => {
  if (vectors.length === 0) return null;

  const containerRef = useRef(null);
  const resultVisRef = useRef(null);
  const [vectorWidth, setVectorWidth] = useState(null);
  const [scalingFactors, setScalingFactors] = useState(vectors.map(() => 0.5));
  const [currentTarget, setCurrentTarget] = useState(targetVector.vector);
  const [isDragging, setIsDragging] = useState(false);
  const [prevTarget, setPrevTarget] = useState(null);

  useEffect(() => {
    if (inverseK) {
      setCurrentTarget(targetVector.vector);
    }
  }, [targetVector, inverseK]);

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

  // Handle slider changes
  const handleScaleChange = useCallback(
    (index, value) => {
      const newFactors = [...scalingFactors];
      newFactors[index] = value;
      setScalingFactors(newFactors);
    },
    [scalingFactors]
  );

  // Calculate result vector based on operations and scaling factors
  const calculateResult = useCallback(() => {
    if (vectors.length === 0) {
      return [0, 0];
    }

    // Start with the first vector, scaled by its factor
    const firstVector = vectors[0].vector;
    const result = [firstVector[0] * scalingFactors[0], firstVector[1] * scalingFactors[0]];

    // Apply operations for each subsequent vector
    for (let i = 1; i < vectors.length; i++) {
      const op = operations[i - 1] || '+'; // Default to addition if no operation specified
      const vector = vectors[i].vector;
      const scaledX = vector[0] * scalingFactors[i];
      const scaledY = vector[1] * scalingFactors[i];

      if (op === '+') {
        result[0] += scaledX;
        result[1] += scaledY;
      } else if (op === '-') {
        result[0] -= scaledX;
        result[1] -= scaledY;
      }
      // Can add other operations as needed
    }

    return result;
  }, [vectors, scalingFactors, operations]);

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

    // Create a vector object with scaled values if scalable is true
    const scaledVector = scalable
      ? {
          ...coloredVectors[i],
          vector: [
            coloredVectors[i].vector[0] * scalingFactors[i],
            coloredVectors[i].vector[1] * scalingFactors[i],
          ],
          label: coloredVectors[i].label || `v${i + 1}`,
        }
      : coloredVectors[i];

    equationComponents.push(
      <div key={`vector-${i}`} className={styles.equationPart}>
        <VectorVis
          vectors={[scaledVector]}
          height={height}
          scale={scale}
          showResult={false}
          width={vectorWidth}
        />
        {scalable && interactive && (
          <div className={styles.sliderContainer}>
            <input
              type="range"
              min={scaleDomain[0]}
              max={scaleDomain[1]}
              step="0.01"
              value={scalingFactors[i]}
              onChange={(e) => handleScaleChange(i, parseFloat(e.target.value))}
              className={styles.vectorSlider}
              style={{ width: vectorWidth || '100%' }}
            />
          </div>
        )}
      </div>
    );
  });

  // Add equals sign
  equationComponents.push(
    <div key="equals" className={styles.equalsSign}>
      =
    </div>
  );

  // Handle interactions with the result visualization
  const handleResultInteraction = useCallback(
    (event) => {
      if (!inverseK || !interactive || !resultVisRef.current) return;

      const resultVis = resultVisRef.current;
      const rect = resultVis.getBoundingClientRect();

      // Calculate center of the visualization
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Get coordinates from either mouse or touch event
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;

      // Calculate click position relative to center
      const clickX = clientX - centerX;
      const clickY = centerY - clientY; // Flip Y to match coordinate system

      // Scale coordinates based on visualization scale
      const visualizationRadius = Math.min(rect.width, rect.height) / 2;
      const normalizedScale = visualizationRadius / scale;

      const scaledX = clickX / normalizedScale;
      const scaledY = clickY / normalizedScale;

      // Clamp values to ensure they stay within a reasonable range
      const clampedX = Math.max(scaleDomain[0], Math.min(scaleDomain[1], scaledX));
      const clampedY = Math.max(scaleDomain[0], Math.min(scaleDomain[1], scaledY));

      // Update target vector
      setCurrentTarget([clampedX, clampedY]);
    },
    [inverseK, interactive, scale, scaleDomain]
  );

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (event) => {
      if (inverseK && interactive) {
        setIsDragging(true);
        handleResultInteraction(event);
      }
    },
    [inverseK, interactive, handleResultInteraction]
  );

  const handleMouseMove = useCallback(
    (event) => {
      if (isDragging && inverseK && interactive) {
        handleResultInteraction(event);
      }
    },
    [isDragging, inverseK, interactive, handleResultInteraction]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch event handlers
  const handleTouchStart = useCallback(
    (event) => {
      if (inverseK && interactive) {
        setIsDragging(true);
        handleResultInteraction(event);
        // Prevent default to avoid scrolling while dragging
        event.preventDefault();
      }
    },
    [inverseK, interactive, handleResultInteraction]
  );

  const handleTouchMove = useCallback(
    (event) => {
      if (isDragging && inverseK && interactive) {
        handleResultInteraction(event);
        // Prevent default to avoid scrolling while dragging
        event.preventDefault();
      }
    },
    [isDragging, inverseK, interactive, handleResultInteraction]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    // Add global mouse up and move handlers
    if (inverseK && interactive) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchmove', handleTouchMove);
      };
    }
  }, [
    inverseK,
    interactive,
    isDragging,
    handleMouseUp,
    handleMouseMove,
    handleTouchEnd,
    handleTouchMove,
  ]);

  // Add target vector to the result visualization
  equationComponents.push(
    <div
      key="result"
      className={styles.equationPart}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      ref={resultVisRef}
      style={inverseK && interactive ? { cursor: isDragging ? 'grabbing' : 'grab' } : {}}
    >
      <VectorVis
        vectors={[
          ...coloredVectors.map((v, i) => ({
            ...v,
            vector:
              scalable || inverseK
                ? [v.vector[0] * scalingFactors[i], v.vector[1] * scalingFactors[i]]
                : v.vector,
          })),
        ]}
        resultLabel={resultLabel}
        height={height}
        scale={scale}
        width={null}
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
        {(scalable || inverseK) && ` (${scalingFactors[0]?.toFixed(3)})`}
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
          {(scalable || inverseK) && ` (${scalingFactors[i]?.toFixed(3)})`}
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

    // if (inverseK) {
    //   elements.push(
    //     <span key="target-info" style={{ color: '#FF0000', marginLeft: '1em' }}>
    //       Target: [{currentTarget[0]?.toFixed(2)}, {currentTarget[1]?.toFixed(2)}]
    //     </span>
    //   );
    // }

    return <div className={styles.equation}>{elements}</div>;
  };

  // Function to solve for scaling factors given a target vector
  const solveForScalingFactors = useCallback(
    (target) => {
      // Handle case with no vectors or only one vector
      if (vectors.length === 0) return [];
      if (vectors.length === 1) {
        // For a single vector, calculate direct scaling if possible
        const v = vectors[0].vector;
        const magnitude = Math.sqrt(v[0] * v[0] + v[1] * v[1]);

        // Avoid division by zero
        if (magnitude < 1e-10) return [0];

        // Project target onto the vector direction
        const dotProduct = (v[0] * target[0] + v[1] * target[1]) / (magnitude * magnitude);
        return [Math.max(scaleDomain[0], Math.min(scaleDomain[1], dotProduct))];
      }

      // Setup system Ax = b where A is the matrix of vectors, x are the scaling factors, b is the target
      const A = [];

      // Build coefficient matrix using all vectors
      for (let i = 0; i < vectors.length; i++) {
        const v = vectors[i].vector;
        A.push([v[0], v[1]]);
      }

      // Transpose A for AtA calculation
      const At = [A.map((row) => row[0]), A.map((row) => row[1])];

      // Calculate AtA
      const AtA = [];
      for (let i = 0; i < vectors.length; i++) {
        const row = [];
        for (let j = 0; j < vectors.length; j++) {
          // Dot product of ith column of At with jth column of A
          const dotProduct = At[0][i] * A[j][0] + At[1][i] * A[j][1];
          row.push(dotProduct);
        }
        AtA.push(row);
      }

      // Calculate Atb
      const Atb = [];
      for (let i = 0; i < vectors.length; i++) {
        // Dot product of ith column of At with target
        const dotProduct = At[0][i] * target[0] + At[1][i] * target[1];
        Atb.push(dotProduct);
      }

      // Solve the system using Gaussian elimination
      const n = vectors.length;
      const augmentedMatrix = [];
      for (let i = 0; i < n; i++) {
        augmentedMatrix.push([...AtA[i], Atb[i]]);
      }

      // Try to solve, but with robust error handling
      try {
        // Forward elimination
        for (let i = 0; i < n; i++) {
          // Find pivot
          let maxRow = i;
          for (let j = i + 1; j < n; j++) {
            if (Math.abs(augmentedMatrix[j][i]) > Math.abs(augmentedMatrix[maxRow][i])) {
              maxRow = j;
            }
          }

          // Swap rows if needed
          if (maxRow !== i) {
            [augmentedMatrix[i], augmentedMatrix[maxRow]] = [
              augmentedMatrix[maxRow],
              augmentedMatrix[i],
            ];
          }

          // Skip if pivot is too small (singular matrix)
          if (Math.abs(augmentedMatrix[i][i]) < 1e-10) continue;

          // Eliminate below
          for (let j = i + 1; j < n; j++) {
            const factor = augmentedMatrix[j][i] / augmentedMatrix[i][i];
            for (let k = i; k <= n; k++) {
              augmentedMatrix[j][k] -= factor * augmentedMatrix[i][k];
            }
          }
        }

        // Back substitution
        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
          let sum = 0;
          for (let j = i + 1; j < n; j++) {
            sum += augmentedMatrix[i][j] * x[j];
          }

          // Check if diagonal element is too small
          if (Math.abs(augmentedMatrix[i][i]) < 1e-10) {
            x[i] = scalingFactors[i] || 0; // Keep current value if we can't solve
          } else {
            x[i] = (augmentedMatrix[i][n] - sum) / augmentedMatrix[i][i];
          }
        }

        // Clamp values to a reasonable range
        return x.map((k) => Math.max(scaleDomain[0], Math.min(scaleDomain[1], k)));
      } catch (error) {
        console.warn('Error solving for scaling factors:', error);
        // Return current scaling factors or defaults as fallback
        return vectors.map((_, i) => scalingFactors[i] || 0.5);
      }
    },
    [vectors, scaleDomain]
  );

  // Update scaling factors when target or inverseK changes
  useEffect(() => {
    if (inverseK && vectors.length > 0) {
      // Add check for vectors.length
      // Check if target has actually changed to prevent infinite loops
      const targetChanged =
        !prevTarget || prevTarget[0] !== currentTarget[0] || prevTarget[1] !== currentTarget[1];

      if (targetChanged) {
        setPrevTarget(currentTarget);
        const newFactors = solveForScalingFactors(currentTarget);
        setScalingFactors(newFactors);
      }
    }
  }, [currentTarget, inverseK, solveForScalingFactors, vectors.length]);

  return (
    <div className={styles.vectorEquation} ref={containerRef}>
      {textEquation()}
      <div className={styles.equationVisuals}>{equationComponents}</div>
    </div>
  );
};

export default VectorEquation;
