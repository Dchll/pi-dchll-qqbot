<p>
  <img src="https://raw.githubusercontent.com/gtiders/pi-agent-qqbot/main/pi-agent-qqbot.png" alt="Pi Agent QQBot" width="1100">
</p>

# Pi Agent QQBot

> [English](#english) | [简体中文](#简体中文)

<a id="english"></a>

## English

Connect a QQ C2C conversation to the native [Pi](https://pi.dev/) session that is already running in your terminal, using the official QQ Bot API.

### Why This Exists

QQ is not a separate agent. It is a second input surface for the same Pi runtime: terminal and QQ share the working directory, model, tools, context, session history, and extension-created interaction UI.

Use the same live coding session from QQ when you are away from the terminal, without creating a second agent, duplicating context, or exposing a general-purpose remote command shell.

### Requirements

- Pi `>=0.82.0 <1.0.0`
- Node.js `>=22.19.0`
- An official QQ bot with C2C direct messages enabled
- Native Windows, macOS, or Linux

WSL path translation and mixed Windows/WSL installations are not supported.

### Highlights

- Bind one configured QQ C2C owner to the active native Pi session.
- Work from QQ with the same workspace, model, context, and session history.
- Use QQ Keyboard controls for models, thinking levels, and native Pi sessions.
- Deliver `ctx.ui.confirm()`, `select()`, and `input()` to both terminal and QQ. The first response from either side wins.
- Operate extension-created `ctx.ui.custom()` remotely through a TUI snapshot, keys, and text input.
- Receive images, voice, documents, and ordinary files without extension-level file count, type, or size quotas.
- Send verified local files through QQ's official chunked-upload API.
- Transfer Gateway ownership between local Pi processes without stopping either process.

### Install

Install the published npm package:

```bash
pi install npm:pi-agent-qqbot
```

You can also install a tagged GitHub release:

```bash
pi install git:github.com/gtiders/pi-agent-qqbot@v1.0.4
```

When HTTPS access to GitHub is unavailable, use SSH:

```bash
pi install git:git@github.com:gtiders/pi-agent-qqbot@v1.0.4
```

Completely exit and restart Pi after installation or upgrade.

### Configure

Create `~/.pi/agent/pi-agent-qqbot.json`. On Windows, this is `%USERPROFILE%\.pi\agent\pi-agent-qqbot.json`.

```json
{
  "schemaVersion": 5,
  "appId": "YOUR_QQBOT_APP_ID",
  "clientSecret": "YOUR_QQBOT_APP_SECRET",
  "sandbox": true,
  "ownerOpenId": "",
  "link": { "conflictPolicy": "ask" },
  "inboundMedia": { "deniedKinds": [], "deniedExtensions": [] },
  "outboundMedia": {
    "enabled": false,
    "deniedRoots": [],
    "deniedKinds": [],
    "deniedExtensions": []
  },
  "logging": { "level": "info" }
}
```

Only schema 5 is accepted. Earlier configurations are neither read nor migrated. For first-time setup, leave `ownerOpenId` empty and use `/qqbot-start` to discover and confirm it locally.

| Field | Meaning |
| --- | --- |
| `appId` | QQ bot application ID. |
| `clientSecret` | QQ bot secret. Never commit a real value. |
| `sandbox` | Use QQ's sandbox endpoint when `true`. |
| `ownerOpenId` | The only QQ C2C user allowed to access Pi. Leave it empty only during first-time bootstrap. |
| `link.conflictPolicy` | `ask` requests terminal approval before takeover; `takeover` transfers ownership automatically. |
| `inboundMedia.deniedKinds` | Deny `image`, `video`, `voice`, or `file`; an empty list denies no type. |
| `inboundMedia.deniedExtensions` | Deny file extensions such as `.exe`; an empty list denies none. |
| `inboundMedia.stt` | Optional OpenAI-compatible speech-to-text settings: `baseUrl`, `apiKeyEnv`, and `model`. |
| `outboundMedia.enabled` | Master switch for local file delivery; defaults to `false`. |
| `outboundMedia.deniedRoots` | Real directory roots that must never be sent; an empty list permits every path readable by the current account. |
| `outboundMedia.deniedKinds` | Deny outbound media types; an empty list denies none. |
| `outboundMedia.deniedExtensions` | Deny outbound extensions; an empty list denies none. |
| `logging.level` | `error`, `info`, or `debug`. |

Media policies use denylist semantics. An omitted field or empty list adds no product-level restriction. QQ platform limits and file-integrity checks still apply.

### Start and Link

The extension does not connect to QQ automatically. For normal use, run this command in the local terminal for each new Pi process:

```text
/qqbot-link
```

For first-time setup only: save `appId` and `clientSecret`, leave `ownerOpenId` empty, run `/qqbot-start`, then send any C2C message to the bot. Pi displays the detected `user_openid` locally; after terminal confirmation it saves the value. Run `/qqbot-link` afterwards.

| Local command | Purpose |
| --- | --- |
| `/qqbot-start` | First-time bootstrap only. Temporarily starts the Gateway to discover the first private sender OpenID; terminal confirmation writes it to the config and stops bootstrap. |
| `/qqbot-stop` | Stop transport only; preserve the link and native Pi session. |
| `/qqbot-link` | Start the QQ Gateway and bind the configured owner to the current Pi runtime. |
| `/qqbot-unlink` | Remove the logical link and invalidate pending QQ replies. |
| `/qqbot-status` | Show Gateway, ownership, link, session, model, and queue state. |
| `/qqbot-takeover` | Take Gateway ownership from another local Pi process. |

QQ cannot run `/qqbot-*` commands.

### QQ Commands

QQ commands are explicitly allowlisted and appear as a Keyboard when supported by the client.

| Command | Purpose |
| --- | --- |
| `/help` | Show the command menu. |
| `/status` | Show the active link and Pi state. |
| `/model [provider/model]` | Browse, search, or switch the active model. |
| `/thinking [level]` | Show or change the thinking level. |
| `/new [name]` | Create a native Pi session, optionally named. |
| `/sessions [query]` | List or search native Pi sessions. |
| `/resume <id-or-name>` | Switch to a uniquely matching native Pi session. |
| `/name <name>` | Rename the current session. |
| `/compact [instructions]` | Compact the active context. |
| `/stop` | Abort the active Pi turn. |

Normal QQ text is injected into the linked Pi session and uses Pi's native follow-up delivery while Pi is busy. Only output from QQ-originated turns is returned to QQ; output from terminal-originated turns remains in the terminal.

### Shared Interaction UI

When a QQ-originated turn opens `ctx.ui.confirm()`, `ctx.ui.select()`, or `ctx.ui.input()`, both QQ and terminal receive the interaction. The first side to complete it wins and invalidates the other side.

For extension-created `ctx.ui.custom()`, both surfaces operate the same component instance. QQ receives a 72-column TUI snapshot with terminal control sequences removed, plus directional, paging, Home/End, Tab, space, backspace, delete, submit, cancel, and refresh controls. Normal QQ text is injected as terminal bracketed-paste input, including into password fields.

Pi core TUI, external PTY programs, and custom UI opened only by terminal-originated turns are outside this relay's scope.

### Media

Inbound media has no extension-level count, type, individual-size, or total-size quotas. Images go to image-capable models; supported documents are extracted within remaining context budget; voice uses QQ ASR text when available; unknown files remain as temporary local resources for Pi tools.

Inbound downloads still enforce HTTPS, SSRF protection, bounded redirects, cancellation, and stalled-network detection.

With outbound media enabled, the `qq_send_local_file` tool can send a local file only to the original conversation of the current QQ turn. Candidates are checked with `realpath`, regular-file identity, hard-link, symlink/junction, and rename-race validation. QQ's 200 MB upload limit and passive-reply count remain platform constraints.

### Current Boundaries

- One configured QQ C2C owner only. Group messages and other users are ignored before attachment handling and agent work.
- The Gateway does not start automatically with the extension. Run `/qqbot-link` for normal operation.
- Pi 0.82 can discover Skills, prompt templates, and extension commands, but does not expose a complete public input-dispatch API. QQ therefore cannot generically execute every Skill, template, or third-party slash command; it supports only the allowlisted commands above.
- Restart Pi completely after upgrading an installed package.

### Troubleshooting

- Invalid configuration: verify `schemaVersion`, `appId`, `clientSecret`, and `ownerOpenId`.
- No QQ response: run `/qqbot-status`, then run `/qqbot-link` locally.
- Missing `ownerOpenId`: leave it empty, run `/qqbot-start`, message the bot from QQ, and confirm the displayed OpenID in the terminal.
- Gateway owned by another Pi: run `/qqbot-takeover`, or retain `conflictPolicy: "ask"` and approve in the terminal.
- Cannot send local files: set `outboundMedia.enabled` to `true`, then restart Pi.
- QQ buttons unavailable: send the corresponding text command shown on the card.

### Development

See the [development guide](https://github.com/gtiders/pi-agent-qqbot/blob/main/docs/DEVELOPMENT.md) for architecture, development, and release procedures, and [CHANGELOG](https://github.com/gtiders/pi-agent-qqbot/blob/main/CHANGELOG.md) for release history.

### License

Apache-2.0

---

<a id="简体中文"></a>

## 简体中文

通过 QQ 官方机器人 API，将一个 QQ 私聊连接到终端中正在运行的原生 Pi 会话。

## 为什么需要它

QQ 不是另起一个 Agent，而是同一 Pi runtime 的第二个输入端：终端与 QQ 共享工作目录、模型、工具、上下文、会话历史，以及扩展创建的交互界面。

离开终端时也能从 QQ 继续使用同一个实时编码会话，无需另起 Agent、复制上下文，也不会把 Pi 暴露成通用远程命令终端。

## 环境要求

- Pi `>=0.82.0 <1.0.0`
- Node.js `>=22.19.0`
- 已启用 C2C 私聊消息的 QQ 官方机器人
- 原生 Windows、macOS 或 Linux

不支持 WSL 路径转换，也不支持 Windows/WSL 混合安装。

## 主要能力

- 将唯一配置的 QQ C2C owner 绑定到当前原生 Pi 会话。
- 从 QQ 操作同一工作目录、模型、上下文和会话历史。
- 使用 QQ Keyboard 切换模型、思考等级和原生 Pi 会话。
- 将 `ctx.ui.confirm()`、`select()`、`input()` 同时发送到终端和 QQ，任意一端先完成即生效。
- 通过 TUI 快照、按键和文字输入远程操作扩展创建的 `ctx.ui.custom()`。
- 接收图片、语音、文档及普通文件，不增加扩展层文件数量、格式或大小配额。
- 通过 QQ 官方分片上传 API 发送经过本地文件身份校验的文件。
- 在本机多个 Pi 进程间转移 Gateway 所有权，不终止任何 Pi 进程。

## 安装

安装 npm 正式版本：

```bash
pi install npm:pi-agent-qqbot
```

也可以从 GitHub 的版本标签安装：

```bash
pi install git:github.com/gtiders/pi-agent-qqbot@v1.0.4
```

如果本机无法通过 HTTPS 连接 GitHub，可使用 SSH：

```bash
pi install git:git@github.com:gtiders/pi-agent-qqbot@v1.0.4
```

安装或升级后必须完整退出并重新启动 Pi。

## 配置

创建 `~/.pi/agent/pi-agent-qqbot.json`。Windows 路径为 `%USERPROFILE%\.pi\agent\pi-agent-qqbot.json`。

```json
{
  "schemaVersion": 5,
  "appId": "YOUR_QQBOT_APP_ID",
  "clientSecret": "YOUR_QQBOT_APP_SECRET",
  "sandbox": true,
  "ownerOpenId": "",
  "link": {
    "conflictPolicy": "ask"
  },
  "inboundMedia": {
    "deniedKinds": [],
    "deniedExtensions": []
  },
  "outboundMedia": {
    "enabled": false,
    "deniedRoots": [],
    "deniedKinds": [],
    "deniedExtensions": []
  },
  "logging": {
    "level": "info"
  }
}
```

扩展只接受 schema 5，不读取也不迁移过时配置。首次配置时可将 `ownerOpenId` 留空，通过 `/qqbot-start` 在本地发现并确认写入。

| 字段 | 含义 |
| --- | --- |
| `appId` | QQ 机器人应用 ID。 |
| `clientSecret` | QQ 机器人密钥，不得提交真实值。 |
| `sandbox` | `true` 表示使用 QQ 沙箱端点。 |
| `ownerOpenId` | 唯一允许访问 Pi 的 QQ C2C 用户；仅首次引导时可留空。 |
| `link.conflictPolicy` | `ask` 在接管前请求终端确认；`takeover` 自动转移所有权。 |
| `inboundMedia.deniedKinds` | 禁止 `image`、`video`、`voice` 或 `file`；空数组表示不禁止类型。 |
| `inboundMedia.deniedExtensions` | 禁止 `.exe` 等扩展名；空数组表示不禁止扩展名。 |
| `inboundMedia.stt` | 可选的 OpenAI 兼容语音转写配置：`baseUrl`、`apiKeyEnv`、`model`。 |
| `outboundMedia.enabled` | 本地文件出站总开关，默认 `false`。 |
| `outboundMedia.deniedRoots` | 永远禁止发送的真实目录根路径；空数组允许所有当前账户可读路径。 |
| `outboundMedia.deniedKinds` | 禁止出站媒体类型；空数组表示不禁止类型。 |
| `outboundMedia.deniedExtensions` | 禁止出站文件扩展名；空数组表示不禁止扩展名。 |
| `logging.level` | `error`、`info` 或 `debug`。 |

媒体配置统一采用黑名单语义：字段缺失或数组为空表示不增加产品限制。QQ 平台硬限制和文件完整性校验仍然生效。

## 启动与绑定

扩展加载时不会自动连接 QQ。正常使用时，每个新的 Pi 进程都需要在本地终端执行：

```text
/qqbot-link
```

仅首次配置：先写入 `appId` 和 `clientSecret`，将 `ownerOpenId` 留空，执行 `/qqbot-start`，再从 QQ 私聊机器人发送任意消息。Pi 会在本地显示收到的 `user_openid`；终端确认后自动写入配置。随后执行 `/qqbot-link`。

本地专用命令：

| 命令 | 作用 |
| --- | --- |
| `/qqbot-start` | 仅首次引导使用。临时启动 Gateway 发现第一位私聊用户的 OpenID；终端确认后写入配置并停止引导。 |
| `/qqbot-stop` | 只停止传输，保留 link 和当前原生 Pi 会话。 |
| `/qqbot-link` | 启动 QQ Gateway，并将配置的 owner 绑定到当前 Pi runtime。 |
| `/qqbot-unlink` | 解除逻辑 link，并使未完成的旧 QQ 回复失效。 |
| `/qqbot-status` | 查看 Gateway、所有权、link、会话、模型和队列状态。 |
| `/qqbot-takeover` | 从本机另一个 Pi 进程接管 Gateway。 |

QQ 端不能执行任何 `/qqbot-*` 命令。

## QQ 命令

QQ 命令采用显式白名单，并在客户端支持时显示 Keyboard：

| 命令 | 作用 |
| --- | --- |
| `/help` | 显示命令菜单。 |
| `/status` | 查看当前 link 和 Pi 状态。 |
| `/model [provider/model]` | 浏览、搜索或切换当前模型。 |
| `/thinking [level]` | 查看或切换思考等级。 |
| `/new [name]` | 新建原生 Pi 会话，可同时命名。 |
| `/sessions [query]` | 列出或搜索原生 Pi 会话。 |
| `/resume <id-or-name>` | 切换到唯一匹配的原生 Pi 会话。 |
| `/name <name>` | 重命名当前会话。 |
| `/compact [instructions]` | 压缩当前上下文。 |
| `/stop` | 中止当前 Pi 回合。 |

普通 QQ 文本会注入已绑定的 Pi 会话；Pi 忙碌时按原生 follow-up 投递。只有 QQ 发起的回合会回复 QQ，终端发起的输出只留在终端。

## 双端交互界面

QQ 发起的回合打开 `ctx.ui.confirm()`、`ctx.ui.select()` 或 `ctx.ui.input()` 时，终端与 QQ 会同时收到交互。任意一端最先完成即生效，另一端随即失效。

扩展创建的 `ctx.ui.custom()` 在两端共享同一个组件实例。QQ 会收到去除终端控制序列后的 72 列 TUI 快照，并提供方向键、翻页、Home/End、Tab、空格、退格、删除、确认、取消和刷新。普通 QQ 文本按终端 bracketed paste 输入，包括密码字段。

Pi 核心 TUI、外部 PTY 程序，以及仅由终端回合打开的自定义界面不在代理范围内。

## 媒体

入站媒体没有扩展层数量、格式、单文件或总大小配额。图片会传给支持图片的模型，已支持的文档按剩余上下文预算提取，语音优先使用 QQ ASR 文本，未知文件保留为临时本地资源供 Pi 工具读取。

入站下载仍强制 HTTPS、SSRF 防护、有限重定向、取消处理和网络停滞检测。

启用出站媒体后，`qq_send_local_file` 工具只能向当前 QQ 回合的原始会话发送本地文件。候选文件会经过 realpath、普通文件身份、hard-link、symlink/junction 和 rename-race 校验。QQ 的 200 MB 上传上限与被动回复次数仍是平台约束。

## 当前边界

- 只支持一个配置的 QQ C2C owner；群消息和其他用户会在附件处理与 Agent 工作前被忽略。
- Gateway 不会随扩展自动启动；日常运行请执行 `/qqbot-link`。
- Pi 0.82 可以发现 Skills、提示词模板和扩展命令，但没有公开完整输入分发 API。因此 QQ 不能通用执行任意 Skill、模板或第三方 slash command，只能使用上面的白名单命令。
- 升级已安装包后必须完整重启 Pi。

## 故障排查

- 提示配置无效：检查 `schemaVersion`、`appId`、`clientSecret` 和 `ownerOpenId`。
- QQ 没有响应：先运行 `/qqbot-status`，再在本地执行 `/qqbot-link`。
- 缺少 `ownerOpenId`：将其留空，执行 `/qqbot-start`，从 QQ 向机器人发消息，并在终端确认显示的 OpenID。
- Gateway 被其他 Pi 占用：执行 `/qqbot-takeover`，或保留 `conflictPolicy: "ask"` 并在终端批准。
- 无法发送本地文件：将 `outboundMedia.enabled` 设置为 `true`，然后重启 Pi。
- QQ 按钮不可用：直接发送卡片中显示的对应文字命令。

## 开发

开发、架构与发布流程见 [开发指南](https://github.com/gtiders/pi-agent-qqbot/blob/main/docs/DEVELOPMENT.md)，发布记录见 [CHANGELOG](https://github.com/gtiders/pi-agent-qqbot/blob/main/CHANGELOG.md)。

## License

Apache-2.0
