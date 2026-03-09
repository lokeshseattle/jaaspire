// src/features/videoEditor/components/TrimmerBar/TimeLabels.tsx

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

interface TimeLabelsProps {
    startTime: number; // in ms
    endTime: number;   // in ms
    duration: number;  // in ms
}

const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const TimeLabels: React.FC<TimeLabelsProps> = ({
    startTime,
    endTime,
    duration,
}) => {
    const trimmedDuration = endTime - startTime;

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.label}>{formatTime(startTime)}</Text>
                <Text style={styles.duration}>
                    Duration: {formatTime(trimmedDuration)}
                </Text>
                <Text style={styles.label}>{formatTime(endTime)}</Text>
            </View>
            <Text style={styles.totalDuration}>
                Total: {formatTime(duration)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: TYPOGRAPHY.timestamp.fontSize,
        fontWeight: TYPOGRAPHY.timestamp.fontWeight,
        color: COLORS.textPrimary,
    },
    duration: {
        fontSize: TYPOGRAPHY.timestamp.fontSize,
        fontWeight: TYPOGRAPHY.timestamp.fontWeight,
        color: COLORS.selectedRegion,
    },
    totalDuration: {
        fontSize: 11,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
});