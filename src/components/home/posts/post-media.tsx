import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface Props {
  type: string;
  media: string;
  isVisible: boolean;
  isLiked: boolean;
  onLike: () => void;
}

function PostMedia({ type, media, isVisible, isLiked, onLike }: Props) {
  const lastTap = useRef<number | null>(null);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const triggerHeartAnimation = () => {
    scale.value = 0.6;
    opacity.value = 1;

    // Faster, tighter pop
    scale.value = withSpring(
      1.3,
      {
        damping: 8,
        stiffness: 300,
        mass: 0.5,
      },
      () => {
        scale.value = withSpring(1, {
          damping: 10,
          stiffness: 250,
        });
      },
    );

    // Shorter visible time
    setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
    }, 350);
  };

  const handleDoubleTap = () => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isLiked) return; //prevent spam

    onLike(); // optimistic update

  };

  const player = useVideoPlayer(type === "video" ? media : null, (p) => {
    if (!p) return;
    p.loop = true;
    p.muted = true;
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const toggleAudio = () => {
    if (!player) return;
    const newMutedState = !isMuted;
    player.muted = newMutedState;
    setIsMuted(newMutedState);
  };

  const handleVideoPress = () => {
    if (!player) return;

    if (isPlaying) player.pause();
    else player.play();

    setIsPlaying(!isPlaying);
  };

  const handleTap = () => {
    const now = Date.now();

    if (lastTap.current && now - lastTap.current < 300) {
      handleDoubleTap();
    } else {
      if (type === "video") handleVideoPress();
    }

    lastTap.current = now;
  };

  useEffect(() => {
    if (type !== "video" || !player) return;

    if (isVisible) player.play();
    else player.pause();
  }, [isVisible, player, type]);

  return (
    <Pressable onPress={handleTap} onLongPress={toggleAudio}>
      <View style={styles.container}>
        {type === "image" ? (
          <Image
            source={{ uri: media }}
            style={[styles.media, { aspectRatio: 4 / 5 }]}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
        ) : player ? (
          <Pressable
            onPress={handleTap}
            onLongPress={() => {
              if (type === "video") player?.pause();
            }}
            onPressOut={() => {
              if (type === "video") player?.play();
            }}
          >
            <VideoView
              style={[styles.media, { aspectRatio: 9 / 14 }]}
              player={player}
              contentFit="cover"
              nativeControls={false}
              allowsPictureInPicture={false}
            />
            <Pressable
              onPress={toggleAudio}
              style={{
                position: "absolute",
                bottom: 20,
                right: 16,
                backgroundColor: "rgba(0,0,0,0.4)",
                padding: 6,
                borderRadius: 20,
              }}
            >
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={18}
                color="white"
              />
            </Pressable>
          </Pressable>
        ) : (
          <View style={[styles.media, styles.placeholder]} />
        )}

        {/* HEART OVERLAY */}
        <Animated.View style={[styles.heartContainer, animatedStyle]}>
          <Ionicons
            name="heart"
            size={120}
            color={isLiked ? "#ff3040" : "white"}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

export default memo(PostMedia);

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  media: {
    width: "100%",
    // height: "100%",
    backgroundColor: "black",
  },
  placeholder: {
    backgroundColor: "#1a1a1a",
  },
  heartContainer: {
    position: "absolute",
    alignSelf: "center",
    top: "35%",
  },
});
