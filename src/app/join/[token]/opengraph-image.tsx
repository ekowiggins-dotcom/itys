import { ImageResponse } from "next/og";
import { CARD_SIZE, cardFonts, GenericCard, InviteCard } from "../../share-card";
import { getDb } from "@/server/db";
import { invitePreview } from "@/server/groups";
import { clientIp } from "@/server/session";

export const alt = "An invite to a group on Who’ll";
export const size = CARD_SIZE;
export const contentType = "image/png";

/** The picture chat apps show for an invite link: the group's name and size, same as the join page. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let preview = null;
  try {
    preview = await invitePreview(await getDb(), token, await clientIp(), null);
  } catch {
    // rate-limited: fall back to the generic card
  }
  return new ImageResponse(preview ? <InviteCard name={preview.name} memberCount={preview.memberCount} color={preview.color} /> : <GenericCard />, { ...size, fonts: await cardFonts() });
}
