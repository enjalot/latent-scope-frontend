import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Tooltip } from 'react-tooltip';
import Scatter from '../ScatterGL';
import styles from './FeatureScatter.module.scss';
import { interpolateSinebow } from 'd3-scale-chromatic';

// Simple debounce utility function
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

function FeatureScatter({ features, selectedFeature, onFeature, height = 400 }) {
  const [hovered, setHovered] = useState(null);
  const [xDomain, setXDomain] = useState([-1, 1]);
  const [yDomain, setYDomain] = useState([-1, 1]);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef(null);

  // Get the container width on mount and when window resizes
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };

    // Initial measurement
    updateWidth();

    // Add resize listener
    window.addEventListener('resize', updateWidth);

    // Clean up
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Debounced setHovered function
  const debouncedSetHoveredRef = useRef(null);

  useEffect(() => {
    // Create the debounced function once
    debouncedSetHoveredRef.current = debounce((value) => {
      setHovered(value);
    }, 1);

    return () => {
      // Clean up any pending debounce on unmount
      if (debouncedSetHoveredRef.current) {
        debouncedSetHoveredRef.current.cancel;
      }
    };
  }, []);

  // Handle view changes (pan/zoom)
  const handleView = useCallback(
    (xDomain, yDomain, transform) => {
      setXDomain(xDomain);
      setYDomain(yDomain);
      setTransform(transform);
    },
    [setXDomain, setYDomain]
  );

  // Handle hover with debounce
  const handleHover = useCallback(
    (feature) => {
      if (feature !== null) {
        // Use immediate update for hover-on to feel responsive
        debouncedSetHoveredRef.current(features[feature]);
      } else {
        // Use debounced update for hover-off to prevent quick disappearance
        debouncedSetHoveredRef.current(null);
      }
    },
    [features]
  );

  // Handle selection - only emit if actively clicked
  const handleSelect = useCallback(
    (feature) => {
      if (feature && feature !== selectedFeature) {
        onFeature(feature);
      }
    },
    [onFeature, selectedFeature]
  );

  // Process features for ScatterGL
  const points = useMemo(() => {
    if (!features) return [];

    return features.map((feature, i) => {
      // Check if this is the selected feature
      const isSelected = selectedFeature && feature.index === selectedFeature.index;

      // Format: [x, y, selectionState, intensity]
      // Using 3 for selected, 1 for normal
      return [feature.grid_x || 0, feature.grid_y || 0, interpolateSinebow(feature.order)];
    });
  }, [features, selectedFeature]);

  return (
    <div className={styles.featureScatterContainer} ref={containerRef}>
      <div className={styles.scatterWrapper} style={{ width: '100%', height }}>
        <Scatter
          points={points}
          width={containerWidth}
          height={height}
          calculatePointColor={(a) => a}
          calculatePointOpacity={() => 1}
          calculatePointSize={() => 1.25}
          onView={handleView}
          onSelect={handleSelect}
          onHover={handleHover}
          minZoom={0.8}
          maxZoom={0.8}
        />

        {/* Tooltip for hover information */}
        <div
          data-tooltip-id="featureTooltip"
          style={{
            position: 'absolute',
            left: 10,
            bottom: 8,
            width: '100%',
            pointerEvents: 'none',
          }}
        >
          {hovered && (
            <p className={styles.hoverInfo}>
              <span
                className={styles.featureIdPill}
                style={{ backgroundColor: interpolateSinebow(hovered.order), opacity: 0.75 }}
              >
                {hovered.feature}
              </span>
              <span className={styles.featureLabel}>{hovered.label || 'Unnamed feature'}</span>
            </p>
          )}
        </div>
        {/* <Tooltip
          id="featureTooltip"
          isOpen={hovered !== null}
          delayShow={0} // Show immediately
          delayHide={0} // Longer delay before hiding
          delayUpdate={0}
          noArrow={true}
          // position="fixed"
          offset={0} // Add an offset to move it from the cursor position
          className={styles.tooltipArea}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', width: '100%' }} // Make background more transparent
        >
          <div className={styles.tooltipContent}>
            <p>
              {hovered?.feature}: {hovered?.label || 'Unnamed feature'}
            </p>
          </div>
        </Tooltip> */}
      </div>
    </div>
  );
}

export default FeatureScatter;
