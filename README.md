# Pi Dchll QQBot

## 测试阶段 / Testing stage

**当前项目处于测试阶段，请在非生产环境试用。功能、配置和命令可能随版本调整，目前仅在 Pi 1.4.0 测试通过。**

**This project is in the testing stage. Use it in non-production environments. Features, configuration, and commands may change between releases, and testing has been performed only with Pi 1.4.0.**

Pi Dchll QQBot 是一个 Pi 扩展，通过 QQ 官方 Bot API 把 QQ 私聊连接到电脑中正在运行的原生 Pi 会话。它不是独立的 Agent，而是同一 Pi 会话的另一个输入和回复端。

Pi Dchll QQBot is a Pi extension that connects QQ private chats to a native Pi session running on your computer through the official QQ Bot API. It is not a separate agent; QQ is another input and reply surface for the same Pi session.

## 项目简介 / Overview

终端和 QQ 共享工作目录、模型、工具、上下文与会话历史。你可以在电脑前使用终端，也可以离开电脑后继续从 QQ 操作同一个会话，不需要复制上下文或维护第二套 Agent。

The terminal and QQ share the working directory, model, tools, context, and session history. You can use the terminal at your computer and continue the same session from QQ later without copying context or maintaining a second agent.

## 快速上手 / Quick start

### 1. 准备环境 / Prepare the requirements

需要 Pi >=1.4.0 <2.0.0、Node.js >=22.19.0，以及原生 Windows、macOS 或 Linux。当前仅在最新版本 Pi 1.4.0 测试通过。还需要一个已启用 C2C 私聊的 QQ 官方机器人及其 AppID、AppSecret。

You need Pi >=1.4.0 <2.0.0, Node.js >=22.19.0, and native Windows, macOS, or Linux. Testing has been performed only with the latest Pi 1.4.0 release. You also need an official QQ bot with C2C direct messages enabled, plus its AppID and AppSecret.

不支持 WSL 路径转换，也不支持 Windows 与 WSL 混合安装。QQ 机器人可在 QQ 开放平台 https://q.qq.com/ 创建和管理。

WSL path translation and mixed Windows/WSL installations are not supported. Create and manage your QQ bot on the QQ Open Platform at https://q.qq.com/.

### 2. 安装扩展 / Install the extension

使用 npm 安装：

Install from npm:

~~~bash
pi install npm:pi-dchll-qqbot
~~~

也可以直接从 GitHub 安装：

You can also install directly from GitHub:

~~~bash
pi install git:github.com/Dchll/pi-dchll-qqbot
~~~

安装或升级后，必须完全退出并重新启动 Pi，确保扩展从最新代码加载。

Completely exit and restart Pi after installation or upgrade so the extension loads from the updated code.

### 3. 创建配置 / Create the configuration

在 macOS 或 Linux 上创建 ~/.pi/agent/pi-dchll-qqbot.json；在 Windows 上创建 %USERPROFILE%\.pi\agent\pi-dchll-qqbot.json。AppSecret 属于敏感凭据，不要提交到 Git，也不要发送到聊天中。

Create ~/.pi/agent/pi-dchll-qqbot.json on macOS or Linux, or %USERPROFILE%\.pi\agent\pi-dchll-qqbot.json on Windows. The AppSecret is a sensitive credential; never commit it to Git or send it in a chat.

~~~json
{
  "schemaVersion": 5,
  "appId": "YOUR_QQBOT_APP_ID",
  "clientSecret": "YOUR_QQBOT_APP_SECRET",
  "sandbox": false,
  "ownerOpenId": ""
}
~~~

仅支持 schemaVersion 5，旧配置不会自动迁移。sandbox 为 false 时使用正式环境，为 true 时使用 QQ 沙箱环境。首次绑定前将 ownerOpenId 留空，后续由扩展写入。

Only schemaVersion 5 is accepted; older configurations are not migrated automatically. Set sandbox to false for production or true for the QQ sandbox. Leave ownerOpenId empty during the first bootstrap; the extension fills it after confirmation.

### 4. 绑定 QQ Owner / Bind the QQ owner

在电脑上的 Pi 终端执行首次引导命令：

Run the first-owner bootstrap command in the Pi terminal on your computer:

~~~text
/qqbot-start
~~~

从需要授权的 QQ 账号私聊机器人发送任意消息。终端会显示检测到的 user_openid，确认后扩展将其写入 ownerOpenId。这个 QQ 用户将成为唯一允许操作 Pi 的 Owner。

