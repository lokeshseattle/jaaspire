// src/features/videoEditor/hooks/useVideoTrimmer.ts

import { useCallback, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { LAYOUT, TRIMMER } from '../constants';
import { TrimRange } from '../types';

interface UseVideoTrimmerProps {
    duration: number;
    initialStartTime?: number;
    initialEndTime?: number;
}

interface UseVideoTrimmerReturn {
    trimRange: TrimRange;
    leftHandleGesture: ReturnType<typeof Gesture.Pan>;
    rightHandleGesture: ReturnType<typeof Gesture.Pan>;
    middleGesture: ReturnType<typeof Gesture.Pan>;
    leftHandleStyle: ReturnType<typeof useAnimatedStyle>;
    rightHandleStyle: ReturnType<typeof useAnimatedStyle>;
    selectionStyle: ReturnType<typeof useAnimatedStyle>;
    resetTrim: () => void;
}

export const useVideoTrimmer = ({
    duration,
    initialStartTime = 0,
    initialEndTime,
}: UseVideoTrimmerProps): UseVideoTrimmerReturn => {
    const effectiveEndTime = initialEndTime ?? duration;

    const [trimRange, setTrimRange] = useState<TrimRange>({
        startTime: initialStartTime,
        endTime: effectiveEndTime,
    });

    const trackWidth = LAYOUT.TRIMMER_WIDTH - TRIMMER.HANDLE_WIDTH * 2;

    // Animated positions
    const leftPosition = useSharedValue(
        (initialStartTime / duration) * trackWidth
    );
    const rightPosition = useSharedValue(
        (effectiveEndTime / duration) * trackWidth
    );

    // Store starting position when gesture begins
    const leftStartPosition = useSharedValue(0);
    const rightStartPosition = useSharedValue(0);

    const minDistancePx = useMemo(() => {
        return (TRIMMER.MIN_TRIM_DURATION_MS / duration) * trackWidth;
    }, [duration, trackWidth]);

    const positionToTime = useCallback(
        (position: number) => {
            return (position / trackWidth) * duration;
        },
        [duration, trackWidth]
    );

    const updateTrimRange = useCallback(
        (start: number, end: number) => {
            setTrimRange({
                startTime: Math.round(positionToTime(start)),
                endTime: Math.round(positionToTime(end)),
            });
        },
        [positionToTime]
    );

    // Left handle gesture
    const leftHandleGesture = useMemo(
        () =>
            Gesture.Pan()
                .onStart(() => {
                    // Store current position when gesture starts
                    leftStartPosition.value = leftPosition.value;
                })
                .onUpdate((event) => {
                    // Calculate new position based on START position + translation
                    const newPosition = Math.max(
                        0,
                        Math.min(
                            leftStartPosition.value + event.translationX,
                            rightPosition.value - minDistancePx
                        )
                    );
                    leftPosition.value = newPosition;
                })
                .onEnd(() => {
                    runOnJS(updateTrimRange)(leftPosition.value, rightPosition.value);
                }),
        [minDistancePx, updateTrimRange]
    );

    // Right handle gesture
    const rightHandleGesture = useMemo(
        () =>
            Gesture.Pan()
                .onStart(() => {
                    // Store current position when gesture starts
                    rightStartPosition.value = rightPosition.value;
                })
                .onUpdate((event) => {
                    // Calculate new position based on START position + translation
                    const newPosition = Math.min(
                        trackWidth,
                        Math.max(
                            rightStartPosition.value + event.translationX,
                            leftPosition.value + minDistancePx
                        )
                    );
                    rightPosition.value = newPosition;
                })
                .onEnd(() => {
                    runOnJS(updateTrimRange)(leftPosition.value, rightPosition.value);
                }),
        [minDistancePx, trackWidth, updateTrimRange]
    );

    // Middle section gesture (moves both handles together)
    const middleGesture = useMemo(
        () =>
            Gesture.Pan()
                .onStart(() => {
                    // Store both positions when gesture starts
                    leftStartPosition.value = leftPosition.value;
                    rightStartPosition.value = rightPosition.value;
                })
                .onUpdate((event) => {
                    const currentWidth = rightStartPosition.value - leftStartPosition.value;

                    let newLeft = leftStartPosition.value + event.translationX;
                    let newRight = rightStartPosition.value + event.translationX;

                    // Clamp to boundaries
                    if (newLeft < 0) {
                        newLeft = 0;
                        newRight = currentWidth;
                    }
                    if (newRight > trackWidth) {
                        newRight = trackWidth;
                        newLeft = trackWidth - currentWidth;
                    }

                    leftPosition.value = newLeft;
                    rightPosition.value = newRight;
                })
                .onEnd(() => {
                    runOnJS(updateTrimRange)(leftPosition.value, rightPosition.value);
                }),
        [trackWidth, updateTrimRange]
    );

    // Animated styles
    const leftHandleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: leftPosition.value }],
    }));

    const rightHandleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: rightPosition.value + TRIMMER.HANDLE_WIDTH }],
    }));

    const selectionStyle = useAnimatedStyle(() => ({
        left: leftPosition.value + TRIMMER.HANDLE_WIDTH,
        width: rightPosition.value - leftPosition.value,
    }));

    // Reset function
    const resetTrim = useCallback(() => {
        leftPosition.value = withSpring(0);
        rightPosition.value = withSpring(trackWidth);
        setTrimRange({ startTime: 0, endTime: duration });
    }, [duration, trackWidth]);

    return {
        trimRange,
        leftHandleGesture,
        rightHandleGesture,
        middleGesture,
        leftHandleStyle,
        rightHandleStyle,
        selectionStyle,
        resetTrim,
    };
};