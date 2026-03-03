import { useTheme } from "@/src/theme/ThemeProvider";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet } from "react-native";

const SIZE = 48;
const RING_WIDTH = 2;

type Props = {
  uri: string;
  hasStory?: boolean;
  seen?: boolean;
  username: string;
};

export default function StoryAvatar({
  uri,
  hasStory = true,
  seen = false,
  username,
}: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (!hasStory) {
    return <Image source={{ uri }} style={styles.avatarOnly} />;
  }

  const gradientColors = seen
    ? [theme.colors.textSecondary, theme.colors.textSecondary]
    : [
      "#FFD700", // subtle gold
      theme.colors.tint,
      theme.colors.primary,
      theme.colors.tint,
      "#FFD700",
    ];

  const navigateToStory = () => {
    router.push({
      pathname: "/story/[username]",
      params: { username },
    });
  };

  return (
    <LinearGradient
      colors={gradientColors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.ring}
    >
      <Pressable onPress={navigateToStory} style={styles.innerRing}>
        <Image source={{ uri }} style={styles.avatar} />
      </Pressable>
    </LinearGradient>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    ring: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      padding: 2,
    },
    innerRing: {
      width: SIZE - RING_WIDTH * 2,
      height: SIZE - RING_WIDTH * 2,
      borderRadius: (SIZE - RING_WIDTH * 2) / 2,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: 2,
    },
    avatar: {
      width: "100%",
      height: "100%",
      borderRadius: theme.radius.pill,
      margin: 2,
    },
    avatarOnly: {
      width: SIZE,
      height: SIZE,
      borderRadius: theme.radius.pill,
    },
  });
