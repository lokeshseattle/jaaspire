import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media";

import PostContext from "@/src/context/post-context";
import type { Post as PostItem } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";
interface Props extends PostItem {
  isVisible: boolean;
}

export default function Post({ isVisible, ...post }: Props) {
  const { attachments } = post;

  //   const [isLiked, setIsLiked] = useState(initialLiked);
  //   const [likesCount, setLikesCount] = useState(props.likesCount);

  const handleLike = () => {
    // TODO: send like to backend (optimistic update)
  };

  return (
    <PostContext.Provider value={{ post }}>
      <PostHeader />
      <PostMedia
        media={attachments[0]?.path}
        type={getMediaType(attachments[0]?.type)}
        isVisible={isVisible}
        isLiked={true}
        onLike={handleLike}
      />
      <PostFooter />
    </PostContext.Provider>
  );
}
