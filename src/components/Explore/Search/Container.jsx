// SearchContainer.jsx
import React, { useState } from 'react';
import Input from './Input';
import SuggestionsPanel from './SuggestionsPanel';
import NearestNeighborResults from './NearestNeighbor';
import FilterResults from './Filters';

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
    if (val === '') {
      setSuggestions([]);
    }
  };

  const [isInputFocused, setIsInputFocused] = useState(false);

  // Handle when a user selects a suggestion from the SuggestionsPanel
  const handleSuggestionSelect = (suggestion) => {
    setQuery(suggestion);
  };

  const handleInputFocus = () => {
    console.log('input focused');
    setIsInputFocused(true);
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  return (
    <div className="search-container">
      {/* SearchInput receives the current query and change handler */}
      <input
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="Search dataset for..."
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />

      {/* Show SuggestionsPanel only when input is focused and there's no query */}
      {query === '' && isInputFocused && (
        <SuggestionsPanel suggestions={suggestions} onSelect={handleSuggestionSelect} />
      )}

      {/* When a query exists, show the NN search result and filter options */}
      {query !== '' && (
        <>
          {/* NearestNeighborResults performs and displays the vector search based on the query */}
          <NearestNeighborResults query={query} />
          {/* FilterResults displays grouped filter options like Clusters and Features */}
          <FilterResults query={query} />
        </>
      )}
    </div>
  );
};

export default Container;
