import { useState } from 'react';
import { useScope } from '../contexts/ScopeContext';
import Select from 'react-select';

const Search = () => {
  const [selectedCluster, setSelectedCluster] = useState(null);
  const { clusterLabels } = useScope();

  // Group options by type
  const groupedOptions = [
    {
      label: 'Clusters',
      options: clusterLabels.map((cluster) => ({
        value: cluster.cluster,
        label: cluster.label,
      })),
    },
    {
      label: 'Features',
      options: [
        { value: 'sentiment', label: 'Sentiment Analysis' },
        { value: 'keywords', label: 'Key Words' },
        { value: 'entities', label: 'Named Entities' },
        { value: 'topics', label: 'Topic Modeling' },
        { value: 'summary', label: 'Text Summary' },
      ],
    },
  ];

  const customStyles = {
    group: (base) => ({
      ...base,
      padding: '8px 0',
    }),
    groupHeading: (base) => ({
      ...base,
      color: '#666',
      fontSize: '0.9em',
      fontWeight: 600,
      textTransform: 'uppercase',
      padding: '0 12px',
      marginBottom: '8px',
    }),
    option: (base, state) => ({
      ...base,
      padding: '8px 12px',
      backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#f8f9fa' : null,
      color: state.isSelected ? 'white' : 'black',
      '&:hover': {
        backgroundColor: state.isSelected ? '#007bff' : '#f8f9fa',
      },
    }),
    control: (base, state) => ({
      ...base,
      minWidth: '300px',
      borderColor: state.isFocused ? '#007bff' : '#ced4da',
      boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(0,123,255,.25)' : null,
      '&:hover': {
        borderColor: state.isFocused ? '#007bff' : '#adb5bd',
      },
    }),
    menu: (base) => ({
      ...base,
      minWidth: '300px',
      borderRadius: 4,
      marginTop: 8,
    }),
  };

  return (
    <div className="search-container">
      <Select
        value={selectedCluster}
        onChange={setSelectedCluster}
        options={groupedOptions}
        className="search-input"
        placeholder="Search..."
        isClearable
        styles={customStyles}
      />
    </div>
  );
};

export default Search;
