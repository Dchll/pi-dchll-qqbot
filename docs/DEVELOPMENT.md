# 开发指南

本文档是 `pi-agent-qqbot` 1.x 的开发与排障手册。用户安装和操作见根目录 `README.md`，Agent 工作约束见根目录 `AGENTS.md`。历史设计只保存在 `docs/archive/`，不得把归档内容当作当前行为依据。

## 1. 开发环境

要求：

- Node.js 22.19 或更高版本
- 支持 lockfile 的 npm
- Pi `>=0.82.0 <1.0.0`
- 原生 Windows、macOS 或 Linux

安装锁文件中的准确依赖图：

```bash
npm ci
```

确认项目实际使用的 Pi SDK：

```bash
npm ls @earendil-works/pi-coding-agent @earendil-works/pi-tui --depth=0
npm exec -- pi --version
```

`package.json` 声明兼容范围，`package-lock.json` 固定 CI 和发布验证使用的实际版本。不要手工修改 lockfile；依赖升级应通过 npm 完成，并单独审查解析结果。

## 2. 快速开始

常用开发循环：

```bash
npm run typecheck
npm run test:focused -- test/integration/extension/native-session-runtime.test.ts
npm run verify
```

从本地 checkout 安装到 Pi：

```bash
pi install /absolute/path/to/pi-agent-qqbot
```

修改扩展源码后需要完整重启 Pi。配置文件位于 `~/.pi/agent/pi-agent-qqbot.json`，不在仓库内。不要用真实凭据运行会记录命令输出的诊断脚本。

## 3. 目录和模块地图

Pi 直接加载 `src/index.ts`，该文件只转交到 extension composition root。

| 路径 | 责任 | 首选测试 |
| --- | --- | --- |
| `src/domain/native-session-link.ts` | Gateway/link/session generation 状态与陈旧回合判断 | `test/unit/domain/native-session-link.test.ts` |
| `src/domain/reply-budget.ts` | QQ 每条消息被动回复预算 | `test/unit/domain/domain.test.ts` |
| `src/domain/message-dedupe.ts` | 入站消息 TTL 去重 | `test/unit/domain/domain.test.ts` |
| `src/application/deliver-reply.ts` | Markdown、文本 fallback 和回复序号交付 | `test/unit/qq/api.test.ts`、characterization tests |
| `src/application/ports.ts` | 跨层 DTO 和配置契约 | 由 TypeScript 与配置测试覆盖 |
| `src/infrastructure/config/*` | 唯一配置路径、schema 5 读取、规范化和校验 | `test/characterization/config.test.ts`、`test/integration/config/*` |
| `src/infrastructure/qq/auth.ts` | access token 获取、缓存、刷新、错误脱敏 | `test/unit/qq/auth.test.ts` |
| `src/infrastructure/qq/gateway.ts` | WebSocket identify、heartbeat、resume、重连 | `test/unit/qq/gateway.test.ts` |
| `src/infrastructure/qq/api.ts` | QQ REST、被动回复、Markdown、Keyboard、媒体上传 | `test/unit/qq/api.test.ts`、`test/characterization/qq-api.test.ts` |
| `src/infrastructure/qq/payload-normalizer.ts` | QQ C2C/group event 转内部消息 | `test/unit/qq/payload-normalizer.test.ts` |
| `src/infrastructure/media/attachment-downloader.ts` | HTTPS、SSRF、重定向、取消与临时文件 | `test/integration/media/attachment-downloader.test.ts` |
| `src/infrastructure/media/attachment-pipeline.ts` | 入站附件策略、图片、语音、文档和 prompt 组装 | `test/integration/extension/native-session-runtime.test.ts` |
| `src/infrastructure/media/document-extractors.ts` | 文本文档与 PDF 提取 | media/integration tests |
| `src/infrastructure/media/stt.ts` | 可选 OpenAI-compatible STT | media/integration tests |
| `src/infrastructure/media/outbound-media.ts` | 本地文件策略、QQ 类型选择和交付上下文 | `test/characterization/outbound-media.test.ts` |
| `src/infrastructure/platform/opened-file-identity.ts` | realpath、link、rename race 和普通文件验证 | `test/integration/platform/opened-file-identity.test.ts` |
| `src/presentation/qq/*` | 命令解析、Keyboard、模型分页、回复格式和用户错误 | `test/characterization/user-facing.test.ts` 等 |
| `src/extension/extension.ts` | 注册工具、命令和 Pi lifecycle hooks | `test/integration/extension/composition-root.test.ts` |
| `src/extension/native-session-runtime.ts` | QQ 与 Pi 的主编排、origin 关联和资源释放 | `test/integration/extension/native-session-runtime.test.ts` |
| `src/extension/pi-command-bridge.ts` | 用公开 Pi context 实现白名单命令 | `test/unit/extension/pi-command-bridge.test.ts` |
| `src/extension/gateway-ownership.ts` | 多进程 owner record 与 loopback takeover | `test/integration/extension/gateway-ownership.test.ts` |
| `src/extension/dual-ui-bridge.ts` | 包装扩展公开 `ctx.ui` | native runtime integration tests |
| `src/extension/qq-ui-interactions.ts` | QQ 交互 token、卡片、按键和自定义 TUI 快照 | native runtime integration tests |

