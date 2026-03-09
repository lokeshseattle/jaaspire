import { useMediaPicker } from "@/hooks/use-media-picker";
import { Colors } from "@/src/constants/theme";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

function Stories() {
  const router = useRouter();
  const { theme } = useTheme();

  const storiesQuery = useGetAllStories();

  const { data } = useGetProfile();

  const { openMediaPicker } = useMediaPicker();

  // const { username } = data!.data;

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
      router.push({
        pathname: "/story-editor",
        params: { uri: result.assets[0].uri },
      });
    }
  };

  const handleStory = () => {
    openMediaPicker({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      onChange: (file) => {
        if (file.type.startsWith("image/")) router.push({
          pathname: "/story-editor",
          params: { uri: file.uri },
        });

        if (file.type.startsWith("video/")) router.push({
          pathname: "/video-editor",
          params: { uri: file.uri },
        });
      },
    });
  };

  function openStory(username: string) {
    router.push({
      pathname: "/story/[username]",
      params: { username },
    });
  }
  if (storiesQuery.isLoading) return <ActivityIndicator />;

  const profile = data?.data;
  const stories = storiesQuery.data?.data.stories || [];

  const displayStories = [...stories];
  const userStoryIndex = displayStories.findIndex(
    (s) => s.username === profile?.username,
  );

  if (userStoryIndex !== -1) {
    // Move user story to front and rename to "You"
    const [userStory] = displayStories.splice(userStoryIndex, 1);
    displayStories.unshift({ ...userStory, name: "You" });
  } else if (profile) {
    // Prepend profile as a "You" placeholder if no story exists
    displayStories.unshift({
      id: -1,
      userId: profile.id,
      name: "You",
      username: profile.username,
      avatar: profile.avatar,
      stories: [],
      is_viewed: 0,
    } as any);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayStories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.username}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              item.stories && item.stories.length > 0
                ? openStory(item.username)
                : null
            }
            style={styles.storyItem}
          >
            <View
              style={[
                styles.avatarWrapper,
                item.is_viewed === 1 ||
                  (item.stories && item.stories.length === 0)
                  ? { borderColor: theme.colors.textSecondary }
                  : { borderColor: Colors.primaryColor },
                item.stories &&
                item.stories.length === 0 && { borderColor: "transparent" },
              ]}
            >
              <Image
                cachePolicy={"disk"}
                source={{ uri: item.avatar }}
                style={styles.avatar}
              />

              {item.name === "You" && (
                <Pressable onPress={handleStory} style={styles.addButton}>
                  <Text style={styles.addText}>+</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.username} numberOfLines={1}>
              {item.name}
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
