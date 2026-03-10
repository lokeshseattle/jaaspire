// app/video-editor.tsx

import { useStoryStore } from '@/src/features/story/story.store';
import { useUploadAndCreateStory, useVideoUpload } from '@/src/features/upload/upload.hooks';
import { VideoEditorScreen } from '@/src/features/videoEditor/screen/VideoEditor';
import { VideoEditorResult } from '@/src/features/videoEditor/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

export default function VideoEditorPage() {
    const router = useRouter();
    const { uri, fileName } = useLocalSearchParams<{ uri: string, fileName: string }>();

    // Handle Android back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            handleCancel();
            return true;
        });

        return () => backHandler.remove();
    }, []);

    const [progress, setProgress] = useState(0);
    const storyMutation = useUploadAndCreateStory()

    console.log("line23", progress)
    const { setUploadProgress } = useStoryStore();

    const videoUploadMutation = useVideoUpload();

    // console.log("isSuccess", isSuccess)
    // console.log("data", data)

    // useEffect(() => {
    //     console.log("progress878", progress)
    //     // setIsLoading(progress > 0 && progress < 1)
    // }, [progress])

    const handleUpload = () => {
        videoUploadMutation.mutate(
            {
                fileUri: uri,
                fileName: fileName,
            },
            {
                onSuccess: (data) => {
                    // setIsLoading(false);

                    console.log("success566")
                },
                onSettled: () => {
                    // setIsLoading(false);

                    console.log("settled566")
                },
                onError: () => {
                    // setIsLoading(false);
                },
            }
        );
    };
    console.log({ progress })


    const handleConfirm = useCallback((result: VideoEditorResult) => {
        console.log('Trim result:', result);
        console.log("Before handle Upload78978")
        // handleUpload()

        storyMutation.mutate({
            fileUri: uri,
            fileName: fileName,
            trimVideoData: JSON.stringify({
                start: result.startTime,
                // divide by 1000 to make in decimal seconds
                end: result.endTime / 1000
            })
        });
        console.log("after handle Upload78978")

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