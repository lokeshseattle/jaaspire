import { useMediaPicker } from "@/hooks/use-media-picker";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { useIsStoryUploading } from "@/src/features/upload/upload.hooks";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

function StoryAvatar({
  avatar,
  hasStory,
  isViewed,
  isLoading,
  animatedStyle,
}: {
  avatar: string;
  hasStory: boolean;
  isViewed: boolean;
  isLoading: boolean;
  animatedStyle: any;
}) {
  if (isLoading) {
    return (
      <Animated.View style={[styles.ring, animatedStyle]}>
        <LinearGradient
          colors={["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"]}
          style={styles.gradient}
        />
      </Animated.View>
    );
  }

  if (!hasStory) {
    return (
      <Image
        cachePolicy="disk"
        source={{ uri: avatar }}
        style={styles.avatar}
      />
    );
  }

  if (isViewed) {
    return (
      <View style={[styles.ring, styles.greyRing]}>
        <Image
          cachePolicy="disk"
          source={{ uri: avatar }}
          style={styles.avatar}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"]}
      style={styles.ring}
    >
      <View style={styles.innerRing}>
        <Image
          cachePolicy="disk"
          source={{ uri: avatar }}
          style={styles.avatar}
        />
      </View>
    </LinearGradient>
  );
}

function Stories() {
  const router = useRouter();
  const { theme } = useTheme();
  const isLoading = useIsStoryUploading();

  console.log("isLoading", isLoading)

  const storiesQuery = useGetAllStories();

  const { data } = useGetProfile();

  const { openMediaPicker } = useMediaPicker();

  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));



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
          params: { uri: file.uri, fileName: file.name },
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
        renderItem={({ item }) => {
          const hasStory = item.stories?.length > 0;
          const isViewed = item.is_viewed === 1;

          return (
            <Pressable
              onPress={() => (hasStory ? openStory(item.username) : null)}
              style={styles.storyItem}
            >
              <View style={styles.avatarWrapper}>
                <StoryAvatar
                  avatar={item.avatar}
                  hasStory={hasStory}
                  isViewed={isViewed}
                  isLoading={isLoading}
                  animatedStyle={animatedStyle}
                />

                {item.name === "You" && (
                  <Pressable onPress={handleStory} style={{ position: "absolute", backgroundColor: "white", borderRadius: 12, bottom: 0, right: 0 }}>
                    <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                  </Pressable>
                )}
              </View>

              <Text style={styles.username} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
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
    // borderWidth: 2,
    // borderColor: Colors.primaryColor, // story ring color
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
  }, ring: {
    padding: 3,
    borderRadius: 40,
  },

  greyRing: {
    borderWidth: 2,
    borderColor: "#B8B8B8",
    padding: 3,
    borderRadius: 40,
  },
  gradient: {
    width: 66,
    height: 66,
    borderRadius: 40,
    padding: 13
  },
  innerRing: {
    backgroundColor: "white",
    padding: 3,
    borderRadius: 40,
  },

});
