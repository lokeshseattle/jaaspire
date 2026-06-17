import FormInput from "@/src/components/ui/input";
import {
    useAuth,
    useDeleteAccountMutation,
} from "@/src/features/auth/auth.hooks";
import { forceLogout } from "@/src/features/auth/auth.utils";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "expo-router";
import { useLayoutEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DESTRUCTIVE = "#EF4444";
const DESTRUCTIVE_MUTED = "rgba(239, 68, 68, 0.12)";

const CONSEQUENCES: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}[] = [
  {
    icon: "log-out-outline",
    text: "You will be signed out of every device immediately.",
  },
  {
    icon: "trash-outline",
    text: "All of your posts, stories, comments, messages, and reactions will be permanently removed.",
  },
  {
    icon: "card-outline",
    text: "All active subscriptions will stop renewing. Existing subscribers keep access until their current period ends.",
  },
  {
    icon: "wallet-outline",
    text: "Any remaining wallet balance is non-refundable per our terms and will be forfeited.",
  },
  {
    icon: "document-text-outline",
    text: "Past transactions are retained for store-refund and tax reporting requirements, but linked to an anonymized record.",
  },
  {
    icon: "storefront-outline",
    text: "Refunds for in-app purchases must be requested through Apple or Google directly — we do not issue refunds.",
  },
  {
    icon: "refresh-outline",
    text: "You have 30 days to cancel this request by signing back in.",
  },
];

type FormData = {
  password: string;
};

export default function DeleteAccountScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { logout } = useAuth();
  const deleteAccount = useDeleteAccountMutation();

  const { control, handleSubmit, setError, watch } = useForm<FormData>({
    defaultValues: { password: "" },
  });

  const password = watch("password");
  const canSubmit = password.trim().length > 0 && !deleteAccount.isPending;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      headerTitleStyle: { color: theme.colors.textPrimary },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.background, theme.colors.textPrimary]);

  const submitDeletion = (data: FormData) => {
    deleteAccount.mutate(
      { password: data.password },
      {
        onSuccess: (response) => {
          Alert.alert("Account scheduled for deletion", response.message, [
            {
              text: "OK",
              onPress: async () => {
                try {
                  await logout();
                } catch {
                  await forceLogout({ silent: true });
                }
              },
            },
          ]);
        },
        onError: (error) => {
          const msg = error.message || "Something went wrong. Try again.";
          if (msg.toLowerCase().includes("password")) {
            setError("password", { message: msg });
          } else {
            Alert.alert("Couldn't delete account", msg);
          }
        },
      },
    );
  };

  const onSubmit = (data: FormData) => {
    Alert.alert(
      "Delete account?",
      "Your account will be scheduled for permanent deletion after a 30-day grace period. You will be signed out immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => submitDeletion(data),
        },
      ],
    );
  };

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
      bottomOffset={headerHeight}
      extraKeyboardSpace={theme.spacing.lg}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageIntro}>
        Review the consequences below. This cannot be undone after the grace
        period ends.
      </Text>

      <View style={styles.warningSection}>
        <View style={styles.warningAccent} />
        <View style={styles.warningBody}>
          <View style={styles.warningTopRow}>
            <View style={styles.warningIconWrap}>
              <Ionicons name="warning" size={22} color={DESTRUCTIVE} />
            </View>
            <View style={styles.graceBadge}>
              <Ionicons name="time-outline" size={14} color={DESTRUCTIVE} />
              <Text style={styles.graceBadgeText}>30-day grace period</Text>
            </View>
          </View>
          <Text style={styles.warningTitle}>This action is permanent</Text>
          <Text style={styles.warningSubtitle}>
            Once the grace window passes, your account and personal data will be
            permanently removed. Before continuing, please understand:
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>What happens next</Text>
      <View style={styles.section}>
        {CONSEQUENCES.map((item, index) => (
          <View
            key={item.text}
            style={[
              styles.consequenceRow,
              index < CONSEQUENCES.length - 1 && styles.consequenceRowBorder,
            ]}
          >
            <View style={styles.consequenceIconWrap}>
              <Ionicons name={item.icon} size={18} color={DESTRUCTIVE} />
            </View>
            <Text style={styles.consequenceText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Confirm with password</Text>
      <View style={styles.section}>
        <Text style={styles.passwordHint}>
          Enter your current password to schedule account deletion.
        </Text>
        <View style={styles.passwordWrap}>
          <FormInput
            control={control}
            name="password"
            label="Current password"
            placeholder="Enter your password"
            secureTextEntry
            passwordToggle
            Left={
              <Ionicons
                name="lock-closed-outline"
                size={22}
                color={theme.colors.icon}
              />
            }
            rules={{ required: "Password is required" }}
            accessibilityLabel="Current password"
          />
        </View>
      </View>

      <View style={styles.actionBlock}>
        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit(onSubmit)}
          style={({ pressed }) => [
            styles.deleteButton,
            !canSubmit && styles.deleteButtonDisabled,
            pressed && canSubmit && styles.deleteButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
        >
          {deleteAccount.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete account</Text>
            </>
          )}
        </Pressable>

        {!canSubmit && !deleteAccount.isPending ? (
          <Text style={styles.deleteHint}>
            Enter your password above to enable deletion.
          </Text>
        ) : null}

        <Text style={styles.cancelHint}>
          Changed your mind? Sign back in within 30 days to cancel this request.
        </Text>
      </View>
    </KeyboardAwareScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      flexGrow: 1,
    },
    pageIntro: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    warningSection: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    warningAccent: {
      width: 4,
      backgroundColor: DESTRUCTIVE,
    },
    warningBody: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
    },
    warningTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    warningIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: DESTRUCTIVE_MUTED,
      alignItems: "center",
      justifyContent: "center",
    },
    graceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radius.sm,
      backgroundColor: DESTRUCTIVE_MUTED,
    },
    graceBadgeText: {
      fontSize: 12,
      fontWeight: "600",
      color: DESTRUCTIVE,
    },
    warningTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    warningSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing.sm,
      marginLeft: theme.spacing.xs,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      overflow: "hidden",
      marginBottom: theme.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    consequenceRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    consequenceRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    consequenceIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: DESTRUCTIVE_MUTED,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    consequenceText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textPrimary,
    },
    passwordHint: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xs,
    },
    passwordWrap: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    actionBlock: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    deleteButton: {
      flexDirection: "row",
      backgroundColor: DESTRUCTIVE,
      borderRadius: theme.radius.md,
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    deleteButtonDisabled: {
      opacity: 0.45,
    },
    deleteButtonPressed: {
      opacity: 0.85,
    },
    deleteButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    deleteHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    cancelHint: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
  });
