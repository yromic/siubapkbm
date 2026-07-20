export function isPublicRoute(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname === "/" ||
    pathname === "/parent" ||
    pathname.startsWith("/parent/") ||
    ["/gallery", "/profile", "/admission", "/contact"].includes(pathname)
  );
}
