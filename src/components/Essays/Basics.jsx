import styles from '../../essays/essays.module.scss';

function P({ children }) {
  return <div className={styles.paragraph}>{children}</div>;
}
function H2({ children }) {
  return <h2 className={`${styles.sectionHeader} ${styles.h2}`}>{children}</h2>;
}

function H3({ children }) {
  return <h3 className={`${styles.sectionHeader} ${styles.h3}`}>{children}</h3>;
}

export { P, H2, H3 };
