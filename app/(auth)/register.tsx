import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Logo } from "@/assets/svg";
import { useDebounce } from "@/hooks/use-debounce";
import Button from "@/src/components/ui/button";
import FormInput from "@/src/components/ui/input";
import { Colors } from "@/src/constants/theme";
import {
  useAuth,
  useCheckUsername,
  useRegister,
} from "@/src/features/auth/auth.hooks";
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

type FormData = {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  username: string;
  acceptTerms: boolean;
  acceptPolicy: boolean;
};

export default function Login() {
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

  // console.log(checkUsername);

  useEffect(() => {
    if (checkUsername.isSuccess) {
      // console.log(checkUsername.data.data.available);
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
          // console.log(e.data.errors);
          setServerErrors<FormData>(e.data?.errors, setError, FIELD_MAP);
        },
      },
    );
  };
  return (
    <ScrollView>
      <View style={styles.container}>
        <View style={{ alignItems: "center" }}>
          <Logo />
        </View>

        <View style={{}}>
          <Text
            style={{
              fontSize: 34,
              fontWeight: "800",
              color: Colors.primaryColor,
            }}
          >
            Create an Account
          </Text>
        </View>
        <FormInput
          control={control}
          name="name"
          label="Name"
          placeholder="Enter your name"
          Left={<FontAwesome5 name="user-circle" size={24} color="black" />}
          rules={{
            required: "Name is required",
          }}
        />
        <FormInput
          control={control}
          name="username"
          label="Username"
          placeholder="Enter your username"
          Left={<FontAwesome5 name="user-circle" size={24} color="black" />}
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
          <Text style={{ fontSize: 12 }}>Checking availability...</Text>
        )}

        <FormInput
          control={control}
          name="email"
          label="Email"
          placeholder="Enter your email"
          Left={<Fontisto name="email" size={24} color="black" />}
          rules={{
            required: "Email is required",
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: "Invalid email format",
            },
          }}
        />
        <FormInput
          // secureTextEntry
          control={control}
          name="password"
          label="Password"
          placeholder="Enter your password"
          keyboardType="visible-password"
          Left={<Fontisto name="email" size={24} color="black" />}
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
          // secureTextEntry
          control={control}
          name="confirmPassword"
          label="Confirm Password"
          placeholder="Re-enter your password"
          keyboardType="visible-password"
          Left={<Fontisto name="email" size={24} color="black" />}
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                <FontAwesome5
                  name={value ? "check-square" : "square"}
                  size={22}
                  color={Colors.primaryColor}
                  onPress={() => onChange(!value)}
                />
                <Text
                  style={{ flexShrink: 1 }}
                  onPress={() => onChange(!value)}
                >
                  I acknowledge and agree to the Terms of Service and Privacy
                  Policy, and confirm that I am at least 18 years old
                </Text>
              </View>
              {error && (
                <Text style={{ color: "red", fontSize: 12 }}>
                  {error.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="acceptPolicy"
          render={({ field: { value, onChange } }) => (
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
            >
              <FontAwesome5
                name={value ? "check-square" : "square"}
                size={22}
                color={Colors.primaryColor}
                onPress={() => onChange(!value)}
              />
              <Text style={{ flexShrink: 1 }} onPress={() => onChange(!value)}>
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

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    // alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 20,
    gap: 20,
    width: "100%",
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
