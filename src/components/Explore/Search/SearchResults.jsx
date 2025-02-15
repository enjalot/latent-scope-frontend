import React, { useMemo } from 'react';

import PropTypes from 'prop-types';
import Select, { components } from 'react-select';
import styles from './SearchResults.module.scss';
import { useScope } from '../../../contexts/ScopeContext';
import { findFeaturesByQuery, findClustersByQuery } from './utils';

// Custom Option component with group-specific handlers
const Option = ({ children, ...props }) => {
  const { data, selectProps } = props;
  const { setDropdownIsOpen, onSelect } = selectProps;

  const handleClick = (e) => {
    e.preventDefault();

    // Get the group type from the option's parent group
    const groupType = props.options.find((group) =>
      group.options?.some((opt) => opt.value === data.value)
    )?.label;

    let type = groupType === 'Clusters' ? 'cluster' : 'feature';
    onSelect({ type, value: data.value, label: data.label });
    setDropdownIsOpen(false);
  };

  return (
    <div onClick={handleClick}>
      <components.Option {...props}>
        <div className={styles.resultContent}>{children}</div>
      </components.Option>
    </div>
  );
};

// Custom Group component
const Group = ({ children, ...props }) => {
  return <components.Group {...props}>{children}</components.Group>;
};

const customStyles = {
  control: () => ({
    display: 'none',
  }),
  menu: (base) => ({
    ...base,
    border: 'none',
    boxShadow: 'none',
    backgroundColor: 'transparent',
    position: 'static',
  }),
  group: (base) => ({
    ...base,
    padding: '8px 0',
  }),
  groupHeading: (base) => ({
    ...base,
    color: 'var(--text-color-text-subtle)',
    fontSize: '0.9em',
    fontWeight: 600,
    textTransform: 'uppercase',
    padding: '0 12px',
    marginBottom: '8px',
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

// Custom Menu component with NN search
const NNSearch = ({ children, ...props }) => {
  const { selectProps } = props;
  const { query, onSelect } = selectProps;

  const handleSubmit = (e) => {
    e.preventDefault();
    // report back to the parent
    onSelect({ type: 'search', value: query, label: query });
  };

  return (
    <components.Menu {...props}>
      <div className={styles.resultsList}>
        <div className={styles.resultRow} onClick={handleSubmit}>
          <div className={styles.resultContent}>
            <span className={styles.searchIcon}>🔍</span>
            <span>Search for nearest neighbors to: "{query}"</span>
          </div>
        </div>
        {children}
      </div>
    </components.Menu>
  );
};

const SearchResults = ({ query, dropdownIsOpen, setDropdownIsOpen, onSelect }) => {
  const { clusterLabels, features } = useScope();

  const featureOptions = useMemo(
    () => (features.length > 0 ? findFeaturesByQuery(features, query, 5) : []),
    [features, query]
  );

  const clusterOptions = useMemo(
    () => findClustersByQuery(clusterLabels, query, 5),
    [clusterLabels, query]
  );

  // Group options by type
  const groupedOptions = [
    {
      label: 'Clusters',
      options: clusterOptions,
    },
  ];

  if (featureOptions.length > 0) {
    groupedOptions.push({
      label: 'Features',
      options: featureOptions,
    });
  }

  // Enhanced filter function
  const filterOption = (option, inputValue) => {
    // If this is a group, check if any of its options match
    if (option.options) {
      return option.options.some((subOption) =>
        subOption.label.toLowerCase().includes(inputValue.toLowerCase())
      );
    }
    // For individual options
    return option.label.toLowerCase().includes(inputValue.toLowerCase());
  };

  return (
    <Select
      options={groupedOptions}
      components={{ Option, Group, Menu: NNSearch }}
      styles={customStyles}
      query={query}
      setDropdownIsOpen={setDropdownIsOpen}
      menuIsOpen={dropdownIsOpen}
      onMenuOpen={() => true}
      onMenuClose={() => false}
      onChange={() => false}
      onSelect={onSelect}
      controlShouldRenderValue={false}
      filterOption={filterOption}
      inputValue={query}
      isSearchable={true}
      hideSelectedOptions={false}
      closeMenuOnSelect={false}
    />
  );
};

SearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  dropdownIsOpen: PropTypes.bool.isRequired,
  setDropdownIsOpen: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default SearchResults;
