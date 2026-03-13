// src/features/videoEditor/components/VideoPreview.tsx

import { VideoPlayer, VideoView } from 'expo-video';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, LAYOUT } from '../constants';

interface VideoPreviewProps {
    player: VideoPlayer;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ player }) => {
    // Calculate aspect ratio friendly dimensions
    const videoWidth = LAYOUT.SCREEN_WIDTH;
    const videoHeight = LAYOUT.SCREEN_WIDTH * (9 / 16); // 16:9 aspect ratio

    return (
        <View style={[styles.container,
            // { height: videoHeight }
        ]}>
            <VideoView
                player={player}
                style={styles.video}
                contentFit="fill"
                nativeControls={false}

            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: COLORS.previewBackground,
        flex: 1,
        borderRadius: 10,
    },
    video: {
        flex: 1,
        borderRadius: 10,
    },
});