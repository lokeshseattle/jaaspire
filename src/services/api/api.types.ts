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
    name: string;
    count: number;
  }>;
  user_reaction?: string;
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
  gender_id: number;
  gender_pronoun: string;
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
  }>
  reply_count: number
  created_at: string
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
