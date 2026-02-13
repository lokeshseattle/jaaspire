export type PossibleErrorResponse = {
  success: boolean;
  message: string;
  errors: any;
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
