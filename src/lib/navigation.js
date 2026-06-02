export function buildLoginRedirectPath(language, location) {
  const currentPath = `${location.pathname}${location.search || ''}`;
  return `/${language}/login?redirect=${encodeURIComponent(currentPath)}`;
}
