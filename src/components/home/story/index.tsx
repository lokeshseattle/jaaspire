import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { useAddStory } from "@/src/features/story/use-add-story";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import StoryAvatar from "./StoryAvatar";

function Stories() {
  const router = useRouter();
  const { theme } = useTheme();
  const { openAddStory, isUploading } = useAddStory();

  const storiesQuery = useGetAllStories();
  const { data } = useGetProfile();

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
    const [userStory] = displayStories.splice(userStoryIndex, 1);
    displayStories.unshift({ ...userStory, name: "You" });
  } else if (profile) {
    displayStories.unshift({
      id: -1,
      userId: profile.id,
      name: "You",
      username: profile.username,
      avatar: profile.avatar,
      stories: [],
      is_viewed: 0,
    } as (typeof displayStories)[number]);
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
          const isYou = item.name === "You";
          const uploading = isUploading && isYou;

          return (
            <Pressable
              onPress={() => (hasStory ? openStory(item.username) : undefined)}
              style={styles.storyItem}
            >
              <StoryAvatar
                uri={item.avatar}
                username={item.username}
                hasStory={hasStory}
                seen={isViewed}
                isUploading={uploading}
                showAddButton={isYou}
                onAddStory={openAddStory}
                size={70}
              />
              <Text
                style={[styles.username, { color: theme.colors.textPrimary }]}
                numberOfLines={1}
              >
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
  username: {
    fontSize: 12,
    marginTop: 4,
  },
});
