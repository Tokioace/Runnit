import ts from 'typescript';

/**
 * Extract the complete, declared MapLibre style source URLs using the TS AST.
 * Exact values, not URL-host substrings or permissive regexp checks.
 */
export function getMapLibreStyleUrls(source) {
  const ast = ts.createSourceFile('ArcadeMapLibreView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const wanted = new Set(['STYLE_URL', 'BUILDING_TILES']);
  const found = {};
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !wanted.has(decl.name.text)) continue;
      if (!decl.initializer || !ts.isStringLiteral(decl.initializer)) {
        throw new Error('MapLibre style URLs must be literal string constants');
      }
      found[decl.name.text] = decl.initializer.text;
    }
  }
  if (!Object.keys(found).every(key => wanted.has(key)) || Object.keys(found).length !== wanted.size) {
    throw new Error('MapLibre style/source URLs are missing');
  }
  return found;
}
