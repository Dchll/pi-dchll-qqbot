import type {
	ExtensionAPI,
	ExtensionCommandContext,
	SessionShutdownEvent,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { ConfigRepositoryError, FileConfigRepository } from "../infrastructure/config/config-repository.ts";
import { CONFIG_PATH, validateBootstrapConfig, validateConfig } from "../infrastructure/config/normalize-config.ts";
import type { PiAgentQQBotConfig } from "../application/ports.ts";
import { NativeSessionRuntime } from "./native-session-runtime.ts";
import { formatBytes } from "../infrastructure/media/outbound-media.ts";

const RUNTIME_SYMBOL = Symbol.for("pi-agent-qqbot.native-session-runtime.v1");
const globalState = globalThis as typeof globalThis & {
	[RUNTIME_SYMBOL]?: NativeSessionRuntime;
};
const runtime = globalState[RUNTIME_SYMBOL] ?? new NativeSessionRuntime();
globalState[RUNTIME_SYMBOL] = runtime;

const configRepository = new FileConfigRepository(CONFIG_PATH);
let currentConfig: PiAgentQQBotConfig = runtimeConfigFallback();

export default function registerExtension(pi: ExtensionAPI): void {
	runtime.bindExtension(pi);
	pi.registerTool({
		name: "qq_send_local_file",
		label: "Send Local File to QQ",
		description: "Send one real local computer file to the QQ conversation that requested the current task. Use only when that QQ user explicitly asks to send, upload, or transfer a local image or file. The target and reply metadata are bound by pi-agent-qqbot; provide only the local path.",
		parameters: Type.Object({
			path: Type.String({ description: "Local file path returned by a tool or explicitly provided by the QQ user" }),
		}),
		async execute(_toolCallId, params) {
			const record = await runtime.sendLocalFile(params.path, "auto");
			return {
				content: [{
					type: "text",
					text: `QQ API 已确认发送${mediaLabel(record.kind)} ${record.filename}（${formatBytes(record.bytes)}）。`,
				}],
				details: record,
			};
		},
	});

	const requireConfig = (ctx: ExtensionCommandContext): boolean => {
		const invalid = validateConfig(currentConfig);
		if (invalid) {
			ctx.ui.notify(`pi-agent-qqbot 配置无效：${invalid}`, "warning");
			return false;
		}
		return true;
	};

	pi.registerCommand("qqbot-start", {
		description: "Bootstrap and save the first QQ C2C owner OpenID",
		handler: async (_args, ctx) => {
			const bootstrapInvalid = validateBootstrapConfig(currentConfig);
			if (bootstrapInvalid) {
				ctx.ui.notify(`pi-agent-qqbot 配置无效：${bootstrapInvalid}`, "warning");
				return;
			}
			if (currentConfig.ownerOpenId) {
				ctx.ui.notify("QQ owner 已配置；请运行 /qqbot-link 启动并绑定当前 Pi 会话。", "info");
				return;
			}
			try {
				runtime.configure(currentConfig);
				await runtime.startBootstrap(ctx, {
					claimOwner: async (userOpenId) => {
						const approved = await ctx.ui.confirm(
							"绑定 QQ 用户？",
							`检测到 QQ C2C user_openid：${userOpenId}\n确认将其写入本机 pi-agent-qqbot 配置？`,
						);
						if (!approved) return false;
						try {
							const updated = { ...currentConfig, ownerOpenId: userOpenId };
							await configRepository.save(updated);
							currentConfig = updated;
							runtime.configure(updated);
							ctx.ui.notify("QQ owner 已写入配置。现在运行 /qqbot-link 启动并绑定当前 Pi 会话。", "info");
							return true;
						} catch (error) {
							ctx.ui.notify(`无法写入 QQ 配置：${safeError(error)}`, "error");
							return false;
						}
					},
				});
				ctx.ui.notify("QQ 首次绑定已启动。请从 QQ 私聊机器人发送任意消息，然后在本地终端确认 OpenID。", "info");
			} catch (error) {
				ctx.ui.notify(`QQ 首次绑定启动失败：${safeError(error)}`, "error");
			}
		},
	});

	pi.registerCommand("qqbot-link", {
		description: "Bind the configured QQ C2C conversation to this Pi session",
		handler: async (_args, ctx) => {
			if (!requireConfig(ctx)) return;
			try {
				runtime.configure(currentConfig);
				await runtime.start(ctx, {
					confirmTakeover: ({ pid }) => ctx.ui.confirm(
						"接管 QQ Gateway？",
						`本机 Pi 进程 ${pid} 当前拥有该 QQ Bot。接管只会停止旧进程的 Gateway，不会终止旧 Pi。`,
					),
				});
				const link = runtime.link(ctx);
				ctx.ui.notify(`QQ Gateway 已启动并绑定到当前 Pi 会话 ${link.currentSessionId}`, "info");
			} catch (error) {
				ctx.ui.notify(`pi-agent-qqbot link 失败：${safeError(error)}`, "error");
			}
		},
	});

	pi.registerCommand("qqbot-stop", {
		description: "Stop only the QQ Gateway transport",
		handler: async (_args, ctx) => {
			await runtime.stop();
			ctx.ui.notify("QQ Gateway 已停止；逻辑绑定和当前 Pi 会话已保留。", "info");
		},
	});

	pi.registerCommand("qqbot-unlink", {
		description: "Clear the in-process QQ logical link",
		handler: async (_args, ctx) => {
			runtime.unlink();
			ctx.ui.notify("QQ logical link 已解除。", "info");
		},
	});

	pi.registerCommand("qqbot-status", {
		description: "Show QQ Gateway and native Pi link status",
		handler: async (_args, ctx) => {
			ctx.ui.notify(runtime.statusText(), "info");
		},
	});

	pi.registerCommand("qqbot-takeover", {
		description: "Take over QQ Gateway ownership from another local Pi process",
		handler: async (_args, ctx) => {
			if (!requireConfig(ctx)) return;
			try {
				runtime.configure(currentConfig);
				await runtime.start(ctx, { forceTakeover: true });
				ctx.ui.notify(`QQ Gateway ownership 已接管。\n${runtime.statusText()}`, "info");
			} catch (error) {
				ctx.ui.notify(`QQ Gateway 接管失败：${safeError(error)}`, "error");
			}
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		try {
			const loaded = await configRepository.load();
			currentConfig = loaded.config;
			runtime.configure(currentConfig);
			runtime.onSessionStart(ctx);
			if (loaded.missing && ctx.hasUI) ctx.ui.notify("pi-agent-qqbot 未找到配置。", "info");
		} catch (error) {
			currentConfig = runtimeConfigFallback();
			if (ctx.hasUI) {
				const code = error instanceof ConfigRepositoryError ? error.code : "read_failed";
				ctx.ui.notify(`pi-agent-qqbot 配置读取失败：${code}`, "warning");
			}
		}
	});

	pi.on("input", async (event) => {
		runtime.onInput(event);
	});
	pi.on("agent_end", async (event) => {
		runtime.onAgentEnd(event);
	});
	pi.on("agent_settled", async () => {
		await runtime.onAgentSettled();
	});
	pi.on("session_shutdown", async (event: SessionShutdownEvent) => {
		if (event.reason === "quit") await runtime.shutdownProcess();
	});
}

function runtimeConfigFallback(): PiAgentQQBotConfig {
	return {
		schemaVersion: 5,
		appId: "",
		clientSecret: "",
		sandbox: true,
		ownerOpenId: "",
		link: { conflictPolicy: "ask" },
		inboundMedia: { deniedKinds: [], deniedExtensions: [] },
		outboundMedia: { enabled: false, deniedRoots: [], deniedKinds: [], deniedExtensions: [] },
		logging: { level: "info" },
	};
}

function mediaLabel(kind: "image" | "video" | "voice" | "file"): string {
	return kind === "image" ? "图片" : kind === "video" ? "视频" : kind === "voice" ? "语音" : "文件";
}

function safeError(error: unknown): string {
	return (error instanceof Error ? error.message : String(error)).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 300);
}
