import { Image } from "expo-image";
import { Pressable, StyleSheet } from "react-native";

type PostImageProps = {
  uri: string;
  onPress?: () => void;
};

export function PostImage({ uri, onPress }: PostImageProps) {
  return (
    <Pressable onPress={onPress}>
      <Image
        source={{ uri }}
        style={styles.imageMedia}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageMedia: {
    width: "100%",
    aspectRatio: 4 / 5,
    backgroundColor: "#111",
  },
});
