import { useState, useEffect } from 'react';
import { Input, Button } from 'react-element-forge';
import styles from './NearestNeighbor.module.scss';
import { useFilter } from '../../contexts/FilterContext';

export default function NearestNeighbor() {
  const { allFilteredIndices, searchFilter, setUrlParams, shownIndices } = useFilter();
  const { loading, setSearchText, clearSearch, searchText: defaultValue, active } = searchFilter;
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSearchText(inputValue);
    setUrlParams((prev) => {
      prev.set('search', inputValue);
      return prev;
    });
  };

  const handleClear = () => {
    clearSearch();
    setInputValue('');
    setUrlParams((prev) => {
      prev.delete('search');
      return prev;
    });
  };

  return (
    <div className={`${styles.container} ${active ? styles.active : ''}`}>
      <div className={`${styles.searchInputContainer}`}>
        <Input
          className={styles.searchInput}
          value={inputValue}
          placeholder="Search..."
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) {
              setSearchText(e.target.value);
              setUrlParams((prev) => {
                prev.set('search', e.target.value);
                return prev;
              });
            }
          }}
        />
        <div className={styles.searchButtonContainer}>
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
        </div>
      </div>
      <div className={`${styles.count}`}>
        {active ? <span>{shownIndices.length} rows</span> : null}
      </div>
    </div>
  );
}
