import { useGetProfile } from "@/src/features/profile/profile.hooks";
import {
  useDeleteStory,
  useGetStoryByUsername,
} from "@/src/features/story/story.hooks";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import StoryHeader from "./components/StoryHeader";
import StoryMedia from "./components/StoryMedia";
import StoryProgress from "./components/StoryProgress";
import StoryTouchOverlay from "./components/StoryTouchOverlay";
import Viewers from "./components/Viewers";

const STORY_DURATION = 5000;

interface TProps {
  username: string;
  onClose?: () => void;
  isPanning?: boolean;
}

const StoryView = ({ username, onClose, isPanning = false }: TProps) => {
  const { data, isLoading, isError } = useGetStoryByUsername(username);
  const { data: loginProfile } = useGetProfile();
  const { mutate } = useDeleteStory();

  const loggedInUser = loginProfile?.data.username;

  console.log(username);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const progress = useSharedValue(0);
  const callbackRef = useRef(onClose);
  callbackRef.current = onClose;

  const stories = data?.stories ?? [];
  const user = data?.user;
  const hasStories = data?.has_stories ?? false;

  const safeIndex =
    stories.length > 0 ? Math.min(currentIndex, stories.length - 1) : 0;

  const currentStory = stories[safeIndex];

  // const storyViewerQuery = useGetStoryViewers(currentStory.id)

  // Go to next story
  const goNext = useCallback(() => {
    if (safeIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      callbackRef.current?.();
    }
  }, [safeIndex, stories.length]);

  // Go to previous story
  const goPrevious = useCallback(() => {
    if (safeIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [safeIndex]);

  // Start/restart progress animation when story changes
  useEffect(() => {
    if (!stories.length) return;

    cancelAnimation(progress);
    progress.value = 0;

    progress.value = withTiming(
      1,
      { duration: STORY_DURATION, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(goNext)();
        }
      },
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [safeIndex, stories.length]);

  // Pause/resume on long press or panning
  useEffect(() => {
    const shouldPause = isPaused || isPanning;

    if (shouldPause) {
      cancelAnimation(progress);
    } else {
      // Resume from current progress
      const remaining = 1 - progress.value;
      if (remaining > 0) {
        progress.value = withTiming(
          1,
          {
            duration: STORY_DURATION * remaining,
            easing: Easing.linear,
          },
          (finished) => {
            if (finished) {
              runOnJS(goNext)();
            }
          },
        );
      }
    }
  }, [isPaused, isPanning]);

  const handleDeleteStory = () => {
    mutate({ id: currentStory.id });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="white" size="large" />
      </View>
    );
  }

  if (isError || !hasStories || !currentStory) {
    return null;
  }

  console.log(currentStory.id);

  return (
    <View style={styles.container}>
      {/* Story image — bottom layer */}
      <StoryMedia uri={currentStory.path} />
      {/* Gradient overlay for top UI readability */}
      <Animated.View style={styles.topGradient} />

      {/* Progress bars */}
      <StoryProgress
        total={stories.length}
        currentIndex={safeIndex}
        progress={progress}
      />

      {/* User header */}
      <StoryHeader
        avatar={user?.avatar ?? ""}
        ownStory={user?.username === loggedInUser}
        username={user?.username ?? username}
        createdAt={currentStory.created_at}
        onClose={onClose}
        onDelete={handleDeleteStory}
      />

      {/* {user?.name === "You" && <StoryViews />} */}

      {/* Touch overlay — topmost for gestures */}
      <StoryTouchOverlay
        onNext={goNext}
        onPrevious={goPrevious}
        onPressIn={() => setIsPaused(true)}
        onPressOut={() => setIsPaused(false)}
      />
      <Viewers id={currentStory.id} setIsPaused={setIsPaused} />
    </View>
  );
};

export default StoryView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "transparent",
    // A subtle dark gradient effect using shadow for readability
    opacity: 0.6,
  },
});
