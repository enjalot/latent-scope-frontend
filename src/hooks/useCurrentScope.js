import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../lib/apiService';

const useCurrentScope = (userId, datasetId, scopeId) => {
    const [scope, setScope] = useState(null);
    const [dataset, setDataset] = useState(null);
    const [sae, setSae] = useState(null);

    useEffect(() => {
        apiService.getScope(userId, datasetId, scopeId).then((scope) => {
            console.log("scope", scope)
            setScope(scope);
            setDataset(scope.dataset);
            setSae(scope.sae);
        });
    }, [userId, datasetId, scopeId]);

    return { dataset, setDataset, scope, setScope, sae, setSae };
};

export default useCurrentScope;