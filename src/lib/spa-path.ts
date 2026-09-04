/**
 * Pathnames que não existem ainda carregam o SPA (rewrite na Vercel).
 * Mantém query/hash do convite e joga o resto para `/`,
 * exceto as páginas legais (`/privacy`, `/terms`).
 */

export type LegalKind = "privacy" | "terms";

const LEGAL_HREF: Record<LegalKind, `/${LegalKind}`> = {
  privacy: "/privacy",
  terms: "/terms",
};

export const canonicalizePath = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname || "/";
};

export const parseLegalPath = (pathname: string): LegalKind | null => {
  const path = canonicalizePath(pathname);
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  return null;
};

export const legalHref = (kind: LegalKind) => LEGAL_HREF[kind];

export const spaHomeHref = (url: {
  pathname: string;
  search: string;
  hash: string;
}) => {
  const path = canonicalizePath(url.pathname);
  if (path === "/" || path === "") return null;
  const legal = parseLegalPath(path);
  if (legal) {
    const href = `${legalHref(legal)}${url.search}${url.hash}`;
    const current = `${url.pathname}${url.search}${url.hash}`;
    return href === current ? null : href;
  }
  return `/${url.search}${url.hash}`;
};

export const settleSpaPath = () => {
  const next = spaHomeHref(window.location);
  if (!next) return;
  window.history.replaceState(null, "", next);
};
