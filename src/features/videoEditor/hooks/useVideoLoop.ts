// src/features/videoEditor/hooks/useVideoLoop.ts

import { VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef } from 'react';

interface UseVideoLoopProps {
    player: VideoPlayer | null;
    startTime: number;
    endTime: number;
    isPlaying: boolean;
}

export const useVideoLoop = ({
    player,
    startTime,
    endTime,
    isPlaying,
}: UseVideoLoopProps) => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkAndLoop = useCallback(() => {
        if (!player) return;

        const currentTime = player.currentTime * 1000; // Convert to ms

        if (currentTime >= endTime || currentTime < startTime) {
            player.currentTime = startTime / 1000; // Convert back to seconds
        }
    }, [player, startTime, endTime]);

    const seekToStart = useCallback(() => {
        if (player) {
            player.currentTime = startTime / 1000;
        }
    }, [player, startTime]);

    useEffect(() => {
        if (isPlaying && player) {
            // Check every 100ms for loop boundary
            intervalRef.current = setInterval(checkAndLoop, 100);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isPlaying, checkAndLoop, player]);

    // Seek to start when trim range changes
    useEffect(() => {
        seekToStart();
    }, [startTime]);

    return { seekToStart };
};