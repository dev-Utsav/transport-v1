/** What the mocked `redirect()` / `notFound()` throw, so a test can see where an action sent the user. */
export class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect → ${url}`);
  }
}

export class NotFoundSignal extends Error {
  constructor() {
    super("notFound()");
  }
}

/** The request cookies the mocked `cookies()` reads and writes. Cleared before every test. */
export const cookieJar = new Map<string, string>();
