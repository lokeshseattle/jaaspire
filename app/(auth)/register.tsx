import { StyleSheet, Text, View } from "react-native";

import { useDebounce } from "@/hooks/use-debounce";
import { AuthScreenLayout } from "@/src/features/auth/AuthScreenLayout";
import Button from "@/src/components/ui/button";
import FormInput from "@/src/components/ui/input";
import {
  useAuth,
  useCheckUsername,
  useRegister,
} from "@/src/features/auth/auth.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { setServerErrors } from "@/src/utils/form-errors";
import {
  hasNumber,
  hasSpecialChar,
  hasUppercase,
  minLength,
} from "@/src/utils/validators";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Fontisto from "@expo/vector-icons/Fontisto";
import { router } from "expo-router";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

const FIELD_MAP = {
  password_confirmation: "confirmPassword",
};

const ERROR_COLOR = "#DC2626";

type FormData = {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  username: string;
  acceptTerms: boolean;
  acceptPolicy: boolean;
};

export default function Register() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const { control, handleSubmit, setError } = useForm<FormData>({
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      acceptPolicy: false,
    },
  });

  const register = useRegister();
  const authStore = useAuth();

  const username = useWatch({ control, name: "username" });
  const debouncedUsername = useDebounce(username, 1000);
  const checkUsername = useCheckUsername(debouncedUsername);

  useEffect(() => {
    if (checkUsername.isSuccess && checkUsername.data?.data) {
      if (!checkUsername.data.data.available) {
        setError("username", {
          type: "manual",
          message: checkUsername.data.data.message,
        });
      }
    }
  }, [checkUsername.isSuccess, checkUsername.data, setError]);

  const onSubmit = (data: FormData) => {
    register.mutate(
      {
        email: data.email,
        name: data.name,
        password: data.password,
        password_confirmation: data.confirmPassword,
        username: data.username,
      },
      {
        onSuccess: (data) => {
          if ("require_2fa" in data.data && data.data.require_2fa) {
            router.push({
              pathname: "/(auth)/verify-2fa",
              params: {
                two_fa_token: data.data.two_fa_token,
                hint: data.data.message,
              },
            });
            return;
          }
          if ("token" in data.data) {
            authStore.login(data.data.token);
          }
        },
        onError: (e) => {
          setServerErrors<FormData>(e.data?.errors, setError, FIELD_MAP);
        },
      }
    );
  };

  const isCheckingUsername =
    debouncedUsername.length >= 3 && checkUsername.isLoading;
  const usernameUnavailable =
    checkUsername.isSuccess &&
    checkUsername.data?.data &&
    !checkUsername.data.data.available;

  return (
    <AuthScreenLayout
      title="Create an Account"
      footerLink={{ label: "Already have an account? Sign In", href: "/(auth)/login" }}
    >
      <FormInput
        control={control}
        name="name"
        label="Name"
        placeholder="Enter your name"
        Left={<FontAwesome5 name="user-circle" size={24} color={theme.colors.icon} />}
        rules={{ required: "Name is required" }}
        accessibilityLabel="Full name"
      />
      <FormInput
        control={control}
        name="username"
        label="Username"
        placeholder="Enter your username"
        Left={<FontAwesome5 name="user-circle" size={24} color={theme.colors.icon} />}
        rules={{
          required: "Username is required",
          minLength: {
            value: 3,
            message: "Username must be at least 3 characters",
          },
          validate: () => {
            if (isCheckingUsername) return "Please wait while we check availability";
            if (usernameUnavailable) return "Username already taken";
            return true;
          },
        }}
        accessibilityLabel="Username"
      />
      {isCheckingUsername && (
        <Text style={styles.checkingText}>Checking availability...</Text>
      )}
      <FormInput
        control={control}
        name="email"
        label="Email"
        placeholder="Enter your email"
        Left={<Fontisto name="email" size={24} color={theme.colors.icon} />}
        rules={{
          required: "Email is required",
          pattern: {
            value: /\S+@\S+\.\S+/,
            message: "Invalid email format",
          },
        }}
        accessibilityLabel="Email address"
      />
      <FormInput
        control={control}
        name="password"
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        passwordToggle
        Left={<Fontisto name="locked" size={24} color={theme.colors.icon} />}
        rules={{
          required: "Password is required",
          validate: {
            minLength: (value: string | boolean) =>
              typeof value === "string" ? minLength(value) : "Invalid value",
            hasUppercase: (value: string | boolean) =>
              typeof value === "string" ? hasUppercase(value) : "Invalid value",
            hasNumber: (value: string | boolean) =>
              typeof value === "string" ? hasNumber(value) : "Invalid value",
            hasSpecialChar: (value: string | boolean) =>
              typeof value === "string" ? hasSpecialChar(value) : "Invalid value",
          },
        }}
        accessibilityLabel="Password"
      />
      <FormInput
        control={control}
        name="confirmPassword"
        label="Confirm Password"
        placeholder="Re-enter your password"
        secureTextEntry
        passwordToggle
        Left={<Fontisto name="locked" size={24} color={theme.colors.icon} />}
        rules={{
          required: "Confirm password is required",
          validate: (value, formValues) =>
            value === formValues.password || "Passwords do not match",
        }}
        accessibilityLabel="Confirm password"
      />
      <Controller
        control={control}
        name="acceptTerms"
        rules={{ required: "You must accept the terms" }}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View>
            <View style={styles.checkboxRow}>
              <FontAwesome5
                name={value ? "check-square" : "square"}
                size={22}
                color={theme.colors.primary}
                onPress={() => onChange(!value)}
              />
              <Text
                style={styles.checkboxText}
                onPress={() => onChange(!value)}
              >
                I acknowledge and agree to the Terms of Service and Privacy
                Policy, and confirm that I am at least 18 years old
              </Text>
            </View>
            {error && (
              <Text style={styles.errorText}>{error.message}</Text>
            )}
          </View>
        )}
      />
      <Controller
        control={control}
        name="acceptPolicy"
        rules={{
          required:
            "You must agree to the Acceptable Use Policy to continue",
        }}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View>
            <View style={styles.checkboxRow}>
              <FontAwesome5
                name={value ? "check-square" : "square"}
                size={22}
                color={theme.colors.primary}
                onPress={() => onChange(!value)}
              />
              <Text
                style={styles.checkboxText}
                onPress={() => onChange(!value)}
              >
                I agree to the Acceptable Use Policy and acknowledge that
                pornography and illegal content are strictly prohibited. I
                understand that uploading such content will result in immediate
                account termination.
              </Text>
            </View>
            {error && (
              <Text style={styles.errorText}>{error.message}</Text>
            )}
          </View>
        )}
      />
      <Button
        title="Sign Up"
        loading={register.isPending}
        onPress={handleSubmit(onSubmit)}
        disabled={isCheckingUsername}
      />
    </AuthScreenLayout>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    checkingText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: -theme.spacing.sm,
    },
    checkboxRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    checkboxText: {
      flexShrink: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 20,
    },
    errorText: {
      color: ERROR_COLOR,
      fontSize: 12,
      marginTop: theme.spacing.xs,
    },
  });
