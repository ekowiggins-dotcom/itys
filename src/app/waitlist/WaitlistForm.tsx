"use client";

import Link from "next/link";
import { useActionState } from "react";
import { waitlistAction, type WaitlistState } from "../actions";
import { Submit } from "../ui";
import { WAITLIST_COPY, type WaitlistLocale } from "@/lib/waitlist-copy";

/** The waitlist form, then the thank-you. The hidden "website" field is a trap for bots. */
export function WaitlistForm(props: { locale: WaitlistLocale; source: string | null; campaign: string | null; content: string | null }) {
  const t = WAITLIST_COPY[props.locale];
  const [state, action] = useActionState(waitlistAction, undefined as WaitlistState);
  if (state?.ok) {
    return (
      <div className="card waitlist-thanks" role="status">
        <h2>{t.thanksTitle}</h2>
        <p>{t.thanksText}</p>
      </div>
    );
  }
  return (
    <form action={action} className="card stack">
      <input type="hidden" name="locale" value={props.locale} />
      {props.source && <input type="hidden" name="source" value={props.source} />}
      {props.campaign && <input type="hidden" name="campaign" value={props.campaign} />}
      {props.content && <input type="hidden" name="content" value={props.content} />}
      <div className="hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label htmlFor="email">{t.email}</label>
      <input id="email" type="email" name="email" autoComplete="email" required maxLength={254} />

      <fieldset className="waitlist-sizes">
        <legend>
          {t.size} <span className="muted">({t.optional})</span>
        </legend>
        <div className="row">
          {(Object.keys(t.sizes) as (keyof typeof t.sizes)[]).map((k) => (
            <label key={k} className="chip-choice">
              <input type="radio" name="groupSize" value={k} />
              <span>{t.sizes[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Submit>{t.submit}</Submit>
      {state?.error && (
        <p className="error" role="alert">
          {t[state.error]}
        </p>
      )}
      <p className="muted small" style={{ margin: 0 }}>
        {t.note} <Link href="/privacy#waitlist">{t.privacy}</Link>
      </p>
    </form>
  );
}
