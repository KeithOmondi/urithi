import { UserRole } from "../models/user.model";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      role: UserRole;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
