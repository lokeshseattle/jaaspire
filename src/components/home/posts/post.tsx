import { View } from "react-native";
import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media";

interface PostItem {
  id: string;
  user: {
    id: string;
    username: string;
    avatar: string;
  };
  media: string;
  caption: string;
  likesCount: number;
  isLiked: boolean;
  isVisible: boolean;
  type: string;
}

export default function Post(props: PostItem) {
  const { user, media, isVisible, type } = props;
  return (
    <View>
      <PostHeader avatar={user.avatar} id={user.id} username={user.username} />
      <PostMedia isVisible={isVisible} media={media} type={type} />
      <PostFooter />
    </View>
  );
}
