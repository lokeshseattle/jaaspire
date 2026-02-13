import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function Index() {
  const { user, isHydrated } = useAuthStore().state;

  // Show nothing until store has rehydrated (e.g. from storage) to avoid flash
  if (!isHydrated) {
    return null;
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/login" />;
}
