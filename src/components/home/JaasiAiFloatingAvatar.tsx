import { useGetMessengerContacts } from "@/src/features/messenger/messenger.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMessengerPeer } from "@/src/utils/messenger-contact";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const AVATAR_SIZE = 44;
const RING_PADDING = 2;
const INNER_GAP = 2;
const CLOSE_BUTTON_SIZE = 18;

export default function JaasiAiFloatingAvatar() {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useGetMessengerContacts();
  const contacts = data?.data.contacts ?? [];

  const aiContact = useMemo(() => contacts.find((c) => c.isAiBot), [contacts]);

  const peer = useMemo(
    () => (aiContact ? getMessengerPeer(aiContact) : null),
    [aiContact],
  );

  const styles = useMemo(() => createStyles(theme), [theme]);

  const floatY = useSharedValue(0);
  const ringRotation = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1400 }),
        withTiming(3, { duration: 1400 }),
      ),
      -1,
      true,
    );
    ringRotation.value = withRepeat(
      withTiming(360, { duration: 8000 }),
      -1,
      false,
    );
  }, [floatY, ringRotation]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const gradientColors =
    theme.colors.gradient ??
    (["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"] as const);

  const innerAvatarSize = AVATAR_SIZE - 2 * (RING_PADDING + INNER_GAP);

  const openChat = () => {
    if (!peer) return;
    router.push({
      pathname: "/chat/[senderId]",
      params: {
        senderId: String(peer.id),
        name: peer.name,
        avatar: peer.avatar,
        isAiBot: "1",
      },
    });
  };

  if (!peer) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      {!dismissed ? (
        <Animated.View
          entering={FadeIn.duration(400).springify()}
          exiting={FadeOut.duration(250)}
          style={floatStyle}
        >
          <View style={styles.cluster}>
            <Pressable
              onPress={() => setDismissed(true)}
              style={styles.closeButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close JaasiAI assistant"
            >
              <Ionicons
                name="close"
                size={12}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={openChat}
              style={({ pressed }) => [
                styles.avatarPressable,
                pressed && styles.avatarPressablePressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Chat with JaasiAI"
            >
              <View style={styles.ringContainer}>
                <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
                  <LinearGradient
                    colors={
                      gradientColors as unknown as [string, string, ...string[]]
                    }
                    style={styles.ringGradient}
                  />
                </Animated.View>
                <View style={styles.innerRing}>
                  {peer.avatar ? (
                    <Image
                      source={{ uri: peer.avatar }}
                      style={{
                        width: innerAvatarSize,
                        height: innerAvatarSize,
                        borderRadius: innerAvatarSize / 2,
                      }}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { width: innerAvatarSize, height: innerAvatarSize },
                      ]}
                    >
                      <Ionicons
                        name="sparkles"
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: {
      position: "absolute",
      right: theme.spacing.lg,
      bottom: 14,
      zIndex: 20,
    },
    cluster: {
      alignItems: "center",
    },
    closeButton: {
      position: "absolute",
      top: -3,
      left: -4,
      zIndex: 2,
      width: CLOSE_BUTTON_SIZE,
      height: CLOSE_BUTTON_SIZE,
      borderRadius: CLOSE_BUTTON_SIZE / 2,
      backgroundColor: theme.colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    avatarPressable: {
      alignItems: "center",
    },
    avatarPressablePressed: {
      opacity: 0.85,
      transform: [{ scale: 0.96 }],
    },
    ringContainer: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      padding: RING_PADDING,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 6,
    },
    ringGradient: {
      flex: 1,
      borderRadius: AVATAR_SIZE / 2,
    },
    innerRing: {
      width: AVATAR_SIZE - RING_PADDING * 2,
      height: AVATAR_SIZE - RING_PADDING * 2,
      borderRadius: (AVATAR_SIZE - RING_PADDING * 2) / 2,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: INNER_GAP,
      overflow: "hidden",
    },
    avatarPlaceholder: {
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
