import { CookieJar } from "./cookies.js";
import { getEnvCredentials, loadEnv } from "./env.js";
import {
  ClasseVivaApiError,
  ClasseVivaAuthError,
  ClasseVivaError,
  ClasseVivaMultiAccountError,
  ClasseVivaSessionExpiredError,
} from "./errors.js";
import type {
  AbsencesResponse,
  AgendaResponse,
  AveragesResponse,
  ClasseVivaClientOptions,
  CommunicationsResponse,
  DailyOverviewResponse,
  DashboardResponse,
  DateInput,
  DidacticsResponse,
  DocumentsResponse,
  FunctionsResponse,
  GradesResponse,
  HomeworksResponse,
  LibrettoWebConfig,
  LessonsResponse,
  LoginCredentials,
  LoginResponse,
  MyTalksResponse,
  NoticeboardResponse,
  NoticeReadResponse,
  NotesResponse,
  OverallTalksResponse,
  PaymentsResponse,
  PeriodsResponse,
  PortfolioResponse,
  SchoolbooksResponse,
  StudentCardResponse,
  SubjectAverage,
  SubjectsResponse,
  TalkFramesResponse,
  TalkTeachersResponse,
  UserInfo,
} from "./types.js";
import { formatDateParam, joinUrl, trimSafe } from "./utils.js";

const DEFAULT_BASE_URL = "https://web.spaggiari.eu/rest/w1";
const DEFAULT_AUTH_URL = "https://web.spaggiari.eu/auth-p7/app/default/AuthApi4.php";
const DEFAULT_CDN_URL = "https://cdndoc.spaggiari.eu";
const DEFAULT_USER_AGENT = "classevivapi.js/1.0.1 (Node.js)";

export class ClasseVivaClient {
  public baseUrl: string;
  public authUrl: string;
  public cdnUrl: string;
  public userAgent: string;

  public username?: string;
  public password?: string;
  public schoolCode?: string;
  public pin?: string;
  public target?: string;

  public studentId?: string;
  public accountInfo?: LoginResponse["data"]["auth"]["accountInfo"];
  public cookieJar: CookieJar;

  private customFetch: typeof globalThis.fetch;
  private autoLoadEnv: boolean;

