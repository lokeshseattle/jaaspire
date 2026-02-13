import { StyleSheet, Text, View } from "react-native";

import { Logo } from "@/assets/svg";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import FormInput from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useLogin } from "@/features/auth/auth.hooks";
import {
    hasNumber,
    hasSpecialChar,
    hasUppercase,
    minLength,
} from "@/utils/validators";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import Fontisto from "@expo/vector-icons/Fontisto";
import { useForm } from "react-hook-form";

type FormData = {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  username: string;
};

export default function Login() {
  const { control, handleSubmit } = useForm<FormData>();
  const login = useLogin();

  const onSubmit = (data: FormData) => {
    login.mutate(data);
  };
  return (
    <ThemedView
      style={styles.container}
      // headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      // headerImage={<Logo />}
    >
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
        }}
      />
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
            minLength: (val) => minLength(val),
            hasUppercase: (val) => hasUppercase(val),
            hasNumber: (val) => hasNumber(val),
            hasSpecialChar: (val) => hasSpecialChar(val),
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

      <Button title="Sign In" onPress={handleSubmit(onSubmit)} />
    </ThemedView>
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
