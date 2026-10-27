/**
 * Base error class for all ClasseViva library errors.
 */
export class ClasseVivaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClasseVivaError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an authentication attempt fails (invalid credentials, expired password, etc.).
 */
export class ClasseVivaAuthError extends ClasseVivaError {
  public readonly isPasswordExpired: boolean;
  public readonly authData?: unknown;

  constructor(message: string, options?: { isPasswordExpired?: boolean; authData?: unknown }) {
    super(message);
    this.name = "ClasseVivaAuthError";
    this.isPasswordExpired = Boolean(options?.isPasswordExpired);
    this.authData = options?.authData;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when login verification succeeded but multiple matching accounts exist and one must be selected.
 */
export class ClasseVivaMultiAccountError extends ClasseVivaError {
  public readonly hints: unknown[];
  public readonly authData?: unknown;

  constructor(message: string, hints: unknown[] = [], authData?: unknown) {
    super(message);
    this.name = "ClasseVivaMultiAccountError";
    this.hints = hints;
    this.authData = authData;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a request receives a 401 Unauthorized status, indicating the session is invalid or expired.
 */
export class ClasseVivaSessionExpiredError extends ClasseVivaError {
  public readonly statusCode: number;

  constructor(message = "ClasseViva session has expired or is invalid (401 Unauthorized).") {
    super(message);
    this.name = "ClasseVivaSessionExpiredError";
    this.statusCode = 401;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the ClasseViva API responds with an HTTP error status code or unexpected payload.
 */
export class ClasseVivaApiError extends ClasseVivaError {
  public readonly statusCode: number;
  public readonly url: string;
  public readonly responseBody?: unknown;

  constructor(message: string, statusCode: number, url: string, responseBody?: unknown) {
    super(message);
    this.name = "ClasseVivaApiError";
    this.statusCode = statusCode;
    this.url = url;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
