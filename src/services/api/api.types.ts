type FieldErrors = {
  [key: string]: string[];
};
export type PossibleErrorResponse = {
  success: boolean;
  message: string;
  data: { errors?: FieldErrors };
};

export type LoginRequest = {
  email: string;
  password: string;
};

/** Session returned after login or 2FA verify success */
export type AuthSessionUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  avatar: string;
  cover: string;
  enable_2fa?: boolean;
};

export type AuthSessionPayload = {
  token: string;
  user: AuthSessionUser;
};

export type LoginRequires2FAData = {
  require_2fa: true;
  two_fa_token: string;
  message: string;
};

export type LoginSuccessResponse = {
  success: boolean;
  message: string;
  data: AuthSessionPayload;
};

export type LoginRequires2FAResponse = {
  success: boolean;
  message: string;
  data: LoginRequires2FAData;
};

export type LoginResponse = LoginSuccessResponse | LoginRequires2FAResponse;

export type Resend2FARequest = {
  two_fa_token: string;
};

export type Resend2FAResponse = {
  success: boolean;
  message: string;
  data: {
    message: string;
  };
};

export type Verify2FARequest = {
  two_fa_token: string;
  code: string;
};

export type Verify2FAResponse = {
  success: boolean;
  message: string;
  data: AuthSessionPayload;
};

export type RegisterRequest = {
  name: string;
  email: string;
  username: string;
  password: string;
  password_confirmation: string;

  country?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export type ValidateUsernameResponse = {
  success: boolean;
  message: string;
  data: {
    available: boolean;
    exists: boolean;
    reserved: boolean;
    message: string;
    suggestions: Array<string>;
  };
};

export type Post = {
  id: number;
  text: string;
  price: number;
  is_exclusive: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  status: number;
  release_date: any;
  expire_date: any;
  created_at: string;
  updated_at: string;
  views_count: number;
  user: {
    id: number;
    name: string;
    username: string;
    avatar: string;
    verified_user: boolean;
    story_status: {
      has_stories: boolean;
      all_viewed: boolean;
      story_count: number;
    };
  };
  attachments: Array<{
    id: string;
    type: string;
    status: "pending" | "completed";
    path: string;
    thumbnail: string;
    duration: null | string;
  }>;
  attachments_count: number;
  reactions: Array<{
    name: "love";
    count: number;
  }>;
  user_reaction: "love" | null;
  reactions_count: number | null;
  comments_count: number;
  is_bookmarked: boolean;
  viewer: {
    is_owner: boolean;
    has_subscription: boolean;
    has_followed: boolean;
    has_purchased: boolean;
  };
};

export type FeedResponse = {
  success: boolean;
  message: string;
  data: {
    posts: Array<Post>;
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      has_more: boolean;
    };
  };
};

/** GET /reels/:id (flicks single-post API) — `data` is the post row; optional `video` duplicates media and is omitted for `Post`. */
export type SingleFlickApiResponse = {
  success: boolean;
  message: string;
  data: Post & { video?: unknown };
};

export type TUserProfile = {
  id: number;
  name: string;
  email: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  avatar: string;
  cover: string;
  birthdate: string;
  gender_id: number;
  country_id: number;
  gender_pronoun: string;
  public_profile: boolean;
  open_profile: boolean;
  blocked_status: "blocked_by_you" | "blocked_by_user" | null;
  paid_profile: boolean;
  verified_user: boolean;
  email_verified_at: string;
  enable_2fa: boolean;
  referral_code: string;
  created_at: string;
  counts: {
    posts: number;
    followers: number;
    following: number;
    fans: number;
  };
  subscription: {
    price_1_month: number;
    price_3_months: number;
    price_6_months: number;
    price_12_months: number;
  };
  wallet: {
    balance: number;
  };
};

export type ProfileResponse = {
  success: boolean;
  message: string;
  data: TUserProfile;
};

export type TUserViewer = {
  viewer: {
    is_following: boolean;
    follow_status: "follow" | "unfollow" | "requested";
    is_subscribed: boolean;
    is_blocked?: boolean;
  };
};

export type TUserProfileResponse = ProfileResponse & {
  data: TUserProfile & TUserViewer;
};

export type OptimisticComment = TComment & { _isOptimistic?: boolean };
export type OptimisticReply = TComment["replies"][0] & {
  _isOptimistic?: boolean;
};
export type TGender = {
  id: number;
  gender_name: string;
  created_at: null | string;
  updated_at: null | string;
};

export type GendersResponse = {
  success: boolean;
  message: string;
  data: {
    genders: Array<TGender>;
  };
};

export type TCountry = {
  id: number;
  name: string;
  country_code: string;
  phone_code: string;
};

