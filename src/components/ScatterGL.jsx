import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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
import { useFilter } from '../contexts/FilterContext';
import { useColorMode } from '../hooks/useColorMode';
import styles from './Scatter.module.css';
import useDebounce from '../hooks/useDebounce';
import { useScope } from '../contexts/ScopeContext';

import PropTypes from 'prop-types';
import { reSplitAlphaNumeric } from '@tanstack/react-table';
ScatterGL.propTypes = {
  points: PropTypes.array.isRequired, // an array of [x,y] points
  width: PropTypes.number.isRequired,
  maxZoom: PropTypes.number,
  pointScale: PropTypes.number,
  quadtreeRadius: PropTypes.number,
  ignoreNotSelected: PropTypes.bool,
  height: PropTypes.number.isRequired,
  onView: PropTypes.func,
  onSelect: PropTypes.func,
  onHover: PropTypes.func,
  isSmallScreen: PropTypes.bool,
  centerOnShownIndices: PropTypes.bool,
  centerMargin: PropTypes.number,
  calculatePointColor: PropTypes.func,
  disablePan: PropTypes.bool,
};

const calculateDynamicPointScale = (pointCount, width, height) => {
  // Calculate area per point
  const totalArea = width * height;
  const areaPerPoint = totalArea / pointCount;

  // Calculate ideal point diameter based on area
  // Using sqrt because area is squared
  const baseSize = Math.sqrt(areaPerPoint);

  // Apply non-linear scaling to make points grow faster with fewer points
  // Using a power less than 1 creates this effect
  const scalingPower = 0.9; // Adjust this value to control growth rate
  const scaledSize = Math.pow(baseSize, scalingPower);

  // Apply scaling factor and constraints
  const size = Math.min(Math.max(scaledSize * 0.3, 1), 10);

  return size;
};

// Converts a screen coordinate (e.g. width / 2, height / 2) to data coordinates
const screenToDataCoordinates = (screenX, screenY, transform, xScale, yScale) => {
  // First apply inverse zoom transform to get back to untransformed screen coordinates
  const untransformedX = transform.invertX(screenX);
  const untransformedY = transform.invertY(screenY);

  // Then use scales to convert to data coordinates
  const dataX = xScale.invert(untransformedX);
  const dataY = yScale.invert(untransformedY);

  return { x: dataX, y: dataY };
};

// Get the center coordinates of the screen in data coordinate space
const getCenterCoordinates = (width, height, transform, xScale, yScale) => {
  const screenCenterX = width / 2;
  const screenCenterY = height / 2;

  return screenToDataCoordinates(screenCenterX, screenCenterY, transform, xScale, yScale);
};

