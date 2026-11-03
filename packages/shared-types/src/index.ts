export type UserStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type MembershipRole = "MEMBER" | "MODERATOR" | "OWNER";
export interface UserSummary {
  id: string;
  handle: string;
  status: UserStatus;
}
export interface CommunitySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}
export interface MembershipSummary {
  userId: string;
  communityId: string;
  role: MembershipRole;
  joinedAt: string;
}
export interface ApiResponse<T> {
  data: T;
  requestId: string;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
  requestId: string;
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