  constructor(options: ClasseVivaClientOptions = {}) {
    this.autoLoadEnv = options.autoLoadEnv ?? true;

    if (this.autoLoadEnv) {
      loadEnv(options.envPath);
    }

    const envCreds = getEnvCredentials();

    this.username = options.username ?? envCreds.username;
    this.password = options.password ?? envCreds.password;
    this.schoolCode = options.schoolCode ?? envCreds.schoolCode;
    this.pin = options.pin ?? envCreds.pin;
    this.target = options.target ?? envCreds.target;

    this.baseUrl = (options.baseUrl ?? envCreds.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.authUrl = options.authUrl ?? envCreds.authUrl ?? DEFAULT_AUTH_URL;
    this.cdnUrl = (options.cdnUrl ?? envCreds.cdnUrl ?? DEFAULT_CDN_URL).replace(/\/+$/, "");
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

    this.customFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.cookieJar = new CookieJar(options.cookies);

    if (options.sessionId) {
      this.cookieJar.set("PHPSESSID", options.sessionId);
    }

    if (options.studentId) {
      this.studentId = String(options.studentId);
    }
  }

  /**
   * Whether the client currently holds an active session cookie (PHPSESSID).
   */
  get isAuthenticated(): boolean {
    return this.cookieJar.hasAuthCookies();
  }

  /**
   * Get all currently stored session cookies.
   */
  getSessionCookies(): Record<string, string> {
    return this.cookieJar.toObject();
  }

  /**
   * Manually restore or inject an existing session ID and optional cookies.
   */
  setSession(sessionId: string, extraCookies?: Record<string, string>): void {
    this.cookieJar.set("PHPSESSID", sessionId);
    if (extraCookies) {
      for (const [key, val] of Object.entries(extraCookies)) {
        if (val) this.cookieJar.set(key, val);
      }
    }
  }

  /**
   * Clears all session cookies and resets cached student data.
   */
  logout(): void {
    this.cookieJar.clear();
    this.studentId = undefined;
    this.accountInfo = undefined;
  }

  /**
   * Authenticate with ClasseViva using username and password.
   * Credentials can be passed here or loaded automatically from .env or constructor options.
   */
  async login(credentials?: LoginCredentials): Promise<LoginResponse> {
    const uid = credentials?.username ?? this.username;
    const pwd = credentials?.password ?? this.password;
    const cid = credentials?.schoolCode ?? this.schoolCode ?? "";
    const pin = credentials?.pin ?? this.pin ?? "";
    const target = credentials?.target ?? this.target ?? "";

    if (!uid || !pwd) {
      throw new ClasseVivaAuthError(
        "ClasseViva login requires username and password. Provide them in login(), constructor options, or .env file (CLASSEVIVA_USERNAME, CLASSEVIVA_PASSWORD)."
      );
    }

    // Save for subsequent auto-reconnects
    this.username = uid;
    this.password = pwd;
    this.schoolCode = cid;
    this.pin = pin;
    this.target = target;

    const params = new URLSearchParams({
      cid,
      uid,
      pwd,
      pin,
      target,
    });

    const url = `${this.authUrl}?a=aLoginPwd`;
    const response = await this.customFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent,
        Accept: "application/json, text/plain, */*",
        ...(this.cookieJar.hasAuthCookies() ? { Cookie: this.cookieJar.toCookieHeader() } : {}),
      },
      body: params.toString(),
    });

    this.cookieJar.collectFromResponse(response);

    if (!response.ok) {
      throw new ClasseVivaApiError(
        `Authentication HTTP error: ${response.status} ${response.statusText}`,
        response.status,
        url
      );
    }

    const payload = (await response.json()) as LoginResponse;

    const auth = payload?.data?.auth;
    if (!auth) {
      throw new ClasseVivaAuthError("Unexpected login response payload from ClasseViva.", {
        authData: payload,
      });
    }

    // Expired password
    if (auth.actionRequested === "changePasswordDialog") {
      throw new ClasseVivaAuthError(
        "Password has expired and must be updated on the official ClasseViva portal.",
        { isPasswordExpired: true, authData: auth }
      );
    }

    // Multiple accounts match (SAM mode)
    if (auth.verified && !auth.loggedIn) {
      throw new ClasseVivaMultiAccountError(
        "Multiple accounts match these credentials. Please select one using client.chooseAccount(accountUid).",
        auth.hints || [],
        auth
      );
    }

    // Login successful
    if (auth.loggedIn) {
      this.accountInfo = auth.accountInfo;
      if (auth.accountInfo?.id) {
        this.studentId = String(auth.accountInfo.id);
      }
      return payload;
    }

    // Failed login
    const errorDetails = Array.isArray(auth.errors) && auth.errors.length > 0
      ? auth.errors.join("; ")
      : "Invalid credentials or unauthorized login.";

    throw new ClasseVivaAuthError(`Login failed: ${errorDetails}`, { authData: auth });
  }

  /**
   * When credentials match multiple accounts, complete the login by choosing an account UID.
   */
  async chooseAccount(accountUid: string): Promise<LoginResponse> {
    const params = new URLSearchParams({ uid: accountUid });
    const url = `${this.authUrl}?a=aLoginSam`;

    const response = await this.customFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent,
        Accept: "application/json, text/plain, */*",
        Cookie: this.cookieJar.toCookieHeader(),
      },
      body: params.toString(),
    });

    this.cookieJar.collectFromResponse(response);

    if (!response.ok) {
      throw new ClasseVivaApiError(
        `SAM account selection HTTP error: ${response.status} ${response.statusText}`,
        response.status,
        url
      );
    }

    const payload = (await response.json()) as LoginResponse;
    const auth = payload?.data?.auth;

    if (auth?.loggedIn) {
      this.accountInfo = auth.accountInfo;
      if (auth.accountInfo?.id) {
        this.studentId = String(auth.accountInfo.id);
      }
      return payload;
    }

    throw new ClasseVivaAuthError("Failed to select account in SAM mode.", { authData: auth });
  }

  /**
   * Generic request method for ClasseViva REST API endpoints.
   */
  async request<T = unknown>(
    path: string,
    options: RequestInit & { requiresAuth?: boolean; customBaseUrl?: string } = {}
  ): Promise<T> {
    const requiresAuth = options.requiresAuth ?? true;

    if (requiresAuth && !this.cookieJar.hasAuthCookies()) {
      if (this.username && this.password) {
        await this.login();
      } else {
        throw new ClasseVivaSessionExpiredError(
          "Not authenticated. Please call login() before making API requests."
        );
      }
    }

    const base = options.customBaseUrl ?? this.baseUrl;
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : joinUrl(base, path);

    const headers = new Headers(options.headers || {});
    headers.set("User-Agent", this.userAgent);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json, text/plain, */*");
    }

    const cookieHeader = this.cookieJar.toCookieHeader();
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await this.customFetch(url, {
      ...options,
      headers,
    });

    this.cookieJar.collectFromResponse(response);

    if (response.status === 401) {
      throw new ClasseVivaSessionExpiredError();
    }

    if (!response.ok) {
      let bodyText: unknown;
      try {
        bodyText = await response.json();
      } catch {
        try {
          bodyText = await response.text();
        } catch {
          bodyText = null;
        }
      }
      throw new ClasseVivaApiError(
        `Request to ${url} failed with status ${response.status} (${response.statusText})`,
        response.status,
        url,
        bodyText
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  /**
   * Performs a request that returns binary data (e.g. PDF documents, attachments).
   */
  async requestBinary(
    path: string,
    options: RequestInit & { requiresAuth?: boolean; customBaseUrl?: string } = {}
  ): Promise<ArrayBuffer> {
    const requiresAuth = options.requiresAuth ?? true;

    if (requiresAuth && !this.cookieJar.hasAuthCookies()) {
      if (this.username && this.password) {
        await this.login();
      } else {
        throw new ClasseVivaSessionExpiredError();
      }
    }

    const base = options.customBaseUrl ?? this.baseUrl;
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : joinUrl(base, path);

    const headers = new Headers(options.headers || {});
    headers.set("User-Agent", this.userAgent);
    const cookieHeader = this.cookieJar.toCookieHeader();
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await this.customFetch(url, {
      ...options,
      headers,
    });

    this.cookieJar.collectFromResponse(response);

    if (response.status === 401) {
      throw new ClasseVivaSessionExpiredError();
    }

    if (!response.ok) {
      throw new ClasseVivaApiError(
        `Binary request to ${url} failed with status ${response.status}`,
        response.status,
        url
      );
    }

    return await response.arrayBuffer();
  }

  /**
   * Helper to resolve the target student ID: argument > client default > error.
   * If unauthenticated but credentials exist, automatically performs login first.
   */
  private async resolveStudentId(studentId?: string | number): Promise<string> {
    if (studentId !== undefined && studentId !== null && String(studentId).trim()) {
      return String(studentId).trim();
    }
    if (!this.studentId && this.username && this.password && !this.cookieJar.hasAuthCookies()) {
      await this.login();
    }
    if (this.studentId) {
      return this.studentId;
    }
    throw new ClasseVivaError(
      "Student ID is required. Please call login() first or explicitly pass a studentId parameter."
    );
  }

  // ==========================================
  // User Info & Profile
  // ==========================================

  /**
   * Get current authenticated user details.
   * `GET /rest/w1/misc/whoami`
   */
  async getWhoAmI(): Promise<UserInfo> {
    const info = await this.request<UserInfo>("misc/whoami");
    if (info?.id && !this.studentId) {
      this.studentId = String(info.id);
    }
    return info;
  }

  /**
   * Get student card information (school info, fiscal code, etc.).
   * `GET /rest/w1/students/{studentId}/card`
   */
  async getCard(studentId?: string | number): Promise<StudentCardResponse> {
    const id = await this.resolveStudentId(studentId);
    const res = await this.request<StudentCardResponse>(`students/${id}/card`);
    if (res?.card) {
      res.card.schName = trimSafe(res.card.schName);
      res.card.schDedication = trimSafe(res.card.schDedication);
    }
    return res;
  }

  /**
   * Get school-enabled sections and UI options.
   * `GET /rest/w1/students/{studentId}/_functions`
   */
  async getFunctions(studentId?: string | number): Promise<FunctionsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<FunctionsResponse>(`students/${id}/_functions`);
  }

  /**
   * Get school periods (e.g. Q1, Q3 / 1° Quadrimestre, 2° Quadrimestre).
   * `GET /rest/w1/students/{studentId}/periods`
   */
  async getPeriods(studentId?: string | number): Promise<PeriodsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<PeriodsResponse>(`students/${id}/periods`);
  }

  /**
   * Get accounts linked to the current login portfolio.
   * `GET /rest/w1/xauth/myportfolio`
   */
  async getPortfolio(): Promise<PortfolioResponse> {
    return await this.request<PortfolioResponse>("xauth/myportfolio");
  }

  /**
   * Connect an account to the portfolio.
   * `POST /rest/w1/xauth/connect`
   */
  async portfolioConnect(data: Record<string, unknown>): Promise<unknown> {
    return await this.request("xauth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  /**
   * Disconnect an account from the portfolio.
   * `POST /rest/w1/xauth/disconnect`
   */
  async portfolioDisconnect(data: Record<string, unknown>): Promise<unknown> {
    return await this.request("xauth/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  /**
   * Change password via portfolio endpoint.
   * `POST /rest/w1/xauth/changepassword`
   */
  async portfolioChangePassword(data: Record<string, unknown>): Promise<unknown> {
    return await this.request("xauth/changepassword", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // Dashboard & Daily Overview
  // ==========================================

  /**
   * Fetch everything needed for the student dashboard in a single call.
   * `GET /rest/w1/students/{studentId}/dashboard`
   */
  async getDashboard(studentId?: string | number): Promise<DashboardResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<DashboardResponse>(`students/${id}/dashboard`);
  }

  /**
   * Returns lessons, agenda, homework, and notes for a date range (defaults to a single day if dateTo is omitted).
   * `GET /rest/w1/students/{studentId}/overview/all26/{dateFrom}/{dateTo}`
   */
  async getDailyOverview(
    dateFrom: DateInput,
    dateTo: DateInput = dateFrom,
    studentId?: string | number
  ): Promise<DailyOverviewResponse> {
    const id = await this.resolveStudentId(studentId);
    const from = formatDateParam(dateFrom);
    const to = formatDateParam(dateTo);
    return await this.request<DailyOverviewResponse>(`students/${id}/overview/all26/${from}/${to}`);
  }

  // ==========================================
  // Subjects
  // ==========================================

  /**
   * Get all enrolled subjects and their assigned teachers.
   * `GET /rest/w1/students/{studentId}/subjects`
   */
  async getSubjects(studentId?: string | number): Promise<SubjectsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<SubjectsResponse>(`students/${id}/subjects`);
  }

  // ==========================================
  // Grades & Averages
  // ==========================================

  /**
   * Get all grades for the current school year.
   * `GET /rest/w1/students/{studentId}/grades26`
   */
  async getGrades(studentId?: string | number): Promise<GradesResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<GradesResponse>(`students/${id}/grades26`);
  }

  /**
   * Get global average and all per-subject averages.
   * `GET /rest/w1/students/{studentId}/avg/`
   */
  async getAverages(studentId?: string | number): Promise<AveragesResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<AveragesResponse>(`students/${id}/avg/`);
  }

  /**
   * Get average for a specific subject ID.
   * `GET /rest/w1/students/{studentId}/avg/{subjectId}`
   */
  async getSubjectAverage(
    subjectId: number | string,
    studentId?: string | number
  ): Promise<{ subjectAverage: SubjectAverage } | SubjectAverage | AveragesResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/avg/${subjectId}`);
  }

  // ==========================================
  // Absences & Justifications
  // ==========================================

  /**
   * Get all absences, delays, and early exits, optionally filtered by date range.
   * `GET /rest/w1/students/{studentId}/absences/details/[dateFrom/dateTo]`
   */
  async getAbsences(
    options?: {
      dateFrom?: DateInput;
      dateTo?: DateInput;
      studentId?: string | number;
    }
  ): Promise<AbsencesResponse> {
    const id = await this.resolveStudentId(options?.studentId);
    if (options?.dateFrom && options?.dateTo) {
      const from = formatDateParam(options.dateFrom);
      const to = formatDateParam(options.dateTo);
      return await this.request<AbsencesResponse>(`students/${id}/absences/details/${from}/${to}`);
    }
    return await this.request<AbsencesResponse>(`students/${id}/absences/details/`);
  }

  /**
   * Get online absence booklet configuration (allowed justification types, causals, etc.).
   * `GET /rest/w1/students/{studentId}/absences/librettowebconf`
   */
  async getLibrettoWebConfig(studentId?: string | number): Promise<LibrettoWebConfig> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<LibrettoWebConfig>(`students/${id}/absences/librettowebconf`);
  }

  /**
   * Get online absence justifications.
   * `GET /rest/w1/students/{studentId}/absences/librettoweb`
   */
  async getLibrettoWeb(studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/absences/librettoweb`);
  }

  /**
   * Submit an online absence justification.
   * `POST /rest/w1/students/{studentId}/absences/librettoweb`
   */
  async justifyAbsence(data: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/absences/librettoweb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete an online absence justification by ID.
   * `DELETE /rest/w1/students/{studentId}/absences/librettoweb/{justificationId}`
   */
  async deleteJustification(justificationId: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/absences/librettoweb/${justificationId}`, {
      method: "DELETE",
    });
  }

  // ==========================================
  // Agenda
  // ==========================================

  /**
   * Get agenda events (homework assignments, tests, reminders) in the given date range.
   * `GET /rest/w1/students/{studentId}/agendav2/{evtCode}/{dateFrom}/{dateTo}`
   */
  async getAgenda(
    dateFrom: DateInput,
    dateTo: DateInput,
    options?: {
      evtCode?: "all" | "AGNT" | "AGHW" | "AGCR" | string;
      studentId?: string | number;
    }
  ): Promise<AgendaResponse> {
    const id = await this.resolveStudentId(options?.studentId);
    const from = formatDateParam(dateFrom);
    const to = formatDateParam(dateTo);
    const code = options?.evtCode || "all";
    return await this.request<AgendaResponse>(`students/${id}/agendav2/${code}/${from}/${to}`);
  }

  // ==========================================
  // Lessons
  // ==========================================

  /**
   * Get lesson log entries for a date range.
   * `GET /rest/w1/students/{studentId}/lessons/{dateFrom}/{dateTo}`
   */
  async getLessons(
    dateFrom: DateInput,
    dateTo: DateInput,
    studentId?: string | number
  ): Promise<LessonsResponse> {
    const id = await this.resolveStudentId(studentId);
    const from = formatDateParam(dateFrom);
    const to = formatDateParam(dateTo);
    return await this.request<LessonsResponse>(`students/${id}/lessons/${from}/${to}`);
  }

  /**
   * Get lesson log entries for a specific date.
   * `GET /rest/w1/students/{studentId}/lessons/{date}`
   */
  async getLessonsForDate(date: DateInput, studentId?: string | number): Promise<LessonsResponse> {
    const id = await this.resolveStudentId(studentId);
    const formatted = formatDateParam(date);
    return await this.request<LessonsResponse>(`students/${id}/lessons/${formatted}`);
  }

  /**
   * Get lesson log entries for today.
   * `GET /rest/w1/students/{studentId}/lessons/today`
   */
  async getLessonsToday(studentId?: string | number): Promise<LessonsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<LessonsResponse>(`students/${id}/lessons/today`);
  }

  /**
   * Get lesson log entries for a specific subject within a date range.
   * `GET /rest/w1/students/{studentId}/lessons/subject/{subjectId}/{dateFrom}/{dateTo}`
   */
  async getLessonsBySubject(
    subjectId: number | string,
    dateFrom: DateInput,
    dateTo: DateInput,
    studentId?: string | number
  ): Promise<LessonsResponse> {
    const id = await this.resolveStudentId(studentId);
    const from = formatDateParam(dateFrom);
    const to = formatDateParam(dateTo);
    return await this.request<LessonsResponse>(
      `students/${id}/lessons/subject/${subjectId}/${from}/${to}`
    );
  }

  // ==========================================
  // Noticeboard (Circolari)
  // ==========================================

  /**
   * Get circular notices and noticeboard items.
   * `GET /rest/w1/students/{studentId}/noticeboard`
   */
  async getNotices(studentId?: string | number): Promise<NoticeboardResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<NoticeboardResponse>(`students/${id}/noticeboard`);
  }

  /**
   * Read notice content and mark it as read.
   * `POST /rest/w1/students/{studentId}/noticeboard/read/{evtCode}/{pubId}/101`
   */
  async readNotice(
    evtCode: string,
    pubId: number | string,
    replyBody?: Record<string, unknown>,
    studentId?: string | number
  ): Promise<NoticeReadResponse> {
    const id = await this.resolveStudentId(studentId);
    const isJsonReply = Boolean(replyBody);
    return await this.request<NoticeReadResponse>(
      `students/${id}/noticeboard/read/${evtCode}/${pubId}/101`,
      {
        method: "POST",
        headers: isJsonReply
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/x-www-form-urlencoded" },
        body: isJsonReply ? JSON.stringify(replyBody) : "",
      }
    );
  }

  /**
   * Read multiple notices / reply.
   * `POST /rest/w1/students/{studentId}/noticeboard/readmulti/{evtCode}/{pubId}/101`
   */
  async readNoticeMulti(
    evtCode: string,
    pubId: number | string,
    replyBody?: Record<string, unknown>,
    studentId?: string | number
  ): Promise<NoticeReadResponse> {
    const id = await this.resolveStudentId(studentId);
    const isJsonReply = Boolean(replyBody);
    return await this.request<NoticeReadResponse>(
      `students/${id}/noticeboard/readmulti/${evtCode}/${pubId}/101`,
      {
        method: "POST",
        headers: isJsonReply
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/x-www-form-urlencoded" },
        body: isJsonReply ? JSON.stringify(replyBody) : "",
      }
    );
  }

  /**
   * Resolves the download URL for a notice attachment (handles 302 redirect to CDN).
   */
  async getNoticeAttachmentUrl(
    evtCode: string,
    pubId: number | string,
    attachNum: number | string,
    studentId?: string | number
  ): Promise<string> {
    const id = await this.resolveStudentId(studentId);
    const path = `students/${id}/noticeboard/attach/${evtCode}/${pubId}/${attachNum}`;
    const url = joinUrl(this.baseUrl, path);

    const response = await this.customFetch(url, {
      method: "GET",
      headers: {
        "User-Agent": this.userAgent,
        Cookie: this.cookieJar.toCookieHeader(),
      },
      redirect: "manual",
    });

    this.cookieJar.collectFromResponse(response);

    const location = response.headers.get("location");
    if (location) {
      return location;
    }

    if (response.ok) {
      return response.url || url;
    }

    throw new ClasseVivaApiError(
      `Failed to get attachment URL (HTTP ${response.status})`,
      response.status,
      url
    );
  }

  /**
   * Download a notice attachment file as ArrayBuffer.
   */
  async downloadNoticeAttachment(
    evtCode: string,
    pubId: number | string,
    attachNum: number | string,
    studentId?: string | number
  ): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    const path = `students/${id}/noticeboard/attach/${evtCode}/${pubId}/${attachNum}`;
    return await this.requestBinary(path);
  }

  // ==========================================
  // Communications
  // ==========================================

  /**
   * Get student communications.
   * `GET /rest/w1/noticeboarduser/{studentId}/communications`
   */
  async getCommunications(studentId?: string | number): Promise<CommunicationsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<CommunicationsResponse>(`noticeboarduser/${id}/communications`);
  }

  /**
   * Get ministerial communications.
   * `GET /rest/w1/noticeboarduser/{studentId}/communications_minister`
   */
  async getMinisterialCommunications(studentId?: string | number): Promise<CommunicationsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<CommunicationsResponse>(`noticeboarduser/${id}/communications_minister`);
  }

  async getCommunicationAttachment(a: string, b: string, c: string, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`noticeboarduser/${id}/attachments/${a}/${b}/${c}`);
  }

  async replyCommunication(a: string, b: string, data: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`noticeboarduser/${id}/response/${a}/${b}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async uploadCommunicationFile(a: string, b: string, body: BodyInit, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`noticeboarduser/${id}/file_response/${a}/${b}`, {
      method: "POST",
      body,
    });
  }

  async deleteCommunicationFileResponse(a: string, b: string, c: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`noticeboarduser/${id}/file_response/${a}/${b}/${c}`, {
      method: "DELETE",
    });
  }

  async getCommunicationSignature(a: string, b: string, c: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`noticeboarduser/${id}/signature/${a}/${b}/${c}`);
  }

  async signCommunication(a: string, b: string, c: string, d: string, data?: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`noticeboarduser/${id}/signature/${a}/${b}/${c}/${d}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : "",
    });
  }

  async setCommunicationSigner(a: string, b: string, data?: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`noticeboarduser/${id}/communication/${a}/${b}/signer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : "",
    });
  }

  // ==========================================
  // Didactics (Materials)
  // ==========================================

  /**
   * Get teaching materials organized in folders.
   * `GET /rest/w1/students/{studentId}/didactics`
   */
  async getDidactics(studentId?: string | number): Promise<DidacticsResponse> {
    const id = await this.resolveStudentId(studentId);
    const res = await this.request<DidacticsResponse>(`students/${id}/didactics`);
    // Provide didactics alias if API only returns misspelled "didacticts"
    if (res && res.didacticts && !res.didactics) {
      res.didactics = res.didacticts;
    }
    return res;
  }

  /**
   * Download a didactic item file.
   * `GET /rest/w1/students/{studentId}/didactics/item/{id}`
   */
  async downloadDidacticItem(itemId: string | number, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`students/${id}/didactics/item/${itemId}`);
  }

  // ==========================================
  // Homeworks
  // ==========================================

  /**
   * Get homework assignments list and statuses.
   * `GET /rest/w1/students/{studentId}/homeworks/index`
   */
  async getHomeworks(studentId?: string | number): Promise<HomeworksResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<HomeworksResponse>(`students/${id}/homeworks/index`);
  }

  async downloadHomeworkTeacherFile(a: string | number, b: string | number, c: string | number, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`students/${id}/homeworks/downloadTeacherFile/${a}/${b}/${c}`);
  }

  async downloadHomeworkStudentFile(a: string | number, b: string | number, c: string | number, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`students/${id}/homeworks/downloadStudentFile/${a}/${b}/${c}`);
  }

  async insertHomeworkStudentMessage(a: string | number, b: string | number, message: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/homeworks/insertStudentMsg/${a}/${b}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }

  async uploadHomeworkStudentFile(a: string | number, b: string | number, fileBody: BodyInit, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/homeworks/uploadStudentFile/${a}/${b}`, {
      method: "POST",
      body: fileBody,
    });
  }

  async removeHomeworkStudentFile(a: string | number, b: string | number, c: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/homeworks/removeStudentFile/${a}/${b}/${c}`, {
      method: "POST",
    });
  }

  async setHomeworkTeacherMessageStatus(a: string | number, b: string | number, status: unknown, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/homeworks/setTeacherMsgStatus/${a}/${b}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(status),
    });
  }

  // ==========================================
  // Notes (Note Disciplinari)
  // ==========================================

  /**
   * Get disciplinary notes categorized by type (NTTE, NTCL, NTWN, NTST).
   * `GET /rest/w1/students/{studentId}/notes/all/`
   */
  async getNotes(studentId?: string | number): Promise<NotesResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<NotesResponse>(`students/${id}/notes/all/`);
  }

  /**
   * Mark a disciplinary note as read.
   * `POST /rest/w1/students/{studentId}/notes/{type}/read/{id}`
   */
  async markNoteAsRead(
    type: "NTTE" | "NTCL" | "NTWN" | "NTST" | string,
    noteId: string | number,
    studentId?: string | number
  ): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/notes/${type}/read/${noteId}`, {
      method: "POST",
    });
  }

  // ==========================================
  // Documents & School Reports (Scrutini)
  // ==========================================

  /**
   * Get documents and school reports (scrutini).
   * `POST /rest/w1/students/{studentId}/documents`
   */
  async getDocuments(studentId?: string | number): Promise<DocumentsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<DocumentsResponse>(`students/${id}/documents`, {
      method: "POST",
    });
  }

  /**
   * Check a document by hash.
   * `POST /rest/w1/students/{studentId}/documents/check/{hash}`
   */
  async checkDocument(hash: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/documents/check/${hash}`, {
      method: "POST",
    });
  }

  /**
   * Read or download a document by hash (returns binary file).
   * `POST /rest/w1/students/{studentId}/documents/read/{hash}`
   */
  async readDocument(hash: string, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`students/${id}/documents/read/${hash}`, {
      method: "POST",
    });
  }

  // ==========================================
  // Talks (Colloqui con docenti)
  // ==========================================

  /**
   * Get list of teachers available for parent-teacher talks.
   * `GET /rest/w1/parents/{studentId}/talks/teachers`
   */
  async getTalkTeachers(studentId?: string | number): Promise<TalkTeachersResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<TalkTeachersResponse>(`parents/${id}/talks/teachers`);
  }

  /**
   * Get talk frames / slots for a teacher in a date range.
   * `GET /rest/w1/parents/{studentId}/talks/getframes/{teacherId}/{dateFrom}/{dateTo}`
   */
  async getTalkFrames(
    teacherId: number | string,
    dateFrom: DateInput,
    dateTo: DateInput,
    studentId?: string | number
  ): Promise<TalkFramesResponse> {
    const id = await this.resolveStudentId(studentId);
    const from = formatDateParam(dateFrom);
    const to = formatDateParam(dateTo);
    return await this.request<TalkFramesResponse>(
      `parents/${id}/talks/getframes/${teacherId}/${from}/${to}`
    );
  }

  /**
   * Get booked talks (optionally filtered by date range).
   * `GET /rest/w1/parents/{studentId}/talks/mytalks`
   */
  async getMyTalks(
    options?: {
      dateFrom?: DateInput;
      dateTo?: DateInput;
      studentId?: string | number;
    }
  ): Promise<MyTalksResponse> {
    const id = await this.resolveStudentId(options?.studentId);
    if (options?.dateFrom && options?.dateTo) {
      const from = formatDateParam(options.dateFrom);
      const to = formatDateParam(options.dateTo);
      return await this.request<MyTalksResponse>(`parents/${id}/talks/mytalks/${from}/${to}`);
    }
    return await this.request<MyTalksResponse>(`parents/${id}/talks/mytalks`);
  }

  /**
   * Get list of overall talks.
   * `GET /rest/w1/parents/{studentId}/overalltalks/list`
   */
  async getOverallTalks(studentId?: string | number): Promise<OverallTalksResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<OverallTalksResponse>(`parents/${id}/overalltalks/list`);
  }

  async getTalkTeachersFrames2(dateFrom: DateInput, dateTo: DateInput, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    const from = formatDateParam(dateFrom);
    const to = formatDateParam(dateTo);
    return await this.request(`parents/${id}/talks/teachersframes2/${from}/${to}`);
  }

  async bookTalk(a: string | number, b: string | number, c: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/talks/book/${a}/${b}/${c}`, { method: "POST" });
  }

  async deleteTalk(talkId: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/talks/delete/${talkId}`, { method: "POST" });
  }

  async sendTalkMyMessage(talkId: string | number, message: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/talks/mymessage/${talkId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }

  async sendTalkTeacherMessage(talkId: string | number, message: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/talks/teachermessage/${talkId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }

  async getOverallTalkFrames(a: string | number, b: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/overalltalks/getframes/${a}/${b}`);
  }

  async bookOverallTalk(a: string | number, b: string | number, c: string | number, d: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/overalltalks/book/${a}/${b}/${c}/${d}`, { method: "POST" });
  }

  async deleteOverallTalk(a: string | number, b: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/overalltalks/delete/${a}/${b}`, { method: "POST" });
  }

  // ==========================================
  // Payments (PagoOnline)
  // ==========================================

  /**
   * Get PagoOnline school payments and status.
   * `GET /rest/w1/parents/{studentId}/pagoonline/payments`
   */
  async getPayments(studentId?: string | number): Promise<PaymentsResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<PaymentsResponse>(`parents/${id}/pagoonline/payments`);
  }

  async downloadPaymentFile(fileId: string | number, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`parents/${id}/pagoonline/downloadfile/${fileId}`);
  }

  async downloadPayment(a: string | number, b: string | number, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`parents/${id}/pagoonline/downloadpayment/${a}/${b}`);
  }

  async getPaymentPrivacy(studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/pagoonline/getprivacy`);
  }

  async setPaymentPrivacy(body: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`parents/${id}/pagoonline/setprivacy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async downloadPaymentFilePrivacy(fileId: string | number, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`parents/${id}/pagoonline/downloadfileprivacy/${fileId}`, {
      method: "POST",
    });
  }

  // ==========================================
  // Schoolbooks
  // ==========================================

  /**
   * Get adopted school textbooks for the student's class and course.
   * `GET /rest/w1/students/{studentId}/schoolbooks/index`
   */
  async getSchoolbooks(studentId?: string | number): Promise<SchoolbooksResponse> {
    const id = await this.resolveStudentId(studentId);
    return await this.request<SchoolbooksResponse>(`students/${id}/schoolbooks/index`);
  }

  // ==========================================
  // Recoveries & Feedback
  // ==========================================

  /**
   * Get student recoveries list.
   * `GET /rest/w1/students/{studentId}/recoveries/list/{a}`
   */
  async getRecoveries(a: string | number, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/recoveries/list/${a}`);
  }

  /**
   * Submit UI feedback.
   */
  async sendNewUiFeedback(data: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`students/${id}/newui-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // Canteen (Mensa)
  // ==========================================

  async getCanteenOptions(meal = "pranzo", studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/options/${meal}`);
  }

  async getCanteenEvents(a: string, b: string, c: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/events/${a}/${b}/${c}`);
  }

  async bookCanteenEvent(a: string, b: string, body?: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/events/${a}/${b}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "",
    });
  }

  async getCanteenBookingState(a: string, b: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/booking_state/${a}/${b}`);
  }

  async getCanteenProfile(meal = "pranzo", studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/profile/${meal}`);
  }

  async getCanteenMenu(meal = "pranzo", studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/menu/${meal}`);
  }

  async getCanteenSummaryMeals(meal = "pranzo", studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/summary_meals/${meal}`);
  }

  async getCanteenWallet(studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`canteenuser/${id}/wallet`);
  }

  async getCanteenFileMenu(a: string, b: string, c: string, d: string, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`canteenuser/${id}/file_menu/${a}/${b}/${c}/${d}`);
  }

  async downloadCanteenFile(a: string, b: string, studentId?: string | number): Promise<ArrayBuffer> {
    const id = await this.resolveStudentId(studentId);
    return await this.requestBinary(`canteenuser/${id}/download_file/${a}/${b}`);
  }

  // ==========================================
  // Roll Call (Appello)
  // ==========================================

  async getRollCallOptions(a: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/options/${a}`);
  }

  async getRollCallEvents(a: string, b: string, c: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/events/${a}/${b}/${c}`);
  }

  async createRollCallEvent(a: string, body: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/events/${a}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async updateRollCallEvent(a: string, b: string, body: Record<string, unknown>, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/events/${a}/${b}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async deleteRollCallEvent(a: string, b: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/events/${a}/${b}`, {
      method: "DELETE",
    });
  }

  async getRollCallBookingState(a: string, b: string, studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/booking_state/${a}/${b}`);
  }

  async getRollCallAssets(asset = "SPA1", studentId?: string | number): Promise<unknown> {
    const id = await this.resolveStudentId(studentId);
    return await this.request(`rollcall/${id}/assets/${asset}`);
  }
}
