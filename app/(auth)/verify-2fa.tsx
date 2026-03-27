import { OtpInput } from "@/src/components/ui/otp-input";
import Button from "@/src/components/ui/button";
import { AuthScreenLayout } from "@/src/features/auth/AuthScreenLayout";
import {
  useAuth,
  useResend2FA,
  useVerify2FA,
} from "@/src/features/auth/auth.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ERROR_COLOR = "#DC2626";
const RESEND_COOLDOWN_SEC = 30;

function parseParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return undefined;
}

export default function Verify2FAScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const params = useLocalSearchParams<{
    two_fa_token?: string | string[];
    hint?: string | string[];
  }>();
  const twoFaToken = parseParam(params.two_fa_token);
  const hint = parseParam(params.hint);

  const authStore = useAuth();
  const verify = useVerify2FA();
  const resend = useResend2FA();

  const [code, setCode] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const onChangeCode = useCallback((next: string) => {
    setCode(next);
    setErrorText(null);
  }, []);

  const onVerify = useCallback(() => {
    if (!twoFaToken || code.length !== 6) return;
    verify.mutate(
      { two_fa_token: twoFaToken, code },
      {
        onSuccess: (r) => {
          void authStore.login(r.data.token);
        },
        onError: (e) => {
          setErrorText(e.message || "Invalid OTP");
        },
      },
    );
  }, [twoFaToken, code, verify, authStore]);

  const onResend = useCallback(() => {
    if (!twoFaToken || secondsLeft > 0 || resend.isPending) return;
    resend.mutate(
      { two_fa_token: twoFaToken },
      {
        onSuccess: () => {
          setSecondsLeft(RESEND_COOLDOWN_SEC);
          setErrorText(null);
        },
        onError: (e) => {
          setErrorText(e.message || "Could not resend code");
        },
      },
    );
  }, [twoFaToken, secondsLeft, resend]);

  if (!twoFaToken) {
    return <Redirect href="/(auth)/login" />;
  }

  const subtitle =
    hint ||
    "Enter the 6-digit code sent to your email";

  const canResend = secondsLeft === 0 && !resend.isPending;

  return (
    <AuthScreenLayout showBranding={false} centerVertically>
      <View style={styles.headerBlock}>
        <Text style={styles.heading}>Two-factor authentication</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.field}>
        <OtpInput
          value={code}
          onChange={onChangeCode}
          error={!!errorText}
          disabled={verify.isPending}
          accessibilityLabel="Six digit verification code"
        />
        {errorText ? (
          <Text style={styles.errorText}>{errorText}</Text>
        ) : null}
      </View>

      <Button
        title="Verify"
        loading={verify.isPending}
        disabled={code.length !== 6}
        onPress={onVerify}
      />

      <View style={styles.resendRow}>
        {canResend ? (
          <Pressable
            onPress={onResend}
            disabled={resend.isPending}
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
          >
            <Text style={styles.resendLink}>
              {resend.isPending ? "Sending…" : "Resend code"}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.resendCooldown}>
            Resend code in {secondsLeft}s
          </Text>
        )}
      </View>
    </AuthScreenLayout>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    headerBlock: {
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    heading: {
      fontSize: 20,
      fontWeight: "600",
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    field: {
      gap: theme.spacing.sm,
    },
    errorText: {
      fontSize: 13,
      color: ERROR_COLOR,
      marginTop: theme.spacing.xs,
    },
    resendRow: {
      alignItems: "center",
      marginTop: theme.spacing.md,
    },
    resendLink: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    resendCooldown: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });
