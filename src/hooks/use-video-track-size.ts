import type { VideoPlayer } from "expo-video";
import { useEffect, useState } from "react";

export type VideoTrackSize = { width: number; height: number };

/** Apply display rotation so layout matches what the user sees on screen. */
export function normalizeVideoTrackSize(
  width: number,
  height: number,
  rotation?: number | null,
): VideoTrackSize {
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

/**
 * Camera videos often store landscape pixel dims with a rotation tag.
 * When rotation is missing, reconcile with picker-reported display orientation.
 */
export function reconcileTrackSizeWithFallback(
  trackSize: VideoTrackSize,
  fallbackSize?: VideoTrackSize | null,
): VideoTrackSize {
  if (!fallbackSize || fallbackSize.width <= 0 || fallbackSize.height <= 0) {
    return trackSize;
  }

  const trackPortrait = trackSize.height > trackSize.width;
  const fallbackPortrait = fallbackSize.height > fallbackSize.width;

  if (trackPortrait === fallbackPortrait) {
    return trackSize;
  }

  const minDim = Math.min(trackSize.width, trackSize.height);
  const maxDim = Math.max(trackSize.width, trackSize.height);

  return fallbackPortrait
    ? { width: minDim, height: maxDim }
    : { width: maxDim, height: minDim };
}

export type UseVideoTrackSizeOptions = {
  fallbackSize?: VideoTrackSize | null;
};

export function useVideoTrackSize(
  player: VideoPlayer | null | undefined,
  isReady: boolean,
  options?: UseVideoTrackSizeOptions,
): VideoTrackSize | null {
  const fallbackSize = options?.fallbackSize ?? null;
  const [trackSize, setTrackSize] = useState<VideoTrackSize | null>(null);

  useEffect(() => {
    if (!player) {
      setTrackSize(null);
      return;
    }

    const sync = () => {
      try {
        const track = player.videoTrack as
          | { size?: { width?: number; height?: number }; rotation?: number }
          | null
          | undefined;
        const width = track?.size?.width ?? 0;
        const height = track?.size?.height ?? 0;
        const rotation = track?.rotation ?? null;
        if (width > 0 && height > 0) {
          const normalized = normalizeVideoTrackSize(width, height, rotation);
          const displaySize = reconcileTrackSizeWithFallback(
            normalized,
            fallbackSize,
          );
          setTrackSize((prev) =>
            prev?.width === displaySize.width &&
            prev?.height === displaySize.height
              ? prev
              : displaySize,
          );
        }
      } catch {
        /* native player */
      }
    };

    sync();

    const subs = [
      player.addListener("statusChange", sync),
      player.addListener("videoTrackChange", sync),
    ];

    return () => {
      subs.forEach((sub) => sub.remove());
    };
  }, [player, isReady, fallbackSize?.width, fallbackSize?.height]);

  if (trackSize) return trackSize;

  if (
    fallbackSize &&
    fallbackSize.width > 0 &&
    fallbackSize.height > 0
  ) {
    return fallbackSize;
  }

  return null;
}
