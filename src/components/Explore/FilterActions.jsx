import React from 'react';
import styles from './FilterActions.module.scss';
import { Button } from 'react-element-forge';
import ClusterFilter from './ClusterFilter';
import ColumnFilter from './ColumnFilter';
import NearestNeighbor from './NearestNeighbor';
import FeatureFilter from './FeatureFilter';
import { useFilter } from '../../contexts/FilterContext';

export default function FilterActions({ clusterLabels, scatter, scope, dataset }) {
  const {
    activeFilterTab,
    toggleSearch,
    toggleFilter,
    toggleSelect,
    toggleColumn,
    toggleFeature,
    clusterIndices,
    columnFilterIndices,
    selectedIndices,
    searchIndices,
    featureIndices,
    features,
    columnFilters,
    filterConstants
  } = useFilter();

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
          className={`${styles.actionsButton} ${activeFilterTab === 'CLUSTER' ? styles.active : styles.notActive}`}
          size="small"
          icon="filter"
          text={`Filter by Cluster (${clusterIndices?.length})`}
          color="secondary"
          title="Filter data points by cluster"
        />

        {columnFilters?.length > 0 && (
          <Button
            onClick={toggleColumn}
            className={`${styles.actionsButton} ${activeFilterTab === 'COLUMN' ? styles.active : styles.notActive}`}
            size="small"
            icon="columns"
            text={`Filter by Column (${columnFilterIndices?.length})`}
            color="secondary"
            title="Filter data points by column"
          />
        )}

        <Button
          onClick={toggleSelect}
          className={`${styles.actionsButton} ${activeFilterTab === 'SELECT' ? styles.active : styles.notActive}`}
          size="small"
          icon="crosshair"
          text={`Select (${selectedIndices?.length})`}
          color="secondary"
          title="Annotate"
        />

        <Button
          onClick={toggleSearch}
          className={`${styles.actionsButton} ${activeFilterTab === 'SEARCH' ? styles.active : styles.notActive}`}
          size="small"
          icon="search"
          text={`Search (${searchIndices?.length})`}
          color="secondary"
          title="Search"
        />

        {features?.length ? (
          <Button
            onClick={toggleFeature}
            className={`${styles.actionsButton} ${activeFilterTab === 'FEATURE' ? styles.active : styles.notActive}`}
            size="small"
            icon="search"
            text={`Feature (${featureIndices?.length})`}
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
function SelectFilter({ scatter }) {
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
              scatter?.select([]);
            }}
            icon="x"
            color="secondary"
          />
        </div>
      )}
    </div>
  );
}
