import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMediaPicker } from "@/hooks/use-media-picker";
import {
  PickedFile,
  useVideoPostDraftStore,
} from "@/src/features/post-editor/store/useVideoPostDraftStore";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";

function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function PostVideoThumbnailScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { openMediaPicker } = useMediaPicker();

  const { video, thumbnail, setThumbnail, setThumbnailTimeMs, reset } =
    useVideoPostDraftStore();

  const videoUri = video?.uri ?? null;

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    p.currentTime = 0;
    p.play();
  });

  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener(
      "playingChange",
      ({ isPlaying: playing }) => {
        setIsPlaying(playing);
      },
    );
    return () => sub.remove();
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [isLoadingDuration, setIsLoadingDuration] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeMs, setTimeMs] = useState(0);

  // Read duration from player once ready
  useEffect(() => {
    if (!player || !videoUri) return;

    setIsLoadingDuration(true);
    setDurationMs(null);

    const interval = setInterval(() => {
      try {
        if (player.duration && player.duration > 0) {
          setDurationMs(player.duration * 1000);
          setIsLoadingDuration(false);
          clearInterval(interval);
        }
      } catch {
        // ignore and keep polling a bit
      }
    }, 10000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setIsLoadingDuration(false);
      if (!durationMs) {
        Alert.alert("Error", "Failed to load video duration.");
      }
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, videoUri]);

  useEffect(() => {
    // Keep player seeked when user scrubs
    if (!player || !durationMs) return;
    player.currentTime = Math.max(0, Math.min(timeMs, durationMs)) / 1000;
  }, [player, timeMs, durationMs]);

  const handlePickCustomThumbnail = useCallback(() => {
    openMediaPicker({
      mediaTypes: ["images"],
      allowsEditing: false,
      onChange: (file) => {
        setThumbnail(file as unknown as PickedFile);
        setThumbnailTimeMs(null);
      },
    });
  }, [openMediaPicker, setThumbnail, setThumbnailTimeMs]);

  const handleUseThisFrame = useCallback(async () => {
    if (!videoUri) return;
    setIsGenerating(true);
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: timeMs,
        quality: 0.8,
      });

      const generated: PickedFile = {
        uri,
        name: `video_thumbnail_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
      setThumbnail(generated);
      setThumbnailTimeMs(timeMs);
    } catch (e) {
      console.warn("Failed to generate thumbnail:", e);
      Alert.alert(
        "Thumbnail failed",
        "Couldn’t generate a thumbnail from this video. Please choose a custom thumbnail from your gallery.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [setThumbnail, setThumbnailTimeMs, timeMs, videoUri]);

  const canDone = !!video && !!thumbnail;

  const handleCancel = useCallback(() => {
    reset();
    router.back();
  }, [reset]);

  if (!video) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>No video selected</Text>
        <Pressable style={styles.primaryButton} onPress={handleCancel}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={handleCancel} style={styles.headerIconButton}>
          <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
        </Pressable>

        <Text style={styles.headerTitle}>Thumbnail</Text>

        <Pressable
          onPress={() => router.back()}
          disabled={!canDone}
          style={[styles.doneButton, !canDone && styles.doneButtonDisabled]}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.preview}>
        {player ? (
          <>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={togglePlayPause}
            >
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
                allowsPictureInPicture={false}
              />
            </Pressable>

            <Pressable
              onPress={togglePlayPause}
              style={styles.playPauseButton}
              hitSlop={10}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#FFFFFF"
              />
            </Pressable>
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.previewFallback]} />
        )}
      </View>

      <View
        style={[
          styles.panel,
          { paddingBottom: insets.bottom + theme.spacing.lg },
        ]}
      >
        <Text style={styles.sectionTitle}>Pick from video</Text>

        {isLoadingDuration || !durationMs ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading video…</Text>
          </View>
        ) : (
          <TimeScrubber
            theme={theme}
            valueMs={timeMs}
            maxMs={durationMs}
            onChangeMs={setTimeMs}
            onScrubStart={() => {
              if (player?.playing) player.pause();
            }}
          />
        )}

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleUseThisFrame}
            disabled={isGenerating || isLoadingDuration}
            style={[
              styles.primaryButton,
              (isGenerating || isLoadingDuration) &&
                styles.primaryButtonDisabled,
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Use frame ({formatMs(timeMs)})
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handlePickCustomThumbnail}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Choose from gallery</Text>
          </Pressable>
        </View>

        {thumbnail && (
          <View style={styles.chosenRow}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.chosenText}>Thumbnail selected</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TimeScrubber({
  theme,
  valueMs,
  maxMs,
  onChangeMs,
  onScrubStart,
}: {
  theme: AppTheme;
  valueMs: number;
  maxMs: number;
  onChangeMs: (ms: number) => void;
  onScrubStart?: () => void;
}) {
  const styles = createStyles(theme);
  const clamp = useCallback(
    (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
    [],
  );

  const trackWidth = useSharedValue(1);
  const progress = useSharedValue(0);
  const startProgress = useSharedValue(0);

  useEffect(() => {
    if (!maxMs) return;
    progress.value = clamp(valueMs / maxMs, 0, 1);
  }, [clamp, maxMs, valueMs, progress]);

  const emitMs = useCallback(
    (p: number) => {
      const clamped = clamp(p, 0, 1);
      onChangeMs(Math.round(clamped * maxMs));
    },
    [clamp, maxMs, onChangeMs],
  );

  const pan = useMemo(() => {
    return Gesture.Pan()
      .onBegin(() => {
        startProgress.value = progress.value;
        if (onScrubStart) {
          runOnJS(onScrubStart)();
        }
      })
      .onUpdate((e) => {
        const w = trackWidth.value || 1;
        // relative drag for smoothness; small damping to avoid oversensitivity
        const damping = 0.75;
        const next = startProgress.value + (e.translationX / w) * damping;
        progress.value = Math.max(0, Math.min(1, next));
        runOnJS(emitMs)(progress.value);
      });
  }, [emitMs, onScrubStart, progress, startProgress, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.scrubberWrap}>
      <View style={styles.scrubberHeader}>
        <Text style={styles.scrubberLabel}>Time</Text>
        <Text style={styles.scrubberValue}>
          {formatMs(valueMs)} / {formatMs(maxMs)}
        </Text>
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={styles.scrubberTrack}
          onLayout={(e) =>
            (trackWidth.value = Math.max(1, e.nativeEvent.layout.width))
          }
        >
          <Animated.View style={[styles.scrubberFill, fillStyle]} />
          <Animated.View style={[styles.scrubberThumb, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
    },
    center: {
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    errorText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      marginBottom: theme.spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: "rgba(0,0,0,0.75)",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.08)",
      zIndex: 10,
    },
    headerIconButton: {
      padding: theme.spacing.xs,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    doneButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
    },
    doneButtonDisabled: {
      opacity: 0.5,
    },
    doneButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 14,
    },
    preview: {
      flex: 1,
      backgroundColor: "#000",
    },
    previewFallback: {
      backgroundColor: "#000",
    },
    playPauseButton: {
      position: "absolute",
      right: theme.spacing.md,
      bottom: theme.spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.14)",
    },
    panel: {
      backgroundColor: "rgba(20,20,20,0.95)",
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.08)",
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      fontSize: 12,
      fontWeight: "700",
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    actionsRow: {
      gap: theme.spacing.sm,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryButton: {
      backgroundColor: "rgba(255,255,255,0.12)",
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.pill,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    chosenRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
    },
    chosenText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    scrubberWrap: {
      gap: theme.spacing.xs,
    },
    scrubberHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    scrubberLabel: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    scrubberValue: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    scrubberTrack: {
      height: 12,
      borderRadius: theme.radius.pill,
      backgroundColor: "rgba(255,255,255,0.14)",
      justifyContent: "center",
      overflow: "visible",
    },
    scrubberFill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
    },
    scrubberThumb: {
      position: "absolute",
      width: 10,
      height: 28,
      top: -8,
      marginLeft: -5,
      borderRadius: theme.radius.pill,
      backgroundColor: "#FFFFFF",
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
  });
