import { View, Text, Button } from "react-native";
import { useAuthStore } from "../../store/authStore";

export default function Home() {
//   const logout = useAuthStore((state) => state.logout);

  return (
    <View>
      <Text>Home (Protected)</Text>
      <Button title="Logout" />
    </View>
  );
}
