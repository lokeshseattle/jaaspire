import { VideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  SharedValue,
  useSharedValue,
} from "react-native-reanimated";
import { TRIMMER } from "../constants";
import { TrimRange } from "../types";

interface UsePlayheadScrubberProps {
  player: VideoPlayer | null;
  duration: number;
  trimRange: TrimRange;
  trackWidth: number;
  progressPosition: SharedValue<number>;
}

interface UsePlayheadScrubberReturn {
  playheadGesture: ReturnType<typeof Gesture.Pan>;
  isScrubbing: SharedValue<boolean>;
}

export function usePlayheadScrubber({
  player,
  duration,
  trimRange,
  trackWidth,
  progressPosition,
}: UsePlayheadScrubberProps): UsePlayheadScrubberReturn {
  const isScrubbing = useSharedValue(false);
  const scrubStartProgress = useSharedValue(0);
  const trimMinProgress = useSharedValue(0);
  const trimMaxProgress = useSharedValue(1);
  const playerRef = useRef(player);
  const durationRef = useRef(duration);
  const trackWidthRef = useRef(trackWidth);

  playerRef.current = player;
  durationRef.current = duration;
  trackWidthRef.current = trackWidth;

  useEffect(() => {
    if (duration <= 0) return;
    trimMinProgress.value = trimRange.startTime / duration;
    trimMaxProgress.value = Math.max(
      trimMinProgress.value,
      (trimRange.endTime - 1) / duration,
    );
  }, [
    trimRange.startTime,
    trimRange.endTime,
    duration,
    trimMinProgress,
    trimMaxProgress,
  ]);

  const seekToMs = useCallback((timeMs: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.currentTime = timeMs / 1000;
    } catch {
      /* native player */
    }
  }, []);

  const resumePlayback = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.play();
    } catch {
      /* native player */
    }
  }, []);

  const playheadGesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop(TRIMMER.PLAYHEAD_HIT_SLOP)
        .onStart(() => {
          isScrubbing.value = true;
          const minP = trimMinProgress.value;
          const maxP = trimMaxProgress.value;
          scrubStartProgress.value = Math.max(
            minP,
            Math.min(maxP, progressPosition.value),
          );
        })
        .onUpdate((event) => {
          const dur = durationRef.current;
          const width = trackWidthRef.current;
          if (dur <= 0 || width <= 0) return;

          const minP = trimMinProgress.value;
          const maxP = trimMaxProgress.value;
          const deltaProgress = event.translationX / width;
          const clampedProgress = Math.max(
            minP,
            Math.min(maxP, scrubStartProgress.value + deltaProgress),
          );

          progressPosition.value = clampedProgress;
          runOnJS(seekToMs)(clampedProgress * dur);
        })
        .onEnd(() => {
          isScrubbing.value = false;
          runOnJS(resumePlayback)();
        })
        .onFinalize(() => {
          isScrubbing.value = false;
        }),
    [
      isScrubbing,
      progressPosition,
      scrubStartProgress,
      trimMinProgress,
      trimMaxProgress,
      seekToMs,
      resumePlayback,
    ],
  );

  return { playheadGesture, isScrubbing };
}
