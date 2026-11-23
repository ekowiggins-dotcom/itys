"use client";

import { logoutAction, logoutEverywhereAction } from "../actions";
import { clearNativeWidget } from "../NativeBridge";

/** Sign-out buttons. In the iOS app they also clear the home-screen widget. (Push stops with the session.) */
export function SignOutButtons() {
  return (
    <div className="row">
      <form action={logoutAction} onSubmit={() => void clearNativeWidget()}>
        <button type="submit" className="secondary">
          Sign out
        </button>
      </form>
      <form action={logoutEverywhereAction} onSubmit={() => void clearNativeWidget()}>
        <button type="submit" className="danger">
          Sign out everywhere
        </button>
      </form>
    </div>
  );
}