function ScatterGL({
  points,
  width,
  height,
  pointScale = 1,
  quadtreeRadius = 10,
  minZoom = 0.75,
  maxZoom = 40,
  shownIndices,
  setCenteredIndices,
  onView,
  onSelect,
  onHover,
  featureIsSelected,
  ignoreNotSelected = false,
  isSmallScreen = false,
  centerOnShownIndices = true,
  centerMargin = 0.25,
  calculatePointColor = (valueA) => {
    return mapSelectionColorsLight[valueA];
  },
  calculatePointOpacity = (featureIsSelected, valueA, activation) => {
    // when a feature is selected, we want to use the activation value to set the opacity
    if (featureIsSelected && valueA === mapSelectionKey.selected && activation !== undefined) {
      return activation + 0.5;
    }
    return mapSelectionOpacity[valueA] || 1;
  },
  calculatePointSize = (valueA) => {
    return mapPointSizeRange[valueA] || 1;
  },
  disablePan = false,
}) {
  const { isDark: isDarkMode } = useColorMode();

  // Add a ref to track if we're currently in a programmatic zoom operation
  const isZoomingProgrammatically = useRef(false);
  // Add a ref to track if user has manually zoomed/panned
  const userHasManuallyZoomed = useRef(false);
  // Add a ref to track the last centered indices
  const lastCenteredIndicesRef = useRef([]);

  const debouncedSetCenteredIndices = useDebounce(setCenteredIndices, 50);

  const canvasRef = useRef(null);
  const reglRef = useRef(null);
  const drawPointsRef = useRef(null);
  const xScaleRef = useRef(scaleLinear().domain([-1, 1]).range([0, width]));
  const yScaleRef = useRef(scaleLinear().domain([-1, 1]).range([height, 0]));
  const quadtreeRef = useRef(null);

  const TOP_N_POINTS = 10;

  const [transform, setTransform] = useState(zoomIdentity);

  // make xScaleRef and yScaleRef update when width and height change
  useEffect(() => {
    xScaleRef.current = scaleLinear().domain([-1, 1]).range([0, width]);
    yScaleRef.current = scaleLinear().domain([-1, 1]).range([height, 0]);
  }, [width, height]);

  // Create refs to store zoom behavior and zoom selection
  const zoomBehaviorRef = useRef(null);
  const zoomSelectionRef = useRef(null);

  const [dirtyCanvas, setDirtyCanvas] = useState(0);

  // Setup regl and shaders
  useEffect(() => {
    console.log('initial canvas setup in scatterGL', width, height);
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

    // Create buffers only once per points change.
    const positionBuffer = reglRef.current.buffer(points.map((p) => [p[0], p[1]]));
    const colorBuffer = reglRef.current.buffer(
      points.map(([, , valueA]) => {
        const colorHex = calculatePointColor(valueA);
        const rgbColor = rgb(colorHex);
        return [rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255];
      })
    );
    const opacityBuffer = reglRef.current.buffer(
      points.map(([p, i, valueA, activation]) =>
        calculatePointOpacity(featureIsSelected, valueA, activation, i)
      )
    );
    const sizeBuffer = reglRef.current.buffer(
      points.map(([p, i, valueA]) => calculatePointSize(valueA, i))
    );

    // Redefine your drawPoints command to take these buffers as attributes.
    drawPointsRef.current = reglRef.current({
      vert: `
        precision mediump float;
        attribute vec2 position;
        attribute vec3 color;
        attribute float opacity;
        attribute float size;
        
        // Instead of separate translate/scale uniforms, we pass in a single transform matrix.
        uniform vec2 uTranslate;
        uniform float uScale;
        uniform vec2 uScreenSize;
        
        uniform float pointScale;
        uniform float dotScaleFactor;
        
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
          
          gl_PointSize = pointScale * size * dotScaleFactor;
        }
      `,
      frag: `
        precision mediump float;
        varying vec3 v_color;
        varying float v_opacity;
        uniform float uScale;
        uniform bool isDarkMode;
        uniform float dotScaleFactor;
        void main() {
          float dist = length(gl_PointCoord.xy - 0.5) * 2.0;
          if (dist > 1.0) discard;
          float alpha;
          if(isDarkMode) {
            alpha = v_opacity * (1.0 - pow(dist, uScale * dotScaleFactor));
          } else {
            alpha = v_opacity * (1.0 - pow(dist, uScale * dotScaleFactor * 2.0));
          }
          vec3 color = v_color * 0.95;
          
          gl_FragColor = vec4(color * alpha*1.25, alpha);
          
        }
      `,
      attributes: {
        position: positionBuffer,
        color: colorBuffer,
        opacity: opacityBuffer,
        size: sizeBuffer,
      },
      uniforms: {
        pointScale: (context, props) => props.pointScale,
        // Compute a single 3x3 matrix that converts your point (in data space)
        // into clip space. This matrix encapsulates the conversion from [-1,1] to pixel coordinates,
        // the zoom transform and the conversion from screen to clip space.
        // uMatrix: (context, props) =>
        //   computeTransformMatrix(props.width, props.height, props.transform),
        uTranslate: (context, props) => [props.transform.x, props.transform.y],
        uScale: (context, props) => props.transform.k,
        uScreenSize: (context, props) => [props.width, props.height],
        dotScaleFactor: (context, props) => {
          const minScaleFactor = 6;
          let sf = 1.25 + (props.transform.k / maxZoom) * 4; // (maxZoom - 1);
          // console.log('dotScaleFactor', props.transform.k, sf);
          return sf;
        },
        // edgeExp: (context, props) => {
        //   let v = 1 + (props.transform.k - 1); // / (maxZoom - 1)) * 12;
        //   // console.log('edgeExp', v, Math.pow(0.01, v), Math.pow(0.99, v));
        //   return v;
        // },
        isDarkMode: (context, props) => isDarkMode,
      },
      count: points.length,
      primitive: 'points',
      blend: {
        enable: true,
        func: (context, props) => {
          return props.blendParams;
        },
      },
      depth: { enable: false },
    });

    // Initialize zoom behavior.
    const zoomBehavior = zoom()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', (event) => {
        // If panning is disabled, ignore panning events
        if (disablePan && event.sourceEvent && event.sourceEvent.type === 'mousemove') {
          return;
        }

        // If the user is manually zooming/panning, cancel any programmatic zoom
        if (event.sourceEvent) {
          isZoomingProgrammatically.current = false;
          userHasManuallyZoomed.current = true;
        }

        setTransform(event.transform);
        const newXScale = event.transform.rescaleX(xScaleRef.current);
        const newYScale = event.transform.rescaleY(yScaleRef.current);

        if (onView) {
          onView(newXScale.domain(), newYScale.domain(), event.transform);
        }
      })
      .on('end', (event) => {
        updateCenteredIndices(event.transform);
      });

    // Call zoom on the canvas and store the selection in a ref.
    const zoomSelection = select(canvas).call(zoomBehavior);

    // Store references so we can later call the transform method.
    zoomBehaviorRef.current = zoomBehavior;
    zoomSelectionRef.current = zoomSelection;

    // Calculate an initial transform (your current logic)
    const zoomOutFactor = 0.8;
    const centerX = width / 2;
    const centerY = height / 2;
    const initialTransform = zoomIdentity
      .translate(centerX, centerY)
      .scale(zoomOutFactor)
      .translate(-centerX, -centerY);

    zoomSelection.call(zoomBehavior.transform, initialTransform);

    setDirtyCanvas(Math.random());

    return () => {
      select(canvas).on('.zoom', null);
      if (reglRef.current) {
        reglRef.current.destroy();
      }
    };
  }, [width, height, disablePan]);

  useEffect(() => {
    console.log('dirtyCanvas update', dirtyCanvas);
  }, [dirtyCanvas]);

  const dynamicSize = useMemo(() => {
    let size = calculateDynamicPointScale(points.length, width, height);
    // console.log('dynamicSize', size, points.length);
    return size;
  }, [points, width, height]);

  // Draw points when they change
  useEffect(() => {
    if (!reglRef.current || !drawPointsRef.current) return;
    console.log('DRAW POINTS');

    reglRef.current.clear({
      color: isDarkMode ? [0.067, 0.067, 0.067, 1] : [0.98, 0.98, 0.98, 1],
      depth: 1,
    });

    const pointsToRender = points;

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
          // srcRGB: 'src alpha',
          // srcAlpha: 'src alpha',
          // dstRGB: 'one',
          // dstAlpha: 'one',
        };

    drawPointsRef.current({
      points: pointsToRender,
      pointScale: dynamicSize * pointScale,
      featureIsSelected,
      transform,
      width,
      height,
      blendParams,
    });
  }, [
    points,
    transform,
    pointScale,
    featureIsSelected,
    width,
    height,
    isDarkMode,
    dynamicSize,
    dirtyCanvas,
  ]);

  // Update useEffect to rebuild quadtree when points change
  useEffect(() => {
    if (!points || !points.length) return;

    // if ignoreNotSelected is true, we only want to add points that are selected as a result of the
    // filter to the quadtree. if it is false, we want to add all points to the quadtree.
    const filteredPoints = points.filter(
      (d) =>
        d[2] !== mapSelectionKey.hidden &&
        (ignoreNotSelected ? d[2] === mapSelectionKey.selected : true)
    );

    quadtreeRef.current = quadtree()
      .x((d) => d[0])
      .y((d) => d[1])
      .addAll(filteredPoints);
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
      const zoomFactor = Math.pow(transform.k, 0.5); // Square root provides a more moderate scaling
      const radius =
        (((quadtreeRadius * (1 + zoomFactor)) / transform.k) *
          (xScaleRef.current.domain()[1] - xScaleRef.current.domain()[0])) /
        width;

      quadtreeRef.current.visit((node, x1, y1, x2, y2) => {
        // First check if this node's bounding box is outside our search area
        const isOutsideSearchArea =
          x1 > dataX + radius || x2 < dataX - radius || y1 > dataY + radius || y2 < dataY - radius;

        // If outside, stop traversing this branch
        if (isOutsideSearchArea) {
          return true;
        }

        // Only process points from nodes within our search area
        if (!node.length) {
          const dx = node.data[0] - dataX;
          const dy = node.data[1] - dataY;
          const distance = dx * dx + dy * dy;

          if (distance < minDistance) {
            minDistance = distance;
            nearest = node.data;
          }
        }

        // Continue traversing this branch's children
        return false;
      });

      if (nearest && Math.sqrt(minDistance) <= radius) {
        return points.findIndex((p) => p[0] === nearest[0] && p[1] === nearest[1]);
      }
      return -1;
    },
    [points, width, transform, quadtreeRadius]
  );

  // Find the n closest points to the given data coordinates (dataX, dataY)
  const findNClosestPoints = useCallback(
    (dataX, dataY, n) => {
      const closestPoints = [];

      // Search radius in data coordinates
      const radius = 0.05;
      // ((quadtreeRadius / transform.k) *
      //   (xScaleRef.current.domain()[1] - xScaleRef.current.domain()[0])) /
      // width;

      quadtreeRef.current.visit((node, x1, y1, x2, y2) => {
        // First check if this node's bounding box is outside our search area
        const isOutsideSearchArea =
          x1 > dataX + radius || x2 < dataX - radius || y1 > dataY + radius || y2 < dataY - radius;

        // If outside, stop traversing this branch
        if (isOutsideSearchArea) {
          return true;
        }

        // Only process points from nodes within our search area
        if (!node.length) {
          const dx = node.data[0] - dataX;
          const dy = node.data[1] - dataY;
          const distance = dx * dx + dy * dy;

          if (closestPoints.length < n) {
            closestPoints.push({ point: node.data, distance });
            closestPoints.sort((a, b) => a.distance - b.distance);
          } else if (distance < closestPoints[closestPoints.length - 1].distance) {
            closestPoints[closestPoints.length - 1] = { point: node.data, distance };
            closestPoints.sort((a, b) => a.distance - b.distance);
          }
        }

        // Continue traversing this branch's children
        return false;
      });
      // debugger;
      // console.log('closestPoints', closestPoints);

      return closestPoints.map(({ point }) =>
        points.findIndex((p) => p[0] === point[0] && p[1] === point[1])
      );
    },
    [points]
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

  const updateCenteredIndices = useCallback(
    (transform) => {
      // Skip updating centered indices if we're in a programmatic zoom operation
      if (isZoomingProgrammatically.current) return;

      const newCenter = getCenterCoordinates(
        width,
        height,
        transform,
        xScaleRef.current,
        yScaleRef.current
      );
      if (!quadtreeRef.current) return;
      // console.log('updateCenteredIndices', newCenter);
      const closest = findNClosestPoints(newCenter.x, newCenter.y, TOP_N_POINTS);
      // console.log('closest', closest);
      if (isSmallScreen) {
        debouncedSetCenteredIndices(closest);
      }
    },
    [width, height, debouncedSetCenteredIndices, findNClosestPoints, isSmallScreen]
  );

  // NEW: When the shownIndices (from FilterContext) change and if centering is enabled,
  // compute a new transform to center (and optionally partially zoom in on) the shown points.
  useEffect(() => {
    if (!centerOnShownIndices) return;
    if (!points || !points.length) return;
    if (!shownIndices || shownIndices.length === 0) return;

    // Skip programmatic zooming if the user has manually zoomed/panned
    if (userHasManuallyZoomed.current) {
      // Reset this flag when filter changes to allow future programmatic zooms
      userHasManuallyZoomed.current = false;
      return;
    }

    // Update the last centered indices ref
    lastCenteredIndicesRef.current = [...shownIndices];

    // Compute bounding box in data space for the shown points.
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    shownIndices.forEach((idx) => {
      const p = points[idx];
      if (p) {
        const [x, y] = p;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    });
    if (minX === Infinity) return;

    // Convert the data-space bounding box to the "initial screen coordinates" that your shader uses.
    // (Recall that in the vertex shader we do:
    //   screen.x = ((position.x + 1) * 0.5 * width)
    //   screen.y = ((1 - position.y) * 0.5 * height))
    const screenMinX = ((minX + 1) / 2) * width;
    const screenMaxX = ((maxX + 1) / 2) * width;
    const screenMinY = ((1 - maxY) / 2) * height;
    const screenMaxY = ((1 - minY) / 2) * height;

    const bboxWidth = screenMaxX - screenMinX;
    const bboxHeight = screenMaxY - screenMinY;
    const bboxCenterX = screenMinX + bboxWidth / 2;
    const bboxCenterY = screenMinY + bboxHeight / 2;

    // To avoid an extremely high scale (when only a single point is visible) use a minimal "pad"
    const pad = 20; // minimal size (in pixels)
    const boxWidthAdjusted = Math.max(bboxWidth, pad);
    const boxHeightAdjusted = Math.max(bboxHeight, pad);

    // Compute the maximum zoom scale that would fit the bounding box with the desired margin.
    const scaleX = (width * centerMargin) / boxWidthAdjusted;
    const scaleY = (height * centerMargin) / boxHeightAdjusted;
    let fitScale = Math.min(scaleX, scaleY);
    fitScale = Math.min(Math.max(fitScale, minZoom), maxZoom);

    // Compute the translation so that the bounding box center is in the middle of the canvas.
    const newTx = width / 2 - bboxCenterX * fitScale;
    const newTy = height / 2 - bboxCenterY * fitScale;

    const newTransform = zoomIdentity.translate(newTx, newTy).scale(fitScale);

    // Update the view via a transition.
    if (zoomSelectionRef.current && zoomBehaviorRef.current) {
      // Set the flag to indicate we're starting a programmatic zoom
      isZoomingProgrammatically.current = true;

      zoomSelectionRef.current
        .transition()
        .duration(950)
        .call(zoomBehaviorRef.current.transform, newTransform)
        .on('end', () => {
          // Reset the flag when the transition is complete
          isZoomingProgrammatically.current = false;
        });
    } else {
      // Reset the flag if we couldn't start the transition
      isZoomingProgrammatically.current = false;
    }
  }, [shownIndices, points, width, height, minZoom, maxZoom, centerOnShownIndices, centerMargin]);

  // Add handlers to reset programmatic zoom flag on user interaction
  const handleMouseDown = useCallback(() => {
    if (isZoomingProgrammatically.current) {
      isZoomingProgrammatically.current = false;
    }
    userHasManuallyZoomed.current = true;
  }, []);

  const handleTouchStart = useCallback(() => {
    if (isZoomingProgrammatically.current) {
      isZoomingProgrammatically.current = false;
    }
    userHasManuallyZoomed.current = true;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={styles.scatter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover && onHover(null)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    />
  );
}

export default ScatterGL;
