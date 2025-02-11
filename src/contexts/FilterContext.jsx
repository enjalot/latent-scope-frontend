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

  // Core pagination state
  const ROWS_PER_PAGE = 20;
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [allFilteredIndices, setAllFilteredIndices] = useState([]);
  const [shownIndices, setShownIndices] = useState([]);

  // Base set of non-deleted indices
  const baseIndices = useMemo(() => {
    return scopeRows.map((row) => row.ls_index).filter((index) => !deletedIndices.includes(index));
  }, [scopeRows, deletedIndices]);

  // Filter hooks
  const searchFilter = useNearestNeighborsSearch({
    userId,
    datasetId,
    scope,
    deletedIndices,
    urlParams,
    scopeLoaded,
    setFilteredIndices: setAllFilteredIndices,
  });

  // Determine if any filter is active
  const anyFilterActive = useMemo(() => {
    return (
      // urlParams.has('cluster') ||
      // urlParams.has('feature') ||
      urlParams.has('search') || searchFilter.active
    );
  }, [searchFilter.active, urlParams]);

  // Reset page when filter status changes
  useEffect(() => {
    setPage(0);
  }, [anyFilterActive]);

  // Update total pages whenever base indices change
  useEffect(() => {
    setTotalPages(Math.ceil(allFilteredIndices.length / ROWS_PER_PAGE));
  }, [allFilteredIndices]);

  // Update shown indices when page or allFilteredIndices changes
  useEffect(() => {
    const start = page * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    setShownIndices(allFilteredIndices.slice(start, end));
  }, [page, allFilteredIndices]);

  // Set default indices when no filter is active
  useEffect(() => {
    if (!anyFilterActive) {
      setAllFilteredIndices(baseIndices);
    }
  }, [anyFilterActive, baseIndices]);

  const clusterFilter = useClusterFilter({
    scopeRows,
    scope,
    scopeLoaded,
    urlParams,
    setFilteredIndices: setAllFilteredIndices,
  });
  const columnFilter = useColumnFilter(userId, datasetId, scope);

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
      setAllFilteredIndices(nonDeletedDataTableIndices);
      const paged = nonDeletedDataTableIndices.slice(
        page * ROWS_PER_PAGE,
        (page + 1) * ROWS_PER_PAGE
      );
      setShownIndices(paged);
      // setPage(0);
    }
  }, [scopeRows, deletedIndices, setAllFilteredIndices, page, setShownIndices, , setTotalPages]);

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

  const filterLoading = useMemo(() => {
    return (
      // clusterFilter.loading || featureFilter.loading || searchFilter.loading || columnFilter.loading
      searchFilter.loading
    );
  }, [searchFilter.loading]);

  const value = {
    // activeFilterTab,
    // setActiveFilterTab,
    allFilteredIndices,
    setAllFilteredIndices,
    shownIndices,
    setShownIndices,

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

    // columnFilter,
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
    dataTableIndices: shownIndices, // indices that will be shown in the table view

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
