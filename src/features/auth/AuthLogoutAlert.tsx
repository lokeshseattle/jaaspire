import { useAuthStore } from "@/src/features/auth/auth.store";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

/** Shows an Alert when the session was cleared unexpectedly (force logout, restore failure, etc.). */
export function AuthLogoutAlert() {
  const logoutNotice = useAuthStore((s) => s.logoutNotice);
  const setLogoutNotice = useAuthStore((s) => s.setLogoutNotice);
  const isShowingRef = useRef(false);

  useEffect(() => {
    if (!logoutNotice || isShowingRef.current) return;

    isShowingRef.current = true;
    const { title, message } = logoutNotice;
    setLogoutNotice(null);

    Alert.alert(
      title,
      message,
      [
        {
          text: "OK",
          onPress: () => {
            isShowingRef.current = false;
          },
        },
      ],
      {
        cancelable: false,
        onDismiss: () => {
          isShowingRef.current = false;
        },
      },
    );
  }, [logoutNotice, setLogoutNotice]);

  return null;
}
