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
  const [suggestions, setSuggestions] = useState([]);

  // Handle updates to the search query from the input field
  const handleInputChange = (val) => {
    setQuery(val);
    // Optionally update suggestions based on the current input value
    if (val === '') {
      setSuggestions([]);
    }
  };

  // Handle when a user selects a suggestion from the SuggestionsPanel
  const handleSuggestionSelect = (suggestion) => {
    setQuery(suggestion);
  };

  return (
    <div className="search-container">
      {/* SearchInput receives the current query and change handler */}
      <Input value={query} onChange={handleInputChange} />

      {/* Show SuggestionsPanel only when there is no active query */}
      {query === '' && (
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
