import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export const MultiPostIndicator: React.FC = () => {
    return (
        <View style={styles.container}>
            <Ionicons name="copy" size={16} color="#FFFFFF" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 4,
        padding: 4,
    },
});