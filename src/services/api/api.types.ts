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
