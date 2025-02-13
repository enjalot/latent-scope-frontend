import React from 'react';
import PropTypes from 'prop-types';
import Select, { components } from 'react-select';
import styles from './SearchResults.module.scss';
import { useState, useRef, useEffect } from 'react';
import { Button } from 'react-element-forge';

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
const NNSearch = ({ children, ...props }) => {
  const { selectProps } = props;
  const { query, setDropdownIsOpen } = selectProps;

  const { allFilteredIndices, searchFilter, setUrlParams, shownIndices } = useFilter();
  const { loading, setSearchText, clearSearch, active } = searchFilter;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSearchText(query);
    setDropdownIsOpen(false);
    setUrlParams((prev) => {
      prev.set('search', query);
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
            <span>Search for nearest neighbors to: "{query}"</span>
          </div>
          {/* <div className={styles.searchButtonContainer}>
            <Button
              color="secondary"
              className={styles.searchButton}
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                active ? handleClear() : handleSubmit(e);
              }}
              icon={loading ? 'pie-chart' : active ? 'x' : 'search'}
            />
          </div> */}
        </div>
        {/* Regular Select Options */}
        {children}
      </div>
    </components.Menu>
  );
};

const SearchResults = ({ query, dropdownIsOpen, setDropdownIsOpen }) => {
  // Example options - replace with your actual options
  const options = [
    { value: 'cluster1', label: 'Cluster: Result 1', type: 'cluster' },
    { value: 'cluster2', label: 'Cluster: Result 2', type: 'cluster' },
    { value: 'feature1', label: 'Feature: Result 1', type: 'feature' },
    { value: 'feature2', label: 'Feature: Result 2', type: 'feature' },
  ];

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
    <Select
      options={options}
      components={{ Option, Menu: NNSearch }}
      styles={customStyles}
      query={query} // Props that are passed to the Menu component
      setDropdownIsOpen={setDropdownIsOpen} // Props that are passed to the Menu component
      menuIsOpen={dropdownIsOpen}
      onMenuOpen={() => true}
      onMenuClose={() => false}
      onChange={() => false} // Close on selection
      controlShouldRenderValue={false}
      filterOption={(option, inputValue) => {
        return option.label.toLowerCase().includes(inputValue.toLowerCase());
      }}
    />
  );
};

SearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
};

export default SearchResults;