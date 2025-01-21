import Select from 'react-select';
import { Button } from 'react-element-forge';
import styles from './ColumnFilter.module.scss';
import { selectStyles } from './SelectStyles';
import { useFilter } from '../../contexts/FilterContext';

const ColumnFilter = () => {
  const {
    columnFilters,
    columnFilterIndices,
    columnFiltersActive,
    setColumnFiltersActive,
    setColumnFilterIndices,
  } = useFilter();

  return columnFilters?.length ? (
    <div className={`${styles.container} ${columnFilterIndices?.length ? styles.active : ''}`}>
      <div className={styles.filterCell}>
        {columnFilters.map((column) => (
          <span key={column.column}>
            <Select
              value={columnFiltersActive[column.column] ? {
                value: columnFiltersActive[column.column],
                label: `${columnFiltersActive[column.column]} (${column.counts[columnFiltersActive[column.column]]})`,
              } : null}
              onChange={(selectedOption) => {
                let active = { ...columnFiltersActive };
                active[column.column] = selectedOption ? selectedOption.value : '';
                setColumnFiltersActive(active);
              }}
              options={column.categories.map((c) => ({
                value: c,
                label: `${c} (${column.counts[c]})`,
              }))}
              isClearable
              placeholder={`Filter by ${column.column}`}
              className={styles.columnSelect}
              styles={selectStyles}
            />
          </span>
        ))}
      </div>
      <div className={styles.count}>
        {columnFilterIndices?.length ? <span>{columnFilterIndices?.length} rows</span> : null}
        {columnFilterIndices?.length ? (
          <Button
            onClick={() => {
              setColumnFiltersActive({});
              setColumnFilterIndices([]);
            }}
            icon="x"
            color="secondary"
          />
        ) : null}
      </div>
    </div>
  ) : null;
};

export default ColumnFilter;
