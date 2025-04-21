// src/components/MDXProvider.jsx
import { MDXProvider } from '@mdx-js/react';
import styles from '../essays/essays.module.scss';

const components = {
  // Custom components for markdown elements
  h1: (props) => <h1 className={styles.title} {...props} />,
  h2: (props) => <h2 className="text-3xl font-semibold my-3" {...props} />,
  p: (props) => <p className="my-2" {...props} />,
  // Add more component overrides as needed
};

export function MDXWrapper({ children }) {
  return (
    <MDXProvider components={components}>
      <div className={styles.essayContainer}>{children}</div>
    </MDXProvider>
  );
}
