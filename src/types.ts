export type DateInput = Date | string | number;

export interface ClasseVivaClientOptions {
  /**
   * ClasseViva username. Defaults to CLASSEVIVA_USERNAME or CV_USERNAME in .env/process.env.
   */
  username?: string;

  /**
   * ClasseViva password. Defaults to CLASSEVIVA_PASSWORD or CV_PASSWORD in .env/process.env.
   */
  password?: string;

  /**
   * School code (cid) if applicable. Defaults to CLASSEVIVA_SCHOOL_CODE / CV_CID in .env/process.env.
   */
  schoolCode?: string;

  /**
   * Security PIN if enabled on account. Defaults to CLASSEVIVA_PIN in .env/process.env.
   */
  pin?: string;

  /**
   * Target parameter if applicable. Defaults to CLASSEVIVA_TARGET in .env/process.env.
   */
  target?: string;

  /**
   * Base URL for the ClasseViva REST API.
   * Default: "https://web.spaggiari.eu/rest/w1"
   */
  baseUrl?: string;

  /**
   * URL for the authentication endpoint.
   * Default: "https://web.spaggiari.eu/auth-p7/app/default/AuthApi4.php"
   */
  authUrl?: string;

  /**
   * Base URL for document downloads.
   * Default: "https://cdndoc.spaggiari.eu"
   */
  cdnUrl?: string;

  /**
   * Automatically load variables from a .env file if present.
   * Default: true
   */
  autoLoadEnv?: boolean;

  /**
   * Path to the .env file.
   * Default: ".env" in current working directory
   */
  envPath?: string;

  /**
   * Custom fetch implementation to use (e.g. for proxies, logging, testing).
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Pre-existing session ID (PHPSESSID) or initial cookies to resume a session.
   */
  sessionId?: string;

  /**
   * Initial cookies map to resume a session.
   */
  cookies?: Record<string, string>;

  /**
   * Pre-set default student ID to avoid passing it on every method call.
   */
  studentId?: string | number;

  /**
   * User-Agent header sent with requests.
   */
  userAgent?: string;
}

export interface LoginCredentials {
  /**
   * ClasseViva username.
   */
  username?: string;

  /**
   * ClasseViva password.
   */
  password?: string;

  /**
   * School code (cid) if applicable.
   */
  schoolCode?: string;

  /**
   * Security PIN if enabled on account.
   */
  pin?: string;

  /**
   * Target parameter if applicable.
   */
  target?: string;
}

export interface AccountInfo {
  type: string;
  id: number;
  cognome: string;
  nome: string;
  cid: string;
  [key: string]: unknown;
}

export interface AuthDetails {
  verified: boolean;
  loggedIn: boolean;
  actionRequested: boolean | string;
  hints: unknown[];
  errors: unknown[];
  accountInfo: AccountInfo;
  redirects: unknown[];
  aMode: string;
  mMode: string;
  errCod: unknown[];
  [key: string]: unknown;
}

