import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createDebugLogger, debugLogPath } from "../../../src/infrastructure/logging/debug-logger.ts";

function temporaryDirectory(t: test.TestContext): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-dchll-qqbot-log-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

test("writes debug diagnostics to a file without using console.error", (t) => {
	const directory = temporaryDirectory(t);
	const path = join(directory, "debug.log");
	const errors: string[] = [];
	const originalError = console.error;
	console.error = (...args: unknown[]) => { errors.push(args.join(" ")); };
	t.after(() => { console.error = originalError; });

	const log = createDebugLogger({ logging: { level: "debug" } }, path);
	log("gateway RESUMED");

	assert.deepEqual(errors, []);
	assert.match(readFileSync(path, "utf8"), /^\d{4}-\d{2}-\d{2}T[^\n]+ \[pi-dchll-qqbot\] gateway RESUMED\n$/);
});

test("does not create a log file below debug level", (t) => {
	const directory = temporaryDirectory(t);
	const path = join(directory, "debug.log");

	createDebugLogger({ logging: { level: "info" } }, path)("gateway RESUMED");

	assert.equal(existsSync(path), false);
});

test("places the debug log beside the extension configuration", () => {
	assert.equal(debugLogPath("/Users/me"), "/Users/me/.pi/agent/pi-dchll-qqbot.debug.log");
});
