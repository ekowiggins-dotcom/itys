declare module "naughty-words" {
  /** Word lists by language code ("en", "tr", …). */
  const lists: Record<string, string[]>;
  export default lists;
}
