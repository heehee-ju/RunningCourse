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
