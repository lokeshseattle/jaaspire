import { GridItem } from '@/src/services/api/api.types';
import { AppTheme } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MultiPostIndicator } from './MultiPostIndicator';
import { VideoIndicator } from './VideoIndicator';




interface ExploreGridItemProps {
    item: GridItem;
    itemSize: number;
    gap: number;
    onPress: (postId: number) => void;
}

export const ExploreGridItem: React.FC<ExploreGridItemProps> = ({
    item,
    itemSize,
    gap,
    onPress,
}) => {
    const { theme } = useTheme();
    const styles = createStyles(theme);



    const { post, isLarge } = item;
    const attachment = post.attachments[0];
    // Explore API uses literal "video" | "image" — not a file path (getMediaType would misclassify).
    const isVideo = attachment?.type === 'video';
    const hasMultiple = post.attachments_count > 1;

    // Large items span 2 rows
    const height = isLarge ? itemSize * 2 + gap : itemSize;

    const handlePress = useCallback(() => {
        if (isVideo) {
            router.push(`/(app)/flick/${post.id}`);
            return;
        }
        onPress(post.id);
    }, [isVideo, post.id, onPress]);

    return (
        <Pressable
            style={[styles.container, { width: itemSize, height, }]}
            onPress={handlePress}
        >
            <Image
                source={{ uri: attachment?.thumbnail || attachment?.path }}
                style={styles.image}
                contentFit="cover"
                transition={200}
            />

            {isVideo && <VideoIndicator />}
            {hasMultiple && <MultiPostIndicator />}
        </Pressable>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});