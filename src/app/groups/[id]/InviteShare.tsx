"use client";

import { useState } from "react";
import { nativeShare } from "../../NativeBridge";
import { CopyButton } from "../../ui";

/** The invite link with a Share button (share sheet on phones) and Copy. */
export function InviteShare({ url, groupName }: { url: string; groupName: string }) {
  const [shown, setShown] = useState(false);
  const text = `Join ${groupName} on Who’ll and make your calls.`;
  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          onClick={async () => {
            try {
              if (await nativeShare(url, text)) return;
              if (navigator.share) return await navigator.share({ url, text });
            } catch {
              // dismissed
            }
            setShown(true);
          }}
        >
          Share invite
        </button>
        <CopyButton text={url} />
      </div>
      {shown && <p className="invite">{url}</p>}
    </div>
  );
}
