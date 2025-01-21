import { createContext, useContext, useState, useEffect } from 'react';
import { useScope } from './ScopeContext';
import useColumnFilter from '../hooks/useColumnFilter';
import useNearestNeighborsSearch from '../hooks/useNearestNeighborsSearch';

export const SEARCH = "search";
export const CLUSTER = "filter";
export const SELECT = "select";
export const COLUMN = "column";
export const FEATURE = "feature";

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
    const { 
      scopeRows, 
      deletedIndices, 
      dataset,
      datasetId,
      userId,
      scope,
    } = useScope();
    
    // Active filter state
    const [activeFilterTab, setActiveFilterTab] = useState(CLUSTER);
    const [filteredIndices, setFilteredIndices] = useState([]);
    const [defaultIndices, setDefaultIndices] = useState([]);

    // Filter-specific states
    const [clusterIndices, setClusterIndices] = useState([]);
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [columnFilterIndices, setColumnFilterIndices] = useState([]);
    const [featureIndices, setFeatureIndices] = useState([]);

    // Search state
    const [searchText, setSearchText] = useState('');

    // Cluster state
    const [cluster, setCluster] = useState(null);

    // Column filter state
    const { columnFiltersActive, setColumnFiltersActive, columnFilters } = useColumnFilter(
        dataset,
        datasetId,
        setColumnFilterIndices
    );

    // Feature filter state
    const [feature, setFeature] = useState(-1);
    const [threshold, setThreshold] = useState(0.1);

    // Search functionality using useNearestNeighborsSearch
    const {
        searchIndices,
        distances,
        searchLoading,
        search,
        clearSearch,
    } = useNearestNeighborsSearch({
        userId,
        datasetId,
        scope,
        deletedIndices,
        searchText,
        setSearchText,
    });

    // Toggle functions
    const toggleSearch = () => setActiveFilterTab(prev => prev === SEARCH ? null : SEARCH);
    const toggleFilter = () => setActiveFilterTab(prev => prev === CLUSTER ? null : CLUSTER);
    const toggleSelect = () => setActiveFilterTab(prev => prev === SELECT ? null : SELECT);
    const toggleColumn = () => setActiveFilterTab(prev => prev === COLUMN ? null : COLUMN);
    const toggleFeature = () => setActiveFilterTab(prev => prev === FEATURE ? null : FEATURE);

    // Update defaultIndices when scopeRows changes
    useEffect(() => {
        if (scopeRows?.length) {
            const indexes = scopeRows
                .filter(row => !deletedIndices.includes(row.ls_index))
                .map(row => row.ls_index);
            setDefaultIndices(indexes);
            setFilteredIndices([]);
        }
    }, [scopeRows, deletedIndices]);

    // Update filtered indices based on active filter
    useEffect(() => {
        switch (activeFilterTab) {
            case CLUSTER:
                setFilteredIndices(clusterIndices);
                break;
            case SEARCH:
                setFilteredIndices(searchIndices);
                break;
            case SELECT:
                setFilteredIndices(selectedIndices);
                break;
            case COLUMN:
                setFilteredIndices(columnFilterIndices);
                break;
            case FEATURE:
                setFilteredIndices(featureIndices);
                break;
            default:
                setFilteredIndices(defaultIndices);
        }
    }, [
        activeFilterTab,
        clusterIndices,
        searchIndices,
        selectedIndices,
        columnFilterIndices,
        featureIndices,
        defaultIndices
    ]);


    const value = {
        activeFilterTab,
        setActiveFilterTab,
        filteredIndices,
        setFilteredIndices,
        defaultIndices,
        setDefaultIndices,
        clusterIndices,
        setClusterIndices,
        searchIndices,
        selectedIndices,
        setSelectedIndices,
        columnFilterIndices,
        setColumnFilterIndices,
        featureIndices,
        setFeatureIndices,
        feature,
        setFeature,
        threshold,
        setThreshold,
        searchText,
        setSearchText,
        searchLoading,
        cluster,
        setCluster,
        columnFiltersActive,
        setColumnFiltersActive,
        columnFilters,
        clearSearch,
        toggleSearch,
        toggleFilter,
        toggleSelect,
        toggleColumn,
        toggleFeature,
        filterConstants: {
            SEARCH,
            CLUSTER,
            SELECT,
            COLUMN,
            FEATURE
        },
        distances,
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilter() {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
}