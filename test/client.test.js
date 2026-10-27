import test from "node:test";
import assert from "node:assert/strict";
import {
  ClasseVivaClient,
  ClasseVivaAuthError,
  ClasseVivaMultiAccountError,
  ClasseVivaSessionExpiredError,
  ClasseVivaApiError,
} from "../dist/index.js";

// Sample fixtures from official documentation
const mockLoginResponseSuccess = {
  time: "2026-10-21T20:05:06+02:00",
  data: {
    auth: {
      verified: true,
      loggedIn: true,
      actionRequested: false,
      hints: [],
      errors: [],
      accountInfo: {
        type: "S",
        id: 12345678,
        cognome: "ROSSI",
        nome: "MARIO",
        cid: "PGXX0000",
      },
      redirects: [],
      aMode: "sam",
      mMode: "SEML",
      errCod: [],
    },
    pfolio: false,
  },
  error: [],
  api: { env: "production", AuthSpa: { version: "2.10.3" } },
};

const mockWhoAmI = {
  id: "12345678",
  account_type: "S",
  sede_codice: "PGXX0000",
  anno_scol: "2026",
  cognome: "ROSSI",
  nome: "MARIO",
  classe_ident: "1234567",
  classe_desc: "5A LICEO SCIENTIFICO",
  data_nascita: "1911-01-01",
  codice_fisc: "RSSMRA11A01H501X",
  login_type: null,
  last_login_at: null,
  email: "mario.rossi@example.com",
  schoolpass: "512345678",
};

const mockGrades = {
  grades: [
    {
      subjectId: 210068,
      subjectCode: "ART",
      subjectDesc: "DISEGNO E STORIA DELL'ARTE",
      evtId: 651664,
      evtCode: "GRV0",
      evtDate: "2026-10-24",
      decimalValue: 7.0,
      displayValue: "7",
      notesForFamily: "",
      color: "green",
      canceled: false,
      underlined: false,
      periodPos: 1,
      periodDesc: "1° PERIODO",
      periodLabel: "1° PERIODO",
      componentPos: 3,
      componentDesc: "Pratico",
      weightFactor: 100,
      noAverage: false,
      teacherName: "SURNAME NAME",
      evtPosition: "S1_3_1",
    },
  ],
};

test("ClasseVivaClient login with valid credentials sets cookies and studentId", async () => {
  const customFetch = async (url, opts) => {
    if (url.includes("AuthApi4.php?a=aLoginPwd")) {
      const headers = new Headers();
      headers.append("set-cookie", "PHPSESSID=test_session_id_123; path=/");
      headers.append("set-cookie", "webidentity=S12345678C; path=/");
      return new Response(JSON.stringify(mockLoginResponseSuccess), {
        status: 200,
        headers,
      });
    }
    return new Response("Not found", { status: 404 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    autoLoadEnv: false,
  });

  const res = await cv.login({
    username: "mario.rossi@example.com",
    password: "secure_password",
  });

  assert.equal(res.data.auth.loggedIn, true);
  assert.equal(cv.isAuthenticated, true);
  assert.equal(cv.studentId, "12345678");
  assert.equal(cv.cookieJar.getSessionId(), "test_session_id_123");
  assert.equal(cv.cookieJar.getWebIdentity(), "S12345678C");
});

test("ClasseVivaClient throws ClasseVivaAuthError on invalid credentials", async () => {
  const customFetch = async () => {
    return new Response(
      JSON.stringify({
        data: {
          auth: {
            verified: false,
            loggedIn: false,
            errors: ["Credenziali non valide"],
          },
        },
      }),
      { status: 200 }
    );
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    autoLoadEnv: false,
  });

  await assert.rejects(
    cv.login({ username: "wrong", password: "wrong" }),
    (err) => err instanceof ClasseVivaAuthError && err.message.includes("Credenziali non valide")
  );
});

