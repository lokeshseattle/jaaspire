import { VerificationSettingsItem } from "@/src/components/settings/VerificationSettingsItem";
import { useAuth } from "@/src/features/auth/auth.hooks";
import { useRestorePurchases } from "@/src/features/wallet/use-restore-purchases";
import { AppTheme, ThemeMode } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useSafeAreaInsets
} from "react-native-safe-area-context";

type ItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  theme: AppTheme;
};

const Item = ({ icon, label, onPress, right, danger, theme }: ItemProps) => {
  const styles = createStyles(theme);

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.left}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? "#ef4444" : theme.colors.icon}
        />
        <Text style={[styles.label, danger && { color: "#ef4444" }]}>
          {label}
        </Text>
      </View>

      {right ?? (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.icon} />
      )}
    </TouchableOpacity>
  );
};

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function SettingsScreen() {
  const { theme, mode, setMode } = useTheme();
  const styles = createStyles(theme);
  const { logout } = useAuth();
  const { restore, isRestoring } = useRestorePurchases();
  const insets = useSafeAreaInsets();
  const showRestorePurchases =
    Platform.OS === "ios" || Platform.OS === "android";

  return (
    // <SafeAreaView style={{ flex: 1 }}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      {/* <StatusBar
        hidden={false}
        // translucent
        
        backgroundColor={theme.colors.background}
      /> */}
      <View style={styles.section}>
        <Item
          theme={theme}
          onPress={() => router.push("/(app)/manage-subscriptions")}
          icon="card-outline"
          label="Subscriptions"
        />
        {showRestorePurchases ? (
          <TouchableOpacity
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => void restore()}
            disabled={isRestoring}
          >
            <View style={styles.left}>
              <Ionicons
                name="refresh-outline"
                size={20}
                color={theme.colors.icon}
              />
              <View style={styles.restoreLabelWrap}>
                <Text style={styles.label}>Restore purchases</Text>
                <Text style={styles.restoreHint}>
                  Sync subscriptions and uncredited star packs from this store
                  account
                </Text>
              </View>
            </View>
            {isRestoring ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.icon}
              />
            )}
          </TouchableOpacity>
        ) : null}
        <Item
          theme={theme}
          onPress={() => router.push("/(app)/manage-payments")}
          icon="receipt-outline"
          label="Payments"
        />
        <Item
          theme={theme}
          onPress={() => router.push("/bookmarks")}
          icon="bookmark-outline"
          label="Bookmarks"
        />
        <Item
          theme={theme}
          onPress={() => router.push("/(app)/blocked-users")}
          icon="ban-outline"
          label="Blocked Users"
        />
        <Item
          theme={theme}
          onPress={() => router.push("/(app)/privacy-settings")}
          icon="shield-checkmark-outline"
          label="Privacy & Monetization"
        />
        <Item
          theme={theme}
          icon="wallet-outline"
          label="Balance"
          onPress={() => router.push("/wallet")}
        />
        <VerificationSettingsItem />
        {/* Dev: subscription IAP event log (re-enable for local debugging) */}
        {/* <Item
          theme={theme}
          icon="bug-outline"
          label="Subscription debug"
          onPress={() => router.push("/(app)/iap-debug")}
        /> */}
      </View>

      <View style={styles.section}>
        <Item
          theme={theme}
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => router.push("/help-support")}
        />
        <Item theme={theme} icon="person-add-outline" label="Invite" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Theme</Text>
        {THEME_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.themeRow}
            activeOpacity={0.7}
            onPress={() => setMode(opt.value)}
          >
            <View style={styles.themeRowLeft}>
              <Ionicons name={opt.icon} size={20} color={theme.colors.icon} />
              <Text style={styles.themeLabel}>{opt.label}</Text>
            </View>
            <View
              style={[styles.radioOuter, { borderColor: theme.colors.border }]}
            >
              {mode === opt.value ? (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: theme.colors.primary },
                  ]}
                />
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Item
          theme={theme}
          icon="trash-outline"
          label="Delete account"
          danger
          onPress={() => router.push("/(app)/delete-account")}
        />
        <Item
          theme={theme}
          icon="log-out-outline"
          label="Logout"
          danger
          onPress={() => {
            Alert.alert("Log out", "Are you sure you want to log out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: logout },
            ]);
          }}
        />
      </View>
    </ScrollView>
    // </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
    },

    section: {
      backgroundColor: theme.colors.card,
      marginBottom: theme.spacing.lg,
      borderRadius: theme.radius.md,
      overflow: "hidden",
    },

    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },

    themeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },

    themeRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },

    themeLabel: {
      fontSize: 15,
      color: theme.colors.textPrimary,
      fontWeight: "500",
    },

    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },

    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },

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

    restoreLabelWrap: {
      flex: 1,
      gap: 2,
    },

    restoreHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      flexShrink: 1,
    },
  });
