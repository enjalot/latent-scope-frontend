import { MoonshineEssay, loadArticles } from '../runtime';
import { figures, inlineFigures } from './figures/registry';
// Figure-support styles this series carries beyond the shared runtime
// stylesheet (taxonomy table, toggle groups, stat bars, extra palette
// tokens). Scoped under .mn-article-root.
import './styles.scss';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const articles = loadArticles(modules as Record<string, string>);

export default function Essay() {
  return (
    <MoonshineEssay
      slug="dim-reduction"
      articles={articles}
      figures={figures}
      inlineFigures={inlineFigures}
    />
  );
}
