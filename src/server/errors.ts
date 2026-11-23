/** An error that is safe to show to the user. Anything else is reported as a generic failure. */
export class AppError extends Error {
  constructor(
    public code: "not_found" | "forbidden" | "invalid" | "conflict" | "rate_limited" | "unauthenticated",
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "That") => new AppError("not_found", `${what} doesn't exist or you don't have access.`);
