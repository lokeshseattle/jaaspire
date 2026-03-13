import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Logo } from "@/assets/svg";
import { useDebounce } from "@/hooks/use-debounce";
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
      name: "John Do",
      email: "john22@example.com",
      username: "jondo1221212",
      password: "passworD@123",
      confirmPassword: "passworD@123",
    },
  });

  const register = useRegister();
  const authStore = useAuth();

  const username = useWatch({
    control,
    name: "username",
  });

  const debouncedUsername = useDebounce(username, 1000);
  const checkUsername = useCheckUsername(debouncedUsername);

  useEffect(() => {
    if (checkUsername.isSuccess) {
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
          authStore.login(data.data.token);
        },
        onError: (e) => {
          setServerErrors<FormData>(e.data?.errors, setError, FIELD_MAP);
        },
      }
    );
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Logo />
        </View>

        <View>
          <Text style={styles.title}>Create an Account</Text>
        </View>

        <FormInput
          control={control}
          name="name"
          label="Name"
          placeholder="Enter your name"
          Left={<FontAwesome5 name="user-circle" size={24} color={theme.colors.icon} />}
          rules={{
            required: "Name is required",
          }}
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
            validate: () =>
              checkUsername.data?.data.available !== false ||
              "Username already taken",
          }}
        />

        {checkUsername.isLoading && (
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
            validate: {
              minLength: (value: string | boolean) =>
                typeof value === "string" ? minLength(value) : "Invalid value",
              hasUppercase: (value: string | boolean) =>
                typeof value === "string"
                  ? hasUppercase(value)
                  : "Invalid value",
              hasNumber: (value: string | boolean) =>
                typeof value === "string" ? hasNumber(value) : "Invalid value",
              hasSpecialChar: (value: string | boolean) =>
                typeof value === "string"
                  ? hasSpecialChar(value)
                  : "Invalid value",
            },
          }}
        />

        <FormInput
          control={control}
          name="confirmPassword"
          label="Confirm Password"
          placeholder="Re-enter your password"
          keyboardType="visible-password"
          Left={<Fontisto name="locked" size={24} color={theme.colors.icon} />}
          rules={{
            required: "Password is required",
            validate: (value, formValues) =>
              value === formValues.password || "Passwords do not match",
          }}
        />

        <Controller
          control={control}
          name="acceptTerms"
          rules={{
            required: "You must accept the terms",
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
          render={({ field: { value, onChange } }) => (
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
          )}
        />

        <Button
          title="Sign Up"
          loading={register.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      gap: theme.spacing.xl,
      width: "100%",
    },
    logoContainer: {
      alignItems: "center",
    },
    title: {
      fontSize: 34,
      fontWeight: "800",
      color: theme.colors.primary,
    },
    checkingText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
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