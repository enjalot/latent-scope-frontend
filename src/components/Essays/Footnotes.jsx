import styles from '../../essays/essays.module.scss';

function Footnote({ number, text }) {
  return (
    <div className={styles.footnote}>
      <span className={styles.footnoteIndicator}>{number}</span>
      <p className={styles.paragraph}>{text}</p>
    </div>
  );
}

function FootnoteTooltip({ number, text }) {
  return (
    <div className={styles.footnote}>
      <sup
        data-tooltip-id="footnote"
        data-tooltip-content={text}
        className={styles.footnoteIndicator}
      >
        {number}
      </sup>
    </div>
  );
}

export { Footnote, FootnoteTooltip };
