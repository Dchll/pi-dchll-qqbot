import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { PiAgentQQBotConfig } from "../../application/ports.ts";
import { configPath } from "../config/paths.ts";

export function debugLogPath(homeDirectory = homedir()): string {
	return join(dirname(configPath(homeDirectory)), "pi-dchll-qqbot.debug.log");
}

export function createDebugLogger(
	config: Pick<PiAgentQQBotConfig, "logging">,
	path = debugLogPath(),
): (message: string) => void {
	if (config.logging.level !== "debug") return () => undefined;
	try {
		mkdirSync(dirname(path), { recursive: true });
	} catch {
		return () => undefined;
	}
	return (message) => {
		try {
			appendFileSync(path, `${new Date().toISOString()} [pi-dchll-qqbot] ${message}\n`, {
				encoding: "utf8",
				mode: 0o600,
			});
		} catch {
			// 日志写入失败不能中断 Gateway 或 Pi 会话。
		}
	};
}
