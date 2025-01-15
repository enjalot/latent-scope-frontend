import { Link, useLocation } from 'react-router-dom';
import styles from './SubNav.module.css';
import { Select } from 'react-element-forge';

const SubNav = ({ user, dataset, scope }) => {
  const location = useLocation();
  if (!dataset) {
    return (
      <div className={styles.subHeaderContainer}>
        <div className={styles.tabsContainer}>
          <div className={styles.leftTabs}>
          </div>
          <div className={styles.rightTabs}>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.subHeaderContainer}>
      <div className={styles.tabsContainer}>
        <div className={styles.leftTabs}>
          <div className={styles.scope}>
            <span className={styles.scopeTitle}>{user} / {dataset?.id} / {scope?.id}</span>
          </div>
        </div>
        <div className={styles.rightTabs}>
          
        </div>
      </div>
    </div>
  );
};

export default SubNav;
