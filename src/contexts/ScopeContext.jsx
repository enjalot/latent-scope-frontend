import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import useCurrentScope from '../hooks/useCurrentScope';
import useScopeData from '../hooks/useScopeData';

const ScopeContext = createContext(null);

export function ScopeProvider({ children }) {
    const { user: userId, dataset: datasetId, scope: scopeId } = useParams();
    const [scopeLoaded, setScopeLoaded] = useState(false);
    const [cluster, setCluster] = useState(null);

    // Core scope data
    const { dataset, scope, sae } = useCurrentScope(userId, datasetId, scopeId);
    
    // Scope data and clustering
    const { 
        fetchScopeRows,
        clusterMap,
        clusterLabels,
        scopeRows,
        deletedIndices,
        features,
        setFeatures
    } = useScopeData(
        userId,
        datasetId,
        scope,
        setScopeLoaded,
        setCluster
    );

    const value = {
        userId,
        datasetId,
        scopeId,
        dataset,
        scope,
        sae,
        scopeLoaded,
        setScopeLoaded,
        cluster,
        setCluster,
        clusterMap,
        clusterLabels,
        scopeRows,
        deletedIndices,
        fetchScopeRows,
        features,
        setFeatures
    };

    return (
        <ScopeContext.Provider value={value}>
            {children}
        </ScopeContext.Provider>
    );
}

export function useScope() {
    const context = useContext(ScopeContext);
    if (!context) {
        throw new Error('useScope must be used within a ScopeProvider');
    }
    return context;
}