/**
 * Lightweight cookie manager for tracking session cookies across ClasseViva requests.
 */
export class CookieJar {
  private cookies = new Map<string, string>();

  constructor(initialCookies?: Record<string, string> | string) {
    if (typeof initialCookies === "string") {
      this.parseCookieHeader(initialCookies);
    } else if (initialCookies && typeof initialCookies === "object") {
      for (const [key, value] of Object.entries(initialCookies)) {
        if (value !== undefined && value !== null) {
          this.set(key, String(value));
        }
      }
    }
  }

  /**
   * Set or update a cookie value.
   */
  set(name: string, value: string): void {
    if (name) {
      this.cookies.set(name.trim(), value.trim());
    }
  }

  /**
   * Get a cookie by name.
   */
  get(name: string): string | undefined {
    return this.cookies.get(name.trim());
  }

  /**
   * Check if a cookie exists.
   */
  has(name: string): boolean {
    return this.cookies.has(name.trim());
  }

  /**
   * Delete a cookie by name.
   */
  delete(name: string): boolean {
    return this.cookies.delete(name.trim());
  }

  /**
   * Clear all cookies in the jar.
   */
  clear(): void {
    this.cookies.clear();
  }

  /**
   * Get the session ID (PHPSESSID cookie).
   */
  getSessionId(): string | undefined {
    return this.get("PHPSESSID");
  }

  /**
   * Get the webidentity cookie (e.g. S12345678C).
   */
  getWebIdentity(): string | undefined {
    return this.get("webidentity");
  }

  /**
   * Get the webrole cookie (e.g. gen).
   */
  getWebRole(): string | undefined {
    return this.get("webrole");
  }

  /**
   * Check if authentication cookies are present.
   */
  hasAuthCookies(): boolean {
    return this.has("PHPSESSID");
  }

  /**
   * Parse `Set-Cookie` headers from a fetch Response.
   */
  collectFromResponse(response: Response): void {
    const headers = response.headers;

    // In modern Node (v18.14.0+), headers.getSetCookie() returns all Set-Cookie headers as string[]
    if (typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function") {
      const setCookies = (headers as unknown as { getSetCookie: () => string[] }).getSetCookie();
      for (const str of setCookies) {
        this.parseSetCookieString(str);
      }
      return;
    }

    // Fallback: headers.get('set-cookie')
    const raw = headers.get("set-cookie");
    if (raw) {
      // If multiple cookies are comma-separated, split while avoiding commas in Expires dates
      const cookieStrings = raw.split(/,(?=\s*[^;=]+=[^;]+)/g);
      for (const str of cookieStrings) {
        this.parseSetCookieString(str);
      }
    }
  }

  /**
   * Parse a single `Set-Cookie` header value string.
   */
  parseSetCookieString(setCookieStr: string): void {
    if (!setCookieStr) return;
    const parts = setCookieStr.split(";");
    const [nameVal] = parts;
    if (!nameVal) return;
    const equalsIdx = nameVal.indexOf("=");
    if (equalsIdx > 0) {
      const name = nameVal.substring(0, equalsIdx).trim();
      const value = nameVal.substring(equalsIdx + 1).trim();
      this.set(name, value);
    }
  }

  /**
   * Parse standard `Cookie: a=1; b=2` header string.
   */
  parseCookieHeader(cookieHeaderStr: string): void {
    if (!cookieHeaderStr) return;
    const pairs = cookieHeaderStr.split(";");
    for (const pair of pairs) {
      const equalsIdx = pair.indexOf("=");
      if (equalsIdx > 0) {
        const name = pair.substring(0, equalsIdx).trim();
        const value = pair.substring(equalsIdx + 1).trim();
        this.set(name, value);
      }
    }
  }

  /**
   * Formats stored cookies into a string suitable for a `Cookie` request header.
   */
  toCookieHeader(): string {
    const pairs: string[] = [];
    for (const [name, value] of this.cookies.entries()) {
      pairs.push(`${name}=${value}`);
    }
    return pairs.join("; ");
  }

  /**
   * Export cookies as a plain key-value object.
   */
  toObject(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [name, value] of this.cookies.entries()) {
      result[name] = value;
    }
    return result;
  }
}
