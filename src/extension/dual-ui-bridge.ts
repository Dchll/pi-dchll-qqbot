import type {
	ExtensionUIDialogOptions,
	ExtensionUIContext,
	KeybindingsManager,
	Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";

type CustomComponent = Component & { dispose?(): void };
type CustomOptions = Parameters<ExtensionUIContext["custom"]>[1];

export interface RemoteUIInteractionHandle<T> {
	result: Promise<T>;
	cancel(): void;
}

export interface RemoteUIInteractionPort {
	openConfirm(title: string, message: string): RemoteUIInteractionHandle<boolean> | undefined;
	openSelect(title: string, options: string[]): RemoteUIInteractionHandle<string | undefined> | undefined;
	openInput(title: string, placeholder?: string): RemoteUIInteractionHandle<string | undefined> | undefined;
	openCustom(): RemoteCustomUIHandle | undefined;
}

export interface RemoteCustomUIController {
	render(width: number): string[];
	input(data: string): void;
}

export interface RemoteCustomUIHandle {
	attach(controller: RemoteCustomUIController): void;
	close(): void;
}

/** Connect public extension dialogs and custom components to terminal and QQ. */
export class DualUIBridge {
	private readonly bound = new WeakSet<ExtensionUIContext>();

	constructor(private readonly remote: RemoteUIInteractionPort) {}

	bind(ui: ExtensionUIContext): void {
		if (this.bound.has(ui)) return;
		this.bound.add(ui);

		const originalConfirm = ui.confirm.bind(ui);
		const originalSelect = ui.select.bind(ui);
		const originalInput = ui.input.bind(ui);
		const originalCustom: ExtensionUIContext["custom"] = ui.custom.bind(ui);

		ui.confirm = (title, message, options) => this.race(
			() => this.remote.openConfirm(title, message),
			(raceOptions) => originalConfirm(title, message, raceOptions),
			options,
		);
		ui.select = (title, options, dialogOptions) => this.race(
			() => this.remote.openSelect(title, options),
			(raceOptions) => originalSelect(title, options, raceOptions),
			dialogOptions,
		);
		ui.input = (title, placeholder, options) => this.race(
			() => this.remote.openInput(title, placeholder),
			(raceOptions) => originalInput(title, placeholder, raceOptions),
			options,
		);
		ui.custom = <T>(
			factory: (
				tui: TUI,
				theme: Theme,
				keybindings: KeybindingsManager,
				done: (result: T) => void,
			) => CustomComponent | Promise<CustomComponent>,
			options?: CustomOptions,
		): Promise<T> => {
			const remote = this.remote.openCustom();
			if (!remote) return originalCustom(factory, options);
			const wrappedFactory = async (
				tui: TUI,
				theme: Theme,
				keybindings: KeybindingsManager,
				done: (result: T) => void,
			): Promise<CustomComponent> => {
				const component = await factory(tui, theme, keybindings, (result) => {
					remote.close();
					done(result);
				});
				const proxy = proxyCustomComponent(component, remote);
				remote.attach({
					render: (width) => proxy.render(width),
					input: (data) => proxy.handleInput?.(data),
				});
				return proxy;
			};
			return originalCustom(wrappedFactory, options).finally(() => remote.close());
		};
	}

	private race<T>(
		openRemote: () => RemoteUIInteractionHandle<T> | undefined,
		runTerminal: (options?: ExtensionUIDialogOptions) => Promise<T>,
		options?: ExtensionUIDialogOptions,
	): Promise<T> {
		if (options?.signal?.aborted) return runTerminal(options);
		const remote = openRemote();
		if (!remote) return runTerminal(options);

		const terminalAbort = new AbortController();
		const terminalOptions = mergeSignal(options, terminalAbort.signal);
		let terminal: Promise<T>;
		try {
			terminal = runTerminal(terminalOptions);
		} catch (error) {
			remote.cancel();
			throw error;
		}

		return new Promise<T>((resolve, reject) => {
			let settled = false;
			const externalSignal = options?.signal;
			const onExternalAbort = () => remote.cancel();
			externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
			const cleanup = () => externalSignal?.removeEventListener("abort", onExternalAbort);

			terminal.then(
				(value) => {
					if (settled) return;
					settled = true;
					cleanup();
					remote.cancel();
					resolve(value);
				},
				(error: unknown) => {
					if (settled) return;
					settled = true;
					cleanup();
					remote.cancel();
					reject(error);
				},
			);
			remote.result.then(
				(value) => {
					if (settled) return;
					settled = true;
					cleanup();
					resolve(value);
					terminalAbort.abort(new Error("QQ completed the Pi interaction"));
				},
				() => undefined,
			);
		});
	}
}

function proxyCustomComponent(component: CustomComponent, remote: RemoteCustomUIHandle): CustomComponent {
	return new Proxy(component, {
		get(target, property) {
			if (property === "render") return (width: number) => target.render.call(target, width);
			if (property === "handleInput") {
				if (!target.handleInput) return undefined;
				return (data: string) => target.handleInput?.call(target, data);
			}
			if (property === "invalidate") return () => target.invalidate.call(target);
			if (property === "dispose") {
				return () => {
					remote.close();
					target.dispose?.call(target);
				};
			}
			const value = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
		set(target, property, value) {
			return Reflect.set(target, property, value, target);
		},
	});
}

function mergeSignal(
	options: ExtensionUIDialogOptions | undefined,
	localSignal: AbortSignal,
): ExtensionUIDialogOptions {
	return {
		...options,
		signal: options?.signal
			? AbortSignal.any([options.signal, localSignal])
			: localSignal,
	};
}
