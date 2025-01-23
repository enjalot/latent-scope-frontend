import { useEffect, useRef, useCallback, useState } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { zoom, zoomIdentity } from 'd3-zoom';
import { rgb } from 'd3-color';
import { quadtree } from 'd3-quadtree';
import REGL from 'regl';
import {
  mapSelectionColorsLight,
  mapSelectionColorsDark,
  mapSelectionOpacity,
  mapPointSizeRange,
  mapSelectionKey,
} from '../lib/colors';
import { useColorMode } from '../hooks/useColorMode';
import styles from './Scatter.module.css';

import PropTypes from 'prop-types';
import { reSplitAlphaNumeric } from '@tanstack/react-table';
ScatterGL.propTypes = {
  points: PropTypes.array.isRequired, // an array of [x,y] points
  width: PropTypes.number.isRequired,
  pointScale: PropTypes.number,
  quadtreeRadius: PropTypes.number,
  ignoreNotSelected: PropTypes.bool,
  height: PropTypes.number.isRequired,
  onView: PropTypes.func,
  onSelect: PropTypes.func,
  onHover: PropTypes.func,
};

const calculatePointColor = (valueA) => {
  return mapSelectionColorsLight[valueA];
};

const calculatePointOpacity = (featureIsSelected, valueA, activation) => {
  // when a feature is selected, we want to use the activation value to set the opacity
  if (featureIsSelected && valueA === mapSelectionKey.selected && activation !== undefined) {
    return activation + 0.5;
  }
  return mapSelectionOpacity[valueA];
};

const calculatePointSize = (valueA) => {
  return mapPointSizeRange[valueA];
};

const calculateDynamicPointScale = (pointCount, width, height) => {
  // Calculate area per point
  const totalArea = width * height;
  const areaPerPoint = totalArea / pointCount;

  // Calculate ideal point diameter based on area
  // Using sqrt because area is squared
  const baseSize = Math.sqrt(areaPerPoint);

  // Apply some constraints and scaling
  // Min size of 2, max size of 20
  const size = Math.min(Math.max(baseSize * 0.2, 2), 20);

  return size;
};

