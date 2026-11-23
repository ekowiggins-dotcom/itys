import { describe, expect, it } from "vitest";
import { summarise } from "@/server/error-report";

describe("error reports", () => {
  it("keep only the first line of the message, no params and no query string", () => {
    const err = new Error('Failed query: select * from users where email = $1\nparams: ada@example.com');
    const r = summarise(err, { method: "GET", path: "/auth/verify?token=secret-token" }, { routePath: "/auth/verify", routeType: "render" });
    expect(r.message).toBe("Error: Failed query: select * from users where email = $1");
    expect(JSON.stringify(r)).not.toContain("ada@example.com");
    expect(JSON.stringify(r)).not.toContain("secret-token");
    expect(r.path).toBe("/auth/verify");
  });

  it("strips params even on the first line, and keeps the digest", () => {
    const err = Object.assign(new Error("boom params: 123,abc"), { digest: "42" });
    const r = summarise(err, { method: "POST", path: "/groups" });
    expect(r.message).toBe("Error: boom ");
    expect(r.digest).toBe("42");
  });
});
