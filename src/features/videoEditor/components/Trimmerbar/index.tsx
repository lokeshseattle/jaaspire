// src/features/videoEditor/components/TrimmerBar/index.tsx

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS, LAYOUT, TRIMMER } from '../../constants';
import { TrimRange } from '../../types';
import { Playhead } from './Playhead';
import { TimeLabels } from './TimeLabels';
import { TrimHandle } from './TrimHandle';
import { TrimSelection } from './TrimSelection';

interface TrimmerBarProps {
    duration: number;
    trimRange: TrimRange;
    leftHandleGesture: any;
    rightHandleGesture: any;
    middleGesture: any;
    leftHandleStyle: any;
    rightHandleStyle: any;
    selectionStyle: any;
    playheadStyle: any;
}

export const TrimmerBar: React.FC<TrimmerBarProps> = ({
    duration,
    trimRange,
    leftHandleGesture,
    rightHandleGesture,
    middleGesture,
    leftHandleStyle,
    rightHandleStyle,
    selectionStyle,
    playheadStyle,
}) => {
    return (
        <View style={styles.container}>
            <GestureHandlerRootView style={styles.gestureRoot}>
                <View style={styles.track}>
                    {/* Unselected background */}
                    <View style={styles.unselectedBackground} />

                    {/* Selected region (draggable middle) */}
                    <TrimSelection gesture={middleGesture} style={selectionStyle} />

                    {/* Left handle */}
                    <TrimHandle
                        gesture={leftHandleGesture}
                        style={leftHandleStyle}
                        position="left"
                    />

                    {/* Right handle */}
                    <TrimHandle
                        gesture={rightHandleGesture}
                        style={rightHandleStyle}
                        position="right"
                    />

                    {/* Progress Playhead */}
                    <Playhead animatedStyle={playheadStyle} />
                </View>
            </GestureHandlerRootView>

            {/* Time labels */}
            <TimeLabels
                startTime={trimRange.startTime}
                endTime={trimRange.endTime}
                duration={duration}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: LAYOUT.TRIMMER_HORIZONTAL_PADDING,
        paddingVertical: 16,
    },
    gestureRoot: {
        width: '100%',
    },
    track: {
        width: LAYOUT.TRIMMER_WIDTH,
        height: TRIMMER.BAR_HEIGHT,
        backgroundColor: COLORS.unselectedRegion,
        borderRadius: 6,
        position: 'relative',
        overflow: 'hidden',
    },
    unselectedBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.unselectedRegion,
    },
});