import React, { useState, useEffect, useRef, useCallback } from 'react';
import FilterActions from '../components/Explore/FilterActions';
import VisualizationPane from '../components/Explore/VisualizationPane';
import MobileFilterDataTable from '../components/MobileFilterDataTable';
import { useScope } from '../contexts/ScopeContext';
import { useFilter } from '../contexts/FilterContext';
import styles from './MobileExplore.module.css';

function MobileExplore() {
  const { dataset, userId, scope, scopeRows, deletedIndices, clusterLabels, features, sae } =
    useScope();
  const {
    loading: filterLoading,
    shownIndices,
    setFilterQuery,
    featureFilter,
    searchFilter,
    setFilterConfig,
    setFilterActive,
    setUrlParams,
  } = useFilter();

  // Visualization and hover state
  const [scatter, setScatter] = useState({});
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [hoverAnnotations, setHoverAnnotations] = useState([]);
  const [dataTableRows, setDataTableRows] = useState([]);

  // Ref for visualization container if needed
  const [size, setSize] = useState([500, 500]);
  const vizContainerRef = useRef(null);

  // In your size update function
  function updateSize() {
    if (vizContainerRef.current) {
      const vizRect = vizContainerRef.current.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(vizContainerRef.current);

      // 150 is the default height of filter data table

      // i feel like this is a hack, but it works for now
      setSize([vizRect.width, parseInt(computedStyle.height) - 150]);
      // setSize([window.innerWidth, window.innerHeight]);
    }
  }

  useEffect(() => {
    const observer = new MutationObserver((mutations, obs) => {
      updateSize();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }, []);

  const handleClicked = useCallback((index) => {
    console.log('Clicked', index);
  }, []);

  const [width, height] = size;

  const handleHover = useCallback(
    (index) => {
      const nonDeletedIndex = deletedIndices.includes(index) ? null : index;
      setHoveredIndex(nonDeletedIndex);
      setHoveredCluster(null);
    },
    [deletedIndices]
  );

  const handleFeatureClick = useCallback(() => {
    // Mobile-specific feature click logic if needed.
  }, []);

  if (!dataset) return <div>Loading...</div>;

  return (
    <div className={styles.mobileExploreLayout}>
      {/* Full screen visualization pane */}
      <div className={styles.visualizationPaneContainer}>
        <div className={styles.filterActionsOverlay}>
          <FilterActions
            clusterLabels={clusterLabels}
            scatter={scatter}
            scope={scope}
            dataset={dataset}
          />
        </div>
        <div ref={vizContainerRef} className={styles.visualizationPane}>
          {scopeRows?.length ? (
            <VisualizationPane
              width={width}
              height={height}
              onScatter={setScatter}
              hovered={hovered}
              hoveredIndex={hoveredIndex}
              onHover={handleHover}
              onSelect={() => {}}
              hoverAnnotations={hoverAnnotations}
              selectedAnnotations={[]}
              hoveredCluster={hoveredCluster}
              dataTableRows={dataTableRows}
            />
          ) : null}
        </div>
      </div>

      {/* Overlay for Filter Actions at the top of the viz pane */}

      {/* Overlay for the Filter DataTable at the bottom */}
      <MobileFilterDataTable
        userId={userId}
        dataset={dataset}
        scope={scope}
        distances={searchFilter.distances}
        clusterMap={{}} // Pass clusterMap if needed
        clusterLabels={clusterLabels}
        sae_id={sae?.id}
        feature={featureFilter.feature}
        features={features}
        onHover={handleHover}
        onClick={handleClicked}
        handleFeatureClick={handleFeatureClick}
        filteredIndices={shownIndices}
        deletedIndices={deletedIndices}
      />
    </div>
  );
}

export default MobileExplore;
