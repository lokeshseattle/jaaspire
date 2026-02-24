import ProfileHeader from "@/src/components/profile/ProfileHeader";
import ProfileTabs from "@/src/components/profile/ProfileTabs";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { FlashList } from "@shopify/flash-list";
import { useState } from "react";

import { Dimensions, Image, StyleSheet, View } from "react-native";

const { width } = Dimensions.get("window");
const ITEM_SIZE = width / 3;

export default function ProfileScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  const { refetch, data } = useGetProfile();
  const [activeTab, setActiveTab] = useState<"video" | "">("");
  const username = data?.data.username;
  const userFeedQuery = useGetUserFeedQuery(username, activeTab);

  const renderItem = ({ item }: any) => (
    <Image source={{ uri: item.image }} style={styles.gridImage} />
  );

  const onRefresh = () => {
    refetch();
    userFeedQuery.refetch();
  };

  userFeedQuery.data?.pages.flatMap((item) =>
    item.data.posts.map((item) =>
      item.attachments.map((item) => console.log(item.id)),
    ),
  );
  const gridData =
    userFeedQuery.data?.pages.flatMap((page) =>
      page.data.posts.flatMap((post) =>
        post.attachments.map((att) => ({
          id: att.id,
          image: getMediaType(att.type) === "image" ? att.path : att.thumbnail,
        })),
      ),
    ) ?? [];

  console.log(gridData);

  return (
    <View style={styles.container}>
      <FlashList
        ListHeaderComponent={
          <>
            <ProfileHeader />
            <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
          </>
        }
        data={gridData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onRefresh={onRefresh}
        numColumns={3}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    gridImage: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      padding: 1,
    },
  });
