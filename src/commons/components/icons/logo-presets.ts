/**
 * 페이지/컨텍스트별 로고 기본 크기 preset 모음.
 */
export const LOGO_SIZE_PRESETS = {
  login: {
    width: 112,
    height: 38,
  },
  header: {
    width: 28,
    height: 22,
  },
  cardThumbnail: {
    width: 48,
    height: 32,
  },
} as const;

export type LogoSizePresetKey = keyof typeof LOGO_SIZE_PRESETS;
