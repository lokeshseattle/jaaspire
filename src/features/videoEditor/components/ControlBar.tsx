// src/features/videoEditor/components/ControlBar.tsx

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants';

interface ControlBarProps {
    isPlaying: boolean;
    isMuted: boolean;
    onPlayPause: () => void;
    onMuteToggle: () => void;
    onReset: () => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
    isPlaying,
    isMuted,
    onPlayPause,
    onMuteToggle,
    onReset,
    onConfirm,
    onCancel,
}) => {
    return (
        <View style={styles.container}>
            {/* Top row - Playback controls */}
            <View style={styles.playbackRow}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onMuteToggle}
                    accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
                >
                    <Ionicons
                        name={isMuted ? 'volume-mute' : 'volume-high'}
                        size={24}
                        color={COLORS.controlActive}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.playButton}
                    onPress={onPlayPause}
                    accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                >
                    <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={32}
                        color="#FFFFFF"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onReset}
                    accessibilityLabel="Reset trim"
                >
                    <Ionicons
                        name="refresh"
                        size={24}
                        color={COLORS.resetButton}
                    />
                </TouchableOpacity>
            </View>

            {/* Bottom row - Action buttons */}
            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={onCancel}
                >

                    <Text style={styles.actionButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.confirmButton]}
                    onPress={onConfirm}
                >

                    <Text style={styles.actionButtonText}>Confirm</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 16,
    },
    playbackRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 32,
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.controlBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.controlActive,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    cancelButton: {
        backgroundColor: COLORS.cancelButton,
    },
    confirmButton: {
        backgroundColor: COLORS.confirmButton,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});