import PaymentConfirmSheet from "@/src/components/payment/PaymentConfirmSheet";
import SubscribePaymentConfirmSheet from "@/src/components/payment/SubscribePaymentConfirmSheet";
import TipBottomSheet from "@/src/components/payment/TipBottomSheet";
import PostContext from "@/src/context/post-context";
import { useToggleLikeMutation } from "@/src/features/post/post.hooks";
import { useGetProfileByUsername } from "@/src/features/profile/profile.hooks";
import {
  getStarsForWalletSku,
  skuForStarAmount,
} from "@/src/features/wallet/iap.constants";
import { useIap } from "@/src/features/wallet/iap.context";
import {
  useIapSkus,
  useUnlockPost,
} from "@/src/features/wallet/wallet.hooks";
import type { Post as PostItem } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";
import { router } from "expo-router";
import { Alert } from "react-native";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import PostFooter from "./post-footer";
import PostHeader from "./post-header";
import PostMedia from "./post-media";

interface Props extends PostItem {
  /** True when this post is the primary viewable item on the home feed (only one at a time). */
  isFocused: boolean;
  /** True when this post is the primary row in the feed (visible slot), independent of tab/screen focus. */
  isPrimaryFeedPost: boolean;
  /** True when this row is within ±2 of the primary post — keep a native player mounted for preload. */
  inVideoWindow: boolean;
  onPressComments: () => void;
  onPressShare: () => void;
  nextPost?: PostItem;
}

