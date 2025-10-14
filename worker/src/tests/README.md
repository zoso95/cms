# Test Scripts

This directory contains test scripts for the worker service.

## Running Tests

All tests can be run from the worker directory using:

```bash
npx tsx src/tests/test-<name>.ts
```

## Available Tests

### test-dynamic-variables.ts

Tests the dynamic variables generation for ElevenLabs calls.

**Purpose:** Verify that patient data, communications, providers, and transcripts are properly gathered and formatted as flat key-value pairs for ElevenLabs.

**Usage:**
```bash
npx tsx src/tests/test-dynamic-variables.ts
```

**What it tests:**
- Fetches patient case data
- Fetches associated communications, providers, and transcripts
- Builds flat variables (strings, numbers, booleans only)
- Creates a stringified `context` field with all complex data
- Validates all variables are primitive types (ElevenLabs requirement)

**Expected output:**
- List of all dynamic variables with types
- Context object summary
- Validation that all types are safe for ElevenLabs

---

### test-call-failure.ts

Tests call initiation failure handling.

**Purpose:** Verify that invalid phone numbers are handled correctly without retrying multiple times.

**Usage:**
```bash
npx tsx src/tests/test-call-failure.ts
```

**What it tests:**
- Creates a test patient with an invalid phone number (+15555555555)
- Initiates a call workflow
- Verifies the call fails immediately (HTTP 400)
- Verifies the activity throws a non-retryable error
- Verifies no webhook is sent (since no conversation was created)

**Expected behavior:**
- Call fails immediately with `ApplicationFailure.nonRetryable`
- Database records the failure
- **Only ONE call attempt** (no retries)

---

### test-elevenlabs.ts

Tests ElevenLabs API conversation status queries.

**Purpose:** Verify that we can query conversation statuses and parse the results correctly.

**Usage:**
```bash
npx tsx src/tests/test-elevenlabs.ts
```

**What it tests:**
- Queries ElevenLabs API for several conversation IDs
- Parses the response (status, transcript, analysis)
- Correctly interprets `talked_to_a_human` evaluation criteria

**Expected output:**
- Status for each conversation (pending, completed, failed)
- Whether human was reached
- Transcript and analysis data

---

## Notes

- All tests use the `.env` file in the worker directory
- Tests require the backend server to be running (for workflow tests)
- Tests may create records in the database (patient_cases, elevenlabs_calls, etc.)
- Some tests use real patient data (e.g., patient #4062)
