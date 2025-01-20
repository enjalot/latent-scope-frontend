import { useEffect, useRef, useCallback } from 'react';
import { select } from 'd3-selection';
import { scaleLinear, scaleSequential, scaleLog } from 'd3-scale';
import { zoom, zoomIdentity } from 'd3-zoom';
import scaleCanvas from "../lib/canvas";
import { rgb } from "d3-color";
import { quadtree } from 'd3-quadtree';
import {
    mapSelectionColorsLight,
    mapSelectionColorsDark,
    mapSelectionOpacity,
    mapPointSizeRange,
} from "../lib/colors";

import styles from "./Scatter.module.css";

import PropTypes from "prop-types";
ScatterCanvas.propTypes = {
    points: PropTypes.array.isRequired, // an array of [x,y] points
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    pointScale: PropTypes.number,
    colorDomain: PropTypes.array,
    colorRange: PropTypes.array,
    colorInterpolator: PropTypes.func,
    opacityBy: PropTypes.string,
    opacityRange: PropTypes.array,
    pointSizeRange: PropTypes.array,
    duration: PropTypes.number,
    onScatter: PropTypes.func,
    onView: PropTypes.func,
    onSelect: PropTypes.func,
    onHover: PropTypes.func,
};

const calculatePointColor = (valueA) => {
    return mapSelectionColorsLight[valueA];
};

const calculatePointOpacity = (valueA) => {
    return mapSelectionOpacity[valueA];
};

const calculatePointSize = (valueA) => {
    return mapPointSizeRange[valueA];
};

function ScatterCanvas({ points, width, height, pointScale = 1, onView, onSelect, onHover }) {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const transformRef = useRef(zoomIdentity);
    const xScaleRef = useRef(scaleLinear().domain([-1, 1]).range([0, width]));
    const yScaleRef = useRef(scaleLinear().domain([-1, 1]).range([height, 0]));
    const quadtreeRef = useRef(null);

    // Setup canvas and scales
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        context.scale(window.devicePixelRatio, window.devicePixelRatio);
        contextRef.current = context;
        scaleCanvas(canvas, context, width, height);

        const zoomBehavior = zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                transformRef.current = event.transform;
                const newXScale = event.transform.rescaleX(xScaleRef.current);
                const newYScale = event.transform.rescaleY(yScaleRef.current);

                requestAnimationFrame(() => {
                    if (onView) {
                        onView(newXScale.domain(), newYScale.domain());
                    }
                    drawPoints();
                });
            });

        select(canvas).call(zoomBehavior);

        return () => {
            select(canvas).on(".zoom", null);
        };
    }, [width, height]);

    const drawPoints = useCallback(() => {
        if (!points || !points.length) return;

        const context = contextRef.current;
        const transform = transformRef.current;

        // Clear canvas
        context.clearRect(0, 0, width, height);

        // Draw each point
        points.forEach(([x, y, valueA]) => {
            const color = calculatePointColor(valueA);
            const opacity = calculatePointOpacity(valueA);
            const pointSize = calculatePointSize(valueA);
            // color is a hex string, opacity is a number between 0 and 1
            // convert hex string to rgb
            const rgbColor = rgb(color);
            const rgbaColor = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${opacity})`;

            context.fillStyle = rgbaColor;

            const screenX = transform.applyX(xScaleRef.current(x));
            const screenY = transform.applyY(yScaleRef.current(y));

            context.beginPath();
            context.arc(screenX, screenY, pointSize, 0, 2 * Math.PI);
            context.fill();
        });
    }, [points, width, height, pointScale]);

    // Draw points when they change
    useEffect(() => {
        drawPoints();
    }, [points, drawPoints]);

    // Update useEffect to rebuild quadtree when points change
    useEffect(() => {
        if (!points || !points.length) return;

        quadtreeRef.current = quadtree()
            .x((d) => d[0])
            .y((d) => d[1])
            .addAll(points);
    }, [points]);

    // Replace the existing handleMouseMove with this updated version
    const findNearestPoint = useCallback(
        (x, y) => {
            if (!points || !quadtreeRef.current) return -1;

            const transform = transformRef.current;
            // Convert screen coordinates back to data space
            const dataX = xScaleRef.current.invert(transform.invertX(x));
            const dataY = yScaleRef.current.invert(transform.invertY(y));

            let nearest = null;
            let minDistance = Infinity;

            // Search radius in data coordinates
            const radius =
                ((5 / transform.k) *
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
                    x1 > dataX + radius ||
                    x2 < dataX - radius ||
                    y1 > dataY + radius ||
                    y2 < dataY - radius
                );
            });

            if (nearest && Math.sqrt(minDistance) <= radius) {
                return points.findIndex((p) => p[0] === nearest[0] && p[1] === nearest[1]);
            }
            return -1;
        },
        [points, width]
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

export default ScatterCanvas;
