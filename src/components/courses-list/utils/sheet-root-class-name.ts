// 바텀시트 상태·드래그 여부에 따라 코스 목록 루트 요소의 CSS 모듈 클래스 문자열을 만든다.

import type { BottomSheetState } from '@/commons/utils/bottom-sheet';

export type CoursesListSheetModuleClasses = {
  courseList: string;
  collapsed: string;
  peek: string;
  expanded: string;
  dragging: string;
};

/** collapsed / peek / expanded 및 dragging 오버레이 클래스 조합 */
export function buildCoursesListSheetRootClassName(
  sheetState: BottomSheetState,
  isDragging: boolean,
  sheetClasses: CoursesListSheetModuleClasses,
): string {
  const stateClass =
    sheetState === 'collapsed'
      ? sheetClasses.collapsed
      : sheetState === 'peek'
        ? sheetClasses.peek
        : sheetClasses.expanded;
  return `${sheetClasses.courseList} ${stateClass}${isDragging ? ` ${sheetClasses.dragging}` : ''}`;
}
