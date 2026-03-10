// src/features/videoEditor/VideoEditorScreen.tsx

import { useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ControlBar } from '../components/ControlBar';
import { TrimmerBar } from '../components/Trimmerbar/index';
import { VideoPreview } from '../components/VideoPreview';
import { COLORS, LAYOUT, TRIMMER } from '../constants';
import { useVideoLoop } from '../hooks/useVideoLoop';
import { useVideoTrimmer } from '../hooks/useVideoTrimmer';
import { VideoEditorProps, VideoEditorResult } from '../types';

export const VideoEditorScreen: React.FC<VideoEditorProps> = ({
    videoUri,
    onConfirm,
    onCancel,
}) => {
    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initialize video player
    const player = useVideoPlayer(videoUri, (playerInstance) => {
        playerInstance.loop = false; // We handle looping manually
        playerInstance.muted = false;
    });

    // Get video duration once player is ready
    useEffect(() => {
        if (!player) return;

        const checkDuration = setInterval(() => {
            try {
                if (player.duration && player.duration > 0) {
                    const durationMs = player.duration * 1000; // Convert to ms
                    setDuration(durationMs);
                    setIsLoading(false);
                    clearInterval(checkDuration);
                }
            } catch (err) {
                console.error('Error getting duration:', err);
                setError('Failed to load video');
                setIsLoading(false);
                clearInterval(checkDuration);
            }
        }, 100);

        // Timeout after 10 seconds
        const timeout = setTimeout(() => {
            if (isLoading) {
                clearInterval(checkDuration);
                setError('Video loading timeout');
                setIsLoading(false);
            }
        }, 10000);

        return () => {
            clearInterval(checkDuration);
            clearTimeout(timeout);
        };
    }, [player, isLoading]);

    // Initialize trimmer hook
    const {
        trimRange,
        leftHandleGesture,
        rightHandleGesture,
        middleGesture,
        leftHandleStyle,
        rightHandleStyle,
        selectionStyle,
        resetTrim,
    } = useVideoTrimmer({
        duration: duration || 10000,
        initialStartTime: 0,
        initialEndTime: duration || 10000,
    });

    // Handle video looping within trim range
    useVideoLoop({
        player,
        startTime: trimRange.startTime,
        endTime: trimRange.endTime,
        isPlaying,
    });

    // Sync muted state with player
    useEffect(() => {
        if (player) {
            player.muted = isMuted;
        }
    }, [isMuted, player]);

    // Sync playing state with player events
    useEffect(() => {
        if (!player) return;

        const handlePlayingChange = () => {
            setIsPlaying(player.playing);
        };

        // Subscribe to player status changes if available
        // Note: expo-video API may vary, adjust as needed

        return () => {
            // Cleanup if needed
        };
    }, [player]);

    // Track progressing playhead
    const progressPosition = useSharedValue(0);

    // Sync progress with player
    useEffect(() => {
        let animationFrameId: number;

        const updateProgress = () => {
            if (!player || !duration) return;

            const currentTimeMs = player.currentTime * 1000;
            const progress = duration > 0 ? currentTimeMs / duration : 0;
            progressPosition.value = Math.max(0, Math.min(progress, 1));

            if (isPlaying) {
                animationFrameId = requestAnimationFrame(updateProgress);
            }
        };

        if (isPlaying || (player && player.currentTime === 0)) {
            animationFrameId = requestAnimationFrame(updateProgress);
        } else {
            // Update once when paused or manual seek happens
            updateProgress();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, player, duration]);

    const trackWidth = LAYOUT.TRIMMER_WIDTH - TRIMMER.HANDLE_WIDTH * 2;

    const playheadStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: progressPosition.value * trackWidth + TRIMMER.HANDLE_WIDTH },
            ],
        };
    });

    // Control handlers
    const handlePlayPause = useCallback(() => {
        if (!player) return;

        if (isPlaying) {
            player.pause();
            setIsPlaying(false);
        } else {
            // Ensure we start from the trim start if outside range
            const currentTimeMs = player.currentTime * 1000;
            if (currentTimeMs < trimRange.startTime || currentTimeMs >= trimRange.endTime) {
                player.currentTime = trimRange.startTime / 1000;
            }
            player.play();
            setIsPlaying(true);
        }
    }, [player, isPlaying, trimRange]);

    const handleMuteToggle = useCallback(() => {
        setIsMuted((prev) => !prev);
    }, []);

    const handleReset = useCallback(() => {
        resetTrim();
        if (player) {
            player.currentTime = 0;
            if (isPlaying) {
                player.pause();
                setIsPlaying(false);
            }
        }
    }, [resetTrim, player, isPlaying]);

    const handleConfirm = useCallback(() => {
        // Pause video before confirming
        if (player && isPlaying) {
            player.pause();
            setIsPlaying(false);
        }

        const result: VideoEditorResult = {
            uri: videoUri,
            startTime: trimRange.startTime,
            endTime: trimRange.endTime,
            duration: duration || 0,
        };

        onConfirm(result);
    }, [videoUri, trimRange, duration, onConfirm, player, isPlaying]);

    const handleCancel = useCallback(() => {
        // Pause video before canceling
        if (player && isPlaying) {
            player.pause();
            setIsPlaying(false);
        }

        onCancel();
    }, [onCancel, player, isPlaying]);

    // Loading state
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.controlActive} />
                    <Text style={styles.loadingText}>Loading video...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Error state
    if (error || !duration) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error || 'Failed to load video'}</Text>
                    <Text style={styles.errorSubtext}>Please try again with a different video</Text>
                </View>
                <View style={styles.errorButtonContainer}>
                    <ControlBar
                        isPlaying={false}
                        isMuted={false}
                        onPlayPause={() => { }}
                        onMuteToggle={() => { }}
                        onReset={() => { }}
                        onConfirm={() => { }}
                        onCancel={handleCancel}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <GestureHandlerRootView style={styles.gestureRoot}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Trim Video</Text>
                </View>

                {/* Video Preview */}
                <View style={styles.previewContainer}>
                    <VideoPreview player={player} />
                </View>

                {/* Trimmer Bar */}
                <View style={styles.trimmerContainer}>
                    <TrimmerBar
                        duration={duration}
                        trimRange={trimRange}
                        leftHandleGesture={leftHandleGesture}
                        rightHandleGesture={rightHandleGesture}
                        middleGesture={middleGesture}
                        leftHandleStyle={leftHandleStyle}
                        rightHandleStyle={rightHandleStyle}
                        selectionStyle={selectionStyle}
                        playheadStyle={playheadStyle}
                    />
                </View>

                {/* Spacer */}
                <View style={styles.spacer} />

                {/* Control Bar */}
                <View style={styles.controlsContainer}>
                    <ControlBar
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        onPlayPause={handlePlayPause}
                        onMuteToggle={handleMuteToggle}
                        onReset={handleReset}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                    />
                </View>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    gestureRoot: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.screenBackground,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.unselectedRegion,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    previewContainer: {
        backgroundColor: COLORS.previewBackground,
    },
    trimmerContainer: {
        marginTop: 16,
    },
    spacer: {
        flex: 1,
    },
    controlsContainer: {
        borderTopWidth: 1,
        borderTopColor: COLORS.unselectedRegion,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 8,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.cancelButton,
        textAlign: 'center',
    },
    errorSubtext: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    errorButtonContainer: {
        borderTopWidth: 1,
        borderTopColor: COLORS.unselectedRegion,
    },
});

export default VideoEditorScreen;