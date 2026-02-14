import { useAuth } from "@/src/features/auth/auth.hooks";
import { Button, Text, View } from "react-native";

export default function Home() {
  const { logout } = useAuth();

  return (
    <View>
      <Text>Home (Protected)</Text>
      <Button onPress={logout} title="Logout" />
    </View>
  );
}
