import { useAuth } from "@/src/features/auth/auth.hooks";
import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Checking authentication...</Text>
      </View>
    );
  }

  const destination = isAuthenticated ? "/(app)/home" : "/(auth)/login";
  console.log("Attempting redirect to:", destination);

  return <Redirect href={destination} />;
}
