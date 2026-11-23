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
  /** Always stored lower-cased and trimmed. */
  email: text("email").notNull().unique(),
  /** Set on first sign-in (welcome screen). */
  name: text("name"),
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
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
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
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    /** The member this call is about, if any. They can't pick on it. */
    subjectId: uuid("subject_id").references(() => users.id),
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
    settlerId: uuid("settler_id").references(() => users.id),
    /** The proposed result while status is proposed/disputed: an option key, or "void". */
    proposedResult: text("proposed_result"),
    proposedBy: uuid("proposed_by").references(() => users.id),
    proposedAt: ts("proposed_at"),
    disputedBy: uuid("disputed_by").references(() => users.id),
    voteClosesAt: ts("vote_closes_at"),
    /** The final answer once settled (an option key). Null for void calls. */
    result: text("result"),
    /** Why a call ended void: the settler said so, a vote, or nobody settled in time. */
    voidReason: text("void_reason"),
    settledAt: ts("settled_at"),
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
