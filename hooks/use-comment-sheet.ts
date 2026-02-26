// src/hooks/useCommentsSheet.ts
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useCallback, useRef, useState } from "react";

export const useCommentsSheet = () => {
    // 👇 Use type assertion
    const bottomSheetRef = useRef<BottomSheetModal>(null) as React.RefObject<BottomSheetModal>;

    const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

    const openComments = useCallback((postId: number) => {
        setSelectedPostId(postId);
        bottomSheetRef.current?.present();
    }, []);

    const closeComments = useCallback(() => {
        bottomSheetRef.current?.dismiss();
    }, []);

    const onDismiss = useCallback(() => {
        setSelectedPostId(null);
    }, []);

    return {
        bottomSheetRef,
        selectedPostId,
        openComments,
        closeComments,
        onDismiss,
    };
};