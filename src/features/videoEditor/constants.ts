// src/features/videoEditor/constants.ts

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LAYOUT = {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    TRIMMER_HORIZONTAL_PADDING: 16,
    get TRIMMER_WIDTH() {
        return SCREEN_WIDTH - this.TRIMMER_HORIZONTAL_PADDING * 2;
    },
};

export const TRIMMER = {
    HANDLE_WIDTH: 16,
    BAR_HEIGHT: 60,
    MIN_TRIM_DURATION_MS: 1000, // 1 second minimum
    MAX_TRIM_DURATION_MS: 60000, // 1 minute maximum
    HANDLE_HIT_SLOP: 20,
};

export const COLORS = {
    // Primary
    selectedRegion: '#3B82F6',      // Blue
    unselectedRegion: '#E5E7EB',    // Light grey
    handleColor: '#1E40AF',          // Dark blue

    // Background
    screenBackground: '#FFFFFF',
    previewBackground: '#000000',

    // Controls
    controlActive: '#3B82F6',
    controlInactive: '#9CA3AF',
    controlBackground: '#F3F4F6',

    // Text
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',

    // Buttons
    confirmButton: '#3B82F6',
    cancelButton: '#EF4444',
    resetButton: '#6B7280',
};

export const TYPOGRAPHY = {
    timestamp: {
        fontSize: 12,
        fontWeight: '600' as const,
    },
};