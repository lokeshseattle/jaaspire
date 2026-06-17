import { useVerificationQuery } from "@/src/features/settings/settings.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  verificationDisplayStatus,
  verificationStatusColor,
  verificationStatusLabel,
} from "./verification.utils";

export function VerificationSettingsItem() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { data, isLoading, isError } = useVerificationQuery();

  const verification = data?.data;
  const displayStatus = verification
    ? verificationDisplayStatus(verification)
    : undefined;
  const statusText = displayStatus
    ? verificationStatusLabel(displayStatus)
    : isError
      ? "Unavailable"
      : "—";

  return (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.7}
      onPress={() => router.push("/(app)/account-verification")}
    >
      <View style={styles.left}>
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={theme.colors.icon}
        />
        <Text style={styles.label}>Account verification</Text>
      </View>

      <View style={styles.right}>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : displayStatus ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: `${verificationStatusColor(displayStatus, theme)}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: verificationStatusColor(displayStatus, theme) },
              ]}
            >
              {statusText}
            </Text>
          </View>
        ) : (
          <Text style={styles.statusFallback}>{statusText}</Text>
        )}
        <Ionicons name="chevron-forward" size={18} color={theme.colors.icon} />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    item: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      flex: 1,
    },
    label: {
      fontSize: 15,
      color: theme.colors.textPrimary,
      fontWeight: "500",
      flexShrink: 1,
    },
    right: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    badge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: theme.radius.sm,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    statusFallback: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
  });
