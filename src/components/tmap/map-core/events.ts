/**
 * Tmap 런타임별 이벤트 바인딩(on/addListener) 호환 유틸.
 */

type EventBindable = {
  on?: (eventName: string, callback: () => void) => void;
  addListener?: (eventName: string, callback: () => void) => void;
};

export function bindMapEvents(
  target: EventBindable,
  eventNames: string[],
  callback: () => void,
): boolean {
  let bound = false;
  eventNames.forEach((eventName) => {
    if (typeof target.on === 'function') {
      target.on(eventName, callback);
      bound = true;
      return;
    }
    if (typeof target.addListener === 'function') {
      target.addListener(eventName, callback);
      bound = true;
    }
  });
  return bound;
}

export function bindSingleEvent(
  target: EventBindable,
  eventName: string,
  callback: () => void,
): void {
  if (typeof target.on === 'function') {
    try {
      target.on(eventName, callback);
      return;
    } catch {
      /* noop */
    }
  }
  if (typeof target.addListener === 'function') {
    try {
      target.addListener(eventName, callback);
    } catch {
      /* noop */
    }
  }
}
