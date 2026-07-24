import { randomUUID } from "node:crypto";

import type {
	QQInboundMessage,
	QQKeyboard,
	QQReplyTarget,
} from "../application/ports.ts";
import { ReplyBudget } from "../domain/reply-budget.ts";
import type { TurnOrigin } from "../domain/native-session-link.ts";
import { normalizeCommandText, parseQQCommand } from "../presentation/qq/command-parser.ts";
import { buildCommandKeyboard, type QQCommandButton } from "../presentation/qq/keyboard.ts";
import type {
	RemoteCustomUIController,
	RemoteCustomUIHandle,
	RemoteUIInteractionHandle,
	RemoteUIInteractionPort,
} from "./dual-ui-bridge.ts";

const SELECT_PAGE_SIZE = 6;
const CUSTOM_TUI_WIDTH = 72;
const CUSTOM_TUI_MAX_LINES = 40;
const CUSTOM_KEY_INPUTS: Readonly<Record<string, string>> = {
	up: "\u001b[A",
	down: "\u001b[B",
	right: "\u001b[C",
	left: "\u001b[D",
	enter: "\r",
	escape: "\u001b",
	tab: "\t",
	space: " ",
	backspace: "\u007f",
	delete: "\u001b[3~",
	home: "\u001b[H",
	end: "\u001b[F",
	"page-up": "\u001b[5~",
	"page-down": "\u001b[6~",
	"ctrl-c": "\u0003",
	"ctrl-d": "\u0004",
	"ctrl-u": "\u0015",
	"ctrl-w": "\u0017",
};

type QQOrigin = Extract<TurnOrigin, { source: "qq" }>;
type InteractionValue = boolean | string | undefined;
type StandardInteractionRequest =
	| { kind: "confirm"; title: string; message: string }
	| { kind: "select"; title: string; options: string[] }
	| { kind: "input"; title: string; placeholder?: string | undefined };

export interface UIInteractionDeliveryContext {
	origin: QQOrigin;
	message: QQInboundMessage;
	target: QQReplyTarget;
	budget: ReplyBudget;
}

export interface QQUIInteractionBrokerOptions {
	getDeliveryContext(): UIInteractionDeliveryContext | undefined;
	isCurrent(origin: QQOrigin): boolean;
	sendCard(target: QQReplyTarget, text: string, budget: ReplyBudget, keyboard?: QQKeyboard): Promise<void>;
	sendStatus(message: QQInboundMessage, text: string): Promise<void>;
}

interface PendingInteractionBase {
	token: string;
	origin: QQOrigin;
	message: QQInboundMessage;
}

interface PendingStandardInteraction extends PendingInteractionBase {
	type: "standard";
	request: StandardInteractionRequest;
	resolve(value: InteractionValue): void;
}

interface PendingCustomInteraction extends PendingInteractionBase {
	type: "custom";
	controller?: RemoteCustomUIController;
}

type PendingInteraction = PendingStandardInteraction | PendingCustomInteraction;

export function isQQUIInteractionCommand(text: string): boolean {
	return /^\/qq-ui(?:\s|$)/i.test(normalizeCommandText(text));
}

/** Own QQ-side dialog and remote custom-component interaction state. */
export class QQUIInteractionBroker implements RemoteUIInteractionPort {
	private readonly pending = new Map<string, PendingInteraction>();

	constructor(private readonly options: QQUIInteractionBrokerOptions) {}

	openConfirm(title: string, message: string): RemoteUIInteractionHandle<boolean> | undefined {
		return this.open({ kind: "confirm", title, message }) as RemoteUIInteractionHandle<boolean> | undefined;
	}

	openSelect(title: string, options: string[]): RemoteUIInteractionHandle<string | undefined> | undefined {
		if (options.length === 0) return undefined;
		return this.open({ kind: "select", title, options: [...options] }) as RemoteUIInteractionHandle<string | undefined> | undefined;
	}

	openInput(title: string, placeholder?: string): RemoteUIInteractionHandle<string | undefined> | undefined {
		return this.open({ kind: "input", title, ...(placeholder ? { placeholder } : {}) }) as RemoteUIInteractionHandle<string | undefined> | undefined;
	}

