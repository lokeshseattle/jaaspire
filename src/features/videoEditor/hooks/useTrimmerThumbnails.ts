import * as VideoThumbnails from "expo-video-thumbnails";
import { useEffect, useState } from "react";
import { ThumbnailFrame } from "../types";

const MAX_THUMBNAILS = 12;
const MIN_THUMBNAILS = 8;
const THUMB_INTERVAL_MS = 4000;
const MAX_FILMSTRIP_DURATION_MS = 5 * 60 * 1000;
const CONCURRENCY = 3;
const THUMB_QUALITY = 0.35;

function computeThumbnailCount(durationMs: number): number {
  if (durationMs <= 0) return MIN_THUMBNAILS;
  const byInterval = Math.ceil(durationMs / THUMB_INTERVAL_MS);
  return Math.min(MAX_THUMBNAILS, Math.max(MIN_THUMBNAILS, byInterval));
}

async function generateBatch(
  videoUri: string,
  durationMs: number,
  count: number,
  onFrame: (frame: ThumbnailFrame, index: number) => void,
) {
  const times =
    count <= 1
      ? [0]
      : Array.from({ length: count }, (_, i) =>
          Math.round((i / (count - 1)) * durationMs),
        );

  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < times.length) {
      const index = nextIndex++;
      const time = times[index];
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time,
          quality: THUMB_QUALITY,
        });
        onFrame({ time, uri }, index);
      } catch {
        /* skip failed frame */
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, times.length) }, () => worker()),
  );
}

interface UseTrimmerThumbnailsResult {
  thumbnails: (ThumbnailFrame | undefined)[];
  isLoading: boolean;
}

export function useTrimmerThumbnails(
  videoUri: string,
  durationMs: number,
): UseTrimmerThumbnailsResult {
  const [thumbnails, setThumbnails] = useState<(ThumbnailFrame | undefined)[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!videoUri || durationMs <= 0) {
      setThumbnails([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setThumbnails([]);

    const count =
      durationMs > MAX_FILMSTRIP_DURATION_MS
        ? 0
        : computeThumbnailCount(durationMs);

    if (count === 0) {
      setIsLoading(false);
      return;
    }

    const frames: (ThumbnailFrame | undefined)[] = new Array(count);

    generateBatch(videoUri, durationMs, count, (frame, index) => {
      if (cancelled) return;
      frames[index] = frame;
      setThumbnails([...frames]);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [videoUri, durationMs]);

  return { thumbnails, isLoading };
}
