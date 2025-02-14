// SearchContainer.jsx
import React, { useState, useRef, useEffect } from 'react';
import SuggestionsPanel from './SuggestionsPanel';
import NearestNeighborResults from './NearestNeighbor';
import FilterResults from './Filters';
import SearchResults from './SearchResults';
import styles from './Container.module.scss';
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
  const [suggestions, setSuggestions] = useState([
    'sentiment',
    'keywords',
    'entities',
    'topics',
    'summary',
  ]);

  // Handle updates to the search query from the input field
  const handleInputChange = (val) => {
    setQuery(val);
    // Optionally update suggestions based on the current input value

    // re-open the dropdown whenever the query changes
    setDropdownIsOpen(true);
  };

  const handleInputFocus = () => {
    console.log('input focused');
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

  // dropdown related state.
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

  return (
    <div className={styles.searchContainer}>
      {/* SearchInput receives the current query and change handler */}
      <input
        className={styles.searchInput}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="Search dataset for..."
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />

      {/* Show SuggestionsPanel only when input is focused and there's no query */}
      {/* {query === '' && isInputFocused && (
        <div className={styles.searchResults} ref={selectRef}>
          <SuggestionsPanel suggestions={suggestions} onSelect={handleSuggestionSelect} />
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
            />
          </div>
          {/* NearestNeighborResults performs and displays the vector search based on the query */}
          {/* <NearestNeighborResults query={query} /> */}
          {/* FilterResults displays grouped filter options like Clusters and Features */}
          {/* <FilterResults query={query} /> */}
        </div>
      )}
    </div>
  );
};

export default Container;
