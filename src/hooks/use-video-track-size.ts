import type { VideoPlayer } from "expo-video";
import { useEffect, useState } from "react";

export type VideoTrackSize = { width: number; height: number };

export function useVideoTrackSize(
  player: VideoPlayer | null | undefined,
  isReady: boolean,
): VideoTrackSize | null {
  const [size, setSize] = useState<VideoTrackSize | null>(null);

  useEffect(() => {
    if (!player) {
      setSize(null);
      return;
    }

    const sync = () => {
      try {
        const track = player.videoTrack;
        const width = track?.size?.width ?? 0;
        const height = track?.size?.height ?? 0;
        if (width > 0 && height > 0) {
          setSize((prev) =>
            prev?.width === width && prev?.height === height
              ? prev
              : { width, height },
          );
        }
      } catch {
        /* native player */
      }
    };

    sync();
    const sub = player.addListener("statusChange", () => {
      sync();
    });
    return () => sub.remove();
  }, [player, isReady]);

  return size;
}
