import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useCallback, useRef, useState } from "react";

export const useShareProfileSheet = () => {
  const bottomSheetRef = useRef<BottomSheetModal>(
    null,
  ) as React.RefObject<BottomSheetModal>;

  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

  const openShareProfile = useCallback((username: string) => {
    setSelectedUsername(username);
    bottomSheetRef.current?.present();
  }, []);

  const closeShareProfile = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const onDismiss = useCallback(() => {
    setSelectedUsername(null);
  }, []);

  return {
    bottomSheetRef,
    selectedUsername,
    openShareProfile,
    closeShareProfile,
    onDismiss,
  };
};
