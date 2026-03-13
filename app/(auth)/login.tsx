import { StyleSheet, Text, View } from "react-native";

import { Logo } from "@/assets/svg";
import { ThemedView } from "@/src/components/themed-view";
import Button from "@/src/components/ui/button";
import FormInput from "@/src/components/ui/input";
import { useAuth, useLogin } from "@/src/features/auth/auth.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import Fontisto from "@expo/vector-icons/Fontisto";
import { Link } from "expo-router";
import { useForm } from "react-hook-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type FormData = {
  email: string;
  password: string;
};

export default function Login() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { control, handleSubmit, setError } = useForm<FormData>();

  const login = useLogin();
  const authStore = useAuth();

  const onSubmit = (data: FormData) => {
    login.mutate(data, {
      onSuccess: (d) => {
        authStore.login(d.data.token);
      },
      onError: (e) => {
        console.log(e.message);
        setError("email", { message: e.message });
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Logo />
        </View>

        <View>
          <Text style={styles.title}>Sign In</Text>
        </View>

        <FormInput
          control={control}
          name="email"
          label="Email / Username"
          placeholder="Enter your email"
          Left={<Fontisto name="email" size={24} color={theme.colors.icon} />}
          rules={{
            required: "It is required",
          }}
        />

        <FormInput
          control={control}
          name="password"
          label="Password"
          placeholder="Enter your password"
          keyboardType="visible-password"
          Left={<Fontisto name="locked" size={24} color={theme.colors.icon} />}
          rules={{
            required: "Password is required",
          }}
        />

        <Button
          title="Sign In"
          loading={login.isPending}
          onPress={handleSubmit(onSubmit)}
        />

        <Link href="../register" style={styles.link}>
          Don't have an account? Register
        </Link>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.xl,
      paddingTop: 40,
      paddingBottom: 40,
      flex: 1,
    },
    logoContainer: {
      alignItems: "center",
    },
    title: {
      fontSize: 34,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    link: {
      color: theme.colors.primary,
      fontSize: 14,
      textAlign: "center",
    },
  });