// SearchContainer.jsx
import React, { useState, useRef, useEffect } from 'react';
import SuggestionsPanel from './SuggestionsPanel';
import { Button } from 'react-element-forge';
import { useSearchParams } from 'react-router-dom';

import SearchResults from './SearchResults';
import { useScope } from '../../../contexts/ScopeContext';
import styles from './Container.module.scss';
import { useFilter } from '../../../contexts/FilterContext';
import { filterConstants } from './utils';
/*
 * SearchContainer is the main parent component that manages the overall search state.
 * It holds the current query and suggestion data, and conditionally renders subcomponents.
 *
 * - When the query is empty, it shows the SuggestionsPanel for general search suggestions.
 * - When a query is present, it always renders:
 *    1. NearestNeighborResults: to display the NN search result based on the query.
 *    2. FilterResults: to display grouped filter options (e.g., Clusters, Features) related to the query.
 */
const Container = () => {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selection, setSelection] = useState(null);

  const { clusterLabels, scopeLoaded } = useScope();
  const {
    searchFilter,
    featureFilter,
    clusterFilter,
    setAnyFilterActive,
    filterQuery,
    setFilterQuery,
    columnFilter,
  } = useFilter();

  // Handle updates to the search query from the input field
  const handleInputChange = (val) => {
    setFilterQuery(val);
    // Optionally update suggestions based on the current input value

    // re-open the dropdown whenever the query changes
    setDropdownIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  // Handle when a user selects a suggestion from the SuggestionsPanel
  const handleSuggestionSelect = (suggestion) => {
    setFilterQuery(suggestion);
    setIsInputFocused(false); // Hide results after selection
  };

  // ==== URL PARAMS ====

  const [urlParams, setUrlParams] = useSearchParams();

  // need to initialize the filter state from the url params on first render
  // maybe this should be done in the FilterProvider?
  useEffect(() => {
    if (!scopeLoaded) return;

    // let's just grab the first key for now
    const key = urlParams.keys().next().value;
    const value = urlParams.get(key);

    if (key === filterConstants.SEARCH) {
      const { setSearchText } = searchFilter;
      setSearchText(value);
      setFilterQuery(value);
    } else if (key === filterConstants.CLUSTER) {
      const { setCluster } = clusterFilter;
      const cluster = clusterLabels.find((cluster) => cluster.cluster === parseInt(value));
      if (cluster) {
        setCluster(cluster);
        setFilterQuery(cluster.label);
      }
    } else if (key === filterConstants.FEATURE) {
      const { setFeature } = featureFilter;
      setFeature(value);
    } else if (key === filterConstants.COLUMN) {
      const { setColumnFiltersActive } = columnFilter;
      // const
      // setColumnFiltersActive({ [column]: value });
    }

    const anyFilterActive = [
      filterConstants.CLUSTER,
      filterConstants.FEATURE,
      filterConstants.COLUMN,
      filterConstants.SEARCH,
    ].some((filter) => key === filter);

    setAnyFilterActive(anyFilterActive);

    if (anyFilterActive) {
      const selection = {
        type: key,
        value: value,
        label: value,
      };
      setSelection(selection);
    }
  }, [
    urlParams,
    scopeLoaded,
    searchFilter,
    clusterFilter,
    featureFilter,
    columnFilter,
    setAnyFilterActive,
  ]);

  // ==== DROPDOWN RELATED STATE ====
  // we need to manage this here because we need to re-open the dropdown whenever the query changes.

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setDropdownIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
  const selectRef = useRef(null);

  const handleSelect = (selection) => {
    setDropdownIsOpen(false);
    setAnyFilterActive(true);
    setSelection(selection);

    const { type, value, label, column } = selection;
    setFilterQuery(label);

    if (type === filterConstants.CLUSTER) {
      const { setCluster } = clusterFilter;
      const cluster = clusterLabels[value];
      if (cluster) {
        setCluster(cluster);
      }
    } else if (type === filterConstants.FEATURE) {
      const { setFeature } = featureFilter;
      setFeature(value);
    } else if (type === filterConstants.SEARCH) {
      const { setSearchText } = searchFilter;
      setSearchText(value);
    } else if (type === filterConstants.COLUMN) {
      const { setColumnFiltersActive } = columnFilter;
      setColumnFiltersActive({ [column]: value });
    }

    setUrlParams((prev) => {
      if (type === filterConstants.COLUMN) {
        prev.set('column', column);
        prev.set('value', value);
      } else {
        prev.set(type, value);
      }
      return prev;
    });
  };

  const handleClear = () => {
    const { type } = selection;
    if (type === filterConstants.SEARCH) {
      const { setSearchText, setDistances } = searchFilter;
      setSearchText('');
      setDistances([]);
    }

    setFilterQuery('');
    setDropdownIsOpen(false);
    setAnyFilterActive(false);
    setSelection(null);

    // delete all filter params from the url
    setUrlParams((prev) => {
      prev.delete('cluster');
      prev.delete('feature');
      prev.delete('search');
      prev.delete('column');
      prev.delete('value');
      return new URLSearchParams(prev);
    });
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchBarContainer}>
        {/* SearchInput receives the current query and change handler */}
        <div className={styles.inputWrapper}>
          <input
            className={styles.searchInput}
            type="text"
            value={filterQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search dataset for..."
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
          {selection !== null && (
            <Button
              color="secondary"
              className={styles.searchButton}
              //   disabled={loading}
              onClick={handleClear}
              //   icon={loading ? 'pie-chart' : active ? 'x' : 'search'}
              icon="x"
            />
          )}
        </div>

        {/* Show SuggestionsPanel only when input is focused and there's no query */}
        {/* {query === '' && isInputFocused && (
          <div className={styles.searchResults} ref={selectRef}>
            <SuggestionsPanel onSelect={handleSuggestionSelect} />
          </div>
        )} */}

        {/* When a query exists, show the NN search result and filter options */}
        {filterQuery !== '' && (
          <div className={styles.searchResults} ref={selectRef}>
            <div className={styles.searchResultsHeader}>
              <SearchResults
                query={filterQuery}
                onSelect={handleSelect}
                menuIsOpen={dropdownIsOpen}
              />
            </div>
          </div>
        )}
      </div>
      <SearchResultsMetadata selection={selection} />
    </div>
  );
};

const SearchResultsMetadata = ({ selection }) => {
  const { shownIndices, allFilteredIndices } = useFilter();

  // if no selection, show the default metadata
  if (!selection) {
    return (
      <div className={styles.searchResultsMetadata}>
        <div className={styles.searchResultsMetadataItem}>
          <span className={styles.searchResultsMetadataLabel}>
            Showing first {shownIndices.length} rows in dataset:
          </span>
        </div>
        <div className={styles.searchResultsMetadataItem}>
          <span className={styles.searchResultsMetadataValue}>{shownIndices.length} results</span>
        </div>
      </div>
    );
  }

  const { type, label } = selection;

  const totalResults = allFilteredIndices.length;
  const headerLabel = type === 'cluster' ? 'Cluster' : type === 'feature' ? 'Feature' : 'Search';

  return (
    <div className={styles.searchResultsMetadata}>
      <div className={styles.searchResultsMetadataItem}>
        <span className={styles.searchResultsMetadataLabel}>{headerLabel}: </span>
        <span className={styles.searchResultsMetadataValue}>{label}</span>
      </div>
      <div className={styles.searchResultsMetadataItem}>
        <span className={styles.searchResultsMetadataLabel}>Total Rows: </span>
        <span className={styles.searchResultsMetadataValue}>{totalResults}</span>
      </div>
    </div>
  );
};

export default Container;
