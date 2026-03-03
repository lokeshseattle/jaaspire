import { ExploreGridItem } from '@/src/components/explore/ExploreGridItem';
import { GridItem } from '@/src/services/api/api.types';
import { AppTheme } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeProvider';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';

interface ExploreGridProps {
    gridItems: GridItem[];
    isLoading: boolean;
    isRefreshing: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    onRefresh: () => void;
    onLoadMore: () => void;
    onPostPress: (postId: number) => void;
}

interface GridBlock {
    items: GridItem[];
    isLeftFeatured: boolean;
    blockIndex: number;
}

const COLUMNS = 3;
const GAP = 2;

const ExploreGrid: React.FC<ExploreGridProps> = ({
    gridItems,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    onRefresh,
    onLoadMore,
    onPostPress,
}) => {
    const { theme } = useTheme()
    const styles = createStyles(theme)

    const { width } = useWindowDimensions();
    const itemSize = (width - GAP * (COLUMNS - 1)) / COLUMNS;
    const blockHeight = itemSize * 2 + GAP; // Height of each 5-item block

    // Group items into blocks of 5
    const blocks = useMemo(() => groupIntoBlocks(gridItems), [gridItems]);

    const renderBlock = useCallback(
        ({ item: block }: { item: GridBlock }) => (
            <View style={[styles.block, { height: blockHeight }]}>
                {block.items.map((gridItem, index) => {
                    const position = getItemPosition(
                        index,
                        block.isLeftFeatured,
                        itemSize,
                        GAP
                    );

                    return (
                        <View
                            key={gridItem.post.id}
                            style={[
                                styles.absoluteItem,
                                {
                                    left: position.left,
                                    top: position.top,
                                    width: position.width,
                                    height: position.height,
                                },
                            ]}
                        >
                            <ExploreGridItem
                                item={{ ...gridItem, isLarge: position.isLarge }}
                                itemSize={itemSize}
                                gap={GAP}
                                onPress={onPostPress}
                            // Pass custom size if your component supports it
                            // customWidth={position.width}
                            // customHeight={position.height}
                            />
                        </View>
                    );
                })}
            </View>
        ),
        [itemSize, blockHeight, onPostPress]
    );

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            onLoadMore();
        }
    }, [hasNextPage, isFetchingNextPage, onLoadMore]);

    const renderFooter = useCallback(() => {
        if (!isFetchingNextPage) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator size="small" color="#ffffff" />
            </View>
        );
    }, [isFetchingNextPage]);

    if (isLoading && gridItems.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    return (
        <FlashList
            data={blocks}
            renderItem={renderBlock}
            // estimatedItemSize={blockHeight}
            keyExtractor={(item) => `block-${item.blockIndex}`}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor="#ffffff"
                />
            }
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        />
    );
};

/**
 * Groups items into blocks of 5
 * Alternates between left-featured and right-featured
 */
const groupIntoBlocks = (items: GridItem[]): GridBlock[] => {
    const blocks: GridBlock[] = [];

    for (let i = 0; i < items.length; i += 5) {
        const blockIndex = Math.floor(i / 5);
        blocks.push({
            items: items.slice(i, i + 5),
            isLeftFeatured: blockIndex % 2 === 0,
            blockIndex,
        });
    }

    return blocks;
};

/**
 * Calculate position for each item within a block
 *
 * LEFT FEATURED (isLeftFeatured = true):
 * ┌─────────┬─────┬─────┐
 * │         │  1  │  2  │
 * │    0    ├─────┼─────┤
 * │ (large) │  3  │  4  │
 * └─────────┴─────┴─────┘
 *
 * RIGHT FEATURED (isLeftFeatured = false):
 * ┌─────┬─────┬─────────┐
 * │  0  │  1  │         │
 * ├─────┼─────┤    4    │
 * │  2  │  3  │ (large) │
 * └─────┴─────┴─────────┘
 */
const getItemPosition = (
    index: number,
    isLeftFeatured: boolean,
    itemSize: number,
    gap: number
): { left: number; top: number; width: number; height: number; isLarge: boolean } => {
    const largeSize = itemSize * 2 + gap;
    const col1 = 0;
    const col2 = itemSize + gap;
    const col3 = (itemSize + gap) * 2;
    const row1 = 0;
    const row2 = itemSize + gap;

    if (isLeftFeatured) {
        // Large item on LEFT (index 0)
        const positions = [
            { left: col1, top: row1, width: itemSize, height: largeSize, isLarge: true },  // 0 - large
            { left: col2, top: row1, width: itemSize, height: itemSize, isLarge: false },  // 1
            { left: col3, top: row1, width: itemSize, height: itemSize, isLarge: false },  // 2
            { left: col2, top: row2, width: itemSize, height: itemSize, isLarge: false },  // 3
            { left: col3, top: row2, width: itemSize, height: itemSize, isLarge: false },  // 4
        ];
        return positions[index] || positions[0];
    } else {
        // Large item on RIGHT (index 4)
        const positions = [
            { left: col1, top: row1, width: itemSize, height: itemSize, isLarge: false },  // 0
            { left: col2, top: row1, width: itemSize, height: itemSize, isLarge: false },  // 1
            { left: col1, top: row2, width: itemSize, height: itemSize, isLarge: false },  // 2
            { left: col2, top: row2, width: itemSize, height: itemSize, isLarge: false },  // 3
            { left: col3, top: row1, width: itemSize, height: largeSize, isLarge: true },  // 4 - large
        ];
        return positions[index] || positions[0];
    }
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    block: {
        position: 'relative',
        width: '100%',
    },
    absoluteItem: {
        position: 'absolute',
    },
    listContent: {
        backgroundColor: theme.colors.background,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
});

export default ExploreGrid;