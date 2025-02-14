// SearchContainer.jsx
import React, { useState, useRef, useEffect } from 'react';
import SuggestionsPanel from './SuggestionsPanel';
import { Button } from 'react-element-forge';
import NearestNeighborResults from './NearestNeighbor';
import FilterResults from './Filters';
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
  const [query, setQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const { clusterMap, clusterLabels } = useScope();
  const { searchFilter, featureFilter, clusterFilter, setUrlParams } = useFilter();

  const { setAnyFilterActive } = useFilter();

  // Handle updates to the search query from the input field
  const handleInputChange = (val) => {
    setQuery(val);
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
    setQuery(suggestion);
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
    console.log('Selection made:', selection);
    setHasSelection(true);
    setDropdownIsOpen(false);
    setAnyFilterActive(true);

    // TODO: Add logic to update search indices here
    // here we need to apply the relevant filters.

    const { type, value } = selection;

    console.log('selection', selection);

    if (type === 'cluster') {
      const { setCluster } = clusterFilter;
      const cluster = clusterLabels[value];
      if (cluster) {
        setCluster(cluster);
      }
    } else if (type === 'feature') {
      const { setFeature } = featureFilter;
      console.log('===setting feature===', value);
      setFeature(value);
    } else if (type === 'search') {
      const { setSearchText } = searchFilter;
      console.log('===setting search text===', value);
      setSearchText(value);
    }
  };

  // if (cluster !== value) {
  //   setUrlParams((prev) => {
  //     prev.set('cluster', value);
  //     return prev;
  //   });
  // }

  const handleClear = () => {
    setQuery('');
    setHasSelection(false);
    setDropdownIsOpen(false);
    setAnyFilterActive(false);
  };

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchBarContainer}>
        {/* SearchInput receives the current query and change handler */}
        <div className={styles.inputWrapper}>
          <input
            className={styles.searchInput}
            type="text"
            value={query}
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
        {query !== '' && (
          <div className={styles.searchResults} ref={selectRef}>
            <div className={styles.searchResultsHeader}>
              <SearchResults
                query={query}
                setDropdownIsOpen={setDropdownIsOpen}
                dropdownIsOpen={dropdownIsOpen}
                onSelect={handleSelect}
              />
            </div>
            {/* NearestNeighborResults performs and displays the vector search based on the query */}
            {/* <NearestNeighborResults query={query} /> */}
            {/* FilterResults displays grouped filter options like Clusters and Features */}
            {/* <FilterResults query={query} /> */}
          </div>
        )}
      </div>
      <SearchResultsMetadata />
    </div>
  );
};

const SearchResultsMetadata = () => {
  const { shownIndices } = useFilter();

  return (
    <div className={styles.searchResultsMetadata}>
      <div className={styles.searchResultsMetadataItem}>
        <span className={styles.searchResultsMetadataLabel}>Total Results: </span>
        <span className={styles.searchResultsMetadataValue}>{shownIndices.length}</span>
      </div>
    </div>
  );
};

export default Container;
