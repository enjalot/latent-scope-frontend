import React, { useState, useRef, useEffect } from 'react';
import { interpolateSinebow } from 'd3-scale-chromatic';
import styles from './FeatureBars.module.scss';
import FeatureBars from './FeatureBars';
import { Query } from './Basics';

const CompareFeatureBars = ({
  topkA,
  topkB,
  queryA,
  queryB,
  features,
  numToShow = 10,
  barHeight = 22,
  barMargin = 1,
  barTopOffset = 12,
}) => {
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const containerRef = useRef(null);
  const [connections, setConnections] = useState([]);
  const [hoverConnection, setHoverConnection] = useState(null);
  const [dimensions, setDimensions] = useState({
    containerWidth: 0,
    leftPanelWidth: 0,
    rightPanelWidth: 0,
    gapWidth: 0,
  });

  // Calculate container dimensions
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        const containerWidth = containerRef.current.clientWidth;
        const panelPercentage = 0.44; // 45% for each panel

        let dims = {
          containerWidth,
          leftPanelWidth: Math.floor(containerWidth * panelPercentage),
          rightPanelWidth: Math.floor(containerWidth * panelPercentage),
          gapWidth: containerWidth - 2 * Math.floor(containerWidth * panelPercentage),
        };
        // console.log('=== Dimensions ===');
        // console.log(dims);
        setDimensions(dims);
      };

      updateDimensions();

      // Add resize listener
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [containerRef]);

  // Calculate connections based on data rather than DOM elements
  useEffect(() => {
    if (!topkA || !topkB || !features || dimensions.containerWidth === 0) return;

    // Get all top features from each side
    const featuresA = (topkA.top_acts || topkA.sae_acts)
      .map((act, i) => {
        const featureIdx = topkA.top_indices?.[i] || topkA.sae_indices?.[i];
        const f = features[featureIdx];
        return {
          i,
          feature: f,
          activation: act,
          position: i,
          featureId: f.feature,
        };
      })
      .slice(0, numToShow);

    const featuresB = (topkB.top_acts || topkB.sae_acts)
      .map((act, i) => {
        const featureIdx = topkB.top_indices?.[i] || topkB.sae_indices?.[i];
        const f = features[featureIdx];
        return {
          i,
          feature: f,
          activation: act,
          position: i,
          featureId: f.feature,
        };
      })
      .slice(0, numToShow);

    // Calculate the positions based on component structure

    // Calculate the x positions for the connection lines
    const leftPanelRightEdge = dimensions.leftPanelWidth + 10;
    const rightPanelLeftEdge = dimensions.leftPanelWidth + dimensions.gapWidth - 11;

    // Calculate positions for each feature bar
    const barPositions = {
      a: {},
      b: {},
    };

    featuresA.forEach((feature, index) => {
      barPositions.a[feature.featureId] = {
        right: leftPanelRightEdge, // Right side of panel A
        center: index * (barHeight + barMargin) + barHeight / 2 + barTopOffset,
        feature: feature,
      };
    });

    featuresB.forEach((feature, index) => {
      barPositions.b[feature.featureId] = {
        left: rightPanelLeftEdge, // Left side of panel B
        center: index * (barHeight + barMargin) + barHeight / 2 + barTopOffset,
        feature: feature,
      };
    });

    // Calculate connections
    const newConnections = [];

    // A to B connections
    featuresA.forEach((featureA) => {
      const start = barPositions.a[featureA.featureId];
      if (!start) return;

      // Find this feature in B or use default end point
      const matchInB = featuresB.find((f) => f.featureId === featureA.featureId);
      const end = matchInB
        ? barPositions.b[featureA.featureId]
        : {
            left: rightPanelLeftEdge,
            center:
              (barPositions.b[featuresB[featuresB.length - 1]?.featureId]?.center || 0) +
              barHeight * 1.5,
          };

      const posB = matchInB?.position !== undefined ? matchInB.position : 'NA';
      newConnections.push({
        id: `a-${featureA.featureId}`,
        startX: start.right,
        startY: start.center,
        endX: end.left - (posB == 9 ? 7 : 0),
        endY: end.center,
        feature: featureA.feature,
        positionA: featureA.position,
        positionB: posB,
      });
    });

    // B to A connections (only for features not already connected)
    featuresB.forEach((featureB) => {
      // Skip if already connected from A
      if (featuresA.some((f) => f.featureId === featureB.featureId)) return;

      const start = barPositions.b[featureB.featureId];
      if (!start) return;

      // Find end point in A (or default)
      const end = {
        right: leftPanelRightEdge,
        center:
          (barPositions.a[featuresA[featuresA.length - 1]?.featureId]?.center || 0) +
          barHeight * 1.5,
      };

      newConnections.push({
        id: `b-${featureB.featureId}`,
        startX: end.right,
        startY: end.center,
        endX: start.left - (featureB.position == 9 ? 7 : 0),
        endY: start.center,
        feature: featureB.feature,
        positionA: 'NA',
        positionB: featureB.position,
      });
    });

    // console.log('=== Connections ===');
    // console.log(newConnections);
    setConnections(newConnections);
  }, [topkA, topkB, features, numToShow, dimensions]);

  // Calculate hover connection
  useEffect(() => {
    if (!hoveredFeature || !topkA || !topkB || !features || dimensions.containerWidth === 0) {
      setHoverConnection(null);
      return;
    }

    const featureId = hoveredFeature.feature;

    // Determine which side the hovered feature is from and find if it exists in the other side
    const isFromA =
      topkA.top_indices?.some((idx, i) => i < numToShow && features[idx]?.feature === featureId) ||
      topkA.sae_indices?.some((idx, i) => i < numToShow && features[idx]?.feature === featureId);

    const isFromB =
      topkB.top_indices?.some((idx, i) => i < numToShow && features[idx]?.feature === featureId) ||
      topkB.sae_indices?.some((idx, i) => i < numToShow && features[idx]?.feature === featureId);

    // If it's already in both displayed sets, no need for a hover connection
    if (isFromA && isFromB) {
      setHoverConnection(null);
      return;
    }

    // Calculate positions
    const leftPanelRightEdge = dimensions.leftPanelWidth + 10;
    const rightPanelLeftEdge = dimensions.leftPanelWidth + dimensions.gapWidth - 11;

    if (isFromA) {
      // Check if it exists anywhere in B dataset (even beyond the displayed top items)
      const positionInB = (topkB.top_indices || topkB.sae_indices)?.findIndex(
        (idx) => features[idx]?.feature === featureId
      );

      const startIdx = (topkA.top_indices || topkA.sae_indices)?.findIndex(
        (idx) => features[idx]?.feature === featureId
      );

      // Position in displayed items
      const posInDisplayedA = startIdx < numToShow ? startIdx : -1;

      if (posInDisplayedA >= 0) {
        const startY = posInDisplayedA * (barHeight + barMargin) + barHeight / 2 + barTopOffset;
        // End position is either below the last bar in B or at actual position if found
        const endY =
          positionInB < 0
            ? numToShow * (barHeight + barMargin) + barHeight + 10
            : positionInB < numToShow
              ? positionInB * (barHeight + barMargin) + barHeight / 2 + barTopOffset
              : numToShow * (barHeight + barMargin) + barHeight + 10;

        setHoverConnection({
          id: `hover-${featureId}`,
          startX: leftPanelRightEdge,
          startY,
          endX: rightPanelLeftEdge,
          endY,
          feature: hoveredFeature,
          positionA: posInDisplayedA,
          positionB: positionInB >= 0 ? positionInB : 'NA',
        });
      }
    } else if (isFromB) {
      // Check if it exists anywhere in A dataset
      const positionInA = (topkA.top_indices || topkA.sae_indices)?.findIndex(
        (idx) => features[idx]?.feature === featureId
      );

      const startIdx = (topkB.top_indices || topkB.sae_indices)?.findIndex(
        (idx) => features[idx]?.feature === featureId
      );

      // Position in displayed items
      const posInDisplayedB = startIdx < numToShow ? startIdx : -1;

      if (posInDisplayedB >= 0) {
        const endY = posInDisplayedB * (barHeight + barMargin) + barHeight / 2 + barTopOffset;
        // Start position is either below the last bar in A or at actual position if found
        const startY =
          positionInA < 0
            ? numToShow * (barHeight + barMargin) + barHeight + 10
            : positionInA < numToShow
              ? positionInA * (barHeight + barMargin) + barHeight / 2 + barTopOffset
              : numToShow * (barHeight + barMargin) + barHeight + 10;

        setHoverConnection({
          id: `hover-${featureId}`,
          startX: leftPanelRightEdge,
          startY,
          endX: rightPanelLeftEdge,
          endY,
          feature: hoveredFeature,
          positionA: positionInA >= 0 ? positionInA : 'NA',
          positionB: posInDisplayedB,
        });
      }
    }
  }, [
    hoveredFeature,
    topkA,
    topkB,
    features,
    numToShow,
    dimensions,
    barHeight,
    barMargin,
    barTopOffset,
  ]);

  const handleHover = (feature) => {
    setHoveredFeature(feature);
  };

  return (
    <div
      className="compareContainer"
      ref={containerRef}
      style={{ position: 'relative', marginBottom: '12px' }}
    >
      {/* Query row - separate from feature bars */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ width: dimensions.leftPanelWidth || '45%', paddingLeft: '2px' }}>
          <Query>{queryA}</Query>
        </div>
        <div style={{ width: dimensions.gapWidth || '10%' }}></div>
        <div style={{ width: dimensions.rightPanelWidth || '45%', paddingLeft: '2px' }}>
          <Query>{queryB}</Query>
        </div>
      </div>

      {/* Feature bars row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div className="sideBySideA" style={{ width: dimensions.leftPanelWidth || '45%' }}>
          <FeatureBars
            topk={topkA}
            features={features}
            numToShow={numToShow}
            onHover={handleHover}
          />
        </div>

        <div
          className="connectionSvg"
          style={{
            position: 'absolute',
            width: '100%',
            height: `${numToShow * (barHeight + barMargin) + 50}px`, // Increase height for out-of-bounds connections
            zIndex: 1,
            pointerEvents: 'none',
            fontFamily: 'monospace',
          }}
        >
          <svg width="100%" height="100%">
            {connections.map((conn) => {
              const isHighlighted =
                hoveredFeature && hoveredFeature.feature === conn.feature.feature;
              const featureColor = interpolateSinebow(conn.feature?.order);

              return (
                <g key={conn.id}>
                  {conn.positionA !== 'NA' && conn.positionB !== 'NA' && (
                    <path
                      d={`M ${conn.startX + 10} ${conn.startY} C ${conn.startX + 50} ${conn.startY}, ${conn.endX - 50} ${conn.endY}, ${conn.endX - 8} ${conn.endY}`}
                      stroke={featureColor}
                      strokeWidth={isHighlighted ? 3 : 2}
                      opacity={isHighlighted ? 1 : 0.5}
                      fill="none"
                    />
                  )}

                  {conn.positionA !== 'NA' && (
                    <text
                      x={conn.startX - 5}
                      y={conn.startY + 5}
                      fill={featureColor}
                      fontSize="12px"
                    >
                      #{conn.positionA + 1}
                    </text>
                  )}
                  {conn.positionB !== 'NA' && (
                    <text x={conn.endX - 5} y={conn.endY + 5} fill={featureColor} fontSize="12px">
                      #{conn.positionB + 1}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Render hover connection */}
            {hoverConnection && (
              <g key={hoverConnection.id}>
                <path
                  d={`M ${hoverConnection.startX + 10} ${hoverConnection.startY} C ${hoverConnection.startX + 50} ${hoverConnection.startY}, ${hoverConnection.endX - 50} ${hoverConnection.endY}, ${hoverConnection.endX - 8} ${hoverConnection.endY}`}
                  stroke={interpolateSinebow(hoverConnection.feature?.order)}
                  strokeWidth={3}
                  opacity={0.7}
                  strokeDasharray={
                    hoverConnection.positionA === 'NA' || hoverConnection.positionB === 'NA'
                      ? '5,5'
                      : 'none'
                  }
                  fill="none"
                />
                {hoverConnection.positionA !== 'NA' && (
                  <text
                    x={hoverConnection.startX - 5}
                    y={hoverConnection.startY + 5}
                    fill={interpolateSinebow(hoverConnection.feature?.order)}
                    fontSize="12px"
                  >
                    #{hoverConnection.positionA + 1}
                  </text>
                )}
                {hoverConnection.positionA === 'NA' && (
                  <text
                    x={hoverConnection.startX - 5}
                    y={hoverConnection.startY + 5}
                    fill={interpolateSinebow(hoverConnection.feature?.order)}
                    fontSize="12px"
                  >
                    NA
                  </text>
                )}
                {hoverConnection.positionB !== 'NA' && (
                  <text
                    x={hoverConnection.endX - 5}
                    y={hoverConnection.endY + 5}
                    fill={interpolateSinebow(hoverConnection.feature?.order)}
                    fontSize="12px"
                  >
                    #{hoverConnection.positionB + 1}
                  </text>
                )}
                {hoverConnection.positionB === 'NA' && (
                  <text
                    x={hoverConnection.endX - 5}
                    y={hoverConnection.endY + 5}
                    fill={interpolateSinebow(hoverConnection.feature?.order)}
                    fontSize="12px"
                  >
                    NA
                  </text>
                )}
              </g>
            )}
          </svg>
        </div>

        <div className="sideBySideB" style={{ width: dimensions.rightPanelWidth || '45%' }}>
          <FeatureBars
            topk={topkB}
            features={features}
            numToShow={numToShow}
            onHover={handleHover}
          />
        </div>
      </div>
    </div>
  );
};

export default CompareFeatureBars;
