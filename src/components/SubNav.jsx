import { useMemo, useEffect } from 'react';
import styles from './SubNav.module.css';
import scopes from '../lib/scopes.js';

function SubNav({ user, dataset, scope }) {
  if (!dataset) {
    return (
      <div className={styles.subHeaderContainer}>
        <div className={styles.tabsContainer}>
          <div className={styles.leftTabs}></div>
          <div className={styles.rightTabs}></div>
        </div>
      </div>
    );
  }
  const scopeId = useMemo(
    () => (user && dataset?.id && scope?.id ? `${user}/${dataset.id}/${scope.id}` : null),
    [user, dataset?.id, scope?.id]
  );
  const scopeDetail = useMemo(
    () => (scopeId ? scopes.find((s) => s.id === scopeId) : null),
    [scopeId]
  );

  return (
    <div className={styles.subHeaderContainer}>
      <div className={styles.tabsContainer}>
        <div className={styles.leftTabs}>
          <div className={styles.scope}>
            <span className={styles.scopeTitle}>{scopeDetail?.label}</span>
            {/* <span>
              {user}/{dataset?.id}/{scope?.id}
            </span> */}
            <span className={styles.scopeDescription}>{scopeDetail?.description}</span>
            {scopeDetail?.dataUrl && (
              <span>
                <a href={scopeDetail?.dataUrl}>dataset details</a>
              </span>
            )}
          </div>
        </div>
        <div className={styles.rightTabs}></div>
      </div>
    </div>
  );
}

export default SubNav;
