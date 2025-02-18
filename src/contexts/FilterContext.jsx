// FilterContext.js
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScope } from './ScopeContext'; // Assuming this provides scopeRows, deletedIndices, etc.
import useColumnFilter from '../hooks/useColumnFilter';
import useNearestNeighborsSearch from '../hooks/useNearestNeighborsSearch';
import useClusterFilter from '../hooks/useClusterFilter';
import useFeatureFilter from '../hooks/useFeatureFilter';

import {
  filterConstants,
  findFeatureLabel,
  validateColumnAndValue,
} from '../components/Explore/Search/utils';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  // Global filter config: { type, value } or null when no filter is active.
  const [filterConfig, setFilterConfig] = useState(null);
  const [filteredIndices, setFilteredIndices] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState(''); // Optional query string for UI
  const [filterActive, setFilterActive] = useState(false);

  const [urlParams, setUrlParams] = useSearchParams();
  // Pull shared data from a higher-level context.
  const {
    features,
    scopeRows,
    deletedIndices,
    userId,
    datasetId,
    scope,
    scopeLoaded,
    clusterLabels,
  } = useScope();

  // Base set of non-deleted indices from the dataset.
  const baseIndices = useMemo(() => {
    return scopeRows.map((row) => row.ls_index).filter((index) => !deletedIndices.includes(index));
  }, [scopeRows, deletedIndices]);

  // Column filter
  const columnFilter = useColumnFilter(userId, datasetId, scope);
  const featureFilter = useFeatureFilter({ userId, datasetId, scope, scopeLoaded });
  const clusterFilter = useClusterFilter({ scopeRows, scope, scopeLoaded });
  const searchFilter = useNearestNeighborsSearch({ userId, datasetId, scope, deletedIndices });

  // Populate filter state from url params
  useEffect(() => {
    if (!scopeLoaded) return;

    // let's just grab the first key for now
    const key = urlParams.keys().next().value;
    const value = urlParams.get(key);
    const numericValue = parseInt(value);

    if (key === filterConstants.SEARCH) {
      setFilterQuery(value);
      setFilterConfig({ type: filterConstants.SEARCH, value, label: value });
    } else if (key === filterConstants.CLUSTER) {
      const cluster = clusterLabels.find((cluster) => cluster.cluster === numericValue);
      if (cluster) {
        const { setCluster } = clusterFilter;
        setCluster(cluster);
        setFilterQuery(cluster.label);
        setFilterConfig({
          type: filterConstants.CLUSTER,
          value: numericValue,
          label: cluster.label,
        });
      }
    } else if (key === filterConstants.FEATURE) {
      const featureLabel = findFeatureLabel(features, numericValue);
      if (featureLabel) {
        const { setFeature } = featureFilter;
        setFeature(numericValue);
        setFilterQuery(featureLabel);
        setFilterConfig({
          type: filterConstants.FEATURE,
          value: numericValue,
          label: featureLabel,
        });
      }
    } else if (urlParams.has('column') && urlParams.has('value')) {
      const value = urlParams.get('value');
      const column = urlParams.get('column');
      const { columnFilters } = columnFilter;
      if (validateColumnAndValue(column, value, columnFilters)) {
        setFilterQuery(`${column}: ${value}`);
        setFilterConfig({
          type: filterConstants.COLUMN,
          value,
          column,
          label: `${column}: ${value}`,
        });
      }
    }
  }, [features, urlParams, scopeLoaded]);

  // ==== Filtering ====
  // compute filteredIndices based on the active filter.
  useEffect(() => {
    async function applyFilter() {
      setLoading(true);
      let indices = [];
      // If no filter is active, use the full baseIndices.
      if (!filterConfig) {
        indices = baseIndices;
      } else {
        const { type, value } = filterConfig;

        switch (type) {
          case filterConstants.CLUSTER: {
            const { setCluster, filter } = clusterFilter;
            const cluster = clusterLabels.find((cluster) => cluster.cluster === value);
            if (cluster) {
              setCluster(cluster);
              indices = filter(cluster);
            }
            break;
          }
          case filterConstants.SEARCH: {
            const { setSearchText, filter } = searchFilter;
            setSearchText(value);
            indices = await filter();
            break;
          }
          case filterConstants.FEATURE: {
            const { setFeature, filter } = featureFilter;
            const featureLabel = findFeatureLabel(features, parseInt(value));
            if (featureLabel) {
              setFeature(value);
              indices = await filter();
            }
            break;
          }
          case filterConstants.COLUMN: {
            const { filter } = columnFilter;
            const { column } = filterConfig;
            indices = await filter(column, value);
            break;
          }
          default: {
            indices = baseIndices;
          }
        }
      }
      setFilteredIndices(indices);
      setPage(0); // Reset to first page when filter changes.
      setLoading(false);
    }
    if (scopeLoaded) {
      applyFilter();
    }
  }, [filterConfig, baseIndices, scopeRows, deletedIndices, userId, datasetId, scope, scopeLoaded]);

  // === Pagination ===
  const ROWS_PER_PAGE = 20;
  const totalPages = useMemo(
    () => Math.ceil(filteredIndices.length / ROWS_PER_PAGE),
    [filteredIndices]
  );
  const shownIndices = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return filteredIndices.slice(start, start + ROWS_PER_PAGE);
  }, [filteredIndices, page]);

  // The context exposes only the state and setters that consumer components need.
  const value = {
    // Filter configuration state.
    filterConfig,
    setFilterConfig,
    filterQuery,
    setFilterQuery,

    // Filtered indices and pagination state.
    filteredIndices, // Complete set of indices after filtering.
    shownIndices, // Paginated indices for table views.
    page,
    setPage,
    totalPages,
    ROWS_PER_PAGE,

    loading,
    filterActive,
    setFilterActive,

    searchFilter,
    // distances
    // searchText (shouldn't need this)

    clusterFilter,
    // cluster

    featureFilter,
    // feature
    // setFeature (needed by the Feature modal)
    // threshold

    columnFilter,
    // columnToValue
    // columnFilters
    // columnIndices

    setUrlParams,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
