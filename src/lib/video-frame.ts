export type VideoSize = { width: number; height: number };

type Sized = {
  videoWidth?: number;
  videoHeight?: number;
  media?: { videoWidth?: number; videoHeight?: number } | null;
  shadowRoot?: { querySelector: (selector: string) => { videoWidth?: number; videoHeight?: number } | null } | null;
};

export function videoFrame(width: number, height: number): (VideoSize & { landscape: boolean }) | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height, landscape: width > height };
}

function sizeOf(width?: number, height?: number) {
  return videoFrame(Number(width), Number(height));
}

export function findVideo(root: ParentNode): HTMLVideoElement | null {
  for (const element of root.querySelectorAll("*")) {
    if (element instanceof HTMLVideoElement) return element;
    const media = (element as HTMLElement & { media?: unknown }).media;
    if (media instanceof HTMLVideoElement) return media;
    if (element.shadowRoot) {
      const nested = findVideo(element.shadowRoot);
      if (nested) return nested;
    }
  }
  return null;
}

export function readVideoSize(target: EventTarget | null) {
  if (!target || typeof target !== "object") return null;
  const node = target as Sized;
  return sizeOf(node.videoWidth, node.videoHeight)
    ?? sizeOf(node.media?.videoWidth, node.media?.videoHeight)
    ?? sizeOf(node.shadowRoot?.querySelector("video")?.videoWidth, node.shadowRoot?.querySelector("video")?.videoHeight);
}
