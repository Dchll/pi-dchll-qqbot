# AGENTS.md

本文件适用于整个仓库，供自动化 Agent 和新维护者快速定位、修改与验证问题。

## 项目目标

`pi-dchll-qqbot` 将唯一 QQ C2C owner 连接到终端中同一个原生 Pi session。它不是独立 Agent，也不是通用 QQ 命令代理。当前正式契约以 `README.md`、`docs/DEVELOPMENT.md`、`src/` 和 `test/` 为准；`docs/archive/` 只保存历史。

## 开始任务前

1. 读取 `README.md` 中与请求相关的用户行为。
2. 读取 `docs/DEVELOPMENT.md` 对应章节和症状定位表。
3. 查看 `git status --short`，保留用户已有改动。
4. 从下表选择最小代码入口和测试，不要先全仓重构。
5. 如果需要改 Pi 核心或私有 API，先停止实施并向用户澄清，等待明确批准。

## 按问题定位

| 问题 | 首要文件 | 首要测试 |
| --- | --- | --- |
| 配置读取、schema、默认值 | `src/infrastructure/config/*` | `test/characterization/config.test.ts`、`test/integration/config/*` |
| QQ 鉴权 | `src/infrastructure/qq/auth.ts` | `test/unit/qq/auth.test.ts` |
| Gateway、心跳、重连 | `src/infrastructure/qq/gateway.ts` | `test/unit/qq/gateway.test.ts` |
| QQ event 字段 | `src/infrastructure/qq/payload-normalizer.ts` | `test/unit/qq/payload-normalizer.test.ts` |
| start/link/消息与回复关联 | `src/extension/native-session-runtime.ts` | `test/integration/extension/native-session-runtime.test.ts` |
| QQ 白名单命令 | `native-session-runtime.ts`、`pi-command-bridge.ts` | native runtime integration、`pi-command-bridge.test.ts` |
| 标准或 custom UI | `dual-ui-bridge.ts`、`qq-ui-interactions.ts` | native runtime integration |
| 多进程接管 | `gateway-ownership.ts`、`domain/native-session-link.ts` | gateway ownership 与 domain tests |
| 入站附件 | `infrastructure/media/attachment-*` | media integration tests |
| 文档/STT | `document-extractors.ts`、`stt.ts` | media tests |
| 本地文件出站 | `outbound-media.ts`、`opened-file-identity.ts` | outbound characterization、platform integration |
| 回复格式/次数 | `deliver-reply.ts`、`reply-budget.ts`、`reply-formatter.ts` | QQ API 和 user-facing tests |
| 包入口/发布内容 | `src/index.ts`、`package.json`、`scripts/check-package.mjs` | `test:package`、`smoke:pi` |

## 必须保持的不变量

- 扩展加载时不启动 Gateway；只能由本地 `/qqbot-start` 启动。
- 只接受配置中的唯一 C2C owner。群消息和其他用户必须在附件下载与 Agent 工作前返回。
- 只支持 schema 5，不添加旧 schema、旧字段名或自动迁移兼容代码。
- 媒体配置是 denylist。空列表表示不增加产品限制。
- 不新增文件数量、格式、大小、总量或队列长度等扩展层配额；QQ 平台硬限制和安全不变量除外。
- QQ 普通消息进入 Pi 前必须创建 pending origin；最终回复必须经过 input/agent_end/agent_settled 关联。
- unlink、takeover 或 rebind 后，旧 generation 的 QQ 回合不得回复新 link。
- 终端发起的 Agent 输出不得镜像到 QQ。
- QQ 被动回复序号只由 `ReplyBudget` 分配，并为最终文本保留容量。
- `qq_send_local_file` 的 target、msg_id 和 sequence 只能来自当前 QQ delivery context，不能由模型传入。
- 本地文件必须经过 `openVerifiedLocalFile()`；不能退化为直接按路径读取。
- 标准和 custom UI 只桥接公开 extension `ctx.ui`，不拦截 Pi 核心 TUI、外部 PTY 或思考链。
- QQ 命令采用显式白名单；`/qqbot-*` 与其他本地控制命令不能从 QQ 执行。

## Pi 核心边界

禁止直接修改 Pi、`node_modules`、私有 `AgentSession`、prototype 或内部 dispatcher。

Pi 1.4.0 的 `getCommands()` 只能发现命令，`sendUserMessage()` 不执行 extension commands，也不展开 Skills/templates。不要通过 `as any`、反射或复制内部实现绕过。需要通用分发时，先给出上游公开 API 设计和替代方案，等待用户批准 Pi 核心修改。

## 诊断工作流

1. 先复现并记录准确症状、输入来源、Gateway/link/session 状态。
2. 运行 `/qqbot-status`；需要 transport 细节时临时使用 `logging.level: "debug"`。
3. 确定责任层：config、transport、identity/link、command、origin、UI、media、formatting 或 package。
4. 阅读该层实现和现有测试，先添加能失败的最小回归测试。
5. 通过公开 port/factory 注入 fake；单元和集成测试不得依赖真实 QQ 或真实凭据。
6. 实施最小修复，避免跨层快捷调用。
7. 先跑目标测试，再跑完整验证。
8. 对用户可见行为同步 README；对架构或发布流程同步开发文档。

不要把配置错误、网络失败或缺失 Pi API 静默降级成成功。错误信息必须可操作，但不得包含 clientSecret、token、STT key、完整敏感路径或密码输入。

## 测试命令

目标测试：

```bash
npm run test:focused -- test/path/to/file.test.ts
```

常规验证：

```bash
npm run verify
```

涉及共享类型、包、依赖、入口、Pi API 或发布时必须额外运行：

```bash
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run test:package
npm run smoke:pi -- .
git diff --check
```

Windows symlink 测试只有在 Developer Mode/权限不足时允许跳过；其他失败不能忽略。

## 编辑和代码风格

- TypeScript ESM import 使用 `.ts` 后缀并保持现有 tab 缩进。
- 依赖由外向内：extension/presentation/infrastructure 可以依赖 application/domain，application 只能依赖 domain，domain 不得依赖任何外层。
- 只在复杂状态转换处添加短注释，不叙述显而易见的代码。
- 新增抽象必须减少真实重复或明确隔离外部边界。
- 不顺手重构无关模块，不覆盖用户未提交改动。
- 配置或协议变化应直接采用新规则并删除旧规则，不保留兼容分支。
- 历史设计移动到 `docs/archive/`，不能重新放回当前文档路径。

## 文档同步要求

- 新增或删除 QQ 命令：同步 README 命令表、help Keyboard、fallback 文本和测试。
- 修改配置：同步 `pi-dchll-qqbot.json.example`、README 字段表、config tests；破坏性变化需要新 schema。
- 修改媒体策略：同步 README 媒体与安全说明以及 characterization tests。
- 修改 UI：同步 README 双端 UI 边界与 native runtime integration tests。
- 修改版本或依赖：同步 package/lockfile、CHANGELOG 和开发环境要求。

## 完成标准

任务只有在以下条件满足后才算完成：

- 请求行为已经实现，而不是只写方案。
- 相关回归测试存在并通过。
- 没有绕过 owner、generation、reply budget、file identity 或 Pi public API 边界。
- 文档与实际行为一致。
- 与风险相称的完整验证已经运行并报告。
- 未经明确请求，不提交、不打标签、不推送、不发布、不替换用户本机安装。
