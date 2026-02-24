import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { useToast } from "./ToastProvider";

export default function NetworkListener() {
  const { trigger } = useToast();
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected;

      console.log("NetInfo:", isConnected);

      // First render → just store value
      if (wasConnected.current === null) {
        wasConnected.current = isConnected;
        return;
      }

      // Went offline
      if (wasConnected.current && !isConnected) {
        trigger("No Internet Connection", "info");
      }

      // Came back online
      if (!wasConnected.current && isConnected) {
        trigger("Back Online", "success");
      }

      wasConnected.current = isConnected;
    });

    return unsubscribe;
  }, [trigger]);

  return null;
}