function ScatterGL({
  points,
  width,
  height,
  pointScale = 1,
  quadtreeRadius = 10,
  onView,
  onSelect,
  onHover,
  featureIsSelected,
  ignoreNotSelected = true,
}) {
  const { isDark: isDarkMode } = useColorMode();

  const canvasRef = useRef(null);
  const reglRef = useRef(null);
  const drawPointsRef = useRef(null);
  const transformRef = useRef(zoomIdentity);
  const xScaleRef = useRef(scaleLinear().domain([-1, 1]).range([0, width]));
  const yScaleRef = useRef(scaleLinear().domain([-1, 1]).range([height, 0]));
  const quadtreeRef = useRef(null);

  // make xScaleRef and yScaleRef update when width and height change
  useEffect(() => {
    xScaleRef.current = scaleLinear().domain([-1, 1]).range([0, width]);
    yScaleRef.current = scaleLinear().domain([-1, 1]).range([height, 0]);
  }, [width, height]);

  const [transform, setTransform] = useState(zoomIdentity);

  // Setup regl and shaders
  useEffect(() => {
    const canvas = canvasRef.current;
    // Get the actual pixel ratio, capped at 2 for better performance on high-DPI devices
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    // Initialize regl with explicit pixel ratio
    reglRef.current = REGL({
      canvas,
      attributes: {
        antialias: true,
        // Add these attributes for better iOS compatibility
        preserveDrawingBuffer: true,
        alpha: true,
      },
      pixelRatio: pixelRatio,
    });

    const blendParams = isDarkMode
      ? {
          srcRGB: 'src alpha',
          srcAlpha: 'src alpha',
          dstRGB: 'one',
          dstAlpha: 'one',
        }
      : {
          srcRGB: 'one',
          srcAlpha: 'one',
          dstRGB: 'one minus src alpha',
          dstAlpha: 'one minus src alpha',
        };

    // Create draw command
    drawPointsRef.current = reglRef.current({
      vert: `
        precision mediump float;
        attribute vec2 position;
        attribute vec3 color;
        attribute float opacity;
        attribute float size;  // New attribute for point size
        
        uniform float pointScale;
        uniform vec2 uTranslate;
        uniform float uScale;
        uniform vec2 uScreenSize;
        
        varying vec3 v_color;
        varying float v_opacity;
        
        void main() {
          v_color = color;
          v_opacity = opacity;
          
          // First map from [-1,1] to screen coordinates
          vec2 screen = vec2(
            (position.x + 1.0) * 0.5 * uScreenSize.x,
            (1.0 - position.y) * 0.5 * uScreenSize.y
          );
          
          // Apply d3-zoom transform
          vec2 transformed = screen * uScale + uTranslate;
          
          // Map back to clip space
          vec2 clip = vec2(
            (transformed.x / uScreenSize.x) * 2.0 - 1.0,
            -(transformed.y / uScreenSize.y) * 2.0 + 1.0
          );
          
          gl_Position = vec4(clip, 0, 1);
          gl_PointSize = pointScale * size * uScale;  // Modified to use per-point size
        }
      `,
      frag: `
        precision mediump float;
        varying vec3 v_color;
        varying float v_opacity;
        
        void main() {
          // Calculate distance from center of point
          float dist = length(gl_PointCoord.xy - 0.5) * 2.0;
          
          // Only discard if completely outside the circle
          if (dist > 1.0) {
            discard;
          }
          
          // Make the falloff much sharper with pow()
          float alpha = v_opacity * (1.0 - pow(dist, 4.0));
          vec3 color = v_color * 0.95;
          gl_FragColor = vec4(color * alpha, alpha);
        }
      `,
      attributes: {
        position: (context, props) => reglRef.current.buffer(props.points.map((p) => [p[0], p[1]])),
        color: (context, props) =>
          reglRef.current.buffer(
            props.points.map(([, , valueA]) => {
              const colorHex = calculatePointColor(valueA);
              const rgbColor = rgb(colorHex);
              return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255];
            })
          ),
        opacity: (context, props) =>
          reglRef.current.buffer(
            props.points.map(([, , valueA, activation]) =>
              calculatePointOpacity(props.featureIsSelected, valueA, activation)
            )
          ),
        size: (context, props) =>
          reglRef.current.buffer(props.points.map(([, , valueA]) => calculatePointSize(valueA))),
      },
      uniforms: {
        pointScale: (context, props) => props.pointScale,
        uTranslate: (context, props) => [props.transform.x, props.transform.y],
        uScale: (context, props) => props.transform.k,
        uScreenSize: (context, props) => [props.width, props.height],
      },

      count: (context, props) => props.points.length,
      primitive: 'points',
      blend: {
        enable: true,
        func: blendParams,
      },
      depth: {
        enable: false, // Explicitly disable depth testing
      },
    });

    const zoomBehavior = zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        setTransform(event.transform);
        const newXScale = event.transform.rescaleX(xScaleRef.current);
        const newYScale = event.transform.rescaleY(yScaleRef.current);

        if (onView) {
          onView(newXScale.domain(), newYScale.domain());
        }
      });

    select(canvas).call(zoomBehavior);

    return () => {
      select(canvas).on('.zoom', null);
      if (reglRef.current) {
        reglRef.current.destroy();
      }
    };
  }, [width, height]);

  // Draw points when they change
  useEffect(() => {
    if (!reglRef.current || !drawPointsRef.current) return;

    reglRef.current.clear({
      color: isDarkMode ? [0.067, 0.067, 0.067, 1] : [0.98, 0.98, 0.98, 1],
      depth: 1,
    });

    const pointsToRender = points;
    const dynamicScale = calculateDynamicPointScale(pointsToRender.length, width, height);

    drawPointsRef.current({
      points: pointsToRender,
      pointScale: dynamicScale * pointScale,
      featureIsSelected,
      transform,
      width,
      height,
    });
  }, [points, transform, pointScale, featureIsSelected, width, height, isDarkMode]);

  // Update useEffect to rebuild quadtree when points change
  useEffect(() => {
    if (!points || !points.length) return;

    quadtreeRef.current = quadtree()
      .x((d) => d[0])
      .y((d) => d[1])
      .addAll(
        points.filter(
          (d) =>
            d[2] !== mapSelectionKey.hidden &&
            (ignoreNotSelected ? d[2] !== mapSelectionKey.notSelected : true)
        )
      );
  }, [points, ignoreNotSelected]);

  // Replace the existing handleMouseMove with this updated version
  const findNearestPoint = useCallback(
    (x, y) => {
      if (!points || !quadtreeRef.current) return -1;

      // const transform = transformRef.current;
      // Convert screen coordinates back to data space
      const dataX = xScaleRef.current.invert(transform.invertX(x));
      const dataY = yScaleRef.current.invert(transform.invertY(y));

      let nearest = null;
      let minDistance = Infinity;

      // Search radius in data coordinates
      const radius =
        ((quadtreeRadius / transform.k) *
          (xScaleRef.current.domain()[1] - xScaleRef.current.domain()[0])) /
        width;

      quadtreeRef.current.visit((node, x1, y1, x2, y2) => {
        if (!node.length) {
          const dx = node.data[0] - dataX;
          const dy = node.data[1] - dataY;
          const distance = dx * dx + dy * dy;

          if (distance < minDistance) {
            minDistance = distance;
            nearest = node.data;
          }
        }
        return (
          x1 > dataX + radius || x2 < dataX - radius || y1 > dataY + radius || y2 < dataY - radius
        );
      });

      if (nearest && Math.sqrt(minDistance) <= radius) {
        return points.findIndex((p) => p[0] === nearest[0] && p[1] === nearest[1]);
      }
      return -1;
    },
    [points, width, transform, quadtreeRadius]
  );

  const handleMouseMove = useCallback(
    (event) => {
      if (!points || !onHover) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const nearestPoint = findNearestPoint(x, y);
      onHover(nearestPoint === -1 ? null : nearestPoint);
    },
    [points, onHover, findNearestPoint]
  );

  // Add click handler
  const handleClick = useCallback(
    (event) => {
      if (!points || !onSelect) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const nearestPoint = findNearestPoint(x, y);
      if (nearestPoint !== -1) {
        onSelect([nearestPoint]);
      }
    },
    [points, onSelect, findNearestPoint]
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={styles.scatter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={handleClick}
    />
  );
}

export default ScatterGL;
