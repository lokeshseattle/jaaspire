// src/features/videoEditor/components/TrimmerBar/TrimSelection.tsx

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, GestureType } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { COLORS, TRIMMER } from '../../constants';

interface TrimSelectionProps {
    gesture: GestureType;
    style: any;
    children?: React.ReactNode; // For future thumbnail support
}

export const TrimSelection: React.FC<TrimSelectionProps> = ({
    gesture,
    style,
    children,
}) => {
    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.selection, style]}>
                {children || <View style={styles.solidBackground} />}
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    selection: {
        position: 'absolute',
        height: TRIMMER.BAR_HEIGHT,
        borderTopWidth: 3,
        borderBottomWidth: 3,
        borderColor: COLORS.handleColor,
        overflow: 'hidden',
    },
    solidBackground: {
        flex: 1,
        backgroundColor: COLORS.selectedRegion,
        opacity: 0.3,
    },
});