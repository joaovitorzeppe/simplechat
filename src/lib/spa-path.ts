/**
 * Pathnames que não existem ainda carregam o SPA (rewrite na Vercel).
 * Mantém query/hash do convite e joga o resto para `/`.
 */
export const spaHomeHref = (url: {
  pathname: string;
  search: string;
  hash: string;
}) => {
  if (url.pathname === "/" || url.pathname === "") return null;
  return `/${url.search}${url.hash}`;
};

export const settleSpaPath = () => {
  const next = spaHomeHref(window.location);
  if (!next) return;
  window.history.replaceState(null, "", next);
};
