import ts from 'typescript';

/**
 * Read the actual JSX TileLayer URL values instead of matching arbitrary
 * host fragments in source text (which are not valid URL validators).
 */
export function getTileLayerUrls(source) {
  const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const urls = [];

  const visit = (node) => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        node.tagName.getText(ast) === 'TileLayer') {
      const urlAttributes = node.attributes.properties.filter(
        (attr) => ts.isJsxAttribute(attr) && attr.name.text === 'url'
      );
      if (urlAttributes.length !== 1 || !urlAttributes[0].initializer ||
          !ts.isStringLiteral(urlAttributes[0].initializer)) {
        throw new Error('TileLayer must have exactly one literal URL');
      }
      urls.push(urlAttributes[0].initializer.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(ast);
  return urls;
}
