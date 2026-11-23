"use client";

import { useActionState } from "react";
import { memberAction } from "../../actions";
import { Avatar } from "../../components/Avatar";

type Props = {
  groupId: string;
  userId: string;
  name: string;
  isMe: boolean;
  isAdmin: boolean;
  /** Whether the viewer is the group admin. */
  viewerIsAdmin: boolean;
  blocked: boolean;
  color?: string;
};

export function MemberRow({ groupId, userId, name, isMe, isAdmin, viewerIsAdmin, blocked, color }: Props) {
  const [state, action, pending] = useActionState(memberAction, undefined);
  return (
    <li>
      <span className="person-line">
        <Avatar name={name} color={color} size={36} me={isMe} />
        <span>
          {name}
          {isMe ? " (you)" : ""}
        </span>
        {isAdmin && <span className="tag">admin</span>}
        {blocked && <span className="tag">blocked</span>}
        {state?.error && <span className="error small"> {state.error}</span>}
      </span>
      {!isMe && (
        <form action={action} className="row">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="userId" value={userId} />
          <button type="submit" name="op" value={blocked ? "unblock" : "block"} className="link" disabled={pending}>
            {blocked ? "Unblock" : "Block"}
          </button>
          {viewerIsAdmin && (
            <button
              type="submit"
              name="op"
              value="remove"
              className="link danger-link"
              disabled={pending}
              onClick={(e) => {
                if (!confirm(`Remove ${name} from the group? They won't be able to rejoin unless you let them back.`)) e.preventDefault();
              }}
            >
              Remove
            </button>
          )}
        </form>
      )}
    </li>
  );
}

export function RemovedRow({ groupId, userId, name }: { groupId: string; userId: string; name: string }) {
  const [state, action, pending] = useActionState(memberAction, undefined);
  return (
    <li>
      <span>
        {name}
        {state?.error && <span className="error small"> {state.error}</span>}
      </span>
      <form action={action}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" name="op" value="allow" className="link" disabled={pending}>
          Let back in
        </button>
      </form>
    </li>
  );
}
