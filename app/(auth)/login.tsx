import { StyleSheet, Text, View } from "react-native";

import { Logo } from "@/assets/svg";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/ui/button";
import FormInput from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import Fontisto from "@expo/vector-icons/Fontisto";
import { Link } from "expo-router";
import { useForm } from "react-hook-form";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type FormData = {
  email: string;
  password: string;
};

export default function Login() {
  const { control, handleSubmit } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    console.log(data);
  };
  return (
    <ThemedView
      style={styles.container}
      // headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      // headerImage={<Logo />}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
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
            Sign In
          </Text>
        </View>
        <FormInput
          control={control}
          name="email"
          label="Email / Username"
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
            required: "Email is required",
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: "Invalid email format",
            },
          }}
        />

        <Button title="Sign In" onPress={handleSubmit(onSubmit)} />

        <Link href="../register">Don't have an account? Register</Link>
      </KeyboardAwareScrollView>
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
    paddingHorizontal: 12,
    gap: 20,
    paddingTop: 40,
    paddingBottom: 40,
    flex: 1,
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
