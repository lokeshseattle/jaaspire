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

const MAX_DURATION = 1000 * 60 * 1; // 1 minute

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
    // CAP effectiveEndTime at MAX_DURATION (1 minute)
    const effectiveEndTime = Math.min(
        initialEndTime ?? duration,
        MAX_DURATION
    );

    const [trimRange, setTrimRange] = useState<TrimRange>({
        startTime: initialStartTime,
        endTime: effectiveEndTime,
    });

    const trackWidth = LAYOUT.TRIMMER_WIDTH - TRIMMER.HANDLE_WIDTH * 2;

    // Calculate distances
    const minDistancePx = (TRIMMER.MIN_TRIM_DURATION_MS / duration) * trackWidth;
    const maxDistancePx = (MAX_DURATION / duration) * trackWidth;

    // Animated positions - rightPosition now uses capped effectiveEndTime
    const leftPosition = useSharedValue(
        (initialStartTime / duration) * trackWidth
    );
    const rightPosition = useSharedValue(
        (effectiveEndTime / duration) * trackWidth
    );

    // Store starting position when gesture begins
    const leftStartPosition = useSharedValue(0);
    const rightStartPosition = useSharedValue(0);

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
                    leftStartPosition.value = leftPosition.value;
                })
                .onUpdate((event) => {
                    const candidatePosition = leftStartPosition.value + event.translationX;

                    const lowerBound = Math.max(0, rightPosition.value - maxDistancePx);
                    const upperBound = rightPosition.value - minDistancePx;

                    const newPosition = Math.min(upperBound, Math.max(lowerBound, candidatePosition));
                    leftPosition.value = newPosition;
                })
                .onEnd(() => {
                    runOnJS(updateTrimRange)(leftPosition.value, rightPosition.value);
                }),
        [minDistancePx, maxDistancePx, updateTrimRange]
    );

    // Right handle gesture
    const rightHandleGesture = useMemo(
        () =>
            Gesture.Pan()
                .onStart(() => {
                    rightStartPosition.value = rightPosition.value;
                })
                .onUpdate((event) => {
                    const candidatePosition = rightStartPosition.value + event.translationX;

                    const lowerBound = leftPosition.value + minDistancePx;
                    const upperBound = Math.min(trackWidth, leftPosition.value + maxDistancePx);

                    const newPosition = Math.min(upperBound, Math.max(lowerBound, candidatePosition));
                    rightPosition.value = newPosition;
                })
                .onEnd(() => {
                    runOnJS(updateTrimRange)(leftPosition.value, rightPosition.value);
                }),
        [minDistancePx, maxDistancePx, trackWidth, updateTrimRange]
    );

    // Middle section gesture (moves both handles together)
    const middleGesture = useMemo(
        () =>
            Gesture.Pan()
                .onStart(() => {
                    leftStartPosition.value = leftPosition.value;
                    rightStartPosition.value = rightPosition.value;
                })
                .onUpdate((event) => {
                    const currentWidth = rightStartPosition.value - leftStartPosition.value;

                    let newLeft = leftStartPosition.value + event.translationX;
                    let newRight = rightStartPosition.value + event.translationX;

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

    // Reset function - also cap at MAX_DURATION
    const resetTrim = useCallback(() => {
        const cappedEndPosition = Math.min(trackWidth, maxDistancePx);
        leftPosition.value = withSpring(0);
        rightPosition.value = withSpring(cappedEndPosition);
        setTrimRange({ startTime: 0, endTime: Math.min(duration, MAX_DURATION) });
    }, [duration, trackWidth, maxDistancePx]);

    console.log({ trimRange });

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