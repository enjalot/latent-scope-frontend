import styles from '../../essays/essays.module.scss';
import { useState } from 'react';
import { Button } from 'react-element-forge';

function P({ children }) {
  return <div className={styles.paragraph}>{children}</div>;
}
function H2({ children }) {
  return <h2 className={`${styles.sectionHeader} ${styles.h2}`}>{children}</h2>;
}

function H3({ children }) {
  return <h3 className={`${styles.sectionHeader} ${styles.h3}`}>{children}</h3>;
}

function Query({ children }) {
  return <span className={styles.query}>{children}</span>;
}
function Array({ children }) {
  return <p className={styles.array}>{children}</p>;
}

function Scrollable({ children, height }) {
  return (
    <div className={styles.scrollable} style={{ height: `${height}px` }}>
      {children}
    </div>
  );
}

function Caption({ children }) {
  return <p className={styles.caption}>{children}</p>;
}
function Aside({ children }) {
  return (
    <div className={styles.aside}>
      <div>{children}</div>
    </div>
  );
}

function Expandable({ children, title, subtitle }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`${styles.expandable} ${isOpen ? styles.expanded : ''}`}>
      <div className={styles.expandableHeader} onClick={toggleOpen}>
        <div className={styles.expandableTitleWrapper}>
          <div className={styles.expandableTitle}>{title}</div>
          {subtitle && <div className={styles.expandableSubtitle}>{subtitle}</div>}
        </div>
        <Button
          color="primary"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            toggleOpen();
          }}
          icon={isOpen ? 'chevron-up' : 'chevron-down'}
          aria-label={isOpen ? 'Close' : 'Open'}
        />
      </div>
      <div className={`${styles.expandableContent} ${isOpen ? styles.visible : ''}`}>
        {children}
      </div>
    </div>
  );
}

export { P, H2, H3, Query, Array, Scrollable, Caption, Aside, Expandable };