export type CountriesResponse = {
  success: boolean;
  message: string;
  data: {
    countries: Array<TCountry>;
  };
};

export type TUpdateProfile = {
  id: number;
  name: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  birthdate: Date | string;
  gender_id: string;
  gender_pronoun: string;
  country_id: string;
};

export type UpdateProfileResponse = {
  success: boolean;
  message: string;
  data: TUpdateProfile;
};

export type PrivacyFlagKey = "enable_2fa" | "open_profile";

export type PrivacyFlagRequestBody = {
  key: PrivacyFlagKey;
  value: boolean;
};

export type PrivacyFlagResponse = {
  success: boolean;
  message: string;
  data: {
    key: PrivacyFlagKey;
    value: boolean;
  };
};

/** POST /settings/rates — profile paywall / access pricing. */
export type SettingsRatesRequestBody = {
  profile_access_price: number;
};

export type SettingsRatesResponse = {
  success: boolean;
  message: string;
};

/** Optional subscription fields for PUT /profile (privacy flags use POST settings/privacy/flags). */
export type PrivacyProfileUpdateFields = {
  price_1_month?: number;
  price_3_months?: number;
  price_6_months?: number;
  price_12_months?: number;
};

export type UpdateProfileRequest = Partial<TUpdateProfile> &
  PrivacyProfileUpdateFields;

export type UpdateAvatarRequest = {
  uri: string;
  name: string;
  type: string;
};

export type TStory = {
  id: number;
  story: string;
  is_story_viewed: number;
  path: string;
  created_at: string;
};

export type StoryByUsernameResponse = {
  success: boolean;
  message: string;
  data: {
    has_stories: boolean;
    user: {
      id: number;
      name: string;
      username: string;
      avatar: string;
    };
    stories: Array<TStory>;
    total_stories: number;
    viewed_stories: number;
    is_viewed: number;
  };
};

export type StoriesResponse = {
  success: boolean;
  message: string;
  data: {
    stories: Array<{
      id: number;
      userId: number;
      name: string;
      username: string;
      avatar: string;
      stories: Array<TStory>;
      is_viewed: number;
    }>;
  };
};

export type TViewer = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  verified_user: number;
  viewed_at: string;
};

export type StoryViewersResponse = {
  success: boolean;
  viewers: Array<TViewer>;
  total: number;
};

export type StoryImageUpload = {
  success: string;
  message: string;
  file_path: {
    filename: string;
    caption: any;
    user_id: number;
    type: string;
    driver: number;
    coconut_id: any;
    expires_at: string;
    id: number;
    path: string;
  };
  trim_story: string;
};

export type TComment = {
  id: number;
  message: string;
  is_liked: boolean;
  user: {
    id: number;
    name: string;
    username: string;
    avatar: string;
    verified_user: boolean;
    story_status: {
      has_stories: boolean;
      all_viewed: boolean;
      story_count: number;
    };
  };
  reactions: number;
  replies: Array<{
    id: number;
    message: string;
    is_liked: boolean;
    user: {
      id: number;
      name: string;
      username: string;
      avatar: string;
      verified_user: boolean;
      story_status: {
        has_stories: boolean;
        all_viewed: boolean;
        story_count: number;
      };
    };
    reactions: number;
    created_at: string;
    _isOptimistic?: boolean;
  }>;
  reply_count: number;
  created_at: string;
  _isOptimistic?: boolean;
};

export type CommentsResponse = {
  success: boolean;
  message: string;
  data: {
    comments: Array<TComment>;
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      has_more: boolean;
    };
  };
};
export type AddCommentResponse = {
  success: boolean;
  message: string;
  data: {
    id: number;
    message: string;
    reply_id: number | null;
    user: TComment["user"];
    created_at: string;
  };
};

// Request body type
export type AddCommentRequest = {
  postId: number;
  message: string;
  reply_id: number | null;
};

export type TNotification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  from_user: {
    id: number;
    name: string;
    username: string;
    avatar: string;
    verified_user: boolean;
    story_status: {
      has_stories: boolean;
      all_viewed: boolean;
      story_count: number;
    };
  };
  post?: {
    id: number;
    text: string;
  };
  comment?: {
    id: number;
    message: string;
  };
  transaction: any;
};

export type NotificationsAPIResponse = {
  success: boolean;
  message: string;
  data: {
    notifications: Array<TNotification>;
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      has_more: boolean;
    };
  };
};

export type FollowUser = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  verified_user: boolean;
  story_status: {
    has_stories: boolean;
    all_viewed: boolean;
    story_count: number;
  };
  follow_status: "follow" | "following" | "requested";
};

export type FollowersResponse = {
  success: boolean;
  message: string;
  data: {
    followers: FollowUser[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      has_more: boolean;
    };
  };
};

