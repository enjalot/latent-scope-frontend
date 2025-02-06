import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';
// import DataTable from './DataTable';
import 'react-data-grid/lib/styles.css';

import DataGrid, { Row } from 'react-data-grid';
import FeaturePlot from './FeaturePlot';

import { apiService } from '../lib/apiService';

import styles from './FilterDataTable.module.css';

FilterDataTable.propTypes = {
  height: PropTypes.string,
  dataset: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  scope: PropTypes.object,
  filteredIndices: PropTypes.array.isRequired,
  distances: PropTypes.array,
  clusterMap: PropTypes.object,
  // clusterLabels: PropTypes.array,
  tagset: PropTypes.object,
  onTagset: PropTypes.func,
  onScope: PropTypes.func,
  onHover: PropTypes.func,
  onClick: PropTypes.func,
};

function RowWithHover({ props, onHover }) {
  const { row } = props;
  const { ls_index } = row;
  return (
    <Row
      key={ls_index}
      {...props}
      onMouseEnter={() => {
        onHover(ls_index);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
    />
  );
}

function extent(activations) {
  const min = Math.min(...activations);
  const max = Math.max(...activations);
  return [min, max];
}

function FilterDataTable({
  handleFeatureClick,
  dataset,
  scope,
  userId,
  filteredIndices = [],
  distances = [],
  clusterMap = {},
  onDataTableRows,
  showNavigation = true,
  sae_id = null,
  feature = -1,
  features = [],
  onHover = () => {},
  deletedIndices = [],
  page,
  setPage,
  filterLoading = false,
}) {
  const [rows, setRows] = useState([]);
  const [defaultRows, setDefaultRows] = useState([]);

  // page count is the total number of pages available
  const rowsPerPage = 100;
  const [pageCount, setPageCount] = useState(0);
  useEffect(() => {
    let inds = filteredIndices.length;
    const count = Math.ceil(inds / rowsPerPage);
    setPageCount(count);
  }, [filteredIndices]);

  // feature tooltip content
  const [featureTooltipContent, setFeatureTooltipContent] = useState(null);

  const [rowsLoading, setRowsLoading] = useState(false);
  const hydrateIndices = useCallback(
    (indices, setRowsTarget) => {
      if (dataset && scope && indices.length) {
        setRowsLoading(true);
        let paged = indices.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

        if (paged.length) {
          apiService.getRowsByIndices(userId, dataset.id, scope.id, paged).then((rows) => {
            const rowsWithIdx = rows.map((row, idx) => ({
              ...row,
              idx,
              ls_index: row.index,
            }));
            setRowsTarget(rowsWithIdx);
            onDataTableRows(rowsWithIdx);
            setRowsLoading(false);
          });
        } else {
          setRowsTarget([]);
          onDataTableRows && onDataTableRows([]);
          setRowsLoading(false);
        }
      } else {
        setRowsTarget([]);
        onDataTableRows && onDataTableRows([]);
        setRowsLoading(false);
      }
    },
    [dataset, page, sae_id, setRowsLoading]
  );

  useEffect(() => {
    const filteredWithoutDeleted = filteredIndices.filter((i) => !deletedIndices.includes(i));
    hydrateIndices(filteredWithoutDeleted, setRows);
  }, [filteredIndices, deletedIndices, page, hydrateIndices]);

  const formattedColumns = useMemo(() => {
    const ls_features_column = 'ls_features';
    let columns = ['ls_index'];
    // Text column is always the first column (after index)

    columns.push(dataset.text_column);

    if (distances && distances.length) columns.push('ls_similarity');
    if (sae_id) columns.push(ls_features_column);
    if (clusterMap && Object.keys(clusterMap).length) columns.push('ls_cluster');
    // if (tagset && Object.keys(tagset).length) columns.push('tags');

    columns = columns.concat(dataset.columns.filter((d) => d !== dataset.text_column));

    let columnDefs = columns.map((col) => {
      const metadata = dataset.column_metadata ? dataset.column_metadata[col] : null;

      const baseCol = {
        key: col,
        name: col,
        resizable: true,
        className: styles.filterDataTableRow,
      };

      // dropping tag support for now.
      // if (col === 'tags') {
      //   return {
      //     ...baseCol,
      //     width: 100,
      //     renderCell: ({ row }) => renderTags(tags, row, tagset, handleTagClick),
      //   };
      // }

      if (metadata?.image) {
        return {
          ...baseCol,
          renderCell: ({ row }) => (
            <a href={row[col]} target="_blank" rel="noreferrer">
              <img src={row[col]} alt="" style={{ height: '100px' }} />
            </a>
          ),
        };
      } else if (metadata?.url) {
        return {
          ...baseCol,
          renderCell: ({ row }) => (
            <a href={row[col]} target="_blank" rel="noreferrer">
              url
            </a>
          ),
        };
      } else if (metadata?.type === 'array') {
        return {
          ...baseCol,
          renderCell: ({ row }) => <span>{`[${row[col].length}]`}</span>,
        };
      }

      if (col === 'ls_cluster') {
        return {
          ...baseCol,
          width: 200,
          renderCell({ row }) {
            const cluster = clusterMap[row.ls_index];
            return cluster ? <span>{cluster.label}</span> : null;
          },
        };
      }

      if (col === dataset.text_column) {
        return {
          ...baseCol,
          width: 500,
          renderHeaderCell: () => <div className={styles.textColumn}>{dataset.text_column}</div>,
          renderCell: ({ row }) => {
            return <span title={row[col]}>{row[col]}</span>;
          },
        };
      }

      if (col === ls_features_column) {
        const baseWidth = 200;

        return {
          ...baseCol,
          width: baseWidth,
          renderHeaderCell: () => (
            <div className={styles.featureColumnHeader} style={{ position: 'relative' }}>
              <span>{ls_features_column}</span>
              <span
                data-tooltip-id="feature-column-info-tooltip"
                className={styles.featureColumnInfoTooltipIcon}
              >
                🤔
              </span>
            </div>
          ),
          renderCell: ({ row }) =>
            row.sae_indices && (
              <FeaturePlot
                width={baseWidth}
                row={row}
                feature={feature}
                features={features}
                handleFeatureClick={handleFeatureClick}
                setFeatureTooltipContent={setFeatureTooltipContent}
              />
            ),
        };
      }

      const renderCell = ({ row }) => {
        if (typeof row[col] === 'object') {
          return <span>{JSON.stringify(row[col])}</span>;
        }
        if (col === 'ls_similarity') {
          // console.log('==== ls_similarity ==== ', row.ls_index, distances[row.ls_index], distances);
          // use the row index to get the distance
          return <span>{parseFloat(1 - distances[row.idx]).toFixed(4)}</span>;
        }
        if (typeof row[col] === 'string') {
          if (row[col].startsWith('http')) {
            return (
              <a href={row[col]} target="_blank" rel="noopener noreferrer">
                {row[col]}
              </a>
            );
          }
        }

        return <span title={row[col]}>{row[col]}</span>;
      };

      return {
        ...baseCol,
        width: col == 'ls_index' ? 60 : 150,
        renderCell,
      };
    });
    return columnDefs;
  }, [dataset, clusterMap, distances, features, feature, sae_id]);

  const renderRowWithHover = useCallback(
    (key, props) => {
      return <RowWithHover key={key} props={props} onHover={onHover} />;
    },
    [onHover]
  );

  // console.log('==== FILTER DATA TABLE =====', { filteredIndices, defaultIndices, rows });

  return (
    <div
      className={`${styles.filterDataTable} ${rowsLoading ? styles.loading : ''}`}
      // style={{ visibility: indices.length ? 'visible' : 'hidden' }}
    >
      {rowsLoading || filterLoading ? (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <div>Loading</div>
          </div>
        </div>
      ) : (
        <div className={`${styles.filterTableScrollableBody} ${styles.tableBody}`}>
          <Tooltip
            id="feature-tooltip"
            place="bottom"
            effect="solid"
            content={featureTooltipContent?.content || ''}
            className={styles.featureTooltip}
            float={true}
            isOpen={!!featureTooltipContent}
            // float={true}
            position="fixed"
            style={{
              zIndex: 9999,
              maxWidth: 'none',
              whiteSpace: 'nowrap',
              backgroundColor: '#D3965E',
              position: 'fixed',
              marginTop: 10,
              top: -200,
              // left: featureTooltipContent?.x || 0,
              // top: (featureTooltipContent?.y || 0) - 30,
            }}
          />
          <DataGrid
            rows={rows}
            columns={formattedColumns}
            rowClass={(row, index) => {
              if (row.ls_index === 0) {
                return 'test';
              }
              return '';
            }}
            rowGetter={(i) => rows[i]}
            rowHeight={sae_id ? 50 : 35}
            style={{ height: '100%', color: 'var(--text-color-main-neutral)' }}
            renderers={{ renderRow: renderRowWithHover }}
            className={styles.dataGrid}
          />

          <Tooltip
            id="feature-column-info-tooltip"
            className={styles.featureColumnInfoTooltip}
            place="top"
            effect="solid"
            clickable={true}
            delayHide={500} // give the user a chance to click the tooltip links
          >
            <div onClick={(e) => e.stopPropagation()}>
              The vertical bars represent activations for different{' '}
              <a
                href="https://enjalot.github.io/latent-taxonomy/articles/about"
                target="_blank"
                rel="noreferrer"
              >
                Sparse Autoencoder (SAE)
              </a>{' '}
              features corresponding to each embedding. Higher activations indicate that the feature
              captures an important semantic element of the embedding.
              <br />
              <br />
              Click each cell to see the labels for each feature and to filter rows by a particular
              feature.
            </div>
          </Tooltip>
        </div>
      )}
      {showNavigation && (
        <div className={styles.filterDataTablePageControls}>
          <button onClick={() => setPage(0)} disabled={page === 0}>
            First
          </button>
          <button onClick={() => setPage((old) => Math.max(0, old - 1))} disabled={page === 0}>
            ←
          </button>
          <span>
            Page {page + 1} of {pageCount || 1}
          </span>
          <button
            onClick={() => setPage((old) => Math.min(pageCount - 1, old + 1))}
            disabled={page === pageCount - 1}
          >
            →
          </button>
          <button onClick={() => setPage(pageCount - 1)} disabled={page === pageCount - 1}>
            Last
          </button>
        </div>
      )}
    </div>
  );
}
export default memo(FilterDataTable);