export interface LoginResponse {
  time: string;
  data: {
    auth: AuthDetails;
    pfolio: boolean;
    [key: string]: unknown;
  };
  error: unknown[];
  api: {
    env: string;
    AuthSpa: {
      version: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface UserInfo {
  id: string;
  account_type: string;
  sede_codice: string;
  anno_scol: string;
  cognome: string;
  nome: string;
  classe_ident: string;
  classe_desc: string;
  data_nascita: string;
  codice_fisc: string;
  login_type: string | null;
  last_login_at: string | null;
  email: string;
  schoolpass: string;
  [key: string]: unknown;
}

export interface FunctionItem {
  title: string;
  desc?: string;
  type: string;
  url: string | null;
  options: Record<string, unknown> | unknown[];
  readonly: boolean;
}

export interface FunctionsResponse {
  functions: Record<string, FunctionItem>;
  appEnabled: string[];
}

export interface PeriodItem {
  periodCode: string;
  periodPos: number;
  periodDesc: string;
  periodLabel: string;
  isFinal: boolean;
  dateStart: string;
  dateEnd: string;
  miurDivisionCode: string | null;
}

export interface PeriodsResponse {
  periods: PeriodItem[];
}

export interface StudentCard {
  ident: string;
  usrType: string;
  usrId: number;
  miurSchoolCode: string;
  miurDivisionCode: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  fiscalCode: string;
  schCode: string;
  schName: string;
  schDedication: string;
  schCity: string;
  schProv: string;
  [key: string]: unknown;
}

export interface StudentCardResponse {
  card: StudentCard;
}

export interface PortfolioMaster {
  id: number;
  masterId: number | null;
  authType: string;
  authString: string;
  authDesc: string;
  emlFlags: number;
  passChanged: string;
  passRemindExpire: string | null;
  validationNeeded: boolean;
  validationExpire: string | null;
  insertDT: string;
}

export interface PortfolioItem {
  id: number;
  target: string;
  cid: string;
  ident: string;
  userType: string;
  userId: number;
  description: string;
  spsPrivacyFlags: number;
  insertDT: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    birthDate: string;
    fiscalCode: string;
    classDesc: string;
    schoolYY: number;
    [key: string]: unknown;
  };
}

export interface PortfolioResponse {
  currentIdent: string;
  portfolio: {
    master: PortfolioMaster;
    items: PortfolioItem[];
  };
}

export interface GradeItem {
  subjectId: number;
  subjectCode: string | null;
  subjectDesc: string;
  evtId: number;
  evtCode: string;
  evtDate: string;
  decimalValue: number | null;
  displayValue: string;
  displaPos?: number;
  notesForFamily: string;
  color: "green" | "yellow" | "red" | "orange" | string;
  canceled: boolean;
  underlined: boolean;
  periodPos: number;
  periodDesc: string;
  periodLabel: string;
  componentPos: number;
  componentDesc: string;
  weightFactor: number;
  noAverage: boolean;
  teacherName: string;
  evtPosition: string;
  [key: string]: unknown;
}

export interface GradesResponse {
  grades: GradeItem[];
}

export interface PeriodAverage {
  periodPos: number;
  periodDesc: string;
  periodLabel: string;
  average: number | null;
  color: string;
  gradeCount?: number;
  subjectCount?: number;
}

export interface SubjectAverage {
  subjectId: number;
  subjectCode: string | null;
  subjectDesc: string;
  periodAverages: Record<string, PeriodAverage> | PeriodAverage[];
  globalAverage: PeriodAverage;
}

export interface AveragesResponse {
  subjectAverages: Record<string, SubjectAverage>;
  generalAverages: Record<string, PeriodAverage>;
}

export interface SubjectTeacher {
  teacherId: string;
  teacherName: string;
}

export interface SubjectItem {
  id: number;
  description: string;
  order: number;
  teachers: SubjectTeacher[];
}

export interface SubjectsResponse {
  subjects: SubjectItem[];
}

export interface AbsenceItem {
  evtId: number;
  evtCode: "ABA0" | "ABR0" | "ABR1" | "ABU0" | string;
  evtDate: string;
  evtHPos: number | null;
  evtValue: unknown | null;
  isJustified: boolean;
  justifReasonCode: string | null;
  justifReasonDesc: string | null;
  hoursAbsence: unknown[];
  webJustifStatus: number | null;
  [key: string]: unknown;
}

export interface AbsencesResponse {
  events: AbsenceItem[];
}

export interface AbsenceCausal {
  code: string;
  usercode: string;
  shortdesc: string;
  longdesc: string;
}

export interface LibrettoWebConfig {
  enableJustA: boolean;
  enableJustR: boolean;
  enableJustU: boolean;
  numDaysStopA: number;
  numDaysStopR: number;
  numDaysStopU: number;
  otherInfo: unknown[];
  causals: AbsenceCausal[];
  [key: string]: unknown;
}

export interface AgendaItem {
  evtId: number;
  evtCode: "AGNT" | "AGHW" | "AGCR" | string;
  evtDatetimeBegin: string;
  evtDatetimeEnd: string;
  isFullDay: boolean;
  notes: string;
  authorName: string;
  classDesc: string;
  subjectId: number | null;
  subjectDesc: string | null;
  homeworkId: number | null;
  [key: string]: unknown;
}

export interface AgendaResponse {
  agenda: AgendaItem[];
}

export interface LessonItem {
  evtId: number;
  evtDate: string;
  evtCode: "LSF0" | "LSC0" | string;
  evtHPos: number;
  evtDuration: number;
  classDesc: string;
  authorName: string;
  subjectId: number;
  subjectCode: string | null;
  subjectDesc: string;
  lessonType: string;
  lessonArg: string;
  [key: string]: unknown;
}

export interface LessonsResponse {
  lessons: LessonItem[];
}

export interface NoticeAttachment {
  fileName: string;
  attachNum: number;
}

export interface NoticeboardItem {
  pubId: number;
  pubDT: string;
  readStatus: boolean;
  evtCode: "CF" | "CF_SDG" | string;
  cntId: number;
  cntValidFrom: string;
  cntValidTo: string;
  cntValidInRange: boolean;
  cntStatus: string;
  cntTitle: string;
  cntNum: string;
  cntCategory: string;
  cntHasChanged: boolean;
  cntHasAttach: boolean;
  needJoin: boolean;
  needReply: boolean;
  needFile: boolean;
  needSign: boolean;
  evento_id: string;
  dinsert_allegato?: string;
  attachments?: NoticeAttachment[];
  [key: string]: unknown;
}

export interface NoticeboardResponse {
  items: NoticeboardItem[];
}

export interface NoticeReadResponse {
  item: {
    title: string;
    text: string;
  };
  reply: {
    replJoin: boolean;
    replText: string | null;
    replFile: string | null;
    replSign: string | null;
  };
}

export interface CommunicationsResponse {
  communications: unknown[];
  [key: string]: unknown;
}

export interface DidacticsContent {
  contentId: number;
  contentName: string;
  objectId: number;
  objectType: "file" | "link" | string;
  shareDT: string;
  [key: string]: unknown;
}

export interface DidacticsFolder {
  folderId: number;
  folderName: string;
  lastShareDT: string;
  contents: DidacticsContent[];
  [key: string]: unknown;
}

export interface DidacticsTeacher {
  teacherId: string;
  teacherName: string;
  teacherFirstName: string;
  teacherLastName: string;
  folders: DidacticsFolder[];
  [key: string]: unknown;
}

export interface DidacticsResponse {
  /**
   * The API returns the misspelled key "didacticts"
   */
  didacticts: DidacticsTeacher[];
  /**
   * Alias for convenience
   */
  didactics?: DidacticsTeacher[];
}

export interface HomeworkItem {
  evtId: number;
  evtCode: string;
  teacherId: number;
  teacherName: string;
  homeworkDesc: string;
  homeworkDone: boolean;
  homeworkMarkedDone: boolean;
  assignmentDate: string;
  assignmentTime: string | null;
  expiryDate: string;
  expiryTime: string | null;
  studentAttachmentsAllowed: boolean;
  subjectId: number;
  subjectDesc: string;
  lastStudentMsg: string | null;
  lastTeacherMsg: string | null;
  newMessages: boolean;
  teacherFiles: unknown[];
  teacherLinks: unknown[];
  studentFiles: unknown[];
  correctedFiles: unknown[];
  [key: string]: unknown;
}

export interface HomeworksResponse {
  items: HomeworkItem[];
}

export interface NotesResponse {
  /**
   * Teacher annotations (annotazioni)
   */
  NTTE: unknown[];
  /**
   * Disciplinary notes (note disciplinari)
   */
  NTCL: unknown[];
  /**
   * Warnings (richiami)
   */
  NTWN: unknown[];
  /**
   * Disciplinary sanctions (sanzioni disciplinari)
   */
  NTST: unknown[];
  [key: string]: unknown;
}

export interface DocumentsResponse {
  documents: unknown[];
  schoolReports: unknown[];
  [key: string]: unknown;
}

export interface TalkSlotRange {
  pos: number;
  time: string;
}

export interface TalkFrame {
  teacherId: number;
  frameId: number;
  frameHPos: number;
  frameDate: string;
  framePlace: string;
  frameTimeRange: string;
  frameTimeFrom: string;
  frameTimeTo: string;
  overallSlots: number;
  busySlotMask: number;
  busySlotFlags: string;
  message: string;
  freeSlotTimeRange: TalkSlotRange[];
  [key: string]: unknown;
}

export interface TalkFramesResponse {
  frames: TalkFrame[];
}

export interface TalkTeacher {
  teacherId: number;
  teacherName: string;
  subjects: Array<{
    subjectId: number;
    description: string;
  }>;
  hasOpenTalks: boolean;
}

export interface TalkTeachersResponse {
  teachers: TalkTeacher[];
}

export interface MyTalksResponse {
  talks: unknown[];
  [key: string]: unknown;
}

export interface OverallTalksResponse {
  overallTalks: unknown[];
  [key: string]: unknown;
}

export interface PaymentPlanItem {
  payId: number;
  amountDue: number;
  deadlineDate: string;
  payExpired: boolean;
  amountPaid: number;
  amountBonus: number;
  payDate: string | null;
  payStatus: number;
  payKey: string | null;
  payIndex: number;
  payFile: boolean;
  scuolapayEnabled: boolean;
  [key: string]: unknown;
}

export interface PaymentItem {
  evtId: number;
  evtType: "POL01" | "POL02" | string;
  schoolYear: number;
  evtDesc: string;
  evtAnn: string;
  payReasonId: number;
  payReasonDesc: string;
  partecipation: boolean;
  cntHasAttach: boolean;
  payPlan: PaymentPlanItem[];
  [key: string]: unknown;
}

export interface PaymentsResponse {
  items: PaymentItem[];
}

export interface SchoolbookItem {
  bookId: number;
  isbnCode: string;
  title: string;
  subheading: string;
  volume: string;
  author: string;
  publisher: string;
  subjectDesc: string;
  price: number;
  toBuy: boolean;
  newAdoption: boolean;
  alreadyOwned: boolean;
  alreadyInUse: boolean;
  recommended: boolean;
  recommendedFor: unknown | null;
  coverUrl: string | null;
  publisherUnlockCode: string;
  [key: string]: unknown;
}

export interface SchoolbooksCourse {
  courseId: number;
  courseDesc: string;
  books: SchoolbookItem[];
}

export interface SchoolbooksResponse {
  schoolbooks: SchoolbooksCourse[];
}

export interface DashboardResponse {
  subjectAverages: Record<string, SubjectAverage>;
  generalAverages: Record<string, PeriodAverage>;
  latestGrades: GradeItem[];
  latestAbsences: AbsenceItem[];
  latestLessons: LessonItem[];
  documents: {
    documents: unknown[];
    schoolReports: unknown[];
  };
  homeworks: HomeworkItem[];
  [key: string]: unknown;
}

export interface DailyOverviewResponse {
  virtualClassesAgenda: unknown[];
  lessons: LessonItem[];
  agenda: AgendaItem[];
  events: unknown[];
  grades: GradeItem[];
  notes: NotesResponse;
  homeworks: HomeworkItem[];
  [key: string]: unknown;
}
