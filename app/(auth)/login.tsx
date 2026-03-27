import { useTheme } from "@/src/theme/ThemeProvider";

import { AuthScreenLayout } from "@/src/features/auth/AuthScreenLayout";
import Button from "@/src/components/ui/button";
import FormInput from "@/src/components/ui/input";
import { useAuth, useLogin } from "@/src/features/auth/auth.hooks";
import { setServerErrors } from "@/src/utils/form-errors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useForm } from "react-hook-form";

type FormData = {
  email: string;
  password: string;
};

export default function Login() {
  const { theme } = useTheme();

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
    <AuthScreenLayout
      title="Sign In"
      centerVertically
      footerLink={{ label: "Don't have an account? Register", href: "/(auth)/register" }}
    >
      <FormInput
        control={control}
        name="email"
        label="Email / Username"
        placeholder="Enter your email"
        Left={
          <Ionicons name="mail-outline" size={24} color={theme.colors.icon} />
        }
        rules={{ required: "It is required" }}
        accessibilityLabel="Email or username"
      />
      <FormInput
        control={control}
        name="password"
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        passwordToggle
        Left={
          <Ionicons
            name="lock-closed-outline"
            size={24}
            color={theme.colors.icon}
          />
        }
        rules={{ required: "Password is required" }}
        accessibilityLabel="Password"
      />
      <Button
        title="Sign In"
        loading={login.isPending}
        onPress={handleSubmit(onSubmit)}
      />
    </AuthScreenLayout>
  );
}
