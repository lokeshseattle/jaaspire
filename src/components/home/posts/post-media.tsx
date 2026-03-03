// src/components/home/posts/PostMedia.tsx
import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { VideoView } from "expo-video";
import { memo, useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface Props {
  postId: number;
  type: string;
  media: string;
  thumbnail?: string;
  isVisible: boolean;
  isLiked: boolean;
  onLike: () => void;
}

function PostMedia({
  postId,
  type,
  media,
  thumbnail,
  isVisible,
  isLiked,
  onLike,
}: Props) {
  const lastTap = useRef<number | null>(null);

  // Animation values
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Video player hook
  const {
    player,
    isBuffering,
    isPlaying,
    isMuted,
    togglePlayPause,
    toggleMute,
    pause,
    play,
  } = useManagedVideoPlayer(
    postId,
    type === "video" ? media : null,
    isVisible
  );

  const triggerHeartAnimation = () => {
    scale.value = 0.6;
    opacity.value = 1;
    scale.value = withSpring(
      1.3,
      { damping: 8, stiffness: 300, mass: 0.5 },
      () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 250 });
      }
    );
    setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
    }, 350);
  };

  const handleDoubleTap = () => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) onLike();
  };

  const handleTap = () => {
    const now = Date.now();

    if (lastTap.current && now - lastTap.current < 300) {
      // Double tap - like
      handleDoubleTap();
    } else {
      // Single tap - toggle play/pause
      // if (type === "video") {
      //   togglePlayPause();
      // }
    }

    lastTap.current = now;
  };

  // Long press to pause (like Instagram)
  const handleLongPressIn = () => {
    if (type === "video") {
      pause();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleLongPressOut = () => {
    if (type === "video") {
      play();
    }
  };

  return (
    <View style={styles.container}>
      {type === "image" ? (
        <Pressable onPress={handleTap}>
          <Image
            source={{ uri: media }}
            style={[styles.media, { aspectRatio: 4 / 5 }]}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
        </Pressable>
      ) : (
        <Pressable
          onPress={handleTap}
          onLongPress={handleLongPressIn}
          onPressOut={handleLongPressOut}
          delayLongPress={200}
        >
          <View style={[styles.media, { aspectRatio: 9 / 14 }]}>
            {/* Thumbnail while loading */}
            {thumbnail && isBuffering && (
              <Image
                source={{ uri: thumbnail }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )}

            {/* Video */}
            {player && (
              <VideoView
                style={StyleSheet.absoluteFill}
                player={player}
                contentFit="cover"
                nativeControls={false}
                allowsPictureInPicture={false}
              />
            )}

            {/* Buffering indicator */}
            {isBuffering && (
              <View style={styles.centerOverlay}>
                <ActivityIndicator color="white" size="large" />
              </View>
            )}

            {/* Mute button */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                toggleMute();
              }}
              style={styles.muteButton}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={18}
                color="white"
              />
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Heart overlay */}
      <Animated.View style={[styles.heartContainer, animatedStyle]} pointerEvents="none">
        <Ionicons
          name="heart"
          size={120}
          color={isLiked ? "#ff3040" : "white"}
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
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  muteButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 20,
  },
  heartContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -60,
    marginTop: -60,
  },
});

export default memo(PostMedia);