// src/features/videoEditor/hooks/useFramePreview.ts

import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useRef, useState } from 'react';

interface FramePreviewState {
    isVisible: boolean;
    uri: string | null;
    time: number;
    position: 'left' | 'right' | 'middle';
    x: number; // Position for tooltip
}

interface UseFramePreviewProps {
    videoUri: string;
    debounceMs?: number;
}

interface UseFramePreviewReturn {
    previewState: FramePreviewState;
    showPreview: (time: number, position: 'left' | 'right' | 'middle', x: number) => void;
    updatePreview: (time: number, x: number) => void;
    hidePreview: () => void;
}

export const useFramePreview = ({
    videoUri,
    debounceMs = 100,
}: UseFramePreviewProps): UseFramePreviewReturn => {
    const [previewState, setPreviewState] = useState<FramePreviewState>({
        isVisible: false,
        uri: null,
        time: 0,
        position: 'left',
        x: 0,
    });

    const lastRequestTime = useRef<number>(0);
    const pendingRequest = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentPosition = useRef<'left' | 'right' | 'middle'>('left');

    const generateThumbnail = useCallback(
        async (timeMs: number, x: number) => {
            try {
                const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
                    time: timeMs,
                    quality: 0.7,
                });

                setPreviewState((prev) => ({
                    ...prev,
                    uri,
                    time: timeMs,
                    x,
                }));
            } catch (error) {
                console.warn('Failed to generate preview thumbnail:', error);
            }
        },
        [videoUri]
    );

    const showPreview = useCallback(
        (time: number, position: 'left' | 'right' | 'middle', x: number) => {
            currentPosition.current = position;

            setPreviewState({
                isVisible: true,
                uri: null,
                time,
                position,
                x,
            });

            // Generate initial thumbnail
            generateThumbnail(time, x);
        },
        [generateThumbnail]
    );

    const updatePreview = useCallback(
        (time: number, x: number) => {
            const now = Date.now();

            // Update position immediately
            setPreviewState((prev) => ({
                ...prev,
                time,
                x,
            }));

            // Debounce thumbnail generation
            if (now - lastRequestTime.current < debounceMs) {
                if (pendingRequest.current) {
                    clearTimeout(pendingRequest.current);
                }
                pendingRequest.current = setTimeout(() => {
                    generateThumbnail(time, x);
                    lastRequestTime.current = Date.now();
                }, debounceMs);
                return;
            }

            lastRequestTime.current = now;
            generateThumbnail(time, x);
        },
        [debounceMs, generateThumbnail]
    );

    const hidePreview = useCallback(() => {
        if (pendingRequest.current) {
            clearTimeout(pendingRequest.current);
            pendingRequest.current = null;
        }

        setPreviewState({
            isVisible: false,
            uri: null,
            time: 0,
            position: 'left',
            x: 0,
        });
    }, []);

    return {
        previewState,
        showPreview,
        updatePreview,
        hidePreview,
    };
};