export type FollowingResponse = {
  success: boolean;
  message: string;
  data: {
    following: FollowUser[];
    pagination: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      has_more: boolean;
    };
  };
};

export type BlockedUser = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  verified_user: boolean;
  blocked_at: string;
};

export type BlockedUsersResponse = {
  success: boolean;
  message: string;
  data: {
    blocked_users: BlockedUser[];
    pagination: Pagination;
  };
};

export interface StoryStatus {
  has_stories: boolean;
  all_viewed: boolean;
  story_count: number;
}

export interface ExploreUser {
  id: number;
  name: string;
  username: string;
  avatar: string;
  story_status: StoryStatus;
}

export interface Attachment {
  type: "image" | "video";
  path: string;
  thumbnail: string;
}

export interface Viewer {
  is_following: boolean;
  follow_status: string;
}

export interface ExplorePost {
  id: number;
  user: ExploreUser;
  attachments: Attachment[];
  attachments_count: number;
  comments_count: number;
  is_bookmarked: boolean;
  created_at: string;
  viewer: Viewer;
}

export interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export interface ExploreResponse {
  success: boolean;
  message: string;
  data: {
    posts: ExplorePost[];
    pagination: Pagination;
  };
}

// For grid item sizing
export interface GridItem {
  post: ExplorePost;
  isLarge: boolean;
}

export type SinglePostResponse = {
  success: boolean;
  message: string;
  data: {
    post: Post;
    recommended: {
      posts: Array<Post>;
      pagination: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        has_more: boolean;
      };
    };
  };
};

export type FollowUserResponse = {
  success: boolean;
  message: string;
  data: {
    follow_status: "unfollow" | "follow" | "requested";
    is_following: boolean;
    is_pending: boolean;
  };
};

export type MentionSearchResponse = {
  success: boolean;
  message: string;
  data: {
    users: MentionUser[];
  };
};

export type MentionUser = {
  id: number;
  value: string;
  name: string;
  username: string;
  avatar: string;
  verified_user: boolean;
  story_status: StoryStatus;
};

export type BookmarkPostResponse = {
  success: boolean;
  message: string;
  data: {
    is_bookmarked: boolean;
  };
};

export type PinPostResponse = {
  success: boolean;
  message: string;
  data: {
    is_pinned: boolean;
    post_id: number;
  };
};

export type DeletePostResponse = {
  success: boolean;
  message: string;
  data: null;
};

export type BookmarksResponse = {
  success: boolean;
  message: string;
  data: {
    posts: Post[];
    pagination: Pagination;
  };
};

export type CreateStoryRequest = {
  videoUID: string;
  fileName: string;
  trimVideoData: string;
};

export type CreateStoryResponse = {
  success: boolean;
  message: string;
  videoUID: string;
  trimResult: StoryTrimResult;
};

export type StoryTrimResult = {
  fileId: string;
  filePath: string;
  url: string;
  format: string;
};

export type ReportReason = {
  id: number;
  name?: string;
  title?: string;
  label?: string;
};

export type ReportTypesData = {
  types: string[];
};

export type ReportTypesResponse = {
  success: boolean;
  message: string;
  data: ReportTypesData;
};

export type CreateReportPayload = {
  type: string;
  user_id: number;
  post_id: number;
  message_id?: string;
  stream_id?: string;
  details: string;
};
export type PendingFollowRequestsResponse = {
  success: boolean;
  message: string;
  data: {
    requests: PendingFollowRequest[];
    pagination: Pagination;
  };
};

export type PendingFollowRequest = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  verified_user: boolean;
  story_status: StoryStatus;
  requested_at: string;
};

export type SearchResultUser = {
  id: number;
  name: string;
  username: string;
  bio: string | null;
  location: string | null;
  avatar: string;
  cover: string;
  verified_user: boolean;
  story_status: StoryStatus;
  follow_status: "follow" | "unfollow" | "requested";
};

type PeopleResponse = {
  filter: "people";
  users: SearchResultUser[];
  pagination: Pagination;
};

export type GlobalSearchPostsFilter = "latest" | "photos" | "videos";

type PostsSearchResponse = {
  filter: GlobalSearchPostsFilter;
  posts: Post[];
  pagination: Pagination;
};

export type SearchResponse =
  | {
      success: true;
      message: string;
      data: PeopleResponse;
    }
  | {
      success: true;
      message: string;
      data: PostsSearchResponse;
    };

export type MessengerStoryStatus = {
  has_stories: boolean;
  all_viewed: boolean;
};

