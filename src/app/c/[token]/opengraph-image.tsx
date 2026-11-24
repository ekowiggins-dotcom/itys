import { ImageResponse } from "next/og";
import { CallInviteCard, CARD_SIZE, cardFonts, GenericCard } from "../../share-card";
import { callInvitePreview } from "@/server/call-invites";
import { getDb } from "@/server/db";
import { clientIp } from "@/server/session";

export const alt = "A call from friends on Who’ll";
export const size = CARD_SIZE;
export const contentType = "image/png";

/** The picture WhatsApp shows for a call invite: the call and who has picked, same as the page. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let p = null;
  try {
    p = await callInvitePreview(await getDb(), token, await clientIp(), null);
  } catch {
    // rate-limited: fall back to the generic card
  }
  return new ImageResponse(
    p ? <CallInviteCard text={p.text} groupName={p.groupName} pickers={p.pickers} color={p.color} /> : <GenericCard />,
    { ...size, fonts: await cardFonts() },
  );
}