分层依赖只能向内指向。Domain 不得导入外层模块，application 不得导入 infrastructure 或 presentation；`test/unit/architecture/import-boundaries.test.ts` 会检查这些规则。

## 4. 启动和所有权流程

### 4.1 扩展加载

`src/extension/extension.ts` 注册 Pi tool、local slash commands 和 lifecycle handlers。加载阶段不得创建网络连接。`session_start` 只做以下工作：

1. 从唯一配置路径读取 schema 5。
2. 将配置交给 `NativeSessionRuntime.configure()`。
3. 记录当前 native session context。
4. 包装当前 context 的公开 `ctx.ui`。

如果扩展一加载就连接 QQ，说明生命周期边界被破坏。

### 4.2 `/qqbot-start`

调用链：

```text
extension command
  -> NativeSessionRuntime.start()
  -> GatewayOwnership.claim()
  -> QQAuth + QQApi + QQGateway
  -> gateway.connect()
```

`start()` 必须先捕获 `ExtensionCommandContext`，因为 `/new`、`/resume` 等 QQ 白名单命令需要 Pi 只在 command context 暴露的能力。并发 start 通过 `startPromise` 合并。

### 4.3 `/qqbot-link`

Gateway 必须已经 running。link 保存 appId、ownerOpenId、runtimeId、generation 和当前 native session。每次 unlink/rebind 会改变 generation，旧 QQ 回合因此无法在新 link 上回复。

### 4.4 takeover

`GatewayOwnership` 使用 appId/owner 范围的 owner record、PID、nonce 和 loopback endpoint。接管只释放旧进程 Gateway 并可转移逻辑 link，不终止旧 Pi 进程。排障时不要通过 kill 进程掩盖所有权问题。

## 5. QQ 消息到 Pi 的完整链路

入口是 `NativeSessionRuntime.handleInbound()`：

```text
QQ Gateway event
  -> payload-normalizer
  -> gateway running check
  -> private + ownerOpenId check
  -> link check
  -> internal UI command / UI text / QQ whitelist command
  -> attachment pipeline
  -> pendingQQ origin record
  -> pi.sendUserMessage()
```

顺序是安全契约。群消息和非 owner 必须在附件下载、文档解析和 Agent 调用前返回。

普通消息的 origin 关联分四步：

1. `handleInbound()` 在调用 `sendUserMessage()` 前写入 `pendingQQ`，并保存 target、原始消息、回复预算和 cleanup。
2. Pi 发出 `input` event。只有 `source === "extension"` 且文本与队首 pending prompt 相同时，QQ origin 才进入 `acceptedOrigins`；其他输入记录为 terminal origin。
3. `agent_end` 只保存最后一条 assistant 文本。
4. `agent_settled` 同步弹出 origin 与输出。只有仍属于当前 generation 的 QQ origin 才能回复 QQ，最后统一释放附件、交互和交付上下文。

如果出现“终端有回复但 QQ 没回复”，优先检查 `acceptedOrigins`、`agentOutputs`、generation、Gateway 状态和 `replyBudgets` 是否同步，而不是先修改格式化器。

Pi 忙碌时，QQ 输入通过 `sendUserMessage(..., { deliverAs: "followUp" })` 排队。不要自行增加插件队列长度限制；Pi 原生队列负责调度。

## 6. QQ 命令链路

QQ 命令不是任意 Pi slash command 转发：

```text
normalizeCommandText()
  -> parseQQCommand()
  -> LOCAL_ONLY_COMMANDS deny
  -> REMOTE_COMMANDS allowlist
  -> executeRemoteCommand()
  -> PiCommandBridge public API adapter
```

新增 QQ 命令至少要同步修改：

- `REMOTE_COMMANDS` 或 `LOCAL_ONLY_COMMANDS`
- `executeRemoteCommand()`
- QQ help Keyboard 和文本
- README 命令表
- native runtime integration tests

