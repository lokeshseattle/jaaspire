import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const DEFAULT_SIZE = 48;
const RING_PADDING = 3;
const INNER_GAP = 2;
const ADD_BUTTON_SIZE = 24;

type Props = {
  uri: string;
  hasStory?: boolean;
  seen?: boolean;
  username: string;
  size?: number;
  showAddButton?: boolean;
  onAddStory?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
};

export default function StoryAvatar({
  uri,
  hasStory = false,
  seen = false,
  username,
  size = DEFAULT_SIZE,
  showAddButton = false,
  onAddStory,
  isUploading = false,
  disabled = false,
}: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme, size);
  const avatarWithRingSize = size - 2 * (RING_PADDING + INNER_GAP);

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!isUploading) return;
    rotation.value = withRepeat(withTiming(360, { duration: 1200 }), -1, false);
  }, [isUploading, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const navigateToStory = () => {
    if (disabled || !hasStory) return;
    router.push({
      pathname: "/story/[username]",
      params: { username },
    });
  };

  const gradientColors = seen
    ? [theme.colors.textSecondary, theme.colors.textSecondary]
    : [
        "#FFD700",
        theme.colors.tint,
        theme.colors.primary,
        theme.colors.tint,
        "#FFD700",
      ];

  const uploadGradient =
    theme.colors.gradient ??
    (["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"] as const);

  const renderAvatarImage = (diameter: number) => (
    <Image
      cachePolicy="disk"
      source={{ uri }}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
      }}
    />
  );

  const renderAddButton = () => {
    if (!showAddButton || isUploading || !onAddStory) return null;
    return (
      <Pressable
        onPress={onAddStory}
        style={styles.addButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add story"
      >
        <Ionicons name="add-circle" size={ADD_BUTTON_SIZE} color={theme.colors.primary} />
      </Pressable>
    );
  };

  if (disabled) {
    return (
      <View style={styles.wrapper}>
        {renderAvatarImage(size)}
      </View>
    );
  }

  if (isUploading) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.uploadRingContainer}>
          <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
            <LinearGradient
              colors={uploadGradient as unknown as [string, string, ...string[]]}
              style={styles.uploadGradient}
            />
          </Animated.View>
          <View style={styles.innerRing}>
            {renderAvatarImage(avatarWithRingSize)}
          </View>
        </View>
      </View>
    );
  }

  if (!hasStory) {
    return (
      <View style={styles.wrapper}>
        {renderAvatarImage(size)}
        {renderAddButton()}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ring}
      >
        <Pressable onPress={navigateToStory} style={styles.innerRing}>
          {renderAvatarImage(avatarWithRingSize)}
        </Pressable>
      </LinearGradient>
      {renderAddButton()}
    </View>
  );
}

const createStyles = (theme: { colors: { background: string } }, size: number) => {
  const innerSize = size - RING_PADDING * 2;

  return StyleSheet.create({
    wrapper: {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
    },
    ring: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: "center",
      justifyContent: "center",
      padding: RING_PADDING,
    },
    innerRing: {
      width: innerSize,
      height: innerSize,
      borderRadius: innerSize / 2,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: INNER_GAP,
      overflow: "hidden",
    },
    uploadRingContainer: {
      width: size,
      height: size,
      borderRadius: size / 2,
      padding: RING_PADDING,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    uploadGradient: {
      flex: 1,
      borderRadius: size / 2,
    },
    addButton: {
      position: "absolute",
      backgroundColor: "white",
      borderRadius: ADD_BUTTON_SIZE / 2,
      bottom: 0,
      right: 0,
    },
  });
};
