import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lower-cased and trimmed. Optional: people who sign in with Apple may hide their email. */
  email: text("email").unique(),
  /** Apple's stable user id ("sub") for Sign in with Apple. */
  appleSub: text("apple_sub").unique(),
  /** Apple refresh token, kept only to revoke Sign in with Apple when the account is deleted. */
  appleRefreshToken: text("apple_refresh_token"),
  /** Set on first sign-in (welcome screen). */
  name: text("name"),
  /** Email me when something needs me (settle, vote, a call about me). */
  emailAlerts: boolean("email_alerts").notNull().default(true),
  createdAt: createdAt(),
});

/** One-time sign-in links. Only a SHA-256 hash of the token is stored. */
export const loginTokens = pgTable(
  "login_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email").notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("login_tokens_email").on(t.email)],
);

/** Sessions. Only a SHA-256 hash of the cookie value is stored; they expire and slide while used. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** IANA time zone, used only for display and weekly boundaries. All times are stored in UTC. */
  timeZone: text("time_zone").notNull(),
  /** 128-bit random token used in invite links. The admin can reset it at any time. */
  inviteToken: text("invite_token").notNull().unique(),
  /** One of GROUP_COLORS (src/lib/faces.ts). Null for groups made before colours: one is derived from the id. */
  color: text("color"),
  /** Null once the creator deletes their account. */
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const memberRole = pgEnum("member_role", ["admin", "member"]);

export const members = pgTable(
  "members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The name friends see in this group. Unique (case-insensitive) among current members. */
    displayName: text("display_name").notNull(),
    role: memberRole("role").notNull().default("member"),
    joinedAt: ts("joined_at").notNull().defaultNow(),
    /** Set when the member leaves; null means active. */
    leftAt: ts("left_at"),
    /** Set when the admin removes someone. They can't rejoin until the admin lets them back. */
    bannedAt: ts("banned_at"),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index("members_user").on(t.userId),
    uniqueIndex("members_active_name")
      .on(t.groupId, sql`lower(${t.displayName})`)
      .where(sql`${t.leftAt} IS NULL`),
  ],
);

/**
 * What kind of answers a call takes:
 * - yes_no: "Yes" / "No"
 * - choice: 2–4 options written by the author
 * - member: pick a person from the group (option keys are user ids; names are looked up when shown)
 */
export const callKind = pgEnum("call_kind", ["yes_no", "choice", "member"]);
/** Whether a call is open/locked is derived from lock_at and now; status holds only what time can't tell. */
/**
 * active: picks open, then locked, waiting for the result · proposed: a result is in, open to dispute for 24h ·
 * disputed: the group is voting · settled / void / cancelled: final.
 */
export const moderationState = pgEnum("moderation_state", ["visible", "hidden", "removed"]);

export const callStatus = pgEnum("call_status", ["active", "cancelled", "settled", "void", "proposed", "disputed"]);
export type CallStatus = (typeof callStatus.enumValues)[number];

export type CallOption = { key: string; label: string };

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** Null once the author deletes their account (shown as "Former member"). */
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    /** The member this call is about, if any. They can't pick on it. */
    subjectId: uuid("subject_id").references(() => users.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    kind: callKind("kind").notNull(),
    /** For member calls, label is empty: the current display name is looked up when shown. */
    options: jsonb("options").$type<CallOption[]>().notNull(),
    /** Picks close at this moment. */
    lockAt: ts("lock_at").notNull(),
    /** When the answer should be known. Settling opens then. */
    eventAt: ts("event_at").notNull(),
    status: callStatus("status").notNull().default("active"),
    /** Who settles the call. Chosen when picks close (see lifecycle.chooseSettler). */
    settlerId: uuid("settler_id").references(() => users.id, { onDelete: "set null" }),
    /** The proposed result while status is proposed/disputed: an option key, or "void". */
    proposedResult: text("proposed_result"),
    proposedBy: uuid("proposed_by").references(() => users.id, { onDelete: "set null" }),
    proposedAt: ts("proposed_at"),
    disputedBy: uuid("disputed_by").references(() => users.id, { onDelete: "set null" }),
    voteClosesAt: ts("vote_closes_at"),
    /** The final answer once settled (an option key). Null for void calls. */
    result: text("result"),
    /** Why a call ended void: the settler said so, a vote, or nobody settled in time. */
    voidReason: text("void_reason"),
    settledAt: ts("settled_at"),
    /** When the "picks close soon" reminder went out (or was skipped). */
    remindedAt: ts("reminded_at"),
    /**
     * visible · hidden: taken down at once (the subject asked, or 2 reports) until a reviewer decides ·
     * removed: confirmed; the call is called off and scores nobody.
     */
    moderation: moderationState("moderation").notNull().default("visible"),
    hiddenAt: ts("hidden_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    /** When the settler was told it's time to enter the result. */
    settlePromptedAt: ts("settle_prompted_at"),
    /** When the job runner next needs to look at this call. Null once nothing more can happen. */
    nextActionAt: ts("next_action_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("calls_group_lock").on(t.groupId, t.lockAt),
    index("calls_author").on(t.authorId),
    index("calls_next_action").on(t.nextActionAt).where(sql`${t.nextActionAt} IS NOT NULL`),
  ],
);

/** Votes in a disputed call. option_key is an option or "void". The disputer's vote is recorded automatically. */
export const votes = pgTable(
  "votes",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionKey: text("option_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.callId, t.userId] })],
);

export const picks = pgTable(
  "picks",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    optionKey: text("option_key").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.callId, t.userId] }), index("picks_user").on(t.userId)],
);

