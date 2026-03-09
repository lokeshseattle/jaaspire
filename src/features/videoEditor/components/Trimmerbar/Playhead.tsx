import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { COLORS } from '../../constants';

interface PlayheadProps {
    animatedStyle: any;
}

export const Playhead: React.FC<PlayheadProps> = ({ animatedStyle }) => {
    return (
        <Animated.View style={[styles.playhead, animatedStyle]} />
    );
};

const styles = StyleSheet.create({
    playhead: {
        position: 'absolute',
        top: -4,
        bottom: -4,
        width: 4,
        backgroundColor: COLORS.controlActive, // Red/Blue line indicating current time
        borderRadius: 2,
        zIndex: 10,
        // Center the playhead horizontally so its center is exactly at the current time
        marginLeft: -2,
    },
});