	openCustom(): RemoteCustomUIHandle | undefined {
		const delivery = this.options.getDeliveryContext();
		if (!delivery || !this.options.isCurrent(delivery.origin)) return undefined;
		const pending: PendingCustomInteraction = {
			type: "custom",
			token: randomUUID(),
			origin: delivery.origin,
			message: delivery.message,
		};
		this.pending.set(pending.token, pending);
		return {
			attach: (controller) => {
				if (this.pending.get(pending.token) !== pending) return;
				pending.controller = controller;
				void this.sendCustomCard(
					pending,
					delivery.message,
					delivery.target,
					delivery.budget,
				).catch(() => this.cancel(pending.token, pending));
			},
			close: () => this.cancel(pending.token, pending),
		};
	}

	async handleCommand(message: QQInboundMessage, text: string): Promise<void> {
		let command;
		try { command = parseQQCommand(text); } catch {
			await this.options.sendStatus(message, "交互响应格式无效。");
			return;
		}
		if (!command || command.name !== "qq-ui") {
			await this.options.sendStatus(message, "交互响应格式无效。");
			return;
		}
		const [token, action, rawValue] = command.args;
		const pending = token ? this.current(token) : undefined;
		if (!pending || !action) {
			await this.options.sendStatus(message, "该交互已在另一端处理或已经失效。");
			return;
		}
		if (pending.type === "custom") {
			await this.handleCustomCommand(pending, message, action, rawValue);
			return;
		}

		if (action === "page" && pending.request.kind === "select") {
			const page = Number(rawValue);
			const totalPages = Math.ceil(pending.request.options.length / SELECT_PAGE_SIZE);
			if (!Number.isSafeInteger(page) || page < 1 || page > totalPages) {
				await this.options.sendStatus(message, "选择页码无效。");
				return;
			}
			await this.sendCard(pending, message, targetFor(message), new ReplyBudget(4), page);
			return;
		}

		const response = resolveCommand(pending, action, rawValue);
		if (!response) {
			await this.options.sendStatus(message, "交互响应与当前请求不匹配。");
			return;
		}
		if (!this.complete(pending, response.value)) {
			await this.options.sendStatus(message, "该交互已在另一端处理或已经失效。");
			return;
		}
		await this.options.sendStatus(message, response.acknowledgement);
	}

	async handleInput(message: QQInboundMessage, value: string): Promise<boolean> {
		const pending = this.latestTextInteraction();
		if (!pending) return false;
		if (pending.type === "standard") {
			if (!this.complete(pending, value)) return false;
			await this.options.sendStatus(message, "输入已提交，Pi 将继续执行。");
			return true;
		}
		if (!pending.controller) {
			await this.options.sendStatus(message, "自定义界面仍在初始化，请稍后重试。");
			return true;
		}
		try {
			pending.controller.input(asBracketedPaste(value));
		} catch {
			await this.options.sendStatus(message, "自定义界面无法处理这段输入。");
			return true;
		}
		if (this.pending.get(pending.token) !== pending) {
			await this.options.sendStatus(message, "交互已完成，Pi 将继续执行。");
			return true;
		}
		await this.sendCustomCard(pending, message, targetFor(message), new ReplyBudget(4));
		return true;
	}

	cancelAll(messageId?: string): void {
		for (const [token, pending] of this.pending) {
			if (messageId && pending.origin.messageId !== messageId) continue;
			this.pending.delete(token);
		}
	}

	private open(request: StandardInteractionRequest): RemoteUIInteractionHandle<InteractionValue> | undefined {
		const delivery = this.options.getDeliveryContext();
		if (!delivery || !this.options.isCurrent(delivery.origin)) return undefined;
		const token = randomUUID();
		let resolve!: (value: InteractionValue) => void;
		const result = new Promise<InteractionValue>((done) => { resolve = done; });
		const pending: PendingStandardInteraction = {
			type: "standard",
			token,
			request,
			origin: delivery.origin,
			message: delivery.message,
			resolve,
		};
		this.pending.set(token, pending);
		void this.sendCard(pending, delivery.message, delivery.target, delivery.budget, 1).catch(() => {
			this.cancel(token, pending);
		});
		return { result, cancel: () => this.cancel(token, pending) };
	}

