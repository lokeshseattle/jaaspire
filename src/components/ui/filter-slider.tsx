import React from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';

import { AppTheme } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeProvider';

interface FilterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  height?: number;
}

export function FilterSlider({
  label,
  value,
  min,
  max,
  onChange,
  format = (v) => v.toString(),
  height = 40,
}: FilterSliderProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const progress = useSharedValue((value - min) / (max - min));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      handleMove(evt.nativeEvent.locationX);
    },
    onPanResponderMove: (evt) => {
      handleMove(evt.nativeEvent.locationX);
    },
    onPanResponderRelease: () => {
      // Finalize value
    },
  });

  const handleMove = (locationX: number) => {
    const containerWidth = 200; // Default width, will be adjusted
    const newProgress = Math.max(0, Math.min(1, locationX / containerWidth));
    const newValue = min + (newProgress * (max - min));
    progress.value = newProgress;
    onChange(Math.round(newValue));
  };

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      left: `${progress.value * 100}%`,
      transform: [{ translateX: -8 }], // Half of thumb width
    };
  });

  const animatedFillStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  const displayValue = format(value);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{displayValue}</Text>
      </View>
      
      <View 
        style={[styles.sliderTrack, { height }]} 
        {...panResponder.panHandlers}
      >
        <Animated.View 
          style={[styles.sliderFill, { height }, animatedFillStyle]} 
        />
        <Animated.View 
          style={[styles.sliderThumb, { height: height + 8 }, animatedThumbStyle]} 
        />
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sliderContainer: {
      marginBottom: theme.spacing.lg,
    },
    sliderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    sliderLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    sliderValue: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      minWidth: 40,
      textAlign: 'right',
    },
    sliderTrack: {
      backgroundColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      position: 'relative',
      overflow: 'visible',
    },
    sliderFill: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
    },
    sliderThumb: {
      width: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: theme.radius.pill,
      position: 'absolute',
      top: -4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
  });
