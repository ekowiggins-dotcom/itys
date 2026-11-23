import { ImageResponse } from "next/og";
import { CARD_SIZE, cardFonts, GenericCard, ResultCard } from "../../share-card";
import { resultFor } from "./data";

export const alt = "A call result on Who’ll";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resultFor(token);
  return new ImageResponse(r ? <ResultCard {...r} /> : <GenericCard />, { ...size, fonts: await cardFonts() });
}
