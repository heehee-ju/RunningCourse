// 코스 목록 바텀시트 순수 계산·상수 (드래그 임계값·상태 전이)

export type BottomSheetState = 'collapsed' | 'peek' | 'expanded';

export const SHEET_ORDER: BottomSheetState[] = ['collapsed', 'peek', 'expanded'];

export const PEEK_VISIBLE_HEIGHT = 260;
export const SKELETON_CARD_COUNT = 3;

export const PAN_DRAG_THRESHOLD = 12;
export const PAN_VELOCITY_THRESHOLD = 140;
export const PAN_DOWN_DRAG_THRESHOLD = 8;
export const PAN_DOWN_VELOCITY_THRESHOLD = 90;

export function roundUpToEven(value: number): number {
  const rounded = Math.ceil(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function getNextSheetState(
  current: BottomSheetState,
  direction: 'up' | 'down',
): BottomSheetState {
  const currentIndex = SHEET_ORDER.indexOf(current);
  if (direction === 'up') {
    return SHEET_ORDER[Math.min(currentIndex + 1, SHEET_ORDER.length - 1)];
  }
  return SHEET_ORDER[Math.max(currentIndex - 1, 0)];
}

type ComputeTranslateParams = {
  effectiveSheetState: BottomSheetState;
  effectiveSheetHeight: number;
  isDragging: boolean;
  dragOffsetY: number;
  peekVisibleHeight?: number;
};

/** 시트 DOM 높이·상태·드래그 오프셋으로 CSS 변수용 translateY(px) 계산 */
export function computeSheetTranslateY({
  effectiveSheetState,
  effectiveSheetHeight,
  isDragging,
  dragOffsetY,
  peekVisibleHeight = PEEK_VISIBLE_HEIGHT,
}: ComputeTranslateParams): number {
  const minTranslateY = 20;
  const maxTranslateY = Math.max(0, effectiveSheetHeight - 24);
  const baseTranslateY =
    effectiveSheetState === 'collapsed'
      ? Math.max(0, effectiveSheetHeight - 24)
      : effectiveSheetState === 'peek'
        ? Math.max(0, effectiveSheetHeight - peekVisibleHeight)
        : 20;
  return Math.min(
    maxTranslateY,
    Math.max(minTranslateY, baseTranslateY + (isDragging ? dragOffsetY : 0)),
  );
}
