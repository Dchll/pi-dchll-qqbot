# pi-agent-qqbot

通过 QQ 官方机器人 API，将一个 QQ 私聊连接到终端中正在运行的原生 Pi 会话。

QQ 不是另起一个 Agent，而是同一 Pi runtime 的第二个输入端：终端与 QQ 共享工作目录、模型、工具、上下文、会话历史，以及扩展创建的交互界面。

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
pi install git:github.com/gtiders/pi-agent-qqbot@v1.0.0
```

如果本机无法通过 HTTPS 连接 GitHub，可使用 SSH：

```bash
pi install git:git@github.com:gtiders/pi-agent-qqbot@v1.0.0
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
  "ownerOpenId": "YOUR_QQ_USER_OPENID",
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

扩展只接受 schema 5，不读取也不迁移过时配置。

| 字段 | 含义 |
| --- | --- |
| `appId` | QQ 机器人应用 ID。 |
| `clientSecret` | QQ 机器人密钥，不得提交真实值。 |
| `sandbox` | `true` 表示使用 QQ 沙箱端点。 |
| `ownerOpenId` | 唯一允许访问 Pi 的 QQ C2C 用户。 |
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

扩展加载时不会自动连接 QQ。每个新的 Pi 进程都需要在本地终端执行：

```text
/qqbot-start
/qqbot-link
```

本地专用命令：

| 命令 | 作用 |
| --- | --- |
| `/qqbot-start` | 启动 QQ Gateway；同进程重启会保留逻辑 link。 |
| `/qqbot-stop` | 只停止传输，保留 link 和当前原生 Pi 会话。 |
| `/qqbot-link` | 将配置的 owner 绑定到当前 Pi runtime。 |
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
- Gateway 不会随扩展自动启动。
- Pi 0.82 可以发现 Skills、提示词模板和扩展命令，但没有公开完整输入分发 API。因此 QQ 不能通用执行任意 Skill、模板或第三方 slash command，只能使用上面的白名单命令。
- 升级已安装包后必须完整重启 Pi。

## 故障排查

- 提示配置无效：检查 `schemaVersion`、`appId`、`clientSecret` 和 `ownerOpenId`。
- QQ 没有响应：先运行 `/qqbot-status`，再在本地执行 `/qqbot-start` 和 `/qqbot-link`。
- Gateway 被其他 Pi 占用：执行 `/qqbot-takeover`，或保留 `conflictPolicy: "ask"` 并在终端批准。
- 无法发送本地文件：将 `outboundMedia.enabled` 设置为 `true`，然后重启 Pi。
- QQ 按钮不可用：直接发送卡片中显示的对应文字命令。

## 开发

开发、架构与发布流程见 [开发指南](https://github.com/gtiders/pi-agent-qqbot/blob/main/docs/DEVELOPMENT.md)，发布记录见 [CHANGELOG](https://github.com/gtiders/pi-agent-qqbot/blob/main/CHANGELOG.md)。

## License

Apache-2.0
