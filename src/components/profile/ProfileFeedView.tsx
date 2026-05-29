import { FeedContainer } from "@/src/components/feed/FeedContainer";
import { useFeedController } from "@/src/components/feed/use-feed-controller";
import type { ViewabilityConfig } from "react-native";

const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};

interface ProfileFeedViewProps {
  postIds: number[];
  ListHeaderComponent: React.ReactElement;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  /** When false, videos pause and viewability is ignored (e.g. inactive profile tab). */
  isTabActive: boolean;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ProfileFeedView({
  postIds,
  ListHeaderComponent,
  onRefresh,
  isRefreshing,
  onEndReached,
  isFetchingNextPage,
  isTabActive,
  ListEmptyComponent,
}: ProfileFeedViewProps) {
  const controller = useFeedController({
    postIds,
    isTabActive,
    viewabilityConfig: VIEWABILITY_CONFIG,
  });

  return (
    <FeedContainer
      controller={controller}
      postIds={postIds}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      onEndReached={onEndReached}
      isFetchingNextPage={isFetchingNextPage}
    />
  );
}
