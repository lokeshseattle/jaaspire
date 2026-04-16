import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useCallback, useRef, useState } from "react";

export const useShareSheet = () => {
  const bottomSheetRef = useRef<BottomSheetModal>(
    null,
  ) as React.RefObject<BottomSheetModal>;

  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const openShare = useCallback((postId: number) => {
    setSelectedPostId(postId);
    bottomSheetRef.current?.present();
  }, []);

  const closeShare = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const onDismiss = useCallback(() => {
    setSelectedPostId(null);
  }, []);

  return {
    bottomSheetRef,
    selectedPostId,
    openShare,
    closeShare,
    onDismiss,
  };
};
