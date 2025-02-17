import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useScope } from './ScopeContext';
import useColumnFilter from '../hooks/useColumnFilter';
import useNearestNeighborsSearch from '../hooks/useNearestNeighborsSearch';
import useClusterFilter from '../hooks/useClusterFilter';
import useFeatureFilter from '../hooks/useFeatureFilter';
import { filterConstants } from '../components/Explore/Search/utils';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [filterQuery, setFilterQuery] = useState('');

  const [urlParams, setUrlParams] = useSearchParams();
  const { scopeRows, deletedIndices, dataset, datasetId, userId, scope, scopeLoaded } = useScope();

  // Core pagination state
  const ROWS_PER_PAGE = 20;
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filteredIndices, setFilteredIndices] = useState([]);
  const [anyFilterActive, setAnyFilterActive] = useState(false);

  // This is the currently selected filter
  const [selection, setSelection] = useState(null);

  // Base set of non-deleted indices
  const baseIndices = useMemo(() => {
    return scopeRows.map((row) => row.ls_index).filter((index) => !deletedIndices.includes(index));
  }, [scopeRows, deletedIndices]);

  // Derive the indices that will be shown in the table view from the filtered indices
  const shownIndices = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return filteredIndices.slice(start, start + ROWS_PER_PAGE);
  }, [filteredIndices, page]);

  // Update total pages and page state whenever base indices change
  useEffect(() => {
    setTotalPages(Math.ceil(filteredIndices.length / ROWS_PER_PAGE));
    setPage(0);
  }, [filteredIndices]);

  // apply the filters to the base indices
  useEffect(() => {
    if (!anyFilterActive) {
      setFilteredIndices(baseIndices);
    } else {
      // this needs to be a function of the currently active filter.
      const evens = baseIndices.filter((index) => index % 2 === 0);
      setFilteredIndices(evens);
    }
  }, [scopeLoaded, anyFilterActive, baseIndices]);

  // Filter hooks
  const searchFilter = useNearestNeighborsSearch({
    userId,
    datasetId,
    scope,
    deletedIndices,
    urlParams,
    scopeLoaded,
    setFilteredIndices,
  });

  // Update shown indices when page or allFilteredIndices changes
  // useEffect(() => {
  //   const start = page * ROWS_PER_PAGE;
  //   const end = start + ROWS_PER_PAGE;
  //   setShownIndices(allFilteredIndices.slice(start, end));
  // }, [page, allFilteredIndices]);

  // // Set default indices when no filter is active
  // useEffect(() => {
  //   if (!anyFilterActive) {
  //     setAllFilteredIndices(baseIndices);
  //   } else {
  //     setAllFilteredIndices(shownIndices);
  //   }
  // }, [anyFilterActive, baseIndices, shownIndices]);

  const clusterFilter = useClusterFilter({
    scopeRows,
    scope,
    scopeLoaded,
    urlParams,
    setFilteredIndices: setFilteredIndices,
  });
  const columnFilter = useColumnFilter(userId, datasetId, scope, setFilteredIndices);
  const featureFilter = useFeatureFilter({
    userId,
    datasetId,
    scope,
    urlParams,
    scopeLoaded,
    setFilteredIndices,
  });

  // // Update defaultIndices when scopeRows changes
  // useEffect(() => {
  //   // where should I be handling that we only want to show the top N points?

  //   // so whatever indexes that are being set to centerIndicies will control the highlighted points in the umap
  //   // i.e. if we don't truncate any points, then all of them will be highlighted in the umap

  //   // then we also have to deal with what is being shown in the table view
  //   // the table view will take whatever is being set by dataTableIndices (logic above)
  //   // and then do its own pagination.

  //   // instinctively i feel like this component should be concerned with handling pagination

  //   if (scopeRows?.length) {
  //     const totalPages = Math.ceil(nonDeletedDataTableIndices.length / ROWS_PER_PAGE);
  //     setTotalPages(totalPages);
  //     setAllFilteredIndices(nonDeletedDataTableIndices);
  //     const paged = nonDeletedDataTableIndices.slice(
  //       page * ROWS_PER_PAGE,
  //       (page + 1) * ROWS_PER_PAGE
  //     );
  //     setShownIndices(paged);
  //     // setPage(0);
  //   }
  // }, [scopeRows, deletedIndices, setAllFilteredIndices, page, setShownIndices, , setTotalPages]);

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
    allFilteredIndices: filteredIndices,
    setAllFilteredIndices: setFilteredIndices,
    shownIndices,

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
    setUrlParams,
    anyFilterActive,
    setAnyFilterActive,
    dataTableIndices: shownIndices, // indices that will be shown in the table view

    page,
    setPage,
    totalPages,
    ROWS_PER_PAGE,
    filterQuery,
    setFilterQuery,
    selection,
    setSelection,
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