export type MessengerContact = {
  lastMessageSenderID: number;
  lastMessage: string;
  isSeen: number;
  messageDate: string;
  senderID: number;
  senderName: string;
  senderAvatar: string;
  senderRole: number;
  receiverID: number;
  receiverName: string;
  receiverAvatar: string;
  receiverRole: number;
  contactID: number;
  firstAttachmentType: string | null;
  attachmentCount: number;
  created_at: string;
  senderStoryStatus: MessengerStoryStatus;
  receiverStoryStatus: MessengerStoryStatus;
  isAiBot: boolean;
};

export type MessengerContactsResponse = {
  status: string;
  data: {
    contacts: MessengerContact[];
  };
};

/** Messenger thread user (API may include extra fields). */
export type MessengerUser = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  profileUrl: string;
  canEarnMoney: boolean;
  [key: string]: unknown;
};

export type MessengerMediaAttachment = {
  id: string;
  filename: string;
  thumbnail: string;
  driver: number;
  type: string; // e.g. "webp"
  user_id: number;
  post_id: number | null;
  message_id: number | null;
  coconut_id: string | null;
  has_thumbnail: number; // consider boolean if API can change
  duration: number | null;
  preview_duration: number | null;
  status: string | null;
  created_at: string; // ISO date
  updated_at: string; // ISO date
  payment_request_id: number | null;
  attachmentType: "image" | "video" | "audio" | "file"; // extend if needed
  path: string | null;
  previewurl: string | null;
};

export type MessengerMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string | "locked";
  isSeen: boolean;
  price: number;
  is_ai_conversation: boolean;
  created_at: string;
  updated_at?: string;
  hasUserUnlockedMessage: boolean;
  sender: MessengerUser;
  receiver: MessengerUser;
  attachments: MessengerMediaAttachment[];
};

export type MessengerThreadPagination = {
  hasMore: boolean;
  oldestMessageId: number;
};

export type MessengerMessagesResponse = {
  status: string;
  data: {
    messages: MessengerMessage[];
    pagination: MessengerThreadPagination;
  };
};

export type SendMessengerMessageRequest = {
  message: string;
  price: number;
  attachments: string[];
};

export type MessengerMessageUser = {
  id: number;
  name: string;
  username: string;
  avatar: string;
  profileUrl: string;
  verified_user: boolean;
  canEarnMoney?: boolean;
};
export type MessengerMessageAttachment = unknown; // replace when you know the shape

export type MessengerMessagePayload = {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  isSeen: 0 | 1; // 0 | 1 if you want to narrow
  price: number;
  is_ai_conversation: 0 | 1; // 0 | 1 if you want to narrow
  created_at: string;
  hasUserUnlockedMessage: boolean;
  sender: MessengerMessageUser;
  receiver: MessengerMessageUser;
  attachments: MessengerMediaAttachment[];
};

/** Generic success; adjust if backend returns a message payload. */
export type SendMessengerMessageResponse = {
  status: string;
  data: {
    message: MessengerMessagePayload;
  };
  errors: boolean;
};

export type SendAiChatMessageRequest = {
  message: string;
};

export type SendAiChatMessageResponse = {
  success: boolean;
  message: string;
  data: {
    user_message: MessengerMessage;
    ai_message: MessengerMessage;
  };
};

export type MarkMessengerMessagesReadResponse = {
  status: string;
  data: {
    count: number;
  };
};

export type NotificationCountsResponse = {
  success: boolean;
  message: string;
  data: {
    notifications: number | string;
    messages: number | string;
    wallet_balance: number | string;
  };
};

/** POST /iap/apple/verify */
export type IapAppleVerifyRequest = {
  jws: string;
  product_id: string;
};

/** POST /iap/google/verify */
export type IapGoogleVerifyRequest = {
  purchase_token: string;
  product_id: string;
  order_id: string;
};

/** Typical envelope for IAP verify endpoints (adjust if backend differs). */
export type IapVerifyResponse = {
  success: boolean;
  message: string;
  data?: unknown;
};

export type CreatorDashboardStartLinkResponse = {
  success: boolean;
  url: string;
  expires_in: number;
  message?: string;
};

export type UploadChunkResponse = {
  success: boolean;
  uploaded_chunk: number;
  file_id: string;
};

export type TipResponse = {
  success: boolean;
  transaction_id: number;
  amount: string;
  wallet_balance: string;
};

export type SubscribeResponse = {
  success: boolean;
  transaction_id: number;
  amount: string;
  wallet_balance: string;
  subscription: {
    id: number;
    expires_at: string;
    status: string;
  };
};

export type UnlockPostResponse = {
  success: boolean;
  transaction_id: number;
  amount: string;
  wallet_balance: string;
  path: string[];
};

export type UnlockMessageResponse = {
  success: boolean;
  transaction_id: number;
  amount: string;
  wallet_balance: string;
  path: string[];
};
