import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';

// Map remark-directive nodes to HAST-flavored hName/hProperties so that
// react-markdown's `components` prop can render them as our React
// components. The tag names are deliberately dashed (`mn-figure`) so they
// don't collide with real HTML tags — react-markdown is happy to look them
// up in the `components` map by exact string.
//
// Authors write two inline flavors plus the container:
//   container          : :::figure{id=foo}\n caption text \n:::
//   text (labeled)     : :term[label]{to=foo}
//   text (unlabeled)   : :inline-viz{kind=spark value=0.8}

const directiveHandler: Plugin = () => (tree: any) => {
  visit(tree, (node: any) => {
    if (
      node.type !== 'textDirective' &&
      node.type !== 'leafDirective' &&
      node.type !== 'containerDirective'
    ) {
      return;
    }

    const attrs: Record<string, string> = { ...(node.attributes || {}) };

    const data = node.data || (node.data = {});
    data.hName = `mn-${node.name}`;
    data.hProperties = attrs;
  });
};

export default directiveHandler;
