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

    const pts = features.map((feature) => {
      // Check if this is the selected feature
      // const isSelected = selectedFeature && feature?.feature === selectedFeature?.feature;

      // Format: [x, y, color]
      // We'll make selected points larger by setting a different size in calculatePointSize
      return [
        feature.grid_x || 0,
        feature.grid_y || 0,
        interpolateSinebow(feature.order),
        feature.count,
      ];
    });
    console.log('pts', pts);
    return pts;
  }, [features, selectedFeature]);

  // Add a calculatePointSize function that makes selected points larger
  const calculatePointSize = useCallback(
    (valueA, index) => {
      const feature = features[index];
      const isSelected = selectedFeature && feature?.feature === selectedFeature?.feature;
      return isSelected ? 3 : 1.25;
    },
    [features, selectedFeature]
  );
  const calculatePointOpacity = useCallback(
    (isselected, valueA, count, index) => {
      return count > 0 ? 1 : 0.25;
    },
    [features]
  );

  return (
    <div className={styles.featureScatterContainer} ref={containerRef}>
      <div className={styles.scatterWrapper} style={{ width: '100%', height }}>
        <Scatter
          points={points}
          width={containerWidth}
          height={height}
          calculatePointColor={(a) => a}
          calculatePointOpacity={calculatePointOpacity}
          calculatePointSize={calculatePointSize}
          onView={handleView}
          onSelect={(index) => {
            if (index !== null) {
              onFeature(features[index]);
            }
          }}
          onHover={handleHover}
          minZoom={0.8}
          maxZoom={0.8}
          disablePan={true}
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
          {hovered ? (
            <p className={styles.hoverInfo}>
              <span
                className={styles.featureIdPill}
                style={{ backgroundColor: interpolateSinebow(hovered.order), opacity: 0.75 }}
              >
                {hovered.feature}
              </span>
              <span className={styles.featureLabel}>
                {hovered.label || 'Unnamed feature'} ({hovered.count})
              </span>
            </p>
          ) : selectedFeature ? (
            <p className={styles.hoverInfo}>
              <span
                className={styles.featureIdPill}
                style={{
                  backgroundColor: interpolateSinebow(selectedFeature.order),
                  opacity: 0.75,
                }}
              >
                {selectedFeature.feature}
              </span>
              <span className={styles.featureLabel}>
                {selectedFeature.label || 'Unnamed feature'} ({selectedFeature.count})
              </span>
            </p>
          ) : null}
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