Send any private message to the bot from the QQ account you want to authorize. The terminal displays the detected user_openid and saves it as ownerOpenId after your confirmation. This QQ user becomes the only Owner allowed to operate Pi.

### 5. 启动并验证 / Link and verify

Owner 配置完成后，在本地终端启动 Gateway 并绑定当前 Pi 会话。扩展不会随 Pi 自动连接 QQ，因此每个新 Pi 进程都需要执行一次链接命令。

After configuring the Owner, start the Gateway and link it to the current Pi session from the local terminal. The extension does not connect to QQ automatically, so link each new Pi process explicitly.

~~~text
/qqbot-link
/qqbot-status
~~~

现在可以从 QQ 私聊机器人发送普通文本。Pi 忙碌时，消息会通过原生 Steering 引导当前回合；回复会发送到原 QQ 私聊。

You can now send ordinary text to the bot in a QQ private chat. When Pi is busy, your message guides the active turn through native Steering, and the reply is delivered to the originating QQ conversation.

## 功能介绍 / Features

### 同一原生会话 / One native session

一个机器人配置对应一个 QQ C2C Owner，并在同一时刻绑定一个原生 Pi 会话。可通过 QQ 新建或恢复会话，但不提供多个 Agent 并行接收同一机器人消息的能力。

One bot configuration maps to one QQ C2C Owner and links to one native Pi session at a time. You can create or resume sessions from QQ, but multiple agents cannot consume messages from the same bot in parallel.

### 对话与回复 / Messages and replies

QQ 文本进入当前链接的 Pi 会话，忙碌时使用 Steering。共享回合按最后一个输入确定回复归属，避免 QQ 回复被吞掉或终端回复误发 QQ。最终文本支持 Markdown、长消息分片、纯文本降级和 QQ 被动回复次数管理。

QQ text enters the linked Pi session and uses Steering while Pi is busy. A shared turn uses its latest input to determine reply ownership, preventing dropped QQ replies and accidental terminal-to-QQ forwarding. Final text supports Markdown, long-message chunking, plain-text fallback, and QQ passive-reply budget management.

### QQ 命令 / QQ commands

QQ 端提供 /help、/status、/model、/thinking、/new、/sessions、/resume、/name、/compact 和 /stop，可用于查看状态、切换模型与思考等级、管理会话、压缩上下文或中止回合。客户端支持时显示按钮，也可以直接发送文字命令。

QQ provides /help, /status, /model, /thinking, /new, /sessions, /resume, /name, /compact, and /stop for status, model and thinking controls, session management, context compaction, and turn cancellation. Supported clients show buttons, and every action is also available as a text command.

### 双端交互界面 / Shared interaction UI

QQ 回合打开 ctx.ui.confirm、ctx.ui.select 或 ctx.ui.input 时，QQ 与终端都会收到交互，先完成的一端生效。扩展创建的 ctx.ui.custom 在两端共享同一个组件实例，QQ 通过 72 列 TUI 快照、方向键、翻页、编辑和确认控件操作。

When a QQ turn opens ctx.ui.confirm, ctx.ui.select, or ctx.ui.input, both QQ and the terminal receive the interaction and the first response wins. An extension-created ctx.ui.custom shares one component instance across both surfaces, with a 72-column TUI snapshot and navigation, paging, editing, and confirmation controls on QQ.

Pi 核心 TUI、外部 PTY 程序、思考链，以及仅由终端回合打开的自定义界面，不会被转发到 QQ。

Pi core TUI, external PTY programs, reasoning traces, and custom interfaces opened only by terminal-originated turns are not forwarded to QQ.

### 媒体与文件 / Media and files

入站支持图片、语音、文档和普通文件。图片可传给图像模型，支持的文档按上下文预算提取内容，语音可使用 QQ ASR 文本或可选的 OpenAI 兼容 STT，其他文件保留为临时本地资源供 Pi 工具读取。

Inbound media supports images, voice, documents, and ordinary files. Images can be sent to image-capable models, supported documents are extracted within the context budget, voice can use QQ ASR text or optional OpenAI-compatible STT, and other files remain available as temporary local resources for Pi tools.

启用出站媒体后，qq_send_local_file 工具可以向当前 QQ 回合的原始会话发送经过校验的本地文件。出站功能默认关闭，文件发送受 QQ 平台限制和本地文件身份校验约束。

With outbound media enabled, the qq_send_local_file tool can send verified local files to the originating conversation of the current QQ turn. Outbound delivery is disabled by default and remains subject to QQ platform limits and local file-identity checks.

