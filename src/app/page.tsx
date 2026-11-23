import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/session";

export default async function Home() {
  if (await currentUser()) redirect("/groups");
  return (
    <>
      <h1>Call it before it happens.</h1>
      <p className="muted">
        Make friendly predictions about your group&apos;s plans and life with your friends. Points are free and only
        earned by being right. No money, no prizes, just bragging rights.
      </p>
      <p>
        <Link href="/login">
          <button type="button">Sign in with email</button>
        </Link>
      </p>
    </>
  );
}