`pi.getCommands()` 只提供命令元数据。Pi 0.82 的 `sendUserMessage()` 写死跳过命令/Skill/template 分发，因此不得假设把 `/skill:name` 注入 Pi 就能执行。不要复制 Pi 私有 dispatcher；通用命令执行需要上游公开 API 和单独批准。

## 7. 双端 UI 链路

`DualUIBridge` 只包装扩展可见的 `ExtensionUIContext`：

- `confirm/select/input`：终端和 QQ race，先完成者 abort 另一端。
- `custom`：factory 仍由 Pi 创建组件，bridge 代理同一个 component；终端和 QQ 都调用该实例的 `handleInput()`。

`QQUIInteractionBroker` 只在当前回合 origin 是 QQ、Gateway running、target 和回复预算仍存在时创建远程交互。每个 token 是一次性的，完成、取消、unlink、session start 或消息 cleanup 后必须失效。

自定义 TUI 使用固定宽度渲染，去除 ANSI/APC 控制序列并限制可见行数。QQ 普通文本使用 bracketed paste。不要记录输入内容，密码字段也按普通 owner 输入转发。

Pi 核心 TUI 和外部 PTY 不经过 `ctx.ui`，不得通过修改 Pi 私有类去拦截。

## 8. 媒体和回复预算

### 8.1 入站

入站附件依次经过 denylist、下载、类型识别和内容准备。没有扩展层数量、格式或字节配额；上下文文本提取量由当前模型剩余 context 派生。网络安全检查不是产品配额，不能通过配置关闭。

临时资源由 QQ message id 绑定，必须保留到对应 `agent_settled`，然后在 `releaseQQMessage()` 中释放。过早 cleanup 会导致 Agent 工具读不到文件；缺少 cleanup 会泄漏临时目录。

### 8.2 出站

`qq_send_local_file` 不接受 QQ target、msg_id 或 sequence。目标只能来自当前有效 QQ origin。调用链：

```text
Pi tool
  -> NativeSessionRuntime.sendLocalFile()
  -> QQOutboundDeliveryContext
  -> openVerifiedLocalFile()
  -> QQApi media upload
  -> passive reply sequence
```

`outboundMedia.enabled` 是总开关，其他配置全部是 denylist。空 `deniedRoots` 表示允许当前账户可读路径，不表示跳过 realpath、link 或文件身份验证。

### 8.3 回复预算

QQ 平台每条消息最多四次被动回复。`ReplyBudget` 是唯一序号分配者。媒体和交互卡片预留序号时必须为最终 assistant 文本保留容量。不要在 transport、formatter 或新功能中维护第二套 seq 计数器。

## 9. 配置契约

- 唯一文件：`~/.pi/agent/pi-agent-qqbot.json`
- 唯一 schema：`schemaVersion: 5`
- 必填身份：`appId`、`clientSecret`、`ownerOpenId`
- 默认环境：`sandbox: true`
- 默认 takeover：`ask`
- 默认出站：关闭
- 所有媒体列表：denylist

配置问题定位顺序：

1. `src/infrastructure/config/paths.ts`：是否读取预期路径。
2. `config-repository.ts`：是 missing、malformed、read failure 还是 unsupported schema。
3. `normalize-config.ts`：默认值和规范化结果。
4. `validateConfig()`：启动前必填字段。
5. `pi-agent-qqbot.json.example` 与 README 是否同步。

不新增旧 schema 兼容、字段别名或自动迁移。需要新语义时提升 schema 并同步删除旧规则。

## 10. 症状到代码的快速定位