	private async handleCustomCommand(
		pending: PendingCustomInteraction,
		message: QQInboundMessage,
		action: string,
		rawValue: string | undefined,
	): Promise<void> {
		const controller = pending.controller;
		if (!controller) {
			await this.options.sendStatus(message, "自定义界面仍在初始化，请稍后重试。");
			return;
		}
		if (action !== "refresh") {
			const input = action === "key" && rawValue ? CUSTOM_KEY_INPUTS[rawValue] : undefined;
			if (input === undefined) {
				await this.options.sendStatus(message, "自定义界面按键无效。");
				return;
			}
			try {
				controller.input(input);
			} catch {
				await this.options.sendStatus(message, "自定义界面无法处理该按键。");
				return;
			}
		}
		if (this.pending.get(pending.token) !== pending) {
			await this.options.sendStatus(message, "交互已完成，Pi 将继续执行。");
			return;
		}
		await this.sendCustomCard(pending, message, targetFor(message), new ReplyBudget(4));
	}

	private async sendCard(
		pending: PendingStandardInteraction,
		message: QQInboundMessage,
		target: QQReplyTarget,
		budget: ReplyBudget,
		page: number,
	): Promise<void> {
		const card = formatCard(pending, page);
		await this.options.sendCard(
			target,
			card.text,
			budget,
			buildCommandKeyboard(message, card.keyboardRows),
		);
	}

	private async sendCustomCard(
		pending: PendingCustomInteraction,
		message: QQInboundMessage,
		target: QQReplyTarget,
		budget: ReplyBudget,
	): Promise<void> {
		const controller = pending.controller;
		if (!controller) return;
		const card = formatCustomCard(pending.token, controller.render(CUSTOM_TUI_WIDTH));
		await this.options.sendCard(
			target,
			card.text,
			budget,
			buildCommandKeyboard(message, card.keyboardRows),
		);
	}

	private latestTextInteraction(): PendingStandardInteraction | PendingCustomInteraction | undefined {
		let latest: PendingStandardInteraction | PendingCustomInteraction | undefined;
		for (const pending of this.pending.values()) {
			if (!this.options.isCurrent(pending.origin)) continue;
			if (pending.type === "custom" || pending.request.kind === "input") latest = pending;
		}
		return latest;
	}

	private current(token: string): PendingInteraction | undefined {
		const pending = this.pending.get(token);
		if (!pending) return undefined;
		if (!this.options.isCurrent(pending.origin)) {
			this.cancel(token, pending);
			return undefined;
		}
		return pending;
	}

	private complete(pending: PendingStandardInteraction, value: InteractionValue): boolean {
		if (this.pending.get(pending.token) !== pending || !this.options.isCurrent(pending.origin)) {
			this.cancel(pending.token, pending);
			return false;
		}
		this.pending.delete(pending.token);
		pending.resolve(value);
		return true;
	}

	private cancel(token: string, expected: PendingInteraction): void {
		if (this.pending.get(token) === expected) this.pending.delete(token);
	}
}

function resolveCommand(
	pending: PendingStandardInteraction,
	action: string,
	rawValue: string | undefined,
): { value: InteractionValue; acknowledgement: string } | undefined {
	if (action === "approve" && pending.request.kind === "confirm") {
		return { value: true, acknowledgement: "已批准，Pi 将继续执行。" };
	}
	if (action === "reject" && pending.request.kind === "confirm") {
		return { value: false, acknowledgement: "已拒绝，Pi 将继续执行。" };
	}
	if (action === "choose" && pending.request.kind === "select") {
		const index = Number(rawValue);
		const selected = Number.isSafeInteger(index) ? pending.request.options[index] : undefined;
		return selected === undefined ? undefined : { value: selected, acknowledgement: `已选择：${selected}` };
	}
	if (action === "cancel") {
		return {
			value: pending.request.kind === "confirm" ? false : undefined,
			acknowledgement: "已取消，Pi 将继续执行。",
		};
	}
	return undefined;
}

