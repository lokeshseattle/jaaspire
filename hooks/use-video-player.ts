// src/hooks/use-video-player.ts
import { videoManager } from "@/src/lib/video-manager";
import type {
    PlayingChangeEventPayload,
    StatusChangeEventPayload,
    VideoPlayer,
} from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";

export function useManagedVideoPlayer(
    postId: number,
    url: string | null,
    isVisible: boolean
) {
    const [isReady, setIsReady] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    // Ref to track latest visibility (avoids stale closure)
    const isVisibleRef = useRef(isVisible);
    isVisibleRef.current = isVisible;

    // Get or create player
    const player: VideoPlayer | null = url
        ? videoManager.getOrCreatePlayer(postId, url)
        : null;

    // Listen for player events
    useEffect(() => {
        if (!player) return;

        console.log(`🎬 [${postId}] Setting up listeners, visible: ${isVisibleRef.current}`);

        // Listen to status changes
        const statusSub = player.addListener(
            "statusChange",
            ({ status, error }: StatusChangeEventPayload) => {
                console.log(`📺 [${postId}] Status: ${status}`);

                switch (status) {
                    case "readyToPlay":
                        setIsReady(true);
                        setIsBuffering(false);
                        // Auto-play if visible
                        if (isVisibleRef.current) {
                            console.log(`▶️ [${postId}] Ready & visible, playing...`);
                            videoManager.play(postId);
                        }
                        break;
                    case "loading":
                        setIsBuffering(true);
                        break;
                    case "idle":
                        setIsReady(false);
                        setIsBuffering(false);
                        break;
                    case "error":
                        setIsBuffering(false);
                        console.error(`❌ [${postId}] Error:`, error);
                        break;
                }
            }
        );

        // 🔥 Listen to ACTUAL playing state from player
        const playingSub = player.addListener(
            "playingChange",
            ({ isPlaying: playing }: PlayingChangeEventPayload) => {
                console.log(`🎵 [${postId}] Playing changed: ${playing}`);
                setIsPlaying(playing);
            }
        );

        // Check if already ready (preloaded videos)
        if (player.status === "readyToPlay") {
            console.log(`🎬 [${postId}] Already ready on mount`);
            setIsReady(true);
            setIsBuffering(false);

            if (isVisibleRef.current) {
                console.log(`▶️ [${postId}] Already ready & visible, playing...`);
                videoManager.play(postId);
            }
        }

        // Sync initial playing state
        setIsPlaying(player.playing);

        return () => {
            statusSub.remove();
            playingSub.remove();
        };
    }, [player, postId]);

    // 🔥 Handle visibility changes - THIS IS THE KEY!
    useEffect(() => {
        if (!player) return;

        console.log(`👁️ [${postId}] Visibility: ${isVisible}, Status: ${player.status}`);

        // Play if visible and ready
        if (isVisible && player.status === "readyToPlay") {
            console.log(`▶️ [${postId}] Visible & ready, playing...`);
            videoManager.play(postId);
        }

        // Pause if not visible
        if (!isVisible && player.playing) {
            console.log(`⏸️ [${postId}] Not visible, pausing...`);
            videoManager.pause(postId);
        }
    }, [isVisible, player, postId]);

    const togglePlayPause = useCallback(() => {
        if (!player || player.status !== "readyToPlay") return;

        if (player.playing) {
            videoManager.pause(postId);
        } else {
            videoManager.play(postId);
        }
    }, [player, postId]);

    const toggleMute = useCallback(() => {
        if (!player) return;
        const newMuted = !isMuted;
        videoManager.setMuted(postId, newMuted);
        setIsMuted(newMuted);
    }, [isMuted, player, postId]);

    // For long press pause
    const pause = useCallback(() => {
        if (!player) return;
        videoManager.pause(postId);
    }, [player, postId]);

    const play = useCallback(() => {
        if (!player || player.status !== "readyToPlay") return;
        videoManager.play(postId);
    }, [player, postId]);

    return {
        player,
        isReady,
        isBuffering,
        isPlaying,
        isMuted,
        togglePlayPause,
        toggleMute,
        pause,
        play,
    };
}