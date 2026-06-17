import { useToast } from "@/src/components/toast/ToastProvider";
import Button from "@/src/components/ui/button";
import FormInput from "@/src/components/ui/input";
import { useForgotPassword } from "@/src/features/auth/auth.hooks";
import { AuthScreenLayout } from "@/src/features/auth/AuthScreenLayout";
import { isNetworkError } from "@/src/services/api/api.error";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";

type FormData = {
  email: string;
};

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { trigger } = useToast();

  const { control, handleSubmit, setError } = useForm<FormData>();
  const forgot = useForgotPassword();

  const onSubmit = (data: FormData) => {
    forgot.mutate(
      { email: data.email },
      {
        onSuccess: (response) => {
          trigger(response.message, "success");
          router.back();
        },
        onError: (e) => {
          if (isNetworkError(e)) return;
          setError("email", {
            message: e.message || "Could not send reset link. Please try again.",
          });
        },
      },
    );
  };

  return (
    <AuthScreenLayout
      title="Forgot password"
      centerVertically
      footerLink={{
        label: "Back to sign in",
        href: "/(auth)/login",
      }}
    >
      <View style={styles.subtitleBlock}>
        <Text style={styles.subtitle}>
          Enter your email or username and we&apos;ll send a reset link.
        </Text>
      </View>
      <FormInput
        control={control}
        name="email"
        label="Email / Username"
        placeholder="Enter your email or username"
        Left={
          <Ionicons name="mail-outline" size={24} color={theme.colors.icon} />
        }
        rules={{ required: "Email or username is required" }}
        accessibilityLabel="Email or username"
      />
      <Button
        title="Send"
        loading={forgot.isPending}
        onPress={handleSubmit(onSubmit)}
      />
    </AuthScreenLayout>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    subtitleBlock: {
      marginTop: -theme.spacing.md,
      marginBottom: -theme.spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
  });
