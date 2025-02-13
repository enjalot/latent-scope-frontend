import React from 'react';
import PropTypes from 'prop-types';
import Select, { components } from 'react-select';
import styles from './SearchResults.module.scss';
import { useState, useRef, useEffect } from 'react';

import { useFilter } from '../../../contexts/FilterContext';

// Custom Option component to maintain our styling
const Option = ({ children, ...props }) => {
  return (
    <components.Option {...props}>
      <div className={styles.resultContent}>{children}</div>
    </components.Option>
  );
};

// Custom Menu component to add our search button at the top
const Menu = ({ children, ...props }) => {
  const { selectProps } = props;
  const { query, setMenuIsOpen } = selectProps;

  const { allFilteredIndices, searchFilter, setUrlParams, shownIndices } = useFilter();
  const { loading, setSearchText, clearSearch, active } = searchFilter;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSearchText(query);
    setMenuIsOpen(false);
    setUrlParams((prev) => {
      prev.set('search', query);
      return prev;
    });
  };

  const handleClear = () => {
    clearSearch();
    setUrlParams((prev) => {
      prev.delete('search');
      return prev;
    });
  };

  return (
    <components.Menu {...props}>
      <div className={styles.resultsList}>
        {/* Nearest Neighbor Search Option */}
        <div className={styles.resultRow} onClick={handleSubmit}>
          <div className={styles.resultContent}>
            <span className={styles.searchIcon}>🔍</span>
            <span>Search for similar content to: "{query}"</span>
          </div>
        </div>
        {/* Regular Select Options */}
        {children}
      </div>
    </components.Menu>
  );
};

const SearchResults = ({ query, onSearch }) => {
  // Example options - replace with your actual options
  const options = [
    { value: 'cluster1', label: 'Cluster: Result 1', type: 'cluster' },
    { value: 'cluster2', label: 'Cluster: Result 2', type: 'cluster' },
    { value: 'feature1', label: 'Feature: Result 1', type: 'feature' },
    { value: 'feature2', label: 'Feature: Result 2', type: 'feature' },
  ];

  const [menuIsOpen, setMenuIsOpen] = useState(true);
  const selectRef = useRef(null);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setMenuIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const customStyles = {
    control: () => ({
      display: 'none', // Hide the control since we're using our own input
    }),
    menu: (base) => ({
      ...base,
      border: 'none',
      boxShadow: 'none',
      backgroundColor: 'transparent',
      position: 'static',
    }),
    option: (base, state) => ({
      ...base,
      padding: '8px 16px',
      backgroundColor: state.isFocused ? 'var(--neutrals-color-neutral-1)' : 'transparent',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: 'var(--neutrals-color-neutral-1)',
      },
    }),
    menuList: (base) => ({
      ...base,
      padding: 0,
    }),
  };

  return (
    <div ref={selectRef}>
      <Select
        options={options}
        components={{ Option, Menu }}
        styles={customStyles}
        query={query} // Props that are passed to the Menu component
        setMenuIsOpen={setMenuIsOpen} // Props that are passed to the Menu component
        menuIsOpen={menuIsOpen}
        onMenuOpen={() => setMenuIsOpen(true)}
        onMenuClose={() => setMenuIsOpen(false)}
        onChange={() => setMenuIsOpen(false)} // Close on selection
        controlShouldRenderValue={false}
        filterOption={(option, inputValue) => {
          return option.label.toLowerCase().includes(inputValue.toLowerCase());
        }}
      />
    </div>
  );
};

SearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
};

export default SearchResults;