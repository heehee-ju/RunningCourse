// 디자인: Figma node 164:16090 (icon 프레임 심볼 → lucide-react)
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  CircleMinus,
  CirclePlus,
  Heart,
  Home,
  Info,
  LocateFixed,
  LogOut,
  Map,
  MapPin,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Scan,
  Sparkles,
  SquarePlus,
  Trash2,
  Undo2,
  UserRound,
  Footprints,
  X,
} from 'lucide-react';

import styles from './styles.module.css';

const iconRegistry = {
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  circleMinus: CircleMinus,
  circlePlus: CirclePlus,
  heart: Heart,
  house: Home,
  info: Info,
  map: Map,
  mapPin: MapPin,
  minus: Minus,
  pencil: Pencil,
  plus: Plus,
  locateFixed: LocateFixed,
  rotateCcw: RotateCcw,
  save: Save,
  scan: Scan,
  sparkles: Sparkles,
  squarePlus: SquarePlus,
  trash2: Trash2,
  userRound: UserRound,
  circleCheckBig: CircleCheckBig,
  heartFilled: Heart,
  check: Check,
  circleAlert: CircleAlert,
  logOut: LogOut,
  sportShoe: Footprints,
  'undo-2': Undo2,
  x: X,
} as const;

export type IconName = keyof typeof iconRegistry;

interface IconProps {
  name: IconName;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  className?: string; // 부모에서 추가적인 CSS 모듈 클래스를 주입할 때 사용
}

export const Icon = ({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  className,
}: IconProps) => {
  const LucideComponent = iconRegistry[name];

  if (!LucideComponent) {
    console.warn(`[Icon Component] "${name}" 아이콘이 iconRegistry에 등록되지 않았습니다.`);
    return null;
  }

  const combinedClassName = `${styles.iconBase} ${className || ''}`.trim();

  const filledHeartProps =
    name === 'heartFilled' ? ({ fill: color } as const satisfies Record<string, string>) : {};

  return (
    <LucideComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={combinedClassName}
      {...filledHeartProps}
    />
  );
};

export default Icon;

export { LogoIcon } from './logo';

import type { LucideIcon } from 'lucide-react';

interface FieldLucideIconProps {
  icon: LucideIcon;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export function FieldLucideIcon({
  icon: LucideComponent,
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  className,
}: FieldLucideIconProps) {
  return (
    <LucideComponent size={size} color={color} strokeWidth={strokeWidth} className={className} />
  );
}

interface IconSvgMarkupOptions {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

type LucideIconWithNode = LucideIcon & {
  iconNode?: Array<[string, Record<string, string | number>]>;
};

// lucide-react 0.4x는 컴포넌트에 .iconNode가 없을 수 있어, Tmap data URL 등에서 사용할 때는 아래와 동기화
// https://lucide.dev/icons/footprints
const SPORT_SHOE_LUCIDE_PATHS: Array<[string, Record<string, string | number>]> = [
  [
    'path',
    {
      d: 'M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z',
    },
  ],
  [
    'path',
    {
      d: 'M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z',
    },
  ],
  ['path', { d: 'M16 17h4' }],
  ['path', { d: 'M4 13h4' }],
];

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function toSvgAttributeName(name: string) {
  if (name === 'key') {
    return '';
  }
  if (name.includes('-')) {
    return name;
  }
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export function getIconSvgMarkup({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  className,
}: IconSvgMarkupOptions) {
  const iconComponent = iconRegistry[name] as LucideIconWithNode;
  let iconNode = iconComponent.iconNode ?? [];
  if (name === 'sportShoe' && iconNode.length === 0) {
    iconNode = SPORT_SHOE_LUCIDE_PATHS;
  }
  const iconClassAttribute = className ? ` class="${escapeHtmlAttribute(className)}"` : '';
  const childNodes = iconNode
    .map(([tagName, attributes]) => {
      const parts = Object.entries(attributes)
        .map(([key, value]) => {
          const attrName = toSvgAttributeName(key);
          if (!attrName) {
            return null;
          }
          return `${attrName}="${escapeHtmlAttribute(String(value))}"`;
        })
        .filter((entry): entry is string => entry !== null);
      return `<${tagName} ${parts.join(' ')} />`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${escapeHtmlAttribute(color)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${iconClassAttribute}>${childNodes}</svg>`;
}
