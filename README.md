# classevivapi.js

[![npm version](https://img.shields.io/npm/v/classevivapi.js.svg)](https://www.npmjs.com/package/classevivapi.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/classevivapi.js)](https://nodejs.org)

A modern, production-ready TypeScript/Node.js wrapper for the Italian electronic register **ClasseViva** (Gruppo Spaggiari) Web REST API (`web.spaggiari.eu`).

- ⚡ **Zero Production Dependencies** – Lightweight, leverages Node.js native `fetch` and built-in cookie jar.
- 📦 **Dual Build** – Full support for modern ESM (`import`) and CommonJS (`require`).
- 🛡️ **Fully Typed** – Complete TypeScript types for all models, parameters, endpoints, and responses.
- 🔑 **Flexible Authentication** – Load credentials effortlessly via `.env` or pass them explicitly to `login()`.
- 🔄 **Smart Session & Auto-Login** – Retains session cookies (`PHPSESSID`, `webidentity`, etc.), automatically infers student IDs, and supports SAM multi-account choice.
- 🌐 **Proxy & Cloudflare Worker Support** – Easily override base and CDN endpoints when deploying on proxies or edge environments.

---

## Installation

```bash
npm install classevivapi.js
```

Requirements: **Node.js >= 18.0.0** (native `fetch` support).

---

## Quick Start

### Option A: Using `.env`

Create a `.env` file in the root of your project:

```env
CLASSEVIVA_USERNAME=mario.rossi@example.com
CLASSEVIVA_PASSWORD=my_secure_password
```

Then in your code:

```typescript
import { ClasseVivaClient } from "classevivapi.js";

const client = new ClasseVivaClient();

// Authenticates automatically using credentials from .env
await client.login();

// Or simply call any method directly — it auto-authenticates if needed!
const grades = await client.getGrades();
console.log("Grades:", grades.grades);

const overview = await client.getDailyOverview(new Date());
console.log("Today's lessons & homework:", overview);
```

### Option B: Passing Credentials Manually

```typescript
import { ClasseVivaClient } from "classevivapi.js";

const client = new ClasseVivaClient();

await client.login({
  username: "mario.rossi@example.com",
  password: "my_secure_password",
  schoolCode: "PGXX0000", // Optional school code (cid)
  pin: "1234",            // Optional security PIN
});

const user = await client.getWhoAmI();
console.log(`Logged in as ${user.nome} ${user.cognome} (${user.classe_desc})`);
```

### Option C: Resuming an Existing Session

You can persist the `PHPSESSID` cookie to avoid logging in on every request:

```typescript
const client = new ClasseVivaClient({
  sessionId: "existing_phpsessid_cookie",
  studentId: "12345678", // Numeric student ID
});

const averages = await client.getAverages();
console.log("Averages:", averages);
```

---

## Environment Variables

When `autoLoadEnv: true` (default), the client automatically looks for these variables in your `.env` or `process.env`:

| Variable | Fallback / Aliases | Description |
|---|---|---|
| `CLASSEVIVA_USERNAME` | `CLASSEVIVA_USER`, `CV_USERNAME`, `CV_USER` | Your ClasseViva username or email |
| `CLASSEVIVA_PASSWORD` | `CLASSEVIVA_PASS`, `CV_PASSWORD`, `CV_PASS` | Your ClasseViva password |
| `CLASSEVIVA_SCHOOL_CODE` | `CLASSEVIVA_CID`, `CV_SCHOOL_CODE`, `CV_CID` | School code (cid), optional |
| `CLASSEVIVA_PIN` | `CV_PIN` | Security PIN (if configured) |
| `CLASSEVIVA_TARGET` | `CV_TARGET` | Target parameter, optional |
| `CLASSEVIVA_BASE_URL` | `CV_BASE_URL` | Custom REST API base URL |
| `CLASSEVIVA_AUTH_URL` | `CV_AUTH_URL` | Custom Auth endpoint URL |
| `CLASSEVIVA_CDN_URL` | `CV_CDN_URL` | Custom CDN endpoint URL |

---

## API Reference

All student endpoints automatically use the `studentId` resolved upon login. You can also pass a custom `studentId` as the last parameter to any method.

### Authentication & Account

```typescript
// Login with credentials (or using .env values if omitted)
const loginRes = await client.login({ username?, password?, schoolCode?, pin?, target? });

// Check authentication status
console.log(client.isAuthenticated); // boolean

// Get all active cookies
const cookies = client.getSessionCookies();

// Clear session
client.logout();

// Choose account when credentials match multiple students (SAM mode)
await client.chooseAccount(accountUid);
```

### User Info & Profile

```typescript
// User details (whoami)
const info = await client.getWhoAmI();

// Student card (school details, fiscal code, etc.)
const card = await client.getCard();

// Enabled portal modules and options
const functions = await client.getFunctions();

// Academic periods (e.g. 1° and 2° Quadrimestre)
const periods = await client.getPeriods();

// Multi-account portfolio
const portfolio = await client.getPortfolio();
```

### Dashboard & Daily Overview

```typescript
// Full student dashboard in a single call
const dashboard = await client.getDashboard();

// Daily overview (lessons, homework, agenda, notes)
// Accepts Date instances, 'YYYY-MM-DD', or 'YYYYMMDD' strings
const today = await client.getDailyOverview(new Date());
const range = await client.getDailyOverview("2026-10-01", "2026-10-05");
```

### Subjects & Teachers

```typescript
const subjects = await client.getSubjects();
for (const sub of subjects.subjects) {
  console.log(`${sub.description} - Teachers: ${sub.teachers.map(t => t.teacherName).join(", ")}`);
}
```

### Grades & Averages

```typescript
// All grades for the current school year
const grades = await client.getGrades();

// General and per-subject averages
const averages = await client.getAverages();

// Average for a specific subject ID
const subjectAvg = await client.getSubjectAverage(210068);
```

### Absences & Justifications

```typescript
// All absence and delay events
const absences = await client.getAbsences();

// Absences within a date range
const filtered = await client.getAbsences({ dateFrom: "2026-09-01", dateTo: "2026-12-31" });

// Online absence booklet configuration (libretto web)
const config = await client.getLibrettoWebConfig();

// Justifications list
const justifications = await client.getLibrettoWeb();

// Submit a justification
await client.justifyAbsence({ reasonCode: "B", notes: "Family reasons" });

// Delete a justification
await client.deleteJustification(justificationId);
```

### Agenda & Homework

```typescript
// Agenda items (homework, tests, reminders) between dates
const agenda = await client.getAgenda("2026-10-01", "2026-10-31");

// Filter by event code (e.g. 'AGHW' for homework, 'AGNT' for tests/notes)
const homeworkAgenda = await client.getAgenda("2026-10-01", "2026-10-31", { evtCode: "AGHW" });

// Homework list and status
const homeworks = await client.getHomeworks();
```

### Lessons Log

```typescript
// Lessons for today
const todayLessons = await client.getLessonsToday();

// Lessons for a specific date
const dateLessons = await client.getLessonsForDate("2026-10-24");

// Lessons across a date range
const rangeLessons = await client.getLessons("2026-09-01", "2027-06-30");

// Lessons filtered by subject ID
const mathLessons = await client.getLessonsBySubject(210068, "2026-09-01", "2026-12-31");
```

### Noticeboard (Circolari) & Attachments

```typescript
// Circular notices
const notices = await client.getNotices();

// Read notice content and mark as read
const notice = await client.readNotice("CF", 40000001);
console.log(notice.item.title, notice.item.text);

// Get direct temporary signed download URL for an attachment
const downloadUrl = await client.getNoticeAttachmentUrl("CF", 40000001, 1);

// Download notice attachment directly into an ArrayBuffer
const fileBuffer = await client.downloadNoticeAttachment("CF", 40000001, 1);
```

### Communications

```typescript
const comms = await client.getCommunications();
const ministerial = await client.getMinisterialCommunications();
```

### Teaching Materials (Didactics)

```typescript
// Folders and shared content
const didactics = await client.getDidactics();

// Download a didactic file
const fileBuffer = await client.downloadDidacticItem(10218874);
```

### Disciplinary Notes

```typescript
// All notes categorized by category (NTTE, NTCL, NTWN, NTST)
const notes = await client.getNotes();

// Mark note as read
await client.markNoteAsRead("NTCL", 12345);
```

### Documents & School Reports

```typescript
// School reports (scrutini / pagelle) and administrative documents
const docs = await client.getDocuments();

// Download document by hash
const pdfBuffer = await client.readDocument("document_hash_value");
```

### Parent-Teacher Talks (Colloqui)

```typescript
// Available teachers
const talkTeachers = await client.getTalkTeachers();

// Available slots for a specific teacher
const frames = await client.getTalkFrames(1234567, "2026-10-01", "2026-10-31");

// Booked talks
const myTalks = await client.getMyTalks();

// Book a talk
await client.bookTalk(teacherId, frameId, slotPos);
```

### Payments (PagoOnline)

```typescript
// School payments list and statuses
const payments = await client.getPayments();

// Download payment receipt / document
const receipt = await client.downloadPaymentFile(1394540);
```

### Schoolbooks

```typescript
// Adopted textbooks for the student's class and course
const books = await client.getSchoolbooks();
```

### Canteen & Roll Call

```typescript
// Canteen menu & options
const menu = await client.getCanteenMenu("pranzo");
const wallet = await client.getCanteenWallet();

// Roll call
const rollCall = await client.getRollCallEvents("a", "b", "c");
```

---

## Date Handling

Any method accepting a date parameter supports:
1. Native `Date` instances (e.g. `new Date()`)
2. Strings formatted as `YYYY-MM-DD` (e.g. `'2026-10-24'`)
3. Strings formatted as `YYYYMMDD` (e.g. `'20261024'`)
4. Numeric epoch timestamps (e.g. `Date.now()`)

They are automatically converted into the `YYYYMMDD` format expected by ClasseViva path parameters.

---

## Multi-Account Handling (SAM)

If an account is associated with multiple students (e.g. parents with several children), `login()` throws a `ClasseVivaMultiAccountError`:

```typescript
import { ClasseVivaClient, ClasseVivaMultiAccountError } from "classevivapi.js";

const client = new ClasseVivaClient();

try {
  await client.login();
} catch (error) {
  if (error instanceof ClasseVivaMultiAccountError) {
    console.log("Matching accounts:", error.hints);
    // Choose the desired account
    await client.chooseAccount("target_account_uid");
  }
}
```

---

## Using with Cloudflare Worker / Proxies

If you are running in an environment where Spaggiari blocks direct connections (or from edge runtimes / CDNs), you can set up a reverse proxy or Cloudflare Worker and configure the client base URLs:

```typescript
const client = new ClasseVivaClient({
  baseUrl: "https://your-proxy.domain.workers.dev/rest/w1",
  authUrl: "https://your-proxy.domain.workers.dev/auth-p7/app/default/AuthApi4.php",
  cdnUrl: "https://your-proxy.domain.workers.dev/cdn",
});
```

---

## Error Handling

`classevivapi.js` exports descriptive error classes for fine-grained error handling:

```typescript
import {
  ClasseVivaError,
  ClasseVivaAuthError,
  ClasseVivaMultiAccountError,
  ClasseVivaSessionExpiredError,
  ClasseVivaApiError,
} from "classevivapi.js";

try {
  await client.getGrades();
} catch (err) {
  if (err instanceof ClasseVivaSessionExpiredError) {
    console.error("Session expired! Please log in again.");
  } else if (err instanceof ClasseVivaAuthError) {
    if (err.isPasswordExpired) {
      console.error("Password expired! Must be changed on official portal.");
    } else {
      console.error("Authentication failed:", err.message);
    }
  } else if (err instanceof ClasseVivaApiError) {
    console.error(`API Error ${err.statusCode}:`, err.responseBody);
  } else {
    console.error("Unexpected error:", err);
  }
}
```

---

## Contributing

Pull requests and issues are welcome on [GitHub](https://github.com/Just1diaxx/classeviva.js).

```bash
# Clone and install dependencies
git clone https://github.com/Just1diaxx/classeviva.js.git
cd classeviva.js
npm install

# Build
npm run build

# Run tests
npm test

# Typecheck
npm run typecheck
```

---

## License

[MIT](./LICENSE)
