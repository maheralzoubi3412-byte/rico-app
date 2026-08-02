import 'express-session';

declare module 'express-session' {
  interface SessionData {
    businessId?: string;
    ownerId?: string;
    ownerRole?: string;
  }
}