/**
 * Points per person per settled call, written once when the call is settled (see scoring.ts).
 * group_id and settled_at are copied from the call so rankings are one indexed range scan.
 */
export const scores = pgTable(
  "scores",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    settledAt: ts("settled_at").notNull(),
    points: integer("points").notNull(),
    correct: boolean("correct").notNull(),
  },
  (t) => [primaryKey({ columns: [t.callId, t.userId] }), index("scores_group_time").on(t.groupId, t.settledAt)],
);

export const notificationType = pgEnum("notification_type", [
  "call_created",
  "about_you",
  "lock_reminder",
  "settle_prompt",
  "result_proposed",
  "vote_needed",
  "settled",
  "called_off",
  "member_joined",
  "review_needed",
  "call_removed",
]);
export type NotificationType = (typeof notificationType.enumValues)[number];

/**
 * In-app notifications. No text is stored: it's rendered when read, from current names and call data and
 * through the visibility rules, so renames, deletions and hidden calls are always respected.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: notificationType("type").notNull(),
    /** One notification per event: e.g. "settled:<callId>". */
    dedupeKey: text("dedupe_key").notNull(),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notifications_dedupe").on(t.userId, t.dedupeKey),
    index("notifications_inbox").on(t.userId, t.createdAt),
    index("notifications_unread").on(t.userId).where(sql`${t.readAt} IS NULL`),
  ],
);

export const outboxStatus = pgEnum("outbox_status", ["queued", "sending", "sent", "failed", "expired"]);

/**
 * Deliveries outside the app (email now, push later), written in the same transaction as the event
 * (transactional outbox). The worker claims rows with a lease, so a crash mid-send is retried, not lost.
 */
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: outboxStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextTryAt: ts("next_try_at").notNull(),
    /** While sending: the claim expires at this time, after which another worker may retry. */
    leaseUntil: ts("lease_until"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("outbox_due").on(t.nextTryAt).where(sql`${t.status} IN ('queued', 'sending')`),
    uniqueIndex("outbox_once").on(t.notificationId, t.channel),
  ],
);

export const reportReason = pgEnum("report_reason", ["about_me", "hurtful", "private", "spam", "other"]);

/** Reports on calls. "about_me" comes from the subject and hides the call at once; 2 reports of any kind do too. */
export const reports = pgTable(
  "reports",
  {
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: reportReason("reason").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.callId, t.userId] })],
);

/** Blocking is per person, across all groups. */
export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked").on(t.blockedId)],
);

/**
 * Public links to a settled call's result. Created by a member on purpose; what the link shows is decided
 * again on every view (src/server/sharing.ts), so a later removal or account deletion takes it down.
 */
export const shareLinks = pgTable(
  "share_links",
  {
    token: text("token").primaryKey(),
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("share_links_once").on(t.callId, t.createdBy)],
);

/**
 * Phones registered for push. Each device belongs to the session that registered it, so signing out
 * (or "sign out everywhere", or deleting the account) stops its pushes automatically.
 */
export const devices = pgTable(
  "devices",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionHash: text("session_hash")
      .notNull()
      .references(() => sessions.tokenHash, { onDelete: "cascade" }),
    /** APNs environment that accepted this token; learned on first send. */
    environment: text("environment"),
    disabledAt: ts("disabled_at"),
    createdAt: createdAt(),
  },
  (t) => [index("devices_user").on(t.userId).where(sql`${t.disabledAt} IS NULL`)],
);

/** Read-only tokens for the home-screen widget (hash only). One per person; replaced on each sign-in. */
export const widgetTokens = pgTable("widget_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

/** Fixed-window rate limit counters. Old windows are deleted opportunistically. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window").on(t.windowStart)],
);
