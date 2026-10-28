import { join } from "node:path";

export const CONFIG_FILENAME = "pi-dchll-qqbot.json";

export interface ConfigPathApi {
	join(...parts: string[]): string;
}

export function configPath(home: string, pathApi: ConfigPathApi = { join }): string {
	return pathApi.join(home, ".pi", "agent", CONFIG_FILENAME);
}
