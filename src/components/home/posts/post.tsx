import { useCallback } from "react";
import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media";

import PostContext from "@/src/context/post-context";
import { useToggleLikeMutation } from "@/src/features/post/post.hooks";
import type { Post as PostItem } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";
interface Props extends PostItem {
  isVisible: boolean;
  onPressComments: () => void;
}

export default function Post({ isVisible, onPressComments, ...post }: Props) {
  const { attachments } = post;


  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  const handleToggleLike = useCallback(() => {
    toggleLike(post.id);
  }, [post.id]);

  return (
    <PostContext.Provider
      value={{
        post,
        isLiked,
        toggleLike: handleToggleLike,
        onPressComments,
      }}
    >
      <PostHeader />
      <PostMedia
        media={attachments[0]?.path}
        type={getMediaType(attachments[0]?.type)}
        isVisible={isVisible}
        isLiked={isLiked}
        onLike={handleToggleLike}
      />
      <PostFooter />
    </PostContext.Provider>
  );
}
