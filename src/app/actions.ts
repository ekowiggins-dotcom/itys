"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import * as auth from "@/server/auth";
import * as calls from "@/server/calls";
import * as lifecycle from "@/server/lifecycle";
import * as notifications from "@/server/notifications";
import * as moderation from "@/server/moderation";
import * as account from "@/server/account";
import * as sharing from "@/server/sharing";
import * as devices from "@/server/devices";
import * as review from "@/server/review";
import * as apple from "@/server/apple";
import { cookies } from "next/headers";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import * as groups from "@/server/groups";
import { sendLoginEmail } from "@/server/mailer";
import {
  appOrigin,
  clearSessionCookie,
  clientIp,
  requireUser,
  safeNext,
  sessionToken,
  setSessionCookie,
} from "@/server/session";

export type FormState = { error?: string; ok?: string; devLink?: string; shareUrl?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Turns known errors into a message for the form; anything unexpected is logged and hidden. */
function toState(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check the form and try again." };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function requestLoginAction(_: FormState, form: FormData): Promise<FormState> {
  const code = str(form, "code");
  if (code) {
    // App Review: a configured account signs in with a code instead of an email link.
    let dest: string;
    try {
      const { sessionToken, expiresAt } = await review.reviewLogin(await getDb(), str(form, "email"), code, await clientIp());
      await setSessionCookie(sessionToken, expiresAt);
      dest = safeNext(str(form, "next"));
    } catch (e) {
      return toState(e);
    }
    redirect(dest);
  }
  try {
    const { email, token } = await auth.requestLogin(await getDb(), str(form, "email"), await clientIp());
    const next = safeNext(str(form, "next"));
    const link = `${await appOrigin()}/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
    await sendLoginEmail(email, link);
    return {
      ok: `We sent a sign-in link to ${email}. It expires in 15 minutes.`,
      devLink: process.env.NODE_ENV === "production" ? undefined : link,
    };
  } catch (e) {
    return toState(e);
  }
}

const APPLE_NONCE_COOKIE = "wholl_apple_nonce";

/** Step 1 of Sign in with Apple: a one-time nonce (kept in a 10-minute httpOnly cookie); returns its hash for Apple. */
export async function appleNonceAction() {
  const nonce = apple.newNonce();
  (await cookies()).set(APPLE_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return apple.nonceHash(nonce);
}

/** Step 2: Apple's answer. Checks it, signs in (or creates the account) and says where to go next. */
export async function appleSignInAction(input: { idToken: string; authorizationCode?: string; givenName?: string; next?: string }) {
  const jar = await cookies();
  const rawNonce = jar.get(APPLE_NONCE_COOKIE)?.value;
  jar.delete(APPLE_NONCE_COOKIE); // one use only
  try {
    const { sessionToken, expiresAt, user } = await apple.appleSignIn(
      await getDb(),
      { idToken: String(input.idToken), rawNonce, authorizationCode: input.authorizationCode, givenName: input.givenName },
      await clientIp(),
    );
    await setSessionCookie(sessionToken, expiresAt);
    const next = safeNext(input.next);
    revalidatePath("/", "layout");
    return { next: user.name ? next : `/welcome?next=${encodeURIComponent(next)}` };
  } catch (e) {
    return { error: toState(e)?.error ?? "Sign in with Apple didn’t work." };
  }
}

/** Runs from a button on the verify page, never on GET, so email link scanners can't use up the token. */
export async function completeLoginAction(_: FormState, form: FormData): Promise<FormState> {
  let dest: string;
  try {
    const { sessionToken, expiresAt, user } = await auth.completeLogin(await getDb(), str(form, "token"));
    await setSessionCookie(sessionToken, expiresAt);
    const next = safeNext(str(form, "next"));
    dest = user.name ? next : `/welcome?next=${encodeURIComponent(next)}`;
  } catch (e) {
    return toState(e);
  }
  redirect(dest);
}

export async function setNameAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/welcome");
  try {
    await auth.setName(await getDb(), user, str(form, "name"));
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/", "layout"); // the header shows the name
  redirect(safeNext(str(form, "next")));
}

export async function logoutAction() {
  const token = await sessionToken();
  if (token) await auth.logout(await getDb(), token);
  await clearSessionCookie();
  redirect("/");
}

export async function logoutEverywhereAction() {
  const user = await requireUser("/settings");
  await auth.logoutEverywhere(await getDb(), user);
  await clearSessionCookie();
  redirect("/");
}

export async function createGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/groups");
  let id: string;
  try {
    id = await groups.createGroup(await getDb(), user, {
      name: str(form, "name"),
      timeZone: str(form, "timeZone"),
      displayName: str(form, "displayName") || user.name || "",
      color: str(form, "color") || undefined,
    });
  } catch (e) {
    return toState(e);
  }
  redirect(`/groups/${id}`);
}

export async function joinGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const token = str(form, "token");
  const user = await requireUser(`/join/${token}`);
  let id: string;
  try {
    id = await groups.joinGroup(await getDb(), user, token, str(form, "displayName"), await clientIp());
  } catch (e) {
    return toState(e);
  }
  redirect(`/groups/${id}`);
}

export async function resetInviteAction(_: FormState, form: FormData): Promise<FormState> {
  const groupId = str(form, "groupId");
  const user = await requireUser(`/groups/${groupId}`);
  try {
    await groups.resetInvite(await getDb(), user, groupId);
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/groups/${groupId}`, "layout");
  return { ok: "New invite link created. The old one no longer works." };
}

export async function createCallAction(_: FormState, form: FormData): Promise<FormState> {
  const groupId = str(form, "groupId");
  const user = await requireUser(`/groups/${groupId}`);
  try {
    const kind = str(form, "kind") as "yes_no" | "choice" | "member";
    await calls.createCall(await getDb(), user, groupId, {
      text: str(form, "text"),
      kind,
      options: kind === "choice" ? form.getAll("option").map(String) : undefined,
      subjectId: str(form, "subjectId") || undefined,
      lockAt: str(form, "lockAt"),
      eventAt: str(form, "eventAt") || str(form, "lockAt"),
    });
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/groups/${groupId}`, "layout");
  return { ok: "Call posted." };
}

/** Pick, change pick, take back, or cancel. One action keeps the call card's buttons simple. */
export async function callAction(_: FormState, form: FormData): Promise<FormState> {
  const groupId = str(form, "groupId");
  const callId = str(form, "callId");
  const user = await requireUser(`/groups/${groupId}`);
  try {
    const db = await getDb();
    const op = str(form, "op");
    if (op === "pick") await calls.pick(db, user, callId, str(form, "option"));
    else if (op === "unpick") await calls.unpick(db, user, callId);
    else if (op === "cancel") await calls.cancelCall(db, user, callId);
    else if (op === "settle") await lifecycle.proposeResult(db, user, callId, str(form, "option"));
    else if (op === "dispute") await lifecycle.disputeResult(db, user, callId, str(form, "option"));
    else if (op === "vote") await lifecycle.voteOnResult(db, user, callId, str(form, "option"));
    else if (op === "share") {
      const token = await sharing.createShareLink(db, user, callId);
      return { shareUrl: `${await appOrigin()}/r/${token}` };
    } else if (op === "hide") {
      await moderation.reportCall(db, user, callId, "about_me");
      revalidatePath(`/groups/${groupId}`, "layout");
      return { ok: "Hidden. Nobody can see it while it's reviewed." };
    } else if (op === "report") {
      const reason = str(form, "reason");
      const valid = ["hurtful", "private", "spam", "other"] as const;
      const hidden = await moderation.reportCall(db, user, callId, valid.find((r) => r === reason) ?? "other");
      revalidatePath(`/groups/${groupId}`, "layout");
      return { ok: hidden ? "Thanks. The call is hidden while it's reviewed." : "Thanks. If someone else reports it too, it's hidden for review." };
    }
    else return { error: "Unknown action." };
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/groups/${groupId}`, "layout");
  return undefined;
}

export async function markReadAction(upTo: string) {
  const user = await requireUser("/notifications");
  const when = new Date(upTo);
  if (Number.isNaN(when.getTime())) return;
  await notifications.markAllRead(await getDb(), user, when);
  revalidatePath("/", "layout"); // the unread count in the header
}

export async function setEmailAlertsAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/settings");
  const on = form.get("emailAlerts") === "on";
  await auth.setEmailAlerts(await getDb(), user, on);
  revalidatePath("/settings");
  return { ok: on ? "You'll get an email when something needs you." : "Emails are off. You'll still see everything in the app." };
}

