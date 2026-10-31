import Image from "next/image";

type MediaImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
};

function optimizable(src: string) {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    return host === "firebasestorage.googleapis.com" || host === "storage.googleapis.com" || host.endsWith(".firebasestorage.app");
  } catch {
    return false;
  }
}

export function MediaImage({ src, alt, className, fill, priority, quality, sizes, onLoad, onError }: MediaImageProps) {
  if (!src) return null;
  if (!optimizable(src)) {
    return <img src={src} alt={alt} className={fill ? `absolute inset-0 h-full w-full ${className ?? ""}` : className} onLoad={onLoad} onError={onError} />;
  }
  return <Image src={src} alt={alt} fill={fill} priority={priority} quality={quality} sizes={sizes} className={className} onLoad={onLoad} onError={onError} />;
}
