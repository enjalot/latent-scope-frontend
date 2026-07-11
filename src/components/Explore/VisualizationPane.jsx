import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { groups } from 'd3-array';
import PropTypes from 'prop-types';
// import Scatter from '../Scatter';
// import Scatter from '../ScatterCanvas';
import Scatter from '../ScatterGL';
import Scatter3D from './Scatter3D';
import VoxelView from './VoxelView';
import CellDetail from './CellDetail';
import MembersTooltip from './MembersTooltip';
import AnnotationPlot from '../AnnotationPlot';
import HullPlot from '../HullPlot';
import TilePlot from '../TilePlot';
import AtlasOverlay from './AtlasOverlay';
import PointsOverlay from './PointsOverlay';
import { atlasLod } from '../../lib/atlas';
import { Tooltip } from 'react-tooltip';
import CrossHair from '../Crosshair';
import { processHulls } from '../../utils';
import PointLabel from './PointLabel';
import { filterConstants } from './Search/utils';
import { useCellMembers } from '../../hooks/useCellMembers';

// import { useColorMode } from '../../hooks/useColorMode';

import { useScope } from '../../contexts/ScopeContext';
import { useFilter } from '../../contexts/FilterContext';

import { mapSelectionOpacity, mapPointSizeRange, mapSelectionKey } from '../../lib/colors';
import styles from './VisualizationPane.module.scss';
import ConfigurationPanel from './ConfigurationPanel';
import { Icon, Button } from 'react-element-forge';
import { useSmallScreen } from '../../hooks/useSmallScreen';

// VisualizationPane.propTypes = {
//   hoverAnnotations: PropTypes.array.isRequired,
//   hoveredCluster: PropTypes.object,
//   cluster: PropTypes.object,
//   scope: PropTypes.object,
//   selectedAnnotations: PropTypes.array.isRequired,
//   onScatter: PropTypes.func.isRequired,
//   onSelect: PropTypes.func.isRequired,
//   onHover: PropTypes.func.isRequired,
//   hovered: PropTypes.object,
//   dataset: PropTypes.object.isRequired,
//   containerRef: PropTypes.object.isRequired,
// };

