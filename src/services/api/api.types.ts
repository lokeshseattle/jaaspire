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

export type LoginResponse = {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      username: string;
      avatar: string;
      cover: string;
    };
  };
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
    status: any;
    path: string;
    thumbnail: string;
    duration: any;
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
  }
}

export type TUserProfileResponse = ProfileResponse & {
  data: TUserProfile & TUserViewer;
}


export type OptimisticComment = TComment & { _isOptimistic?: boolean };
export type OptimisticReply = TComment["replies"][0] & { _isOptimistic?: boolean };
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

export type UpdateProfileRequest = Partial<TUpdateProfile>;

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
  id: number
  message: string
  is_liked: boolean
  user: {
    id: number
    name: string
    username: string
    avatar: string
    verified_user: boolean
    story_status: {
      has_stories: boolean
      all_viewed: boolean
      story_count: number
    }
  }
  reactions: number
  replies: Array<{
    id: number
    message: string
    is_liked: boolean
    user: {
      id: number
      name: string
      username: string
      avatar: string
      verified_user: boolean
      story_status: {
        has_stories: boolean
        all_viewed: boolean
        story_count: number
      }
    }
    reactions: number
    created_at: string
    _isOptimistic?: boolean
  }>
  reply_count: number
  created_at: string
  _isOptimistic?: boolean;

}

export type CommentsResponse = {
  success: boolean
  message: string
  data: {
    comments: Array<TComment>
    pagination: {
      current_page: number
      last_page: number
      per_page: number
      total: number
      has_more: boolean
    }
  }
}
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
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
  from_user: {
    id: number
    name: string
    username: string
    avatar: string
    verified_user: boolean
    story_status: {
      has_stories: boolean
      all_viewed: boolean
      story_count: number
    }
  }
  post?: {
    id: number
    text: string
  }
  comment?: {
    id: number
    message: string
  }
  transaction: any
}

export type NotificationsAPIResponse = {
  success: boolean
  message: string
  data: {
    notifications: Array<TNotification>
    pagination: {
      current_page: number
      last_page: number
      per_page: number
      total: number
      has_more: boolean
    }
  }
}

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
  type: 'image' | 'video';
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
    }

  };
};

export type FollowUserResponse = {
  success: boolean,
  message: string,
  data: {
    follow_status: "unfollow" | "follow" | "requested",
    is_following: boolean,
    is_pending: boolean
  }
}

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

export type BookmarksResponse = {
  success: boolean;
  message: string;
  data: {
    posts: Post[];
    pagination: Pagination;
  };
};