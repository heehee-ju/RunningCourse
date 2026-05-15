import Image from 'next/image';

type LogoIconProps = {
  width?: number;
  height?: number;
  className?: string;
};

export function LogoIcon({ width = 44, height = 38, className }: LogoIconProps) {
  return (
    <Image
      src="/assets/logo/logo.svg"
      alt="RouteRun 로고"
      width={width}
      height={height}
      className={className}
      draggable={false}
      unoptimized
    />
  );
}

export default LogoIcon;
