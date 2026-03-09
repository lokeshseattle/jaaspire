// src/features/videoEditor/components/TrimmerBar/FramePreviewTooltip.tsx

import React from 'react';
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { COLORS } from '../../constants';

interface FramePreviewTooltipProps {
    isVisible: boolean;
    uri: string | null;
    time: number; // in milliseconds
    x: number; // horizontal position
    containerWidth: number;
}

const TOOLTIP_WIDTH = 120;
const TOOLTIP_HEIGHT = 80;
const ARROW_SIZE = 8;

const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

export const FramePreviewTooltip: React.FC<FramePreviewTooltipProps> = ({
    isVisible,
    uri,
    time,
    x,
    containerWidth,
}) => {
    // Calculate tooltip position (centered above the handle, clamped to container)
    const tooltipX = Math.max(
        0,
        Math.min(x - TOOLTIP_WIDTH / 2, containerWidth - TOOLTIP_WIDTH)
    );

    // Calculate arrow offset to point at the handle
    const arrowOffset = Math.max(
        10,
        Math.min(x - tooltipX, TOOLTIP_WIDTH - 10)
    );

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: withSpring(tooltipX, { damping: 15, stiffness: 150 }) },
        ],
    }));

    if (!isVisible) {
        return null;
    }

    return (
        <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={[styles.container, animatedStyle]}
        >
            {/* Tooltip content */}
            <View style={styles.tooltip}>
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                    {uri ? (
                        <Image
                            source={{ uri }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={COLORS.controlActive} />
                        </View>
                    )}
                </View>

                {/* Time label */}
                <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{formatTime(time)}</Text>
                </View>
            </View>

            {/* Arrow pointing down */}
            <View style={[styles.arrowContainer, { left: arrowOffset - ARROW_SIZE }]}>
                <View style={styles.arrow} />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: '100%',
        marginBottom: 12,
        zIndex: 100,
    },
    tooltip: {
        width: TOOLTIP_WIDTH,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    thumbnailContainer: {
        width: TOOLTIP_WIDTH,
        height: TOOLTIP_HEIGHT,
        backgroundColor: '#000',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    loadingContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#374151',
    },
    timeContainer: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#1F2937',
    },
    timeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    arrowContainer: {
        position: 'absolute',
        bottom: -ARROW_SIZE,
    },
    arrow: {
        width: 0,
        height: 0,
        borderLeftWidth: ARROW_SIZE,
        borderRightWidth: ARROW_SIZE,
        borderTopWidth: ARROW_SIZE,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#1F2937',
    },
});