test("ClasseVivaClient detects expired password", async () => {
  const customFetch = async () => {
    return new Response(
      JSON.stringify({
        data: {
          auth: {
            verified: true,
            loggedIn: false,
            actionRequested: "changePasswordDialog",
          },
        },
      }),
      { status: 200 }
    );
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    autoLoadEnv: false,
  });

  await assert.rejects(
    cv.login({ username: "mario", password: "old_password" }),
    (err) => err instanceof ClasseVivaAuthError && err.isPasswordExpired === true
  );
});

test("ClasseVivaClient handles SAM multi-account choice", async () => {
  const customFetch = async (url) => {
    if (url.includes("a=aLoginPwd")) {
      return new Response(
        JSON.stringify({
          data: {
            auth: {
              verified: true,
              loggedIn: false,
              hints: ["account1", "account2"],
            },
          },
        }),
        { status: 200 }
      );
    }
    if (url.includes("a=aLoginSam")) {
      return new Response(JSON.stringify(mockLoginResponseSuccess), { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    autoLoadEnv: false,
  });

  await assert.rejects(
    cv.login({ username: "parent_account", password: "password" }),
    (err) => err instanceof ClasseVivaMultiAccountError
  );

  const samRes = await cv.chooseAccount("account1");
  assert.equal(samRes.data.auth.loggedIn, true);
  assert.equal(cv.studentId, "12345678");
});

test("ClasseVivaClient API endpoints work with session cookies", async () => {
  const calls = [];
  const customFetch = async (url, opts) => {
    calls.push({ url, method: opts?.method || "GET" });

    if (url.endsWith("misc/whoami")) {
      return new Response(JSON.stringify(mockWhoAmI), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.endsWith("students/12345678/grades26")) {
      return new Response(JSON.stringify(mockGrades), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.endsWith("students/12345678/card")) {
      return new Response(
        JSON.stringify({
          card: {
            ident: "S12345678C",
            firstName: "MARIO",
            lastName: "ROSSI",
            schName: "LICEO SCIENTIFICO   ",
            schDedication: "GALILEI   ",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url.includes("students/12345678/overview/all26/20261024/20261024")) {
      return new Response(
        JSON.stringify({
          virtualClassesAgenda: [],
          lessons: [],
          agenda: [],
          events: [],
          grades: [],
          notes: { NTTE: [], NTCL: [], NTWN: [], NTST: [] },
          homeworks: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    if (url.endsWith("students/12345678/didactics")) {
      return new Response(
        JSON.stringify({
          didacticts: [
            {
              teacherId: "A1234567",
              teacherName: "ROSSI MARIO",
              folders: [],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    sessionId: "existing_session_id",
    studentId: "12345678",
    autoLoadEnv: false,
  });

  // Test whoami
  const whoami = await cv.getWhoAmI();
  assert.equal(whoami.cognome, "ROSSI");

  // Test card (verifying whitespace trimming)
  const card = await cv.getCard();
  assert.equal(card.card.schName, "LICEO SCIENTIFICO");
  assert.equal(card.card.schDedication, "GALILEI");

  // Test grades
  const grades = await cv.getGrades();
  assert.equal(grades.grades.length, 1);
  assert.equal(grades.grades[0].decimalValue, 7);

  // Test daily overview with Date object
  const overview = await cv.getDailyOverview(new Date(2026, 9, 24));
  assert.ok(overview);

  // Test didactics typo normalization
  const didactics = await cv.getDidactics();
  assert.ok(Array.isArray(didactics.didacticts));
  assert.ok(Array.isArray(didactics.didactics));
});

test("ClasseVivaClient throws ClasseVivaSessionExpiredError on 401 response", async () => {
  const customFetch = async () => {
    return new Response("Unauthorized", { status: 401 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    sessionId: "invalid_session",
    studentId: "12345678",
    autoLoadEnv: false,
  });

  await assert.rejects(
    cv.getGrades(),
    (err) => err instanceof ClasseVivaSessionExpiredError
  );
});