function formatCard(pending: PendingStandardInteraction, page: number): { text: string; keyboardRows: QQCommandButton[][] } {
	const title = clean(pending.request.title, 200) || "Pi 交互请求";
	const command = (action: string) => `/qq-ui ${pending.token} ${action}`;
	if (pending.request.kind === "confirm") {
		const approve = command("approve");
		const reject = command("reject");
		return {
			text: [
				`### ${title}`,
				clean(pending.request.message, 2_000),
				"终端与 QQ 均可处理，首个响应生效。",
				`手动响应：\`${approve}\` 或 \`${reject}\``,
			].filter(Boolean).join("\n\n"),
			keyboardRows: [[
				{ label: "批准", command: approve, primary: true },
				{ label: "拒绝", command: reject },
			]],
		};
	}
	if (pending.request.kind === "input") {
		return {
			text: [
				`### ${title}`,
				pending.request.placeholder ? `输入提示：${clean(pending.request.placeholder, 500)}` : undefined,
				"请直接回复一条文本消息。终端与 QQ 均可输入，首个响应生效。",
				`取消：\`${command("cancel")}\``,
			].filter((value): value is string => !!value).join("\n\n"),
			keyboardRows: [[{ label: "取消", command: command("cancel") }]],
		};
	}

	const totalPages = Math.ceil(pending.request.options.length / SELECT_PAGE_SIZE);
	const start = (page - 1) * SELECT_PAGE_SIZE;
	const visible = pending.request.options.slice(start, start + SELECT_PAGE_SIZE);
	const optionButtons: QQCommandButton[] = visible.map((option, offset) => ({
		label: clean(option, 20) || `选项 ${start + offset + 1}`,
		command: command(`choose ${start + offset}`),
		primary: start + offset === 0,
	}));
	const keyboardRows = chunk(optionButtons, 2);
	const navigation: QQCommandButton[] = [];
	if (page > 1) navigation.push({ label: "上一页", command: command(`page ${page - 1}`) });
	if (page < totalPages) navigation.push({ label: "下一页", command: command(`page ${page + 1}`), primary: true });
	if (navigation.length) keyboardRows.push(navigation);
	keyboardRows.push([{ label: "取消", command: command("cancel") }]);
	return {
		text: [
			`### ${title}`,
			`选项 ${page}/${totalPages}：`,
			...visible.map((option, offset) => {
				const index = start + offset;
				return `- ${clean(option, 200)}：\`${command(`choose ${index}`)}\``;
			}),
			"终端与 QQ 均可选择，首个响应生效。",
		].join("\n"),
		keyboardRows,
	};
}

function formatCustomCard(token: string, rendered: string[]): { text: string; keyboardRows: QQCommandButton[][] } {
	const command = (key: string) => `/qq-ui ${token} key ${key}`;
	const snapshot = cleanCustomSnapshot(rendered);
	return {
		text: [
			"### Pi 自定义界面",
			"```text",
			snapshot,
			"```",
			"直接发送文字可输入到当前界面。",
		].join("\n\n"),
		keyboardRows: [
			[
				{ label: "上", command: command("up") },
				{ label: "上翻页", command: command("page-up") },
				{ label: "行首", command: command("home") },
				{ label: "刷新", command: `/qq-ui ${token} refresh` },
			],
			[
				{ label: "左", command: command("left") },
				{ label: "确认", command: command("enter"), primary: true },
				{ label: "右", command: command("right") },
				{ label: "空格", command: command("space") },
			],
			[
				{ label: "下", command: command("down") },
				{ label: "下翻页", command: command("page-down") },
				{ label: "行尾", command: command("end") },
			],
			[
				{ label: "Tab", command: command("tab") },
				{ label: "退格", command: command("backspace") },
				{ label: "删除", command: command("delete") },
			],
			[
				{ label: "取消", command: command("escape") },
				{ label: "Ctrl+C", command: command("ctrl-c") },
			],
		],
	};
}

function cleanCustomSnapshot(lines: string[]): string {
	const visible = lines.slice(0, CUSTOM_TUI_MAX_LINES).map(stripTerminalSequences);
	if (lines.length > CUSTOM_TUI_MAX_LINES) visible.push(`... 另有 ${lines.length - CUSTOM_TUI_MAX_LINES} 行未显示`);
	return visible.join("\n").replace(/```/g, "` ` `").trimEnd() || "（界面暂无可见内容）";
}

function stripTerminalSequences(value: string): string {
	return value
		.replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
		.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
		.replace(/\u001b_[^\u0007]*\u0007/g, "")
		.replace(/\u001b[@-_]/g, "")
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function asBracketedPaste(value: string): string {
	return `\u001b[200~${value}\u001b[201~`;
}

function chunk<T>(values: T[], size: number): T[][] {
	const rows: T[][] = [];
	for (let index = 0; index < values.length; index += size) rows.push(values.slice(index, index + size));
	return rows;
}

function clean(value: string, maxLength: number): string {
	return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function targetFor(message: QQInboundMessage): QQReplyTarget {
	return {
		type: "private",
		userOpenId: message.userOpenId,
		msgId: message.id,
		createdAt: message.receivedAt,
	};
}