export async function reviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/review");
  const decision = str(form, "decision") === "remove" ? "remove" : "restore";
  try {
    await moderation.reviewCall(await getDb(), user, str(form, "callId"), decision);
  } catch (e) {
    return toState(e);
  }
  revalidatePath("/review");
  return { ok: decision === "remove" ? "Removed. Nobody scores on it." : "Restored." };
}

/** Member actions on the group page: block / unblock (anyone), remove / let back (admin). */
export async function memberAction(_: FormState, form: FormData): Promise<FormState> {
  const groupId = str(form, "groupId");
  const target = str(form, "userId");
  const user = await requireUser(`/groups/${groupId}`);
  const db = await getDb();
  try {
    const op = str(form, "op");
    if (op === "block") await moderation.blockUser(db, user, target);
    else if (op === "unblock") await moderation.unblockUser(db, user, target);
    else if (op === "remove") await moderation.removeMember(db, user, groupId, target);
    else if (op === "allow") await moderation.allowBack(db, user, groupId, target);
    else return { error: "Unknown action." };
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/groups/${groupId}`, "layout");
  revalidatePath("/settings");
  return undefined;
}

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/settings");
  if (str(form, "confirm").trim().toLowerCase() !== "delete") return { error: 'Type "delete" to confirm.' };
  await account.deleteAccount(await getDb(), user);
  await clearSessionCookie();
  redirect("/");
}

/** The iOS app registers its push token for this session. */
export async function registerDeviceAction(deviceToken: string) {
  const user = await requireUser("/groups");
  const token = await sessionToken();
  if (!token) return;
  await devices.registerDevice(await getDb(), user, token, deviceToken);
}

/** The iOS app asks for a read-only widget token, which it stores for the home-screen widget. */
export async function widgetTokenAction() {
  const user = await requireUser("/groups");
  return devices.createWidgetToken(await getDb(), user);
}

export async function leaveGroupAction(_: FormState, form: FormData): Promise<FormState> {
  const groupId = str(form, "groupId");
  const user = await requireUser(`/groups/${groupId}`);
  try {
    await groups.leaveGroup(await getDb(), user, groupId);
  } catch (e) {
    return toState(e);
  }
  redirect("/groups");
}
