import { VideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef } from "react";

interface UseVideoLoopProps {
  player: VideoPlayer | null;
  startTime: number;
  endTime: number;
}

export const useVideoLoop = ({
  player,
  startTime,
  endTime,
}: UseVideoLoopProps) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndLoop = useCallback(() => {
    if (!player) return;

    const currentTimeMs = Math.round(player.currentTime * 1000);

    // Only loop at the out-point. Do not clamp to startTime here — sub-ms drift
    // after a seek (e.g. 1656.9ms vs start 1657ms) caused an infinite seek/play storm.
    if (currentTimeMs >= endTime) {
      player.currentTime = startTime / 1000;
      try {
        player.play();
      } catch {
        /* native player */
      }
    }
  }, [player, startTime, endTime]);

  useEffect(() => {
    if (!player) return;

    intervalRef.current = setInterval(checkAndLoop, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkAndLoop, player]);
};
