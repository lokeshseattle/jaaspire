/**
 * Dev-only subscription IAP log screen.
 * Route and Settings entry are commented out in _layout.tsx / settings.tsx.
 */
import {
  SUBSCRIPTION_DEBUG_LOG,
  useIapDevStore,
} from "@/src/features/wallet/iap-dev.store";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export default function IapDebugScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const last = useIapDevStore((s) => s.last);
  const history = useIapDevStore((s) => s.history);
  const clear = useIapDevStore((s) => s.clear);

  const subscriptionHistory = history.filter(
    (e) =>
      e.phase === "availability" ||
      e.phase === "purchase" ||
      e.phase === "subscribe" ||
      e.phase === "ui" ||
      (e.phase === "error" &&
        (e.summary.includes("subscription") ||
          e.summary.includes("subscribe") ||
          e.summary.includes("Store") ||
          e.summary.includes("purchase"))),
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
    >
      <Text style={styles.lead}>
        Temporary subscription debug log (production builds included). Events are
        also printed to the console with prefix {SUBSCRIPTION_DEBUG_LOG}. Reproduce a
        subscribe flow, then share the latest JSON with engineering.
      </Text>

      <View style={styles.toolbar}>
        <Pressable
          onPress={clear}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel="Clear IAP debug log"
        >
          <Ionicons name="trash-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.clearLabel}>Clear</Text>
        </Pressable>
      </View>

      {last ? (
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <Text
              style={[
                styles.badge,
                last.status === "success" ? styles.badgeSuccess : styles.badgeFailure,
              ]}
            >
              {last.status}
            </Text>
            <Text style={styles.phase}>{last.phase}</Text>
            <Text style={styles.time}>{last.at}</Text>
          </View>
          <Text style={styles.summary}>{last.summary}</Text>
          <Text selectable style={styles.json}>
            {formatPayload(last.payload)}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.muted}>
            No subscription events yet. Open a creator profile, tap Subscribe, and
            complete (or fail) the purchase.
          </Text>
        </View>
      )}

      {subscriptionHistory.length > 1 ? (
        <>
          <Text style={styles.sectionTitle}>
            Subscription flow ({subscriptionHistory.length})
          </Text>
          {subscriptionHistory.slice(1, 20).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyMeta}>
                {entry.status} · {entry.phase} · {entry.at}
              </Text>
              <Text style={styles.historySummary} numberOfLines={2}>
                {entry.summary}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    lead: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    toolbar: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    clearButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    clearLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    badge: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.sm,
      overflow: "hidden",
    },
    badgeSuccess: {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      color: "#16a34a",
    },
    badgeFailure: {
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      color: "#dc2626",
    },
    phase: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    time: {
      flex: 1,
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: "right",
    },
    summary: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    json: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    muted: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    historyRow: {
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      gap: 4,
    },
    historyMeta: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    historySummary: {
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
  });
