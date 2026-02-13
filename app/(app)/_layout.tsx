import { Stack } from "expo-router";

export default function AppLayout() {
  //   const {user, isHydrated} = useAuthStore().state;
  // //   const isHydrated = useAuthStore((state) => state.isHydrated);

  //   if (!isHydrated) return null;

  //   if (!user) {
  //     return <Redirect href="/login" />;
  //   }

  return (
    <Stack>
      <Stack.Screen name="home" />
    </Stack>
  );
}
