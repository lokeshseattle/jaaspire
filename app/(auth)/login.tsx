import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";

import Button from "@/src/components/ui/button";
import FormInput from "@/src/components/ui/input";
import { useAuth, useLogin } from "@/src/features/auth/auth.hooks";
import { useInstallTrack } from "@/src/features/attribution/attribution.hooks";
import { AuthScreenLayout } from "@/src/features/auth/AuthScreenLayout";
import { isNetworkError } from "@/src/services/api/api.error";
import { setServerErrors } from "@/src/utils/form-errors";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";

type FormData = {
  email: string;
  password: string;
};

export default function Login() {
  useInstallTrack();

  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { control, handleSubmit, setError } = useForm<FormData>();

  const login = useLogin();
  const authStore = useAuth();

  const onSubmit = (data: FormData) => {
    login.mutate(data, {
      onSuccess: (d) => {
        if ("require_2fa" in d.data && d.data.require_2fa) {
          router.push({
            pathname: "/(auth)/verify-2fa",
            params: {
              two_fa_token: d.data.two_fa_token,
              hint: d.data.message,
            },
          });
          return;
        }
        if ("token" in d.data) {
          authStore.login(d.data.token);
        }
      },
      onError: (e) => {
        if (isNetworkError(e)) return;
        if (e.data?.errors) {
          setServerErrors<FormData>(e.data.errors, setError);
        } else {
          const msg = e.message || "Sign in failed. Please try again.";
          const lower = msg.toLowerCase();
          if (lower.includes("password")) {
            setError("password", { message: msg });
          } else {
            setError("email", { message: msg });
          }
        }
      },
    });
  };

  return (
    <AuthScreenLayout title="Sign In" centerVertically>
      <FormInput
        control={control}
        name="email"
        label="Email / Username"
        placeholder="Enter your email"
        Left={
          <Ionicons name="mail-outline" size={24} color={theme.colors.icon} />
        }
        rules={{ required: __DEV__ ? false : "It is required" }}
        defaultValue={__DEV__ ? "developer+20@convoia.com" : undefined}
        accessibilityLabel="Email or username"
      />
      <FormInput
        control={control}
        name="password"
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        passwordToggle
        defaultValue={__DEV__ ? "Test@123" : undefined}
        Left={
          <Ionicons
            name="lock-closed-outline"
            size={24}
            color={theme.colors.icon}
          />
        }
        rules={{ required: __DEV__ ? false : "Password is required" }}
        accessibilityLabel="Password"
      />
      <Pressable
        onPress={() => router.push("/(auth)/forgot-password")}
        accessibilityRole="button"
        accessibilityLabel="Forgot password"
        style={styles.forgotLink}
      >
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </Pressable>
      <Button
        title="Sign In"
        loading={login.isPending}
        onPress={handleSubmit(onSubmit)}
      />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Link href="/(auth)/register" style={styles.footerLink}>
          Register
        </Link>
      </View>
    </AuthScreenLayout>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    forgotLink: {
      alignSelf: "flex-end",
      marginTop: -theme.spacing.md,
    },
    forgotLinkText: {
      fontSize: 14,
      
      color: theme.colors.primary,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    footerLink: {
      fontSize: 14,
      color: theme.colors.primary,
    },
  });
