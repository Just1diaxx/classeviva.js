import test from "node:test";
import assert from "node:assert/strict";
import { ClasseVivaClient } from "../dist/index.js";

test("ClasseVivaClient automatically logs in on request if credentials exist in env/instance", async () => {
  let loginCalled = false;
  let gradesCalled = false;

  const customFetch = async (url) => {
    if (url.includes("a=aLoginPwd")) {
      loginCalled = true;
      const headers = new Headers();
      headers.append("set-cookie", "PHPSESSID=session_auto_123; path=/");
      return new Response(
        JSON.stringify({
          data: {
            auth: {
              verified: true,
              loggedIn: true,
              accountInfo: { id: 98765432 },
            },
          },
        }),
        { status: 200, headers }
      );
    }

    if (url.includes("students/98765432/grades26")) {
      gradesCalled = true;
      return new Response(JSON.stringify({ grades: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    username: "auto_user",
    password: "auto_password",
    autoLoadEnv: false,
  });

  assert.equal(cv.isAuthenticated, false);

  const res = await cv.getGrades();
  assert.equal(loginCalled, true);
  assert.equal(gradesCalled, true);
  assert.equal(cv.isAuthenticated, true);
  assert.equal(cv.studentId, "98765432");
  assert.deepEqual(res.grades, []);
});

test("Notice attachment URL resolution follows 302 redirect", async () => {
  const customFetch = async (url, opts) => {
    if (url.includes("noticeboard/attach/CF/40000001/1")) {
      const headers = new Headers();
      headers.set("location", "https://cdndoc.spaggiari.eu/signed-doc-url.pdf?token=xyz");
      return new Response(null, { status: 302, headers });
    }
    return new Response("Not found", { status: 404 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    sessionId: "sess_notice",
    studentId: "12345678",
    autoLoadEnv: false,
  });

  const url = await cv.getNoticeAttachmentUrl("CF", 40000001, 1);
  assert.equal(url, "https://cdndoc.spaggiari.eu/signed-doc-url.pdf?token=xyz");
});

test("ClasseVivaClient methods for Agenda, Absences, Lessons, Talks, Homeworks, Payments, Schoolbooks", async () => {
  const customFetch = async (url) => {
    if (url.includes("agendav2/all/20261001/20261015")) {
      return new Response(JSON.stringify({ agenda: [{ evtId: 1, notes: "Homework test" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("absences/details/20260901/20261001")) {
      return new Response(JSON.stringify({ events: [{ evtId: 543814, evtCode: "ABA0" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("homeworks/index")) {
      return new Response(JSON.stringify({ items: [{ evtId: 101, homeworkDesc: "Read chapter 4" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("parents/12345678/pagoonline/payments")) {
      return new Response(JSON.stringify({ items: [{ evtId: 39717, evtType: "POL01" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("schoolbooks/index")) {
      return new Response(JSON.stringify({ schoolbooks: [{ courseId: 104, books: [] }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };

  const cv = new ClasseVivaClient({
    fetch: customFetch,
    sessionId: "sess_tests",
    studentId: "12345678",
    autoLoadEnv: false,
  });

  const agenda = await cv.getAgenda("2026-10-01", "2026-10-15");
  assert.equal(agenda.agenda.length, 1);
  assert.equal(agenda.agenda[0].notes, "Homework test");

  const absences = await cv.getAbsences({ dateFrom: "20260901", dateTo: "20261001" });
  assert.equal(absences.events.length, 1);
  assert.equal(absences.events[0].evtCode, "ABA0");

  const hw = await cv.getHomeworks();
  assert.equal(hw.items[0].homeworkDesc, "Read chapter 4");

  const payments = await cv.getPayments();
  assert.equal(payments.items[0].evtId, 39717);

  const books = await cv.getSchoolbooks();
  assert.equal(books.schoolbooks[0].courseId, 104);
});