function Post({
  isFocused,
  isPrimaryFeedPost,
  inVideoWindow,
  onPressComments,
  onPressShare,
  nextPost,
  ...post
}: Props) {
  const { attachments } = post;

  // Keep a ref so context consumers always read the latest post without
  // needing to be in the useMemo dependency array.
  const postRef = useRef(post);
  postRef.current = post;

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();

  const handleToggleLike = useCallback(() => {
    toggleLike(post.id);
  }, [post.id]);

  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [subscribeSheetOpen, setSubscribeSheetOpen] = useState(false);
  const [tipSheetOpen, setTipSheetOpen] = useState(false);

  const isExclusivePost = post.is_exclusive && !post.viewer?.has_subscription;

  const { data: creatorProfile } = useGetProfileByUsername(
    subscribeSheetOpen ? post.user.username : "",
  );
  const subscriptionAmount =
    creatorProfile?.data?.subscription?.price_1_month ?? 0;

  const { mutateAsync: unlockPost, isPending: isUnlocking } = useUnlockPost();
  const { data: iapSkusResponse } = useIapSkus("consumable");
  const { connected: isIapConnected, startPurchase, isProcessing: isIapProcessing } =
    useIap();

  const postIapSku = useMemo(() => {
    if (isExclusivePost) return null;
    const skus = iapSkusResponse?.skus ?? [];
    if (!skus.length) return null;
    return skuForStarAmount(post.price, skus);
  }, [isExclusivePost, post.price, iapSkusResponse?.skus]);

  const postIapStars = useMemo(() => {
    if (!postIapSku) return null;
    return getStarsForWalletSku(postIapSku, iapSkusResponse?.skus ?? []);
  }, [iapSkusResponse?.skus, postIapSku]);

  const handleConfirmIap = useCallback(
    async (sku: string) => {
      if (!isIapConnected) {
        Alert.alert("Store unavailable", "Please try again in a moment.");
        return;
      }

      try {
        await startPurchase({
          intent: { kind: "unlock_post", postId: post.id },
          storeProductId: sku,
          purchaseType: "in-app",
          onSuccess: () => setPaymentSheetOpen(false),
        });
      } catch (e) {
        Alert.alert(
          "Could not start purchase",
          e instanceof Error ? e.message : "Try again in a moment.",
        );
      }
    },
    [isIapConnected, post.id, startPurchase],
  );

  const handleRequestPurchase = useCallback(() => {
    if (isExclusivePost) {
      setSubscribeSheetOpen(true);
      return;
    }
    setPaymentSheetOpen(true);
  }, [isExclusivePost]);

  const handleCloseSubscribeSheet = useCallback(() => {
    setSubscribeSheetOpen(false);
  }, []);

  const handleSubscribeSuccess = useCallback(() => {
    setSubscribeSheetOpen(false);
    router.replace({
      pathname: "/user/[username]",
      params: {
        username: post.user.username,
        tab: "premium",
        subscribed: String(Date.now()),
      },
    });
  }, [post.user.username]);

  const handleClosePaymentSheet = useCallback(() => {
    setPaymentSheetOpen(false);
  }, []);

  const handleConfirmPurchase = useCallback(async () => {
    try {
      await unlockPost(post.id);
      setPaymentSheetOpen(false);
    } catch (e) {
      Alert.alert(
        "Unlock failed",
        e instanceof Error ? e.message : "Could not unlock post. Try again.",
      );
    }
  }, [post.id, unlockPost]);

  const handleOpenTip = useCallback(() => {
    setTipSheetOpen(true);
  }, []);

  const handleCloseTip = useCallback(() => {
    setTipSheetOpen(false);
  }, []);

  // Pause video when any payment sheet is open
  const anySheetOpen =
    paymentSheetOpen || subscribeSheetOpen || tipSheetOpen;
  const effectiveIsFocused = isFocused && !anySheetOpen;

  const currentMedia = attachments[0];
  const mediaType = getMediaType(currentMedia?.type);

  const nextVideoInfo = useMemo(() => {
    if (!nextPost?.attachments?.[0]) return null;

    const nextMedia = nextPost.attachments[0];
    const nextMediaType = getMediaType(nextMedia.type);

    if (nextMediaType !== "video") return null;

    return {
      postId: nextPost.id,
      url: nextMedia.path,
    };
  }, [nextPost?.id, nextPost?.attachments]);

  const contextValue = useMemo(
    () => ({
      post: postRef.current,
      isLiked,
      toggleLike: handleToggleLike,
      onPressComments,
      onPressShare,
      onTip: handleOpenTip,
    }),
    // Fine-grained deps: only the fields PostHeader/PostFooter actually read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      post.id,
      post.user?.id,
      post.user?.avatar,
      post.user?.username,
      post.user?.name,
      post.user_reaction,
      post.comments_count,
      post.views_count,
      post.is_bookmarked,
      post.text,
      post.created_at,
      isLiked,
      handleToggleLike,
      onPressComments,
      onPressShare,
      handleOpenTip,
    ],
  );

  return (
    <PostContext.Provider value={contextValue}>
      <PostHeader />
      <PostMedia
        postId={post.id}
        media={currentMedia?.path}
        thumbnail={currentMedia?.thumbnail}
        type={mediaType}
        price={post.price}
        fullDuration={currentMedia?.duration}
        viewer={post.viewer}
        isExclusive={post.is_exclusive}
        isFocused={effectiveIsFocused}
        isPrimaryFeedPost={isPrimaryFeedPost}
        inVideoWindow={inVideoWindow}
        isLiked={isLiked}
        onLike={handleToggleLike}
        nextPostId={nextVideoInfo?.postId}
        nextPostUrl={nextVideoInfo?.url}
        onRequestPurchase={handleRequestPurchase}
      />
      <PostFooter />
      {!isExclusivePost ? (
        <PaymentConfirmSheet
          visible={paymentSheetOpen}
          onClose={handleClosePaymentSheet}
          onConfirm={handleConfirmPurchase}
          onConfirmIap={handleConfirmIap}
          action="buy_post"
          username={post.user.username}
          amount={post.price}
          iapSku={postIapSku}
          starsPerUsd={iapSkusResponse?.currency?.stars_per_usd}
          iapStarsAmount={postIapStars}
          loading={isUnlocking || isIapProcessing}
        />
      ) : subscribeSheetOpen ? (
        <SubscribePaymentConfirmSheet
          visible
          onClose={handleCloseSubscribeSheet}
          username={post.user.username}
          amount={subscriptionAmount}
          onSuccess={handleSubscribeSuccess}
        />
      ) : null}
      <TipBottomSheet
        visible={tipSheetOpen}
        onClose={handleCloseTip}
        username={post.user.username}
      />
    </PostContext.Provider>
  );
}

export default memo(Post);
