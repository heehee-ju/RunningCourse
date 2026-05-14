import type { Route } from '@/commons/types/runroute';

export function dedupeRoutesById(routes: Route[]): Route[] {
  const deduped = new Map<string, Route>();
  for (const route of routes) {
    deduped.set(route.id, route);
  }
  return Array.from(deduped.values());
}
