import type { Post as PostItem } from "@/src/services/api/api.types";
import { createContext, useContext } from "react";

type PostContextType = {
  post: PostItem;
  isLiked: boolean;
  toggleLike: () => void;
  onPressComments: () => void;
  onPressShare: () => void;
  onTip: () => void;
};

const PostContext = createContext<PostContextType | null>(null);

export const usePost = () => {
  const context = useContext(PostContext);
  if (!context) {
    throw new Error("usePost must be used inside PostProvider");
  }
  return context;
};

export default PostContext;
