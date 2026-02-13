import { Stack } from "expo-router";

export default function AuthLayout() {
  // const { user, isHydrated } = useAuthStore().state;
  // //   const isHydrated = useAuthStore((state) => state.isHydrated);

  // if (!isHydrated) return null;

  // if (user) {
  //   return <Redirect href="/home" />;
  // }

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="register"
        options={{
          headerBackVisible: true,
          headerShown: true,
          headerBackTitle: "Back",
          title: "",
        }}
      />
    </Stack>
  );
}
