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

  const [filteredIndices, setFilteredIndices] = useState([]);

  // indices of the points that are currently centered in the view
  // these should be shown if the user has not filtered the points,
  // i.e. anyFilterActive is false
  // Currently, ScatterGL is responsible for calculating these indices
  const [centeredIndices, setCenteredIndices] = useState([]);

  // page logic
  const ROWS_PER_PAGE = 10;
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // const clusterFilter = useClusterFilter({
  //   scopeRows,
  const clusterFilter = useClusterFilter({
    scopeRows,
    scope,
    scopeLoaded,
    urlParams,
    setFilteredIndices,
  });
  const columnFilter = useColumnFilter(userId, datasetId, scope);
  const searchFilter = useNearestNeighborsSearch({
    userId,
    datasetId,
    scope,
    deletedIndices,
    urlParams,
    scopeLoaded,
    setFilteredIndices,
  });
  const featureFilter = useFeatureFilter({
    userId,
    datasetId,
    scope,
    urlParams,
    scopeLoaded,
  });

  // Toggle functions
  // const toggleSearch = () => setActiveFilterTab((prev) => (prev === SEARCH ? null : SEARCH));
  // const toggleFilter = () => setActiveFilterTab((prev) => (prev === CLUSTER ? null : CLUSTER));
  // const toggleSelect = () => setActiveFilterTab((prev) => (prev === SELECT ? null : SELECT));
  // const toggleColumn = () => setActiveFilterTab((prev) => (prev === COLUMN ? null : COLUMN));
  // const toggleFeature = () => setActiveFilterTab((prev) => (prev === FEATURE ? null : FEATURE));

  // Determine if any filter is active
  const anyFilterActive = useMemo(() => {
    return (
      urlParams.has('cluster') ||
      urlParams.has('feature') ||
      urlParams.has('search') ||
      clusterFilter.active ||
      searchFilter.active ||
      featureFilter.active ||
      columnFilter.active
    );
  }, [
    clusterFilter.active,
    searchFilter.active,
    featureFilter.active,
    columnFilter.active,
    urlParams,
  ]);

  const dataTableIndices = useMemo(() => {
    if (anyFilterActive) {
      const paged = filteredIndices.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
      setTotalPages(Math.ceil(filteredIndices.length / ROWS_PER_PAGE));
      return paged;
    } else {
      return centeredIndices;
    }
  }, [anyFilterActive, filteredIndices, centeredIndices, page, setTotalPages]);

  const nonDeletedDataTableIndices = useMemo(() => {
    const indexes = scopeRows
      .filter((row) => !deletedIndices.includes(row.ls_index))
      .map((row) => row.ls_index);
    return indexes;
  }, [scopeRows, deletedIndices]);

  // Update defaultIndices when scopeRows changes
  useEffect(() => {
    // where should I be handling that we only want to show the top N points?

    // so whatever indexes that are being set to centerIndicies will control the highlighted points in the umap
    // i.e. if we don't truncate any points, then all of them will be highlighted in the umap

    // then we also have to deal with what is being shown in the table view
    // the table view will take whatever is being set by dataTableIndices (logic above)
    // and then do its own pagination.

    // instinctively i feel like this component should be concerned with handling pagination

    if (scopeRows?.length) {
      const totalPages = Math.ceil(nonDeletedDataTableIndices.length / ROWS_PER_PAGE);
      setTotalPages(totalPages);
      const paged = nonDeletedDataTableIndices.slice(
        page * ROWS_PER_PAGE,
        (page + 1) * ROWS_PER_PAGE
      );
      setCenteredIndices(paged);
    }
  }, [scopeRows, deletedIndices, setCenteredIndices, page, setTotalPages]);

  // // Update filtered indices based on active filter
  // useEffect(() => {
  //   switch (activeFilterTab) {
  //     case CLUSTER:
  //       setFilteredIndices(clusterFilter.clusterIndices);
  //       break;
  //     case SEARCH:
  //       setFilteredIndices(searchFilter.searchIndices);
  //       break;
  //     case SELECT:
  //       setFilteredIndices(selectedIndices);
  //       break;
  //     case COLUMN:
  //       setFilteredIndices(columnFilter.columnIndices);
  //       break;
  //     case FEATURE:
  //       setFilteredIndices(featureFilter.featureIndices);
  //       break;
  //     default:
  //       setFilteredIndices([]);
  //   }
  // }, [
  //   activeFilterTab,
  //   clusterFilter.clusterIndices,
  //   searchFilter.searchIndices,
  //   selectedIndices,
  //   columnFilter.columnIndices,
  //   featureFilter.featureIndices,
  // ]);

  // Update active tab based on URL params, but only on first load.
  // We only do this on first load to prevent us from switching tabs unintentionally when the URL params are removed
  // (e.g. when a filter is removed through the UI)
  useEffect(() => {}, []);

  const filterLoading = useMemo(() => {
    return (
      clusterFilter.loading || featureFilter.loading || searchFilter.loading || columnFilter.loading
    );
  }, [clusterFilter.loading, featureFilter.loading, searchFilter.loading, columnFilter.loading]);

  const value = {
    // activeFilterTab,
    // setActiveFilterTab,
    filteredIndices,
    setFilteredIndices,
    centeredIndices,
    setCenteredIndices,

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

    filterLoading,

    // toggleSearch,
    // toggleFilter,
    // toggleSelect,
    // toggleColumn,
    // toggleFeature,
    filterConstants: {
      SEARCH,
      CLUSTER,
      SELECT,
      COLUMN,
      FEATURE,
    },
    setUrlParams,
    anyFilterActive,
    dataTableIndices, // indices that will be shown in the table view

    page,
    setPage,
    totalPages,
    ROWS_PER_PAGE,
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