### 多进程接管 / Multiple Pi processes

多个本地 Pi 进程可以配置同一个机器人，但同一时刻只有一个进程持有 Gateway。可以停止传输、保留逻辑链接，或从另一进程接管所有权；接管不会终止旧 Pi 进程。

Multiple local Pi processes can be configured for the same bot, but only one process owns the Gateway at a time. You can stop transport while retaining the logical link, or transfer ownership from another process without terminating the previous Pi process.

### 安全与边界 / Security and boundaries

只接受配置 Owner 的 C2C 消息，群消息和其他用户在附件处理及 Agent 调用前被忽略。/qqbot-* 本地控制命令不能从 QQ 执行，QQ 也只能使用显式白名单中的命令，不能通用调用任意 Skill、提示词模板或第三方 slash command。

Only C2C messages from the configured Owner are accepted. Group messages and other users are ignored before attachment handling or agent work. Local /qqbot-* controls cannot be executed from QQ, and QQ supports only explicitly allowlisted commands rather than arbitrary skills, prompt templates, or third-party slash commands.

入站下载强制 HTTPS、SSRF 防护、有限重定向和网络停滞检测。本地文件发送执行 realpath、普通文件身份、链接与重命名竞争校验。媒体策略使用 denylist，可配置禁止的类型、扩展名和目录。

Inbound downloads enforce HTTPS, SSRF protection, bounded redirects, and stalled-network detection. Local-file delivery validates real paths, regular-file identity, links, and rename races. Media policies use denylists for restricted types, extensions, and directories.

## 本地命令速查 / Local command reference

本地命令用于首次绑定、启动、停止、解除链接、查看状态和处理多进程接管，只能在电脑上的 Pi 终端执行。

Local commands handle first-owner bootstrap, linking, stopping, unlinking, status checks, and multi-process takeover. They are available only in the Pi terminal on your computer.

~~~text
/qqbot-start
/qqbot-link
/qqbot-stop
/qqbot-unlink
/qqbot-status
/qqbot-takeover
~~~

## 配置补充 / More configuration

完整示例见 pi-dchll-qqbot.json.example。link.conflictPolicy 可设为 ask 或 takeover；inboundMedia 支持 deniedKinds、deniedExtensions 和可选 stt；outboundMedia 支持 enabled、deniedRoots、deniedKinds 和 deniedExtensions；logging.level 支持 error、info 和 debug。

See pi-dchll-qqbot.json.example for the complete configuration. link.conflictPolicy accepts ask or takeover; inboundMedia supports deniedKinds, deniedExtensions, and optional stt; outboundMedia supports enabled, deniedRoots, deniedKinds, and deniedExtensions; logging.level accepts error, info, or debug.

空 denylist 不增加扩展层限制，但 QQ 平台硬限制和安全校验仍然生效。启用本地文件发送后需要重启 Pi。

An empty denylist adds no extension-level restriction, while QQ platform limits and safety checks still apply. Restart Pi after enabling local-file delivery.

## 故障排查 / Troubleshooting

提示配置无效时，检查 schemaVersion、appId、clientSecret 和 ownerOpenId。QQ 没有回复时，先执行 /qqbot-status，再执行 /qqbot-link；升级或重载异常时，完全重启 Pi。Gateway 被其他进程占用时，使用 /qqbot-takeover 或在终端确认接管。

For invalid configuration errors, check schemaVersion, appId, clientSecret, and ownerOpenId. If QQ does not respond, run /qqbot-status and then /qqbot-link; after an upgrade or an abnormal reload, completely restart Pi. If another process owns the Gateway, use /qqbot-takeover or confirm the takeover in the terminal.

无法发送本地文件时，将 outboundMedia.enabled 设为 true 并重启 Pi。QQ 按钮不可用时，直接发送卡片中显示的文字命令。

If local-file delivery is unavailable, set outboundMedia.enabled to true and restart Pi. If QQ buttons are unavailable, send the equivalent text command shown on the card.

## 开发与许可 / Development and license

本项目由 Dchll 维护，基于 gtiders/pi-agent-qqbot 1.0.4 派生。架构、开发和发布流程见 docs/DEVELOPMENT.md，版本变化见 CHANGELOG.md，许可证为 Apache-2.0。

This project is maintained by Dchll and derived from gtiders/pi-agent-qqbot 1.0.4. See docs/DEVELOPMENT.md for architecture, development, and release procedures, CHANGELOG.md for release history, and Apache-2.0 for the license.
