import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { VideoView } from "expo-video";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

interface Props {
  postId: number;
  type: string;
  media: string;
  thumbnail?: string;
  isVisible: boolean;
  isLiked: boolean;
  onLike: () => void;
  nextPostId?: number;   // For preloading
  nextPostUrl?: string;  // For preloading
}

// Double-tap detection window (ms)
const DOUBLE_TAP_DELAY = 300;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_MEDIA_HEIGHT = SCREEN_HEIGHT * 0.75;

function PostMedia({
  postId,
  type,
  media,
  thumbnail,
  isVisible,
  isLiked,
  onLike,
  nextPostId,
  nextPostUrl,
}: Props) {
  // Refs for tap handling
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values for heart
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Animation values for mute icon
  const muteOpacity = useSharedValue(0);
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const animatedMuteStyle = useAnimatedStyle(() => ({
    opacity: muteOpacity.value,
  }));

  // Video player hook - now with preloading support
  const {
    player,
    isReady,
    isBuffering,
    isPlaying,
    isMuted,
    toggleMute,
    togglePlayPause,
    pause,
    play,
  } = useManagedVideoPlayer(
    postId,
    type === "video" ? media : null,
    isVisible,
    nextPostUrl,  // Pass for preloading
    nextPostId    // Pass for preloading
  );

  // Dynamic Aspect Ratio
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    if (type === "video" && isReady && player?.videoTrack?.size) {
      const { width, height } = player.videoTrack.size;
      if (width && height) {
        setAspectRatio(width / height);
      }
    }
  }, [type, isReady, player]);

  const handleImageLoad = useCallback((e: any) => {
    if (e.source?.width && e.source?.height) {
      setAspectRatio(e.source.width / e.source.height);
    }
  }, []);

  // Heart animation
  const triggerHeartAnimation = useCallback(() => {
    scale.value = 0.6;
    opacity.value = 1;
    scale.value = withSpring(
      1.3,
      { damping: 8, stiffness: 300, mass: 0.5 },
      (finished) => {
        if (finished) {
          scale.value = withSpring(1, { damping: 10, stiffness: 250 });
        }
      }
    );
    // Fade out after delay
    opacity.value = withTiming(0, { duration: 600 }, undefined);
  }, []);

  // Double-tap handler (like)
  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) {
      onLike();
    }
  }, [isLiked, onLike, triggerHeartAnimation]);

  const showMuteIcon = useCallback(() => {
    muteOpacity.value = withTiming(1, { duration: 200 });
    if (muteTimerRef.current) {
      clearTimeout(muteTimerRef.current);
    }
    muteTimerRef.current = setTimeout(() => {
      muteOpacity.value = withTiming(0, { duration: 500 });
    }, 1000);
  }, []);

  // Single-tap handler (show mute icon for video, nothing for image)
  const handleSingleTap = useCallback(() => {
    if (type === "video") {
      showMuteIcon();
    }
  }, [type, showMuteIcon]);

  // Unified tap handler with debounce to distinguish single vs double
  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    // Clear any pending single-tap action
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      lastTapRef.current = 0; // Reset to prevent triple-tap issues
      handleDoubleTap();
    } else {
      // Potential single tap - wait to see if another tap comes
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        handleSingleTap();
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  }, [handleDoubleTap, handleSingleTap]);

  // Long press handlers (pause video while held)
  const handleLongPressIn = useCallback(() => {
    // Cancel any pending single-tap action when long press starts
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (type === "video" && isPlaying) {
      pause();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [type, isPlaying, pause]);

  const handleLongPressOut = useCallback(() => {
    if (type === "video" && isVisible) {
      play();
    }
  }, [type, isVisible, play]);

  // Mute button handler - stop propagation to prevent tap handler
  const handleMutePress = useCallback(() => {
    toggleMute();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showMuteIcon();
  }, [toggleMute, showMuteIcon]);

  // Don't render if no media
  if (!media) return null;

  // Determine if we should show the video player
  // Show VideoView as soon as player exists (not gated on isReady)
  // VideoView handles its own loading state internally
  const showVideoView = player !== null;

  // Show loading overlay when buffering or not ready
  const showLoadingOverlay = type === "video" && (isBuffering || !isReady);

  const calculatedHeight = aspectRatio ? SCREEN_WIDTH / aspectRatio : SCREEN_WIDTH;
  const containerHeight = Math.min(calculatedHeight, MAX_MEDIA_HEIGHT);

  return (
    <View style={styles.container}>
      {type === "image" ? (
        <Pressable onPress={handleTap}>
          <Image
            source={{ uri: media }}
            style={[styles.media, { height: containerHeight }]}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
            onLoad={handleImageLoad}
          />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleTap}
          onLongPress={handleLongPressIn}
          onPressOut={handleLongPressOut}
          delayLongPress={200}
        >
          <View style={[styles.media, { height: containerHeight }]}>
            {/* Thumbnail as background while loading */}
            {thumbnail && (
              <Image
                source={{ uri: thumbnail }}
                style={[
                  StyleSheet.absoluteFill,
                  // Hide thumbnail once video is ready and playing
                  { opacity: isReady && isPlaying ? 0 : 1 }
                ]}
                contentFit="cover"
                cachePolicy="disk"
              />
            )}

            {/* Video player - render as soon as player exists */}
            {showVideoView && (
              <VideoView
                style={StyleSheet.absoluteFill}
                player={player}
                contentFit="cover"
                nativeControls={false}
                allowsPictureInPicture={false}
              />
            )}

            {/* Loading overlay */}
            {showLoadingOverlay && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="white" size="large" />
              </View>
            )}

            {/* Play/Pause indicator (briefly shows on tap) */}
            {!isPlaying && isReady && isVisible && (
              <View style={styles.playIndicator}>
                <Ionicons name="play" size={50} color="white" />
              </View>
            )}

            {/* Mute button */}
            <AnimatedPressable
              onPress={handleMutePress}
              style={[styles.muteButton, animatedMuteStyle]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={18}
                color="white"
              />
            </AnimatedPressable>
          </View>
        </Pressable>
      )}

      {/* Heart overlay for double-tap like */}
      <Animated.View
        style={[styles.heartContainer, animatedStyle]}
        pointerEvents="none"
      >
        <Ionicons
          name="heart"
          size={120}
          color="#ff3040"
          style={styles.heartIcon}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  media: {
    width: "100%",
    backgroundColor: "#000",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  playIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  muteButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 8,
    borderRadius: 20,
  },
  heartContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -60,
    marginTop: -60,
    justifyContent: "center",
    alignItems: "center",
  },
  heartIcon: {
    // Shadow for visibility on light backgrounds
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export default memo(PostMedia);