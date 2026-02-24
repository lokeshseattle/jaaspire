import * as MediaLibrary from "expo-media-library";
import React, { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { captureScreen } from "react-native-view-shot";

import { router } from "expo-router";
import TextOverlayLayer from "./TextOverlayLayer";

interface Props {
  imageUri: string;
}

export default function StoryEditor({ imageUri }: Props) {
  const viewRef = useRef(null);

  const [saving, setSaving] = useState(false);

  const saveToGallery = async () => {
    setSaving(true);

    requestAnimationFrame(async () => {
      const uri = await captureScreen({ format: "png", quality: 1 });

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.granted) {
        await MediaLibrary.saveToLibraryAsync(uri);
        router.back();
      }

      setSaving(false);
    });
  };

  return (
    <View style={styles.container}>
      <View ref={viewRef} style={styles.editor}>
        <Image source={{ uri: imageUri }} style={styles.image} />
        <TextOverlayLayer />
      </View>
      {!saving && (
        <Pressable
          onPress={saveToGallery}
          style={{
            position: "absolute",
            bottom: 40,
            right: 20,
            backgroundColor: "red",
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Save</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  editor: { flex: 1 },
  image: { width: "100%", height: "100%", position: "absolute" },
});
