/**
 * Tmap Marker DOM에 hover 커서를 지도 패닝(grab/grabbing)보다 우선해 pointer로 보이게 한다.
 * 컨테이너에서 상속된 grab·내부 img 기본 커서를 덮기 위해 하위 노드까지 !important 적용.
 */

export type TmapMarkerElementAccessor = {
  getElement?: () => HTMLElement | null;
};

function applyPointerCursorToElementTree(root: HTMLElement): void {
  root.style.setProperty('z-index', '40', 'important');

  const nodes: HTMLElement[] = [root];
  root.querySelectorAll<HTMLElement>('*').forEach((child) => {
    nodes.push(child);
  });

  nodes.forEach((node) => {
    node.style.setProperty('cursor', 'pointer', 'important');
    node.style.setProperty('pointer-events', 'auto', 'important');
  });
}

export function applyPointerCursorToTmapMarker(marker: TmapMarkerElementAccessor): void {
  const apply = (): void => {
    const el = marker.getElement?.();
    if (el instanceof HTMLElement) {
      applyPointerCursorToElementTree(el);
    }
  };

  apply();
  window.requestAnimationFrame(apply);
  window.requestAnimationFrame(() => window.requestAnimationFrame(apply));
}
