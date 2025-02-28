import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'react-tooltip';
import { useFilter } from '../contexts/FilterContext';
// import DataTable from './DataTable';
import 'react-data-grid/lib/styles.css';

import DataGrid, { Row } from 'react-data-grid';
import FeaturePlot from './FeaturePlot';

import { apiService } from '../lib/apiService';

import styles from './FilterDataTable.module.css';

FilterDataTable.propTypes = {
  height: PropTypes.string,
  dataset: PropTypes.object.isRequired,
  distances: PropTypes.array,
  clusterMap: PropTypes.object,
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

function FilterDataTable({
  handleFeatureClick,
  dataset,
  distances = [],
  clusterMap = {},
  sae_id = null,
  feature = -1,
  features = [],
  onHover = () => {},
}) {
  const { dataTableRows, page, setPage, totalPages, filterConfig, filterActive, loading } =
    useFilter();

  // Track expanded rows by index
  const [expandedRows, setExpandedRows] = useState({});

  // feature tooltip content
  const [featureTooltipContent, setFeatureTooltipContent] = useState(null);

  // Toggle row expansion
  const handleRowExpand = useCallback((index) => {
    setExpandedRows((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const formattedColumns = useMemo(() => {
    // Add index circle column as the first column
    const indexColumn = {
      key: 'index-circle',
      name: '', // Empty header
      width: 50,
      renderCell: IndexCircleCell,
      frozen: true, // Optional: keeps it visible during horizontal scroll
    };

    const ls_features_column = 'ls_features';
    let columns = ['ls_index'];
    // Text column is always the first column (after index)

    columns.push(dataset.text_column);

    if (distances && distances.length) columns.push('ls_similarity');
    if (sae_id) columns.push(ls_features_column);
    if (clusterMap && Object.keys(clusterMap).length) columns.push('ls_cluster');
    // if (tagset && Object.keys(tagset).length) columns.push('tags');

    columns = columns.concat(dataset.columns.filter((d) => d !== dataset.text_column));

    function renderUrl(text) {
      let urls = text.split('http').filter((url) => !!url);
      console.log('==== urls ==== ', urls);
      return (
        <div className={styles.urlContainer}>
          {urls.map((url, idx) => (
            <a key={'url ' + idx} href={`http${url}`} target="_blank" rel="noreferrer">
              {`http${url}`}
            </a>
          ))}
        </div>
      );
    }

    let columnDefs = columns.map((col) => {
      const metadata = dataset.column_metadata ? dataset.column_metadata[col] : null;
      console.log('==== metadata ==== ', col, metadata);

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
          renderCell: ({ row }) => {
            let text = row[col];
            renderUrl(text);
          },
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
            const isExpanded = expandedRows[row.ls_index];
            return (
              <div
                className={`${styles.textCell} ${isExpanded ? styles.expanded : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowExpand(row.ls_index);
                }}
                title={isExpanded ? '' : row[col]}
              >
                {row[col]}
              </div>
            );
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
            return renderUrl(row[col]);
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

    // Add index column as first column
    return [indexColumn, ...columnDefs];
    // return columnDefs;
  }, [dataset, clusterMap, distances, features, feature, sae_id, expandedRows, handleRowExpand]);

  // Row height calculation
  const getRowHeight = useCallback(
    (row) => {
      if (expandedRows[row.ls_index]) {
        // TODO: a more sophisticated way to do this would be better (measuring text content in DOM)
        const text = row[dataset.text_column] || '';
        // Use the text length to determine a reasonable height
        if (text.length > 1000) return 400;
        if (text.length > 500) return 300;
        if (text.length > 200) return 200;
        if (text.length > 100) return 100;
        if (text.length > 50) return 60;
      }
      return sae_id ? 50 : 35;
    },
    [expandedRows, sae_id, dataset.text_column]
  );

  const renderRowWithHover = useCallback(
    (key, props) => {
      return <RowWithHover key={key} props={props} onHover={onHover} />;
    },
    [onHover]
  );

  return (
    <div
      className={`${styles.filterDataTable} ${loading ? styles.loading : ''}`}
      // style={{ visibility: indices.length ? 'visible' : 'hidden' }}
    >
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <div>Loading</div>
          </div>
        </div>
      )}
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
          rows={dataTableRows}
          columns={formattedColumns}
          rowClass={(row) => (expandedRows[row.ls_index] ? styles.expandedRow : styles.rdgRow)}
          rowGetter={(i) => dataTableRows[i]}
          rowHeight={getRowHeight}
          rowHeightGetter={getRowHeight}
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
      {page >= 0 && (
        <div className={styles.filterDataTablePageControls}>
          <button onClick={() => setPage(0)} disabled={page === 0}>
            First
          </button>
          <button onClick={() => setPage((old) => Math.max(0, old - 1))} disabled={page === 0}>
            ←
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((old) => Math.min(totalPages - 1, old + 1))}
            disabled={page === totalPages - 1}
          >
            →
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}>
            Last
          </button>
        </div>
      )}
    </div>
  );
}

const IndexCircleCell = ({ row }) => {
  return (
    <div className={styles.indexCircleContainer}>
      <div className={styles.indexCircle}>{row.idx + 1}</div>
    </div>
  );
};

export default memo(FilterDataTable);
