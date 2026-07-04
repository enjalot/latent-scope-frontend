import { MoonshineEssay, loadArticles } from '../runtime';
import { figures, inlineFigures } from './figures/registry';

const modules = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const articles = loadArticles(modules as Record<string, string>);

export default function Essay() {
  return (
    <MoonshineEssay
      slug="anisotropy"
      articles={articles}
      figures={figures}
      inlineFigures={inlineFigures}
    />
  );
}
