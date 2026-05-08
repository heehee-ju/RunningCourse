import Image from 'next/image';

type LogoIconProps = {
  width?: number;
  height?: number;
  className?: string;
};

export function LogoIcon({ width = 44, height = 32, className }: LogoIconProps) {
  return (
    <Image
      src="/icons/rr-logo.png"
      alt="RouteRun 로고"
      width={width}
      height={height}
      className={className}
      draggable={false}
    />
  );
}

export default LogoIcon;
