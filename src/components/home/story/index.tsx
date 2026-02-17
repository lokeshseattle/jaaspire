import { Colors } from "@/src/constants/theme";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

const STORIES = [
  {
    id: "story_1",
    username: "your.story",
    avatar: "https://randomuser.me/api/portraits/men/10.jpg",
  },
  {
    id: "story_2",
    username: "mila.design",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    id: "story_3",
    username: "jay.dev",
    avatar: "https://randomuser.me/api/portraits/men/33.jpg",
  },
  {
    id: "story_4",
    username: "zoe.art",
    avatar: "https://randomuser.me/api/portraits/women/12.jpg",
  },
];

function Stories() {
  const router = useRouter();

  const [image, setImage] = useState<string | null>(null);

  //   const requestPermission = async () => {
  //     const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();

  //     if (status === "granted") {
  //       return true;
  //     }

  //     if (canAskAgain) {
  //       const permissionResult = await MediaLibrary.requestPermissionsAsync();

  //       if (permissionResult.status === "granted") {
  //         return true;
  //       }
  //     }

  //     Alert.alert(
  //       "Permission required",
  //       "Please enable media library access in Settings.",
  //       [
  //         { text: "Cancel", style: "cancel" },
  //         { text: "Open Settings", onPress: () => Linking.openSettings() },
  //       ],
  //     );

  //     return false;
  //   };

  const pickImage = async () => {
    // Request permission from ImagePicker
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please enable media library access in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

      const result = await ImagePicker.launchImageLibraryAsync({
        // Use string media type values instead of deprecated MediaTypeOptions enum
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  function openStory() {
    router.push({
      pathname: "/story-viewer",
    });
  }
  return (
    <View style={styles.container}>
      <FlatList
        data={STORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={openStory} style={styles.storyItem}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: item.avatar }} style={styles.avatar} />

              {/* {item.isCurrentUser && ( */}
              {true && (
                <Pressable onPress={pickImage} style={styles.addButton}>
                  <Text style={styles.addText}>+</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.username} numberOfLines={1}>
              {item.username}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

export default Stories;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  storyItem: {
    alignItems: "center",
    marginHorizontal: 8,
    width: 70,
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: Colors.primaryColor, // story ring color
    borderRadius: 40,
    padding: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  username: {
    fontSize: 12,
    marginTop: 4,
  },
  addButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#0095f6", // Instagram blue
    width: 22,
    height: 22,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  addText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: -1,
  },
});
