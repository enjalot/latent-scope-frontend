import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useScope } from './ScopeContext';
import useColumnFilter from '../hooks/useColumnFilter';
import useNearestNeighborsSearch from '../hooks/useNearestNeighborsSearch';
import useClusterFilter from '../hooks/useClusterFilter';
import useFeatureFilter from '../hooks/useFeatureFilter';
export const SEARCH = 'search';
export const CLUSTER = 'filter';
export const SELECT = 'select';
export const COLUMN = 'column';
export const FEATURE = 'feature';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [urlParams, setUrlParams] = useSearchParams();

  const { scopeRows, deletedIndices, dataset, datasetId, userId, scope, scopeLoaded } = useScope();

  const [activeFilterTab, setActiveFilterTab] = useState(CLUSTER);
  const [filteredIndices, setFilteredIndices] = useState([]);
  const [defaultIndices, setDefaultIndices] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);

  const clusterFilter = useClusterFilter({
    scopeRows,
    scope,
    scopeLoaded,
    urlParams,
  });
  const columnFilter = useColumnFilter(userId, datasetId, scope);
  const searchFilter = useNearestNeighborsSearch({
    userId,
    datasetId,
    scope,
    deletedIndices,
    urlParams,
    scopeLoaded,
  });
  const featureFilter = useFeatureFilter({
    userId,
    datasetId,
    scope,
    urlParams,
    scopeLoaded,
  });

  // Toggle functions
  const toggleSearch = () => setActiveFilterTab((prev) => (prev === SEARCH ? null : SEARCH));
  const toggleFilter = () => setActiveFilterTab((prev) => (prev === CLUSTER ? null : CLUSTER));
  const toggleSelect = () => setActiveFilterTab((prev) => (prev === SELECT ? null : SELECT));
  const toggleColumn = () => setActiveFilterTab((prev) => (prev === COLUMN ? null : COLUMN));
  const toggleFeature = () => setActiveFilterTab((prev) => (prev === FEATURE ? null : FEATURE));

  // Update defaultIndices when scopeRows changes
  useEffect(() => {
    if (scopeRows?.length) {
      const indexes = scopeRows
        .filter((row) => !deletedIndices.includes(row.ls_index))
        .map((row) => row.ls_index);
      setDefaultIndices(indexes);
      setFilteredIndices([]);
    }
  }, [scopeRows, deletedIndices]);

  // Update filtered indices based on active filter
  useEffect(() => {
    switch (activeFilterTab) {
      case CLUSTER:
        setFilteredIndices(clusterFilter.clusterIndices);
        break;
      case SEARCH:
        setFilteredIndices(searchFilter.searchIndices);
        break;
      case SELECT:
        setFilteredIndices(selectedIndices);
        break;
      case COLUMN:
        setFilteredIndices(columnFilter.columnIndices);
        break;
      case FEATURE:
        setFilteredIndices(featureFilter.featureIndices);
        break;
      default:
        setFilteredIndices(defaultIndices);
    }
  }, [
    activeFilterTab,
    clusterFilter.clusterIndices,
    searchFilter.searchIndices,
    selectedIndices,
    columnFilter.columnIndices,
    featureFilter.featureIndices,
    defaultIndices,
  ]);

  // Update active tab based on URL params, but only on first load.
  // We only do this on first load to prevent us from switching tabs unintentionally when the URL params are removed
  // (e.g. when a filter is removed through the UI)
  useEffect(() => {
    if (urlParams.has('cluster')) {
      setActiveFilterTab(CLUSTER);
    } else if (urlParams.has('feature')) {
      setActiveFilterTab(FEATURE);
    } else if (urlParams.has('search')) {
      setActiveFilterTab(SEARCH);
    }
  }, []);

  const useDefaultIndices = useMemo(() => {
    if (activeFilterTab === CLUSTER) {
      return urlParams.get('cluster') === null && clusterFilter.cluster === null;
    } else if (activeFilterTab === FEATURE) {
      return urlParams.get('feature') === null && featureFilter.feature === null;
    } else if (activeFilterTab === SEARCH) {
      return urlParams.get('search') === null && searchFilter.searchText === '';
    } else if (activeFilterTab === SELECT) {
      return urlParams.get('select') === null && selectedIndices.length === 0;
    } else if (activeFilterTab === COLUMN) {
      return urlParams.get('column') === null && columnFilter.columnIndices.length === 0;
    }

    return false;
  }, [
    activeFilterTab,
    urlParams,
    clusterFilter.clusterIndices,
    featureFilter.featureIndices,
    searchFilter.searchIndices,
    selectedIndices,
    columnFilter.columnIndices,
  ]);

  const value = {
    activeFilterTab,
    setActiveFilterTab,
    filteredIndices,
    setFilteredIndices,
    defaultIndices,
    setDefaultIndices,
    selectedIndices,
    setSelectedIndices,

    featureFilter,
    // featureIndices,
    // setFeatureIndices,
    // feature,
    // setFeature,
    // threshold,
    // setThreshold,

    searchFilter,
    // searchIndices,
    // searchLoading,
    // distances,
    // clearSearch,

    clusterFilter,
    // setCluster,

    columnFilter,
    // columnFiltersActive,
    // setColumnFiltersActive,
    // columnFilters,
    // columnIndices,

    toggleSearch,
    toggleFilter,
    toggleSelect,
    toggleColumn,
    toggleFeature,
    filterConstants: {
      SEARCH,
      CLUSTER,
      SELECT,
      COLUMN,
      FEATURE,
    },
    useDefaultIndices,
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
