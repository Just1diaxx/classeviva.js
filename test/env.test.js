import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEnvContent, loadEnv, getEnvCredentials } from "../dist/index.js";

test("parseEnvContent parses key-value pairs and strips quotes and comments", () => {
  const content = `
# This is a comment
CLASSEVIVA_USERNAME="mario.rossi@example.com"
CLASSEVIVA_PASSWORD='my-secret-password'
CLASSEVIVA_SCHOOL_CODE=PGXX0000
EMPTY_LINE=
`;
  const parsed = parseEnvContent(content);
  assert.equal(parsed.CLASSEVIVA_USERNAME, "mario.rossi@example.com");
  assert.equal(parsed.CLASSEVIVA_PASSWORD, "my-secret-password");
  assert.equal(parsed.CLASSEVIVA_SCHOOL_CODE, "PGXX0000");
});

test("loadEnv loads values from custom .env file", () => {
  const tmpDir = os.tmpdir();
  const testEnvPath = path.join(tmpDir, `test-cv-${Date.now()}.env`);

  fs.writeFileSync(
    testEnvPath,
    `
CLASSEVIVA_USERNAME=test_user_from_env
CLASSEVIVA_PASSWORD=test_pass_from_env
CLASSEVIVA_PIN=1234
`
  );

  try {
    const creds = loadEnv(testEnvPath, true);
    assert.equal(creds.username, "test_user_from_env");
    assert.equal(creds.password, "test_pass_from_env");
    assert.equal(creds.pin, "1234");
  } finally {
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  }
});
