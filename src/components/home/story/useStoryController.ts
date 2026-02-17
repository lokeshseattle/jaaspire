import { useEffect, useRef, useState } from "react";
import {
    cancelAnimation,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { StoryItem } from "./types";

export function useStoryController(
  stories: StoryItem[],
  onComplete: () => void,
) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const progress = useSharedValue(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getDuration = (story: StoryItem) => {
    if (story.duration) return story.duration;
    return story.type === "video" ? 10000 : 5000;
  };

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const start = (index: number) => {
    clearTimer();

    const story = stories[index];
    const duration = getDuration(story);

    progress.value = 0;

    // Animate progress on UI thread
    progress.value = withTiming(1, { duration });

    // Handle next slide on JS thread
    timeoutRef.current = setTimeout(() => {
      next();
    }, duration);
  };

  const next = () => {
    setCurrentIndex((prev) => {
      const nextIndex = prev + 1;

      if (nextIndex < stories.length) {
        start(nextIndex);
        return nextIndex;
      } else {
        onComplete();
        return prev;
      }
    });
  };

  const previous = () => {
    setCurrentIndex((prev) => {
      const prevIndex = prev - 1;

      if (prevIndex >= 0) {
        start(prevIndex);
        return prevIndex;
      }

      return prev;
    });
  };

  const pause = () => {
    cancelAnimation(progress);
    clearTimer();
  };

  const resume = () => {
    start(currentIndex);
  };

  useEffect(() => {
    start(0);

    return () => {
      clearTimer();
    };
  }, []);

  return {
    currentIndex,
    progress,
    next,
    previous,
    pause,
    resume,
  };
}
