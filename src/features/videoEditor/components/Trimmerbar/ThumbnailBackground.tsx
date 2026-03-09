// src/features/videoEditor/components/TrimmerBar/ThumbnailBackground.tsx

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ThumbnailFrame } from '../../types';

interface ThumbnailBackgroundProps {
  thumbnails: ThumbnailFrame[];
  // Future: Add more props for positioning, sizing, etc.
}

// Placeholder component for future thumbnail implementation
export const ThumbnailBackground: React.FC<ThumbnailBackgroundProps> = ({
  thumbnails,
}) => {
  if (thumbnails.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {thumbnails.map((thumb, index) => (
        <Image
          key={index}
          source={{ uri: thumb.uri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  thumbnail: {
    flex: 1,
    height: '100%',
  },
});