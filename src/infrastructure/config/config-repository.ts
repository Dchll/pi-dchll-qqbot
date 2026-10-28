import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
	normalizeConfig,
	type LoadConfigResult,
	UnsupportedConfigSchemaError,
} from "./normalize-config.ts";

export class ConfigRepositoryError extends Error {
	constructor(readonly code: "permission_denied" | "invalid_json" | "invalid_path" | "unsupported_schema" | "write_failed", message: string, readonly cause?: unknown) {
		super(message);
		this.name = "ConfigRepositoryError";
	}
}

export class FileConfigRepository {
	constructor(readonly path: string) {}

	async load(): Promise<LoadConfigResult> {
		let text: string;
		try {
			text = await readFile(this.path, "utf8");
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code === "ENOENT") return { config: normalizeConfig({ schemaVersion: 5 }), missing: true };
			if (code === "EACCES" || code === "EPERM") throw new ConfigRepositoryError("permission_denied", "Cannot read config", error);
			throw new ConfigRepositoryError("invalid_path", "Cannot read config", error);
		}
		try {
			const parsed = JSON.parse(text) as unknown;
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
				throw new ConfigRepositoryError("invalid_json", "Config root must be an object");
			}
			return { config: normalizeConfig(parsed) };
		} catch (error) {
			if (error instanceof ConfigRepositoryError) throw error;
			if (error instanceof UnsupportedConfigSchemaError) {
				throw new ConfigRepositoryError("unsupported_schema", error.message, error);
			}
			throw new ConfigRepositoryError("invalid_json", "Config is not valid JSON", error);
		}
	}

	async save(config: LoadConfigResult["config"]): Promise<void> {
		const directory = dirname(this.path);
		const temporary = join(directory, `.${Date.now()}-pi-dchll-qqbot.json.tmp`);
		try {
			await mkdir(directory, { recursive: true });
			await writeFile(temporary, `${JSON.stringify(config, null, "\t")}\n`, { encoding: "utf8", mode: 0o600 });
			await rename(temporary, this.path);
		} catch (error) {
			throw new ConfigRepositoryError("write_failed", "Cannot save config", error);
		}
	}
}
