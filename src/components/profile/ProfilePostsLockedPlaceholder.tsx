import { ThemedText as Text } from "@/src/components/themed-text";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type FollowStatus = "follow" | "unfollow" | "requested";

type Props = {
  /** While profile is loading for another user */
  loading?: boolean;
  username?: string;
  followStatus?: FollowStatus;
};

export function ProfilePostsLockedPlaceholder({
  loading,
  username,
  followStatus,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (loading) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const pending = followStatus === "requested";
  const title = pending ? "Request pending" : "This account is private";
  const subtitle = pending
    ? `@${username ?? "This user"} will need to accept your follow request before you can see their posts.`
    : `Follow @${username ?? "this user"} to see their posts and send messages.`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderColor: theme.colors.border }]}>
        <View
          style={[
            styles.iconRing,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name={pending ? "time-outline" : "lock-closed-outline"}
            size={28}
            color={theme.colors.primary}
          />
        </View>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      alignSelf: "stretch",
      width: "100%",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
      minHeight: 220,
    },
    center: {
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.card,
    },
    iconRing: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      maxWidth: 300,
    },
  });
