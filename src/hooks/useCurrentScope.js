import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiService } from '../lib/apiService';
import { saeAvailable } from '../lib/SAE';
const useCurrentScope = (userId, datasetId, scopeId) => {
    const [scope, setScope] = useState(null);
    const [dataset, setDataset] = useState(null);
    const [sae, setSae] = useState(null);

    useEffect(() => {
        apiService.getScope(userId, datasetId, scopeId).then((scope) => {
            console.log("scope", scope)
            if(saeAvailable[scope.embedding?.model_id]) {
                setSae(scope.sae);
            } else {
                delete scope.sae
                delete scope.sae_id
            }
            setScope(scope);
            setDataset(scope.dataset);
        });
    }, [userId, datasetId, scopeId]);

    return { dataset, setDataset, scope, setScope, sae, setSae };
};

export default useCurrentScope;