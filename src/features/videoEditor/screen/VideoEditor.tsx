// src/features/videoEditor/VideoEditorScreen.tsx

import { VideoPlayer, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { TrimmerBar } from "../components/Trimmerbar/index";
import { VideoPreview } from "../components/VideoPreview";
import { COLORS, LAYOUT, TRIMMER } from "../constants";
import { usePlayheadScrubber } from "../hooks/usePlayheadScrubber";
import { useTrimmerThumbnails } from "../hooks/useTrimmerThumbnails";
import { useVideoLoop } from "../hooks/useVideoLoop";
import { useVideoTrimmer } from "../hooks/useVideoTrimmer";
import { VideoEditorProps, VideoEditorResult } from "../types";

interface VideoEditorContentProps {
  player: VideoPlayer;
  videoUri: string;
  fallbackDimensions?: { width?: number; height?: number };
  duration: number;
  onConfirm: (result: VideoEditorResult) => void;
  onCancel: () => void;
}

const VideoEditorContent: React.FC<VideoEditorContentProps> = ({
  player,
  videoUri,
  fallbackDimensions,
  duration,
  onConfirm,
  onCancel,
}) => {
  const prevTrimRef = useRef<{ startTime: number; endTime: number } | null>(
    null,
  );

  const { thumbnails, isLoading: thumbnailsLoading } = useTrimmerThumbnails(
    videoUri,
    duration,
  );

  const {
    trimRange,
    leftHandleGesture,
    rightHandleGesture,
    middleGesture,
    leftHandleStyle,
    rightHandleStyle,
    selectionStyle,
    leftDimStyle,
    rightDimStyle,
  } = useVideoTrimmer({
    duration,
    initialStartTime: 0,
    initialEndTime: duration,
  });

  const resumePlayback = useCallback(
    (afterSeek = false) => {
      if (!player) return;

      const tryPlay = () => {
        try {
          player.play();
        } catch {
          /* native player */
        }
      };

      if (afterSeek) {
        const playingSub = player.addListener("playingChange", ({ isPlaying }) => {
          if (!isPlaying) {
            tryPlay();
            playingSub.remove();
          }
        });
        if (player.status !== "readyToPlay") {
          const statusSub = player.addListener("statusChange", () => {
            if (player.status === "readyToPlay") {
              tryPlay();
              statusSub.remove();
            }
          });
        }
      }

      tryPlay();
    },
    [player],
  );

  useVideoLoop({
    player,
    startTime: trimRange.startTime,
    endTime: trimRange.endTime,
  });

  useEffect(() => {
    resumePlayback();
  }, [player, resumePlayback]);

  useEffect(() => {
    if (!player) return;
    player.muted = false;
  }, [player]);

  const progressPosition = useSharedValue(0);
  const trackWidth = LAYOUT.TRIMMER_WIDTH - TRIMMER.HANDLE_WIDTH * 2;

  const { playheadGesture, isScrubbing } = usePlayheadScrubber({
    player,
    duration,
    trimRange,
    trackWidth,
    progressPosition,
  });

  useEffect(() => {
    let animationFrameId: number;
    let cancelled = false;

    const updateProgress = () => {
      if (cancelled) return;

      if (player && duration > 0 && !isScrubbing.value) {
        const currentTimeMs = player.currentTime * 1000;
        const progress = currentTimeMs / duration;
        const minProgress = trimRange.startTime / duration;
        const maxProgress = Math.max(
          minProgress,
          (trimRange.endTime - 1) / duration,
        );
        progressPosition.value = Math.max(
          minProgress,
          Math.min(maxProgress, progress),
        );
      }

      animationFrameId = requestAnimationFrame(updateProgress);
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      cancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [player, duration, isScrubbing, progressPosition, trimRange.startTime, trimRange.endTime]);

  useEffect(() => {
    if (!player) return;

    const prev = prevTrimRef.current;
    prevTrimRef.current = {
      startTime: trimRange.startTime,
      endTime: trimRange.endTime,
    };

    if (!prev) return;

    const deltaStart = trimRange.startTime - prev.startTime;
    const deltaEnd = trimRange.endTime - prev.endTime;
    const isMiddleDrag =
      deltaStart !== 0 && Math.abs(deltaStart - deltaEnd) <= 1;
    const isLeftHandleDrag = deltaStart !== 0 && !isMiddleDrag;
    const isRightHandleDrag = deltaEnd !== 0 && !isMiddleDrag;
    let targetMs = player.currentTime * 1000;

    if (isMiddleDrag) {
      targetMs += deltaStart;
    } else if (isLeftHandleDrag || isRightHandleDrag) {
      // Handle-only drag — replay preview from the new in-point.
      targetMs = trimRange.startTime;
    } else if (
      targetMs < trimRange.startTime ||
      targetMs >= trimRange.endTime
    ) {
      targetMs = trimRange.startTime;
    }

    targetMs = Math.max(
      trimRange.startTime,
      Math.min(trimRange.endTime - 1, targetMs),
    );

    const didSeek = Math.abs(targetMs - player.currentTime * 1000) > 1;

    if (didSeek) {
      player.currentTime = targetMs / 1000;
      progressPosition.value = targetMs / duration;
    }

    resumePlayback(didSeek || isLeftHandleDrag || isRightHandleDrag || isMiddleDrag);
  }, [trimRange.startTime, trimRange.endTime, player, duration, resumePlayback, progressPosition]);

  const playheadStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: progressPosition.value * trackWidth + TRIMMER.HANDLE_WIDTH,
      },
    ],
  }));

  const handleConfirm = useCallback(() => {
    if (player) {
      try {
        player.pause();
      } catch {
        /* native player */
      }
    }

    onConfirm({
      uri: videoUri,
      startTime: trimRange.startTime,
      endTime: trimRange.endTime,
      duration,
    });
  }, [videoUri, trimRange, duration, onConfirm, player]);

  const handleCancel = useCallback(() => {
    if (player) {
      try {
        player.pause();
      } catch {
        /* native player */
      }
    }

    onCancel();
  }, [onCancel, player]);

  const handleReplayFromStart = useCallback(() => {
    if (!player) return;

    player.currentTime = trimRange.startTime / 1000;
    progressPosition.value = trimRange.startTime / duration;
    resumePlayback(true);
  }, [player, trimRange.startTime, duration, progressPosition, resumePlayback]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.previewContainer}>
          <VideoPreview
            player={player}
            videoUri={videoUri}
            fallbackDimensions={fallbackDimensions}
          />
          <View style={styles.headerOverlay} pointerEvents="box-none">
            <Pressable onPress={handleCancel}>
              <Text style={styles.headerTitle}>Back</Text>
            </Pressable>
            <Pressable onPress={handleConfirm}>
              <Text style={styles.headerTitle}>Done</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={handleReplayFromStart}
            style={styles.replayButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Replay from trim start"
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.trimmerContainer}>
          <TrimmerBar
            duration={duration}
            trimRange={trimRange}
            thumbnails={thumbnails}
            thumbnailsLoading={thumbnailsLoading}
            leftHandleGesture={leftHandleGesture}
            rightHandleGesture={rightHandleGesture}
            middleGesture={middleGesture}
            playheadGesture={playheadGesture}
            leftHandleStyle={leftHandleStyle}
            rightHandleStyle={rightHandleStyle}
            selectionStyle={selectionStyle}
            leftDimStyle={leftDimStyle}
            rightDimStyle={rightDimStyle}
            playheadStyle={playheadStyle}
          />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export const VideoEditorScreen: React.FC<VideoEditorProps> = ({
  videoUri,
  fallbackDimensions,
  onConfirm,
  onCancel,
}) => {
  const [duration, setDuration] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const player = useVideoPlayer(videoUri, (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.muted = false;
    playerInstance.currentTime = 0;
    playerInstance.play();
  });

  useEffect(() => {
    if (!player) return;

    const checkDuration = setInterval(() => {
      try {
        if (player.duration && player.duration > 0) {
          setDuration(player.duration * 1000);
          setIsLoading(false);
          clearInterval(checkDuration);
        }
      } catch {
        setError("Failed to load video");
        setIsLoading(false);
        clearInterval(checkDuration);
      }
    }, 100);

    const timeout = setTimeout(() => {
      if (isLoading) {
        clearInterval(checkDuration);
        setError("Video loading timeout");
        setIsLoading(false);
      }
    }, 10000);

    return () => {
      clearInterval(checkDuration);
      clearTimeout(timeout);
    };
  }, [player, isLoading]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.controlActive} />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !duration) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || "Failed to load video"}
          </Text>
          <Text style={styles.errorSubtext}>
            Please try again with a different video
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <VideoEditorContent
      player={player}
      videoUri={videoUri}
      fallbackDimensions={fallbackDimensions}
      duration={duration}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    backgroundColor: "black",
  },
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  headerOverlay: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
  previewContainer: {
    backgroundColor: COLORS.previewBackground,
    flex: 1,
    overflow: "hidden",
  },
  replayButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  trimmerContainer: {
    marginTop: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.cancelButton,
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});

export default VideoEditorScreen;
