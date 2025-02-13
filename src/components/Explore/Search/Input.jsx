// SearchInput.jsx
import React from 'react';

/*
 * SearchInput renders a basic text input for the user to enter a search query.
 * It calls the onChange handler (passed from SearchContainer) on each keystroke.
 */
const SearchInput = ({ value, onChange }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="Search..."
  />
);

export default SearchInput;
