import React from 'react';
import styles from './FilterActions.module.scss';
import { Button } from 'react-element-forge';
import ClusterFilter from './ClusterFilter';
import ColumnFilter from './ColumnFilter';
import NearestNeighbor from './NearestNeighbor';
import FeatureFilter from './FeatureFilter';
import { useFilter } from '../../contexts/FilterContext';
import { useScope } from '../../contexts/ScopeContext';
import MobileClusterFilter from './MobileClusterFilter';
import MobileFeatureFilter from './MobileFeatureFilter';

export default function FilterActions({ scatter, isSmallScreen = false }) {
  const {
    activeFilterTab,
    toggleSearch,
    toggleFilter,
    toggleSelect,
    toggleColumn,
    toggleFeature,
    clusterFilter,
    columnFilter,
    selectedIndices,
    searchFilter,
    featureFilter,
    filterConstants,
  } = useFilter();

  const { scope, features, clusterLabels } = useScope();

  if (isSmallScreen) {
    return (
      <div className={styles.container}>
        <div className={styles.actionsRow}>
          <MobileClusterFilter clusterLabels={clusterLabels} />
          <MobileFeatureFilter scope={scope} />
        </div>
      </div>
    );
  }
  let filterComponent = null;
  switch (activeFilterTab) {
    case filterConstants.CLUSTER:
      filterComponent = <ClusterFilter clusterLabels={clusterLabels} />;
      break;
    case filterConstants.COLUMN:
      filterComponent = <ColumnFilter />;
      break;
    case filterConstants.FEATURE:
      filterComponent = <FeatureFilter scope={scope} />;
      filterComponent = <MobileFeatureFilter scope={scope} />;
      break;
    case filterConstants.SELECT:
      filterComponent = <SelectFilter scatter={scatter} />;
      break;
    case filterConstants.SEARCH:
      filterComponent = <NearestNeighbor />;
      break;
  }

  return (
    <div className={styles.container}>
      <div className={styles.actionsContainer}>
        <Button
          onClick={toggleFilter}
          className={`${styles.actionsButton} ${activeFilterTab === filterConstants.CLUSTER ? styles.active : styles.notActive}`}
          size="small"
          icon="filter"
          text={`Filter by Cluster (${clusterFilter?.clusterIndices?.length})`}
          color="secondary"
          title="Filter data points by cluster"
        />

        {columnFilter.columnFilters?.length > 0 && (
          <Button
            onClick={toggleColumn}
            className={`${styles.actionsButton} ${activeFilterTab === filterConstants.COLUMN ? styles.active : styles.notActive}`}
            size="small"
            icon="columns"
            text={`Filter by Column (${columnFilter?.columnIndices?.length})`}
            color="secondary"
            title="Filter data points by column"
          />
        )}

        <Button
          onClick={toggleSelect}
          className={`${styles.actionsButton} ${activeFilterTab === filterConstants.SELECT ? styles.active : styles.notActive}`}
          size="small"
          icon="crosshair"
          text={`Select (${selectedIndices?.length})`}
          color="secondary"
          title="Annotate"
        />

        <Button
          onClick={toggleSearch}
          className={`${styles.actionsButton} ${activeFilterTab === filterConstants.SEARCH ? styles.active : styles.notActive}`}
          size="small"
          icon="search"
          text={`Search (${searchFilter?.searchIndices?.length})`}
          color="secondary"
          title="Search"
        />

        {features?.length ? (
          <Button
            onClick={toggleFeature}
            className={`${styles.actionsButton} ${activeFilterTab === filterConstants.FEATURE ? styles.active : styles.notActive}`}
            size="small"
            icon="compass"
            text={`Feature (${featureFilter?.featureIndices?.length})`}
            color="secondary"
            title="Feature"
          />
        ) : null}
      </div>
      <div className={styles.actionsRow}>{filterComponent}</div>
    </div>
  );
}

// New component for Select filter
function SelectFilter() {
  const { selectedIndices, setSelectedIndices } = useFilter();

  return (
    <div className={`${styles.filterRow} ${selectedIndices?.length ? styles.active : ''}`}>
      {!selectedIndices?.length ? (
        <div className={`${styles.filterCell} ${styles.count}`}>
          Click, or Shift+Drag on the map to filter by points.
        </div>
      ) : (
        <div className={`${styles.filterCell} ${styles.count}`}>
          <span>{selectedIndices?.length} rows</span>
          <Button
            className="deselect"
            onClick={() => {
              setSelectedIndices([]);
            }}
            icon="x"
            color="secondary"
          />
        </div>
      )}
    </div>
  );
}
