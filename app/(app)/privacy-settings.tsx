import { useToast } from "@/src/components/toast/ToastProvider";
import {
  useGetProfile,
  useSetEnable2faFlagMutation,
  useSetOpenProfileFlagMutation,
  useSetSettingsRatesMutation,
  useUpdateProfile,
} from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { profileVisibilityLabel } from "@/src/utils/profile-visibility";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Visibility = "public" | "private";

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can view your profile and posts.",
    icon: "globe-outline",
  },
  {
    value: "private",
    label: "Private",
    description: "Only approved followers can see your content.",
    icon: "lock-closed-outline",
  },
];

export default function PrivacySettingsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { trigger } = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { data, isLoading } = useGetProfile();
  const profile = data?.data;
  const updateProfile = useUpdateProfile();
  const setSettingsRates = useSetSettingsRatesMutation();
  const openProfileFlag = useSetOpenProfileFlagMutation();
  const enable2faFlag = useSetEnable2faFlagMutation();

  const [visibility, setVisibility] = useState<Visibility>("public");
  const [email2fa, setEmail2fa] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [baseline, setBaseline] = useState<{
    visibility: Visibility;
    email2fa: boolean;
    monthlyPrice: string;
  } | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      headerTitleStyle: { color: theme.colors.textPrimary },
      headerShadowVisible: false,
    });
  }, [
    navigation,
    theme.colors.background,
    theme.colors.textPrimary,
  ]);

  useEffect(() => {
    if (!profile) return;
    const v = profileVisibilityLabel(profile);
    const price =
      profile.subscription?.price_1_month != null
        ? String(profile.subscription.price_1_month)
        : "";
    setVisibility(v);
    setEmail2fa(Boolean(profile.enable_2fa));
    setMonthlyPrice(price);
    setBaseline({
      visibility: v,
      email2fa: Boolean(profile.enable_2fa),
      monthlyPrice: price,
    });
  }, [profile?.id]);

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return (
      visibility !== baseline.visibility ||
      email2fa !== baseline.email2fa ||
      monthlyPrice.trim() !== baseline.monthlyPrice.trim()
    );
  }, [baseline, visibility, email2fa, monthlyPrice]);

  const parsePrice = useCallback((): number | null => {
    const t = monthlyPrice.trim();
    if (t === "") return null;
    const n = Number.parseFloat(t.replace(/,/g, ""));
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  }, [monthlyPrice]);

  const handleSave = useCallback(async () => {
    if (!baseline) return;

    const price = parsePrice();
    if (monthlyPrice.trim() !== "" && price === null) {
      trigger("Enter a valid subscription price.", "error");
      return;
    }

    const visibilityDirty = visibility !== baseline.visibility;
    const twoFaDirty = email2fa !== baseline.email2fa;
    const priceDirty = monthlyPrice.trim() !== baseline.monthlyPrice.trim();

    if (!visibilityDirty && !twoFaDirty && !priceDirty) return;

    try {
      if (visibilityDirty) {
        await openProfileFlag.mutateAsync(visibility === "public");
      }
      if (twoFaDirty) {
        await enable2faFlag.mutateAsync(email2fa);
      }
      if (priceDirty) {
        if (price != null) {
          await setSettingsRates.mutateAsync({
            profile_access_price: price,
          });
        } else {
          await updateProfile.mutateAsync({});
        }
      }

      setBaseline({
        visibility,
        email2fa,
        monthlyPrice: monthlyPrice.trim(),
      });
      trigger("Privacy settings saved.", "success");
    } catch {
      trigger("Could not save. Try again.", "error");
    }
  }, [
    baseline,
    parsePrice,
    monthlyPrice,
    visibility,
    email2fa,
    openProfileFlag,
    enable2faFlag,
    setSettingsRates,
    updateProfile,
    trigger,
  ]);

  if (isLoading && !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const savePending =
    openProfileFlag.isPending ||
    enable2faFlag.isPending ||
    setSettingsRates.isPending ||
    updateProfile.isPending;

  const saveDisabled =
    !isDirty ||
    savePending ||
    (monthlyPrice.trim() !== "" && parsePrice() === null);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: theme.spacing.xl + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageIntro}>
          Control who can see your profile and how your account is secured.
        </Text>

        <Text style={styles.sectionLabel}>Profile visibility</Text>
        <View style={styles.section}>
          {VISIBILITY_OPTIONS.map((opt, index) => {
            const selected = visibility === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.optionRow,
                  index < VISIBILITY_OPTIONS.length - 1 && styles.optionRowBorder,
                ]}
                onPress={() => setVisibility(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.optionRowLeft}>
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={theme.colors.icon}
                  />
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionTitle}>{opt.label}</Text>
                    <Text style={styles.optionSubtitle}>{opt.description}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: theme.colors.border },
                  ]}
                >
                  {selected ? (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchTitle}>Email two-factor authentication</Text>
              <Text style={styles.switchSubtitle}>
                We’ll email a code when you sign in on a new device.
              </Text>
            </View>
            <Switch
              value={email2fa}
              onValueChange={setEmail2fa}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary + "99",
              }}
              thumbColor={Platform.OS === "ios" ? "#fff" : email2fa ? theme.colors.primary : "#f4f4f5"}
              ios_backgroundColor={theme.colors.border}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Monetization</Text>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Monthly subscription price</Text>
          <View
            style={[
              styles.inputShell,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.textPrimary }]}
              value={monthlyPrice}
              onChangeText={setMonthlyPrice}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
              accessibilityLabel="Monthly subscription price"
            />
          </View>
          <Text style={styles.fieldHint}>
            Amount fans pay per month. Leave empty to keep your current price.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
            paddingBottom: Math.max(insets.bottom, theme.spacing.md),
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: theme.colors.primary },
            saveDisabled && { opacity: 0.5 },
            !saveDisabled && pressed && { opacity: 0.88 },
          ]}
          onPress={handleSave}
          disabled={saveDisabled}
        >
          {savePending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    pageIntro: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
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
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    optionRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    optionRowLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      flex: 1,
      paddingRight: theme.spacing.md,
    },
    optionTextWrap: { flex: 1 },
    optionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    optionSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
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
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    switchTextWrap: { flex: 1 },
    switchTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    switchSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    fieldLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    inputShell: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.md,
      minHeight: 48,
    },
    currencyPrefix: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      marginRight: 4,
    },
    input: {
      flex: 1,
      fontSize: 17,
      paddingVertical: theme.spacing.sm,
    },
    fieldHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.lg,
      lineHeight: 17,
    },
    footer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    saveButton: {
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
    },
    saveButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
  });
