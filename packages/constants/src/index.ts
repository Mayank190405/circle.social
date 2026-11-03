export const APP_NAME = "Circle.social";
// Public URL identifiers. Changing slugs requires an explicit migration/redirect plan.
export const INITIAL_COMMUNITIES = [
  { name: "Bhasar", slug: "bhasar" },
  { name: "Papaki Pari", slug: "papaki-pari" },
  { name: "Dukhi Aatma", slug: "dukhi-aatma" },
  { name: "Khushi Ki Pujari", slug: "khushi-ki-pujari" },
  { name: "Baap Ka Paisa", slug: "baap-ka-paisa" },
] as const;
export type CommunitySlug = (typeof INITIAL_COMMUNITIES)[number]["slug"];
export const COMMUNITY_SLUGS: readonly CommunitySlug[] =
  INITIAL_COMMUNITIES.map((c) => c.slug);
export const QUEUE_NAMES = [
  "notifications",
  "media",
  "moderation",
  "maintenance",
] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];
export const JOB_DEFAULTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 604800, count: 1000 },
} as const;