| 症状 | 先检查 | 关键证据 |
| --- | --- | --- |
| Pi 看不到扩展命令 | `src/index.ts`、`extension.ts`、package `pi.extensions` | `npm run smoke:pi -- .` 是否列出 `qqbot-start` |
| 启动提示配置无效 | config 三个模块 | 错误分类、schema、必填字段；不要输出 secret |
| Gateway 无法连接 | `auth.ts`、`gateway.ts`、QQ sandbox 配置 | token 错误、identify/heartbeat/state transition、debug log |
| QQ 消息完全无反应 | `payload-normalizer.ts`、`handleInbound()` 前置检查 | event type、private/group、userOpenId、Gateway/link 状态 |
| QQ 显示未绑定 | `NativeSessionLinkState`、`link()` | `/qqbot-status` 中 Gateway 与 Link |
| 消息进入 Pi 但 QQ 无最终回复 | `pendingQQ`/`acceptedOrigins`/`agentOutputs` | input source、队列顺序、generation、agent_settled、reply budget |
| 终端消息错误回复到 QQ | origin correlation | terminal input 必须记录 `{source:"terminal"}`，不能复用 QQ target |
| QQ 命令未知或行为不一致 | parser、allowlist、`executeRemoteCommand()`、`PiCommandBridge` | 解析后的 name/rawArgs、command context 是否可用 |
| `/model` 没有卡片或分页错误 | model-pages、keyboard、runtime modelReply | 可用模型列表、page size、QQ row/button 限制 |
| 标准审批只在终端出现 | `DualUIBridge.race()`、delivery context | 当前 origin 是否 QQ、预算是否大于 1、token 是否已取消 |
| custom TUI 空白或按键无效 | `proxyCustomComponent()`、`formatCustomCard()` | component render、handleInput、ANSI 清理、token current |
| 附件下载失败 | downloader、pipeline | HTTPS/SSRF/redirect/abort、denylist、临时路径 |
| 文档内容缺失 | extractors、attachmentPreparationOptions | MIME/扩展名、剩余 context、truncated 标志 |
| 本地文件被拒绝 | outbound-media、opened-file-identity | enabled、denylist、realpath、普通文件、link/hard-link、rename race |
| 媒体发出但最终文本缺失 | ReplyBudget、deliver-reply、runtime cleanup | 是否为 final 保留 sequence、budget 是否被重复消费 |
| takeover 失败或两个进程争抢 | gateway-ownership、native-session-link | owner record PID/nonce、loopback 响应、claim policy |
| npm 包缺文件或混入测试 | `package.json.files`、`.npmignore`、check-package | `npm pack --dry-run --json --ignore-scripts` |

## 11. 调试顺序

按下面顺序收集证据，避免从猜测开始改代码：

1. 运行 `/qqbot-status`，记录 Gateway、Link、Session、Model、Origin queue。
2. 临时把 `logging.level` 设为 `debug` 并重启 Pi，只记录状态与错误，不记录凭据或用户输入。
3. 确定问题属于 transport、identity/link、command、origin、UI、media 或 formatting 哪一层。
4. 先运行上表对应的最小测试文件。
5. 用现有 factory/port 注入 fake transport 或 context 增加回归测试，不连接真实 QQ。
6. 修复后运行同层测试，再运行 `npm run verify`。
7. 涉及包、依赖、入口或文档时，再运行 package 和 smoke 检查。

不要把网络不稳定、配置错误或 Pi API 缺失伪装成 fallback 成功。用户可见失败应保留可操作的错误分类，同时对 secret 做脱敏。

## 12. 测试体系

`test/run-all.ts` 自动递归发现 `*.test.ts` 并逐文件启动隔离 Node test 进程。新增测试只要放在 `test/` 下即可，无需维护清单。

测试层次：

- `test/unit`：纯规则、协议状态机和小型 adapter。
- `test/characterization`：固定用户可见输出、配置和 QQ API 契约。
- `test/integration`：跨模块生命周期、文件系统和 Pi extension 行为。

运行单个文件：

```bash
npm run test:focused -- test/integration/extension/native-session-runtime.test.ts
```

完整发布验证：

```bash
npm run verify
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run test:package
npm run smoke:pi -- .
git diff --check
```

CI 在 Windows、Ubuntu、macOS 上覆盖 Node 22.19 和 Node 24。Windows 未启用 Developer Mode 或缺少权限时，文件 symlink 测试可以跳过；junction 与其他路径测试仍必须通过。

## 13. Pi 集成边界

只使用 Pi 公开扩展 API。以下做法禁止：

- 修改已安装 Pi 或 `node_modules`。
- 依赖私有 `AgentSession` 字段。
- monkey-patch Pi prototype。
- 复制 Pi 内部 command dispatcher 形成兼容层。
- 拦截 Pi 核心 TUI 或思考链。

如果需求只有修改 Pi 核心才能完成，必须先说明缺失的公开能力、最小上游 API、替代方案和维护成本，然后等待明确批准。

## 14. 发布流程

1. 从干净 worktree 开始，显式升级依赖。
2. 更新 `package.json` SemVer 和 `CHANGELOG.md`。
3. 同步 README、示例配置和开发文档。
4. 运行全部发布验证。
5. 检查 `npm pack --dry-run --json --ignore-scripts`；包内只能包含 runtime 源码、README、changelog、license、包元数据和示例配置。
6. 提交 release，创建 annotated `v<version>` 标签，推送提交与标签。
7. 确认标签与 tarball 后执行 `npm publish`。
8. 在干净 Pi 环境安装发布源，重启 Pi，验证 start/link、QQ 回合、命令卡片、双端 UI 和一个允许的出站文件。

发布保持人工控制。CI 只验证发布就绪状态，不自动推送标签或发布 npm。
