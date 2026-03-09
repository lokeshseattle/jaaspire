// app/video-editor.tsx

import { useVideoUpload } from '@/src/features/upload/upload.hooks';
import { VideoEditorScreen } from '@/src/features/videoEditor/screen/VideoEditor';
import { VideoEditorResult } from '@/src/features/videoEditor/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
export default function VideoEditorPage() {
    const router = useRouter();
    const { uri } = useLocalSearchParams<{ uri: string }>();

    // Handle Android back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleCancel();
            return true;
        });

        return () => backHandler.remove();
    }, []);

    const [progress, setProgress] = useState(0);

    const { mutate, isPending, isSuccess, isError } = useVideoUpload();

    const handleUpload = () => {
        mutate(
            {
                fileUri: uri,
                fileName: 'video.mp4',
                onProgress: setProgress,
            },
            {
                onSuccess: (data) => console.log('Upload complete:', data),
                onError: (err) => console.error('Upload failed:', err),
                onSettled: () => {
                    console.warn('Upload settled');
                }
            }
        );
    };
    console.log({ progress })


    const handleConfirm = useCallback((result: VideoEditorResult) => {
        console.log('Trim result:', result);

        handleUpload()

        // Option 1: Go back with params
        router.back();

        // Option 2: Or navigate to specific screen with result
        // router.replace({
        //   pathname: '/',
        //   params: {
        //     trimmedUri: result.uri,
        //     startTime: result.startTime.toString(),
        //     endTime: result.endTime.toString(),
        //   },
        // });

        // TODO: Use result.startTime and result.endTime as needed
    }, [router]);

    const handleCancel = useCallback(() => {
        router.back();
    }, [router]);

    // Error state - no URI provided
    if (!uri) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>No video selected</Text>
            </View>
        );
    }

    return (
        <VideoEditorScreen
            videoUri={uri}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    );
}

const styles = StyleSheet.create({
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
    },
});