function VisualizationPane({
  width,
  height,
  onScatter,
  hovered,
  hoveredIndex,
  onHover,
  onSelect,
  hoverAnnotations,
  selectedAnnotations,
  hoveredCluster,
  dataTableRows,
}) {
  const {
    scopeRows,
    clusterLabels,
    clusterMap,
    deletedIndices,
    scope,
    features,
    userId,
    datasetId,
    scopeImages,
    imageColumn,
    isImageScope,
    thumbUrl,
    atlasManifest,
  } = useScope();

  const isSmallScreen = useSmallScreen();

  const { featureFilter, clusterFilter, shownIndices, filterConfig, setCenteredIndices } =
    useFilter();

  // ====================================================================================================
  // View mode (2D scatter / 3D scatter / Voxels). The 3D + Voxels modes are only
  // available when the scope's projection is 3-dimensional (dimensions === 3).
  // ====================================================================================================
  const is3D = scope?.dimensions === 3;
  const [viewMode, setViewMode] = useState('2d');
  useEffect(() => {
    if (!is3D && viewMode !== '2d') setViewMode('2d');
  }, [is3D, viewMode]);

  // Cell-detail drawer (shared by voxels + the 2D heatmap). { key, column }.
  const [selectedCell, setSelectedCell] = useState(null);
  const handleCellSelect = useCallback((key, column) => {
    setSelectedCell({ key, column });
  }, []);

  // Members-in-cell tooltip for the 2D heatmap tiles (voxels have their own).
  const heatmapCellKeyOf = useCallback((row) => row.tile_index_64, []);
  const {
    setActiveCell: setHeatmapCell,
    active: heatmapActive,
    snippets: heatmapSnippets,
    snippetIndices: heatmapSnippetIndices,
    loadingSnippets: heatmapLoading,
  } = useCellMembers({
    scopeRows,
    scope,
    userId,
    datasetId,
    cellKeyOf: heatmapCellKeyOf,
  });
  const [heatmapTooltip, setHeatmapTooltip] = useState(null); // {x,y}
  const handleTileHover = useCallback(
    (tileIndex, clientX, clientY) => {
      if (tileIndex === null || tileIndex === undefined) {
        setHeatmapCell(null);
        setHeatmapTooltip(null);
      } else {
        setHeatmapCell(tileIndex);
        setHeatmapTooltip({ x: clientX, y: clientY });
      }
    },
    [setHeatmapCell]
  );
  const handleTileClick = useCallback(
    (tileIndex) => handleCellSelect(tileIndex, 'tile_index_64'),
    [handleCellSelect]
  );

  // only show the hull if we are filtering by cluster
  const showHull = filterConfig?.type === filterConstants.CLUSTER;

  const maxZoom = 40;

  const [xDomain, setXDomain] = useState([-1, 1]);
  const [yDomain, setYDomain] = useState([-1, 1]);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const handleView = useCallback(
    (xDomain, yDomain, transform) => {
      setXDomain(xDomain);
      setYDomain(yDomain);
      setTransform(transform);
    },
    [setXDomain, setYDomain]
  );

  // const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const umapRef = useRef(null);
  const [umapOffset, setUmapOffset] = useState(0);

  const size = [width, height];

  const featureIsSelected = featureFilter.feature !== -1;

  // Add new memoized feature activation lookup
  const featureActivationMap = useMemo(() => {
    if (!featureIsSelected || !dataTableRows || !shownIndices) {
      return new Map();
    }

    const lookup = new Map();
    dataTableRows.forEach((data, index) => {
      const activatedIdx = data.sae_indices.indexOf(featureFilter.feature);
      if (activatedIdx !== -1) {
        const activatedFeature = data.sae_acts[activatedIdx];
        // normalize the activation to be between 0 and 1
        const min = 0.0;
        const max = features[featureFilter.feature].dataset_max;
        const normalizedActivation = (activatedFeature - min) / (max - min);
        lookup.set(data.ls_index, normalizedActivation);
      }
    });
    return lookup;
  }, [featureIsSelected, dataTableRows, featureFilter.feature, features]);

  const drawingPoints = useMemo(() => {
    return scopeRows.map((p, i) => {
      if (featureIsSelected) {
        if (shownIndices?.includes(i)) {
          const activation = featureActivationMap.get(p.ls_index);
          return activation !== undefined
            ? [p.x, p.y, mapSelectionKey.selected, activation]
            : [p.x, p.y, mapSelectionKey.notSelected, 0.0];
        }
        return [p.x, p.y, mapSelectionKey.notSelected, 0.0];
      }

      if (p.deleted) {
        return [-10, -10, mapSelectionKey.hidden, 0.0];
        //   } else if (hoveredIndex === i) {
        //     return [p.x, p.y, mapSelectionKey.hovered, 0.0];
      } else if (shownIndices?.includes(i)) {
        return [p.x, p.y, mapSelectionKey.selected, 0.0];
      } else if (shownIndices?.length) {
        return [p.x, p.y, mapSelectionKey.notSelected, 0.0];
      } else {
        return [p.x, p.y, mapSelectionKey.normal, 0.0];
      }
    });
  }, [scopeRows, shownIndices, featureActivationMap, featureIsSelected]);

  const points = useMemo(() => {
    return scopeRows
      .filter((p) => !p.deleted)
      .map((p) => {
        return [p.x, p.y];
      });
  }, [scopeRows]);

  // const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  // useEffect(() => {
  //   console.log('==== hovered ==== ', hovered);
  //   if (hovered) {
  //     // console.log("hovered", hovered, scopeRows[hovered.index])
  //     const point = scopeRows[hovered.index];
  //     if (point && xDomain && yDomain) {
  //       let px = point.x;
  //       if (px < xDomain[0]) px = xDomain[0];
  //       if (px > xDomain[1]) px = xDomain[1];
  //       let py = point.y;
  //       if (py < yDomain[0]) py = yDomain[0];
  //       if (py > yDomain[1]) py = yDomain[1];
  //       const xPos = ((px - xDomain[0]) / (xDomain[1] - xDomain[0])) * width + 19;
  //       const yPos = ((py - yDomain[1]) / (yDomain[0] - yDomain[1])) * size[1] + umapOffset - 28;
  //       // console.log("xPos", xPos, "yPos", yPos)
  //       setTooltipPosition({
  //         x: xPos,
  //         y: yPos,
  //       });
  //     }
  //   }
  // }, [hovered, scopeRows, xDomain, yDomain, width, height, umapOffset]);

  const hulls = useMemo(() => {
    return processHulls(clusterLabels, scopeRows, (d) => (d.deleted ? null : [d.x, d.y]));
  }, [scopeRows, clusterLabels]);

  // derive the hulls from the cluster, and filter deleted points via an accessor
  const clusterHulls = useMemo(() => {
    if (!clusterFilter.cluster || !scopeRows) return [];
    return processHulls([clusterFilter.cluster], scopeRows, (d) => (d.deleted ? null : [d.x, d.y]));
  }, [clusterFilter.cluster, scopeRows]);

  const hoveredHulls = useMemo(() => {
    if (!hoveredCluster || !scopeRows) return [];
    return processHulls([hoveredCluster], scopeRows, (d) => (d.deleted ? null : [d?.x, d?.y]));
  }, [hoveredCluster, scopeRows]);

  // TODO: these should just be based on which tile we choose, 32, 64 or 128
  const tileMeta = useMemo(() => {
    return {
      size: 2 / 64,
      cols: 64,
    };
  }, []);
  const tiles = useMemo(() => {
    return groups(scopeRows, (d) => d.tile_index_64).map((tile) => {
      return {
        tile_index: tile[0],
        points: tile[1],
      };
    });
  }, [scopeRows]);

  // Invert the TilePlot draw math: map a data-space (x,y) to the tile_index_64
  // it falls in. The grid spans [-1,1] on both axes (cols*size/2 = 1), matching
  // how TilePlot positions each tile. Returns null when outside the grid.
  const tileIndexFromData = useCallback(
    (dataX, dataY) => {
      const { size, cols } = tileMeta;
      const half = (cols * size) / 2;
      const col = Math.floor((dataX + half) / size);
      const row = Math.floor((dataY + half) / size);
      if (col < 0 || col >= cols || row < 0 || row >= cols) return null;
      return row * cols + col;
    },
    [tileMeta]
  );

  // Drive the heatmap tile tooltip/drawer from the ScatterGL cursor pipeline
  // (the scatter stays the single interactive layer; TilePlot is pointer-events:
  // none). onCursor reports the data-space cursor + client coords on every move.
  const handleScatterCursor = useCallback(
    (cursor) => {
      if (!cursor) {
        handleTileHover(null);
        return;
      }
      const tileIndex = tileIndexFromData(cursor.x, cursor.y);
      handleTileHover(tileIndex, cursor.clientX, cursor.clientY);
    },
    [handleTileHover, tileIndexFromData]
  );
  const handleScatterCursorClick = useCallback(
    (cursor) => {
      if (!cursor) return;
      const tileIndex = tileIndexFromData(cursor.x, cursor.y);
      if (tileIndex !== null) handleTileClick(tileIndex);
    },
    [handleTileClick, tileIndexFromData]
  );

  // ====================================================================================================
  // Configuration Panel
  // ====================================================================================================
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [vizConfig, setVizConfig] = useState({
    showHeatMap: false,
    showClusterOutlines: true,
    // atlas image layer for image scopes; only used when the scope has images
    showImages: true,
    pointSize: 1,
    pointOpacity: 1,
  });

  useEffect(() => {
    if (scopeRows?.length <= 1000) {
      setVizConfig((prev) => ({ ...prev, pointSize: 2.25 }));
    } else if (scopeRows?.length <= 10000) {
      setVizConfig((prev) => ({ ...prev, pointSize: 1.25 }));
    } else if (scopeRows?.length <= 100000) {
      setVizConfig((prev) => ({ ...prev, pointSize: 0.75 }));
    } else {
      setVizConfig((prev) => ({ ...prev, pointSize: 0.5 }));
    }
  }, [scopeRows]);

  const toggleShowHeatMap = useCallback(() => {
    setVizConfig((prev) => ({ ...prev, showHeatMap: !prev.showHeatMap }));
  }, []);

  const toggleShowClusterOutlines = useCallback(() => {
    setVizConfig((prev) => ({ ...prev, showClusterOutlines: !prev.showClusterOutlines }));
  }, []);

  const toggleShowImages = useCallback(() => {
    setVizConfig((prev) => ({ ...prev, showImages: !prev.showImages }));
  }, []);

  // ====================================================================================================
  // Image scopes: atlas image layer (LOD over the sprite-atlas pyramid)
  // ====================================================================================================
  const atlasResolutions = useMemo(
    () => (atlasManifest?.resolutions || []).map((r) => r.num_tiles),
    [atlasManifest]
  );
  const imagesVisible =
    isImageScope && vizConfig.showImages && !!atlasManifest && atlasResolutions.length > 0;
  // Which pyramid level fits the current zoom, and whether we're past the
  // finest level (points get drawn back on top).
  const lod = useMemo(
    () => atlasLod(transform?.k || 1, width, atlasResolutions),
    [transform, width, atlasResolutions]
  );
  const pointsOverlayVisible = imagesVisible && lod.deepest;

  const updatePointSize = useCallback((value) => {
    setVizConfig((prev) => ({ ...prev, pointSize: value }));
  }, []);

  const updatePointOpacity = useCallback((value) => {
    setVizConfig((prev) => ({ ...prev, pointOpacity: value }));
  }, []);

  const pointSizeRange = useMemo(() => {
    return mapPointSizeRange.map((d) => d * vizConfig.pointSize);
  }, [vizConfig.pointSize]);
  const pointOpacityRange = useMemo(() => {
    return mapSelectionOpacity.map((d) => d * vizConfig.pointOpacity);
  }, [vizConfig.pointOpacity]);

  // ensure the order of selectedPoints
  // exactly matches the ordering of indexes in shownIndices.
  const selectedPoints = useMemo(() => {
    if (!shownIndices || !scopeRows) return [];
    return shownIndices
      .map((ls_index, i) => {
        // Find the point in scopeRows with matching ls_index
        const point = scopeRows.find((p) => p.ls_index === ls_index);
        return point ? { ...point, index: i } : null;
      })
      .filter((point) => point !== null);
  }, [shownIndices, scopeRows]);

  // console.log({
  //   shownIndices,
  //   selectedPoints: selectedPoints.map((p) => {
  //     return {
  //       index: p.index,
  //       ls_index: p.ls_index,
  //     };
  //   }),
  // });

  return (
    // <div style={{ width, height }} ref={umapRef}>
    <div ref={umapRef} style={{ width: '100%', height: '100%' }}>
      <div className={styles.configToggleContainer}>
        <Button
          className={styles['configToggle']}
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          aria-label="Toggle configuration panel"
          icon={'settings'}
          size="small"
          // color="#333"
        />

        <ConfigurationPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          title="View Settings"
          vizConfig={vizConfig}
          toggleShowHeatMap={toggleShowHeatMap}
          toggleShowClusterOutlines={toggleShowClusterOutlines}
          toggleShowImages={toggleShowImages}
          isImageScope={isImageScope}
          updatePointSize={updatePointSize}
          updatePointOpacity={updatePointOpacity}
        />
      </div>

      {is3D && (
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={viewMode === '2d' ? styles.viewToggleActive : ''}
            onClick={() => setViewMode('2d')}
          >
            2D
          </button>
          <button
            type="button"
            className={viewMode === '3d' ? styles.viewToggleActive : ''}
            onClick={() => setViewMode('3d')}
          >
            3D
          </button>
          <button
            type="button"
            className={viewMode === 'voxels' ? styles.viewToggleActive : ''}
            onClick={() => setViewMode('voxels')}
          >
            Voxels
          </button>
        </div>
      )}

      <div className={styles.scatters + ' ' + (isFullScreen ? styles.fullScreen : '')}>
        {viewMode === '3d' && scope && (
          <Scatter3D
            scopeRows={scopeRows}
            width={width}
            height={height}
            clusterLabels={clusterLabels}
            selectedCluster={clusterFilter.cluster}
            hoveredIndex={hoveredIndex}
            onHover={onHover}
            onSelect={onSelect}
            pointScale={vizConfig.pointSize}
          />
        )}
        {viewMode === 'voxels' && scope && (
          <VoxelView
            scopeRows={scopeRows}
            scope={scope}
            userId={userId}
            datasetId={datasetId}
            clusterLabels={clusterLabels}
            width={width}
            height={height}
            onCellSelect={handleCellSelect}
          />
        )}
        {viewMode === '2d' && (
          <>
            {scope && (
              <Scatter
                points={drawingPoints}
                shownIndices={shownIndices}
                setCenteredIndices={setCenteredIndices}
                width={width}
                height={height}
                onView={handleView}
                onSelect={onSelect}
                onHover={onHover}
                onCursor={vizConfig.showHeatMap ? handleScatterCursor : undefined}
                onCursorClick={vizConfig.showHeatMap ? handleScatterCursorClick : undefined}
                featureIsSelected={featureIsSelected}
                maxZoom={maxZoom}
                isSmallScreen={isSmallScreen}
              />
            )}
            {/* Image scopes: representative-image atlas drawn over the scatter
                (unpopulated cells are transparent, so points show through gaps).
                pointer-events: none — hover/zoom still go to the ScatterGL canvas. */}
            {imagesVisible && (
              <AtlasOverlay
                userId={userId}
                datasetId={datasetId}
                atlasPath={scopeImages.atlas?.[imageColumn]?.path}
                xDomain={xDomain}
                yDomain={yDomain}
                width={width}
                height={height}
                transform={transform}
                manifest={atlasManifest}
              />
            )}
            {/* Points drawn back on top of the images once zoomed past the finest
                pyramid level, so individual rows can be pinpointed. */}
            {pointsOverlayVisible && (
              <PointsOverlay
                scopeRows={scopeRows}
                xDomain={xDomain}
                yDomain={yDomain}
                width={width}
                height={height}
                enabled={pointsOverlayVisible}
                opacity={vizConfig.pointOpacity}
                pointSize={vizConfig.pointSize}
              />
            )}
            {/* show all the hulls */}
            {vizConfig.showClusterOutlines && hulls.length && (
          <HullPlot
            hulls={hulls}
            // stroke="#E7C7AA"
            // stroke={cluster && cluster.hull ? 'lightgray' : '#E7C7AA'}
            // stroke={isDark ? '#E0EFFF' : '#d4b297'}
            stroke="#d4b297"
            // stroke={'#E0EFFF'}
            fill="none"
            duration={200}
            strokeWidth={0.75}
            xDomain={xDomain}
            yDomain={yDomain}
            width={width}
            height={height}
          />
        )}
        {hoveredCluster && hoveredHulls && scope.cluster_labels_lookup && (
          <HullPlot
            hulls={hoveredHulls}
            fill="#8bcf66"
            stroke="#6aa64f"
            strokeWidth={2.5}
            // if there are selected indices already, that means other points will be less visible
            // so we can make the hull a bit more transparent
            opacity={0.2}
            duration={0}
            xDomain={xDomain}
            yDomain={yDomain}
            width={width}
            height={height}
            label={scope.cluster_labels_lookup[hoveredCluster.cluster]}
            k={transform.k}
            maxZoom={maxZoom}
          />
        )}
        {/* Cluster is selected via filter */}
        {showHull &&
          clusterFilter.cluster &&
          clusterFilter.cluster.hull &&
          !scope.ignore_hulls &&
          scope.cluster_labels_lookup && (
            <HullPlot
              hulls={clusterHulls}
              fill="#D3965E"
              stroke="#C77C37"
              strokeWidth={3}
              opacity={0.25}
              duration={0}
              xDomain={xDomain}
              yDomain={yDomain}
              width={width}
              height={height}
              label={scope.cluster_labels_lookup[clusterFilter.cluster.cluster]}
            />
          )}
        <AnnotationPlot
          points={hoverAnnotations}
          stroke="black"
          fill="#8bcf66"
          size="16"
          xDomain={xDomain}
          yDomain={yDomain}
          width={width}
          height={height}
        />
        <AnnotationPlot
          points={selectedAnnotations}
          stroke="black"
          fill="purple"
          size="16"
          xDomain={xDomain}
          yDomain={yDomain}
          width={width}
          height={height}
        />
            {vizConfig.showHeatMap && tiles?.length > 1 && (
              <TilePlot
                tiles={tiles}
                tileMeta={tileMeta}
                xDomain={xDomain}
                yDomain={yDomain}
                width={width}
                height={height}
                fill="gray"
                // stroke="black"
              />
            )}
            <PointLabel
              selectedPoints={selectedPoints}
              hovered={hovered}
              xDomain={xDomain}
              yDomain={yDomain}
              width={width}
              height={height}
              k={transform.k}
              maxZoom={maxZoom}
            />
            {isSmallScreen && (
              <CrossHair xDomain={xDomain} yDomain={yDomain} width={width} height={height} />
            )}
          </>
        )}
      </div>

      {/* Cell-detail drawer: opens from a voxel click (3D) or heatmap tile click (2D) */}
      <CellDetail selectedCell={selectedCell} onClose={() => setSelectedCell(null)} />

      {/* Members-in-cell tooltip for the 2D heatmap tiles */}
      {viewMode === '2d' && vizConfig.showHeatMap && heatmapTooltip && heatmapActive && (
        <MembersTooltip
          x={heatmapTooltip.x}
          y={heatmapTooltip.y}
          summary={heatmapActive.summary}
          snippets={heatmapSnippets}
          loading={heatmapLoading}
          isImageScope={isImageScope}
          thumbUrl={thumbUrl}
          indices={heatmapSnippetIndices}
        />
      )}

      {/* Hover information display */}
      {hovered && (
        <div
          data-tooltip-id="featureTooltip"
          style={{
            position: 'absolute',
            right: 225,
            top: 0,
            pointerEvents: 'none',
          }}
        ></div>
      )}
      {hovered && (
        <Tooltip
          id="featureTooltip"
          isOpen={hovered !== null}
          delayShow={0}
          delayHide={0}
          delayUpdate={0}
          noArrow={true}
          className="tooltip-area"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            pointerEvents: 'none',
            width: '400px',
            backgroundColor: '#D3965E',
          }}
        >
          <div className="tooltip-content">
            {hoveredCluster && (
              <span>
                <span className="key">Cluster {hoveredCluster.cluster}: </span>
                <span className="value">{hoveredCluster.label}</span>
              </span>
            )}
            <br></br>
            <span>Index: {hovered.index}</span>
            {isImageScope && thumbUrl(hovered.index) && (
              <div>
                <img
                  src={thumbUrl(hovered.index)}
                  alt=""
                  style={{ maxWidth: 128, maxHeight: 128, marginTop: 4, display: 'block' }}
                  onError={(e) => {
                    // rows with no thumbnail (missing/undecodable image) 404
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <p className="tooltip-text">{hovered.text}</p>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

export default VisualizationPane;
