"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import * as auth from "@/server/auth";
import * as calls from "@/server/calls";
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

export type FormState = { error?: string; ok?: string; devLink?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Turns known errors into a message for the form; anything unexpected is logged and hidden. */
function toState(e: unknown): FormState {
  if (e instanceof AppError) return { error: e.message };
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check the form and try again." };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

export async function requestLoginAction(_: FormState, form: FormData): Promise<FormState> {
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
  revalidatePath(`/groups/${groupId}`);
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
  revalidatePath(`/groups/${groupId}`);
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
    else return { error: "Unknown action." };
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/groups/${groupId}`);
  return undefined;
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
