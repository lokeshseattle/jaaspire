import { useAuth } from "@/src/features/auth/auth.hooks";

import Post from "@/src/components/home/posts/post";
import Stories from "@/src/components/home/story";
import { useRef, useState } from "react";
import { FlatList } from "react-native";

const POSTS = [
  {
    id: "post_101",
    type: "image",
    user: {
      id: "user_11",
      username: "kai.visuals",
      avatar: "https://randomuser.me/api/portraits/men/22.jpg",
    },
    media: "https://picsum.photos/id/1043/800/800",
    caption:
      "Golden hour hits different when you're exactly where you're meant to be 🌇",
    likesCount: 412,
    isLiked: false,
  },
  {
    id: "post_102",
    type: "video",
    user: {
      id: "user_12",
      username: "ella.moves",
      avatar: "https://randomuser.me/api/portraits/women/29.jpg",
    },
    media: "https://www.w3schools.com/html/mov_bbb.mp4",
    caption:
      "Motion creates emotion 🎥✨ Capturing moments that words can't explain.",
    likesCount: 876,
    isLiked: true,
  },
  {
    id: "post_103",
    type: "image",
    user: {
      id: "user_13",
      username: "noah.codes",
      avatar: "https://randomuser.me/api/portraits/men/55.jpg",
    },
    media: "https://picsum.photos/id/1050/800/800",
    caption: "Deep focus mode activated 🧠💻 Building things that matter.",
    likesCount: 221,
    isLiked: false,
  },
  {
    id: "post_104",
    type: "video",
    user: {
      id: "user_14",
      username: "aria.travels",
      avatar: "https://randomuser.me/api/portraits/women/31.jpg",
    },
    media: "https://www.w3schools.com/html/movie.mp4",
    caption: "POV: You finally booked the trip ✈️🌍 No more waiting.",
    likesCount: 1293,
    isLiked: false,
  },
  {
    id: "post_105",
    type: "image",
    user: {
      id: "user_15",
      username: "leo.fit",
      avatar: "https://randomuser.me/api/portraits/men/18.jpg",
    },
    media: "https://picsum.photos/id/1062/800/800",
    caption: "Discipline builds what motivation starts 💪🔥",
    likesCount: 654,
    isLiked: true,
  },
  {
    id: "post_106",
    type: "video",
    user: {
      id: "user_16",
      username: "soph.art",
      avatar: "https://randomuser.me/api/portraits/women/63.jpg",
    },
    media:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    caption: "Slow down. Notice the details 🌸🎬",
    likesCount: 318,
    isLiked: false,
  },
];

export default function Home() {
  const { logout } = useAuth();
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisiblePostId(viewableItems[0].item.id);
    }
  }).current;

  return (
    <FlatList
      data={POSTS}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Post {...item} isVisible={visiblePostId === item.id} />
      )}
      ListHeaderComponent={<Stories />}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      removeClippedSubviews
      windowSize={5}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
    />
  );
}
