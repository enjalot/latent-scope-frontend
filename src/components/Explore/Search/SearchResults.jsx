import React, { useMemo } from 'react';

import PropTypes from 'prop-types';
import Select, { components } from 'react-select';
import styles from './SearchResults.module.scss';
import { useScope } from '../../../contexts/ScopeContext';
import { filterConstants, findFeaturesByQuery, findClustersByQuery } from './utils';
import useColumnFilter from '../../../hooks/useColumnFilter';

const COLUMNS = 'Columns';
const CLUSTERS = 'Clusters';
const FEATURES = 'Features';

// Function to underline the search term
const underlineText = (text, query) => {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={index} className={styles.underline}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    )
  );
};

// Custom Option component
const Option = (props) => {
  const { data, selectProps } = props;
  const { onSelect, inputValue } = selectProps;

  const handleClick = (e) => {
    e.preventDefault();
    const groupType = props.options.find((group) =>
      group.options?.some((opt) => opt.value === data.value)
    )?.label;

    if (groupType === COLUMNS) {
      onSelect({
        type: 'column',
        value: data.value,
        column: data.column,
        label: data.label,
      });
    } else if (groupType === CLUSTERS) {
      onSelect({ type: 'cluster', value: data.value, label: data.label });
    } else if (groupType === FEATURES) {
      onSelect({ type: 'feature', value: data.value, label: data.label });
    }
  };

  // Get the group type
  const groupType = props.options.find((group) =>
    group.options?.some((opt) => opt.value === data.value)
  )?.label;

  if (groupType === COLUMNS) {
    return (
      <div onClick={handleClick}>
        <components.Option {...props}>
          <div className={styles.columnResultContent}>
            <span>{underlineText(data.label, inputValue)}</span>
            <span className={styles.columnLabel}>{data.column}</span>
          </div>
        </components.Option>
      </div>
    );
  }

  return (
    <div onClick={handleClick}>
      <components.Option {...props}>
        <div className={styles.resultContent}>{underlineText(data.label, inputValue)}</div>
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
    overflowY: 'visible',
    maxHeight: 'none',
  }),
};

// Custom Menu component with NN search
const NNSearch = ({ children, ...props }) => {
  const { selectProps } = props;
  const { query, onSelect, options } = selectProps;

  // Check if there are any matches in the cluster / feature options
  const hasMatches = options.some((group) => group.options && group.options.length > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSelect({ type: filterConstants.SEARCH, value: query });
  };

  return (
    <components.Menu {...props}>
      <div className={styles.resultsList}>
        <div className={styles.resultRow} onClick={handleSubmit}>
          <div className={styles.searchResultContent}>
            <span className={styles.searchIcon}>🔍</span>
            <span>Search for nearest neighbors to: "{query}"</span>
          </div>
        </div>
        {hasMatches && children} {/* Only render cluster / feature options if there are matches */}
      </div>
    </components.Menu>
  );
};

const NUM_SEARCH_RESULTS = 4;

const SearchResults = ({ query, menuIsOpen, onSelect }) => {
  const { features, userId, datasetId, scope, clusterLabels } = useScope();
  const columnFilter = useColumnFilter(userId, datasetId, scope);
  const { columnFilters } = columnFilter;

  const featureOptions = useMemo(
    () => (features.length > 0 ? findFeaturesByQuery(features, query, NUM_SEARCH_RESULTS) : []),
    [features, query]
  );

  const clusterOptions = useMemo(
    () => findClustersByQuery(clusterLabels, query, NUM_SEARCH_RESULTS),
    [clusterLabels, query]
  );

  // Transform column values into options
  const columnOptions = useMemo(() => {
    if (!columnFilters) return [];

    // Flatten all column values into searchable options
    const options = columnFilters.flatMap((column) =>
      column.categories.map((category) => ({
        value: category,
        label: category, // Just the value
        column: column.column, // Store column name for display
      }))
    );

    // Filter based on query
    if (!query) return [];
    const searchTerm = query.toLowerCase();
    return options
      .filter((option) => option.value.toString().toLowerCase().includes(searchTerm))
      .slice(0, NUM_SEARCH_RESULTS);
  }, [columnFilters, query]);

  // Group options by type
  const groupedOptions = [
    {
      label: CLUSTERS,
      options: clusterOptions,
    },
  ];

  if (featureOptions.length > 0) {
    groupedOptions.push({
      label: FEATURES,
      options: featureOptions,
    });
  }

  if (columnOptions.length > 0) {
    groupedOptions.push({
      label: COLUMNS,
      options: columnOptions,
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
      components={{
        Option,
        Group,
        Menu: NNSearch,
      }}
      styles={customStyles}
      query={query}
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
      menuIsOpen={menuIsOpen}
    />
  );
};

SearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  menuIsOpen: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default SearchResults;
