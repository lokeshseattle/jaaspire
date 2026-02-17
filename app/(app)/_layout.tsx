import { Stack } from "expo-router";

export default function AppLayout() {
  //   const {user, isHydrated} = useAuthStore().state;
  // //   const isHydrated = useAuthStore((state) => state.isHydrated);

  //   if (!isHydrated) return null;

  //   if (!user) {
  //     return <Redirect href="/login" />;
  //   }

  return (
    // <Stack screenOptions={{ headerShown: false }}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen
        name="messages"
        options={{
          headerShown: true,
          title: "Messages",
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="story-viewer"
        options={{
          headerShown: false,
          // Present as a modal that comes up from the bottom and fades
          presentation: "transparentModal",
          animation: "fade",
        }}
      />
    </Stack>
    // </Stack>
  );
}
