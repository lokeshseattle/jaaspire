import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

import { PickedFile, useImageEditStore } from '@/src/features/post-editor/store/useImageEditorStore';
import { AdjustmentState, DEFAULT_ADJUSTMENTS, FILTERS, getCSSFilterString } from '@/src/lib/image-filters';
import { AppTheme } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PostImageEditorScreen() {
  // const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { originalImage, setEditedImage } = useImageEditStore();
  const [selectedFilterId, setSelectedFilterId] = useState('none');
  const [filterIntensity, setFilterIntensity] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [adjustments, setAdjustments] = useState<AdjustmentState>(DEFAULT_ADJUSTMENTS);

  // Zoom state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Get current filter
  const selectedFilter = useMemo(
    () => FILTERS.find((f) => f.id === selectedFilterId) || FILTERS[0],
    [selectedFilterId]
  );

  // Get CSS filter string for preview
  const cssFilter = useMemo(
    () => getCSSFilterString(selectedFilter, filterIntensity, adjustments),
    [selectedFilter, filterIntensity, adjustments]
  );

  // Get filter overlay properties for React Native
  const filterOverlayProps = useMemo(() => {
    if (selectedFilterId === 'none' || !selectedFilter.overlayColor) {
      return null;
    }

    return {
      backgroundColor: selectedFilter.overlayColor,
      opacity: selectedFilter.overlayOpacity || 0.1,
    };
  }, [selectedFilter, selectedFilterId]);

  // Pinch gesture
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  // Pan gesture
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Reset zoom
  const handleResetZoom = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    savedTranslateX.value = 0;
    translateY.value = withSpring(0);
    savedTranslateY.value = 0;
  };

  // Handle adjustment change
  const handleAdjustmentChange = (key: keyof AdjustmentState, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  };

  // Reset adjustments
  const handleResetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setSelectedFilterId('none');
    setFilterIntensity(100);
  };

  // Apply and return edited image
  const handleApply = async () => {
    setIsProcessing(true);
    try {
      // Set the edited image in the store
      // For now, we're using the original image URI
      // In production, you'd apply the actual filters and adjustments here
      if (originalImage) {
        const editedFile: PickedFile = {
          ...originalImage,
          uri: originalImage.uri, // In production, this would be the processed image URI
        };
        setEditedImage(editedFile);
      }
      router.back();
    } catch (error) {
      console.error('Error applying edits:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!originalImage) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>No image provided</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Toolbar */}
      <View style={[styles.topToolbar, { paddingTop: insets.top }]}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </Pressable>

        <View style={styles.toolbarCenter}>
          {/* <Pressable
            style={[styles.intensityButton, filterIntensity !== 100 && styles.intensityButtonActive]}
            onPress={() => setFilterIntensity(filterIntensity === 100 ? 50 : 100)}
          >
            <Text style={[styles.intensityButtonText, filterIntensity !== 100 && styles.intensityButtonTextActive]}>
              {filterIntensity}%
            </Text>
          </Pressable> */}
        </View>

        <Pressable
          style={[styles.applyButton, isProcessing && styles.applyButtonDisabled]}
          onPress={handleApply}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.applyButtonText}>Apply</Text>
          )}
        </Pressable>
      </View>

      {/* Main Image Area */}
      <View style={styles.imageContainer}>
        <GestureDetector gesture={gesture}>
          <Animated.Image
            source={{ uri: originalImage.uri }}
            style={[styles.image, animatedImageStyle]}
            resizeMode="contain"
          />
        </GestureDetector>

        {/* Filter overlay for React Native using blend modes */}
        {filterOverlayProps && Platform.OS !== 'web' && (
          <View
            style={[StyleSheet.absoluteFill, filterOverlayProps]}
            pointerEvents="none"
          />
        )}

        {/* Web filter preview */}
        {Platform.OS === 'web' && cssFilter !== 'none' && (
          <View
            style={[StyleSheet.absoluteFill, { filter: cssFilter }]}
            pointerEvents="none"
          />
        )}

        {/* Filter name indicator */}
        {selectedFilterId !== 'none' && (
          <View style={styles.filterIndicator}>
            <Text style={styles.filterIndicatorText}>{selectedFilter.name}</Text>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom }]}>
        {/* Filter Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterCarousel}
        >
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.id}
              style={[
                styles.filterItem,
                selectedFilterId === filter.id && styles.filterItemSelected,
              ]}
              onPress={() => setSelectedFilterId(filter.id)}
            >
              <View style={[styles.filterThumbnail, { filter: filter.cssFilter }]}>
                <Image source={{ uri: originalImage?.uri }} style={styles.filterThumbnailImage} />
              </View>
              <Text style={[
                styles.filterName,
                selectedFilterId === filter.id && styles.filterNameSelected,
              ]}>
                {filter.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>



      {/* Processing Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.processingText}>Applying edits...</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    backButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.pill,
    },
    backButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    topToolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      zIndex: 10,
    },
    iconButton: {
      padding: theme.spacing.xs,
    },
    toolbarCenter: {
      flex: 1,
      alignItems: 'center',
    },
    intensityButton: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radius.pill,
    },
    intensityButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    intensityButtonText: {
      color: theme.colors.textPrimary,
      fontWeight: '600',
      fontSize: 14,
    },
    intensityButtonTextActive: {
      color: '#FFFFFF',
    },
    applyButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      minWidth: 80,
      alignItems: 'center',
    },
    applyButtonDisabled: {
      opacity: 0.5,
    },
    applyButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 16,
    },
    imageContainer: {
      flex: 1,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    filterOverlay: {
      pointerEvents: 'none',
    },
    bottomControls: {
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    filterCarousel: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
    },
    filterItem: {
      marginRight: theme.spacing.md,
      alignItems: 'center',
    },
    filterItemSelected: {
      opacity: 1,
    },
    filterThumbnail: {
      width: 70,
      height: 70,
      borderRadius: theme.radius.sm,
      overflow: 'hidden',
      marginBottom: theme.spacing.xs,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    filterThumbnailImage: {
      width: '100%',
      height: '100%',
    },
    filterName: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    filterNameSelected: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    processingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.background,
      opacity: 0.8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    processingText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      marginTop: theme.spacing.md,
      fontWeight: '600',
    },
    filterIndicator: {
      position: 'absolute',
      top: 60,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 5,
    },
    filterIndicatorText: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      fontSize: 14,
      fontWeight: '600',
    },
  });
