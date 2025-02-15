// SearchContainer.jsx
import React, { useState, useRef, useEffect } from 'react';
import SuggestionsPanel from './SuggestionsPanel';
import { Button } from 'react-element-forge';

import SearchResults from './SearchResults';
import { useScope } from '../../../contexts/ScopeContext';
import styles from './Container.module.scss';
import { useFilter } from '../../../contexts/FilterContext';
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

  const { clusterLabels } = useScope();
  const {
    searchFilter,
    featureFilter,
    clusterFilter,
    setAnyFilterActive,
    searchQuery,
    setSearchQuery,
  } = useFilter();

  // Handle updates to the search query from the input field
  const handleInputChange = (val) => {
    setSearchQuery(val);
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
    setSearchQuery(suggestion);
    setIsInputFocused(false); // Hide results after selection
  };

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

  const [dropdownIsOpen, setDropdownIsOpen] = useState(true);
  const selectRef = useRef(null);

  const [hasSelection, setHasSelection] = useState(false);

  const handleSelect = (selection) => {
    setHasSelection(true);
    setDropdownIsOpen(false);
    setAnyFilterActive(true);
    setSelection(selection);

    const { type, value, label } = selection;
    setSearchQuery(label);

    if (type === 'cluster') {
      const { setCluster } = clusterFilter;
      const cluster = clusterLabels[value];
      if (cluster) {
        setCluster(cluster);
      }
    } else if (type === 'feature') {
      const { setFeature } = featureFilter;
      setFeature(value);
    } else if (type === 'search') {
      const { setSearchText } = searchFilter;
      setSearchText(value);
    }
  };

  // TODO: update query in url params

  // if (cluster !== value) {
  //   setUrlParams((prev) => {
  //     prev.set('cluster', value);
  //     return prev;
  //   });
  // }

  const handleClear = () => {
    const { type } = selection;
    if (type === 'search') {
      const { setSearchText, setDistances } = searchFilter;
      setSearchText('');
      setDistances([]);
    }

    setSearchQuery('');
    setHasSelection(false);
    setDropdownIsOpen(false);
    setAnyFilterActive(false);
    setSelection(null);
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchBarContainer}>
        {/* SearchInput receives the current query and change handler */}
        <div className={styles.inputWrapper}>
          <input
            className={styles.searchInput}
            type="text"
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search dataset for..."
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
          {hasSelection && (
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
        {searchQuery !== '' && (
          <div className={styles.searchResults} ref={selectRef}>
            <div className={styles.searchResultsHeader}>
              <SearchResults
                query={searchQuery}
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
            Default (showing first {shownIndices.length} rows in dataset):{` `}
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
