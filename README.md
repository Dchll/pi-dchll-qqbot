# Pi Dchll QQBot

> 在 QQ 里继续使用当前 Pi 会话。
> Use your current Pi session from QQ.

**测试阶段：请在非生产环境试用，目前仅实测 Pi 1.4.0。**
**Testing stage: use in non-production environments. Tested with Pi 1.4.0 only.**

[快速开始 / Quick start](#快速开始--quick-start) · [核心功能 / Features](#核心功能--features) · [更多文档 / More](#更多文档--more)

## 快速开始 / Quick start

需要 Pi >=1.4.0 <2.0.0、Node.js >=22.19.0，以及启用了 C2C 私聊的 QQ 官方机器人。

Requires Pi >=1.4.0 <2.0.0, Node.js >=22.19.0, and an official QQ bot with C2C direct messages enabled.

### 1. 安装 / Install

~~~bash
pi install npm:pi-dchll-qqbot
~~~

### 2. 配置 / Configure

创建 ~/.pi/agent/pi-dchll-qqbot.json，并填入 QQ 开放平台的 AppID 和 AppSecret。

Create ~/.pi/agent/pi-dchll-qqbot.json and enter the AppID and AppSecret from the QQ Open Platform.

~~~json
{
  "schemaVersion": 5,
  "appId": "YOUR_QQBOT_APP_ID",
  "clientSecret": "YOUR_QQBOT_APP_SECRET",
  "sandbox": false,
  "ownerOpenId": ""
}
~~~

sandbox 为 false 表示正式环境；ownerOpenId 首次留空。Windows 配置路径为 %USERPROFILE%\.pi\agent\pi-dchll-qqbot.json。

Use false for the production sandbox setting and leave ownerOpenId empty during the first setup. On Windows, use %USERPROFILE%\.pi\agent\pi-dchll-qqbot.json.

### 3. 绑定并启动 / Bind and start

重启 Pi，执行 /qqbot-start，从 QQ 私聊机器人发送一条消息，并在终端确认 Owner。

Restart Pi, run /qqbot-start, send a private message to the bot from QQ, and confirm the Owner in the terminal.

确认后启动链接：

Then start the link:

~~~text
/qqbot-link
/qqbot-status
~~~

以后每个新 Pi 进程只需执行 /qqbot-link。收到 QQ 回复即表示连接成功。

For later Pi processes, only /qqbot-link is required. A reply in QQ confirms that the connection is working.

## 核心功能 / Features

* QQ 与终端共享工作目录、模型、工具、上下文和会话历史。
  QQ and the terminal share the working directory, model, tools, context, and session history.

* 私聊支持文本、图片、语音、文档和文件；本地文件发送可按需启用。
  Private chats support text, images, voice, documents, and files. Local-file delivery can be enabled when needed.

* Pi 忙碌时通过 Steering 引导当前回合，回复只发送到对应输入端。
  Messages use Steering while Pi is busy, and replies stay on the surface that owns the turn.

* 可通过 QQ 命令或按钮切换模型、思考等级和会话。
  Switch models, thinking levels, and sessions through QQ commands or buttons.

* QQ 与终端共享确认、选择、输入和扩展自定义交互界面。
  QQ and the terminal share confirmations, selections, text input, and extension-created custom interfaces.

* 多个 Pi 进程可以接管机器人，但同一时刻只有一个进程持有 Gateway。
  Multiple Pi processes can take over the bot, while only one process owns the Gateway at a time.

* 仅配置的 Owner 可以使用；群消息和其他用户默认忽略。
  Only the configured Owner can use the bot. Group messages and other users are ignored by default.

本地控制使用 /qqbot-start、/qqbot-link、/qqbot-stop、/qqbot-unlink、/qqbot-status 和 /qqbot-takeover。QQ 中发送 /help 可查看可用命令。

Use /qqbot-start, /qqbot-link, /qqbot-stop, /qqbot-unlink, /qqbot-status, and /qqbot-takeover for local control. Send /help in QQ to see the available commands.

## 更多文档 / More

* [配置示例 / Configuration example](./pi-dchll-qqbot.json.example)
* [开发与排障 / Development and troubleshooting](./docs/DEVELOPMENT.md)
* [更新记录 / Changelog](./CHANGELOG.md)
* [上游项目 / Upstream project](https://github.com/gtiders/pi-agent-qqbot)

也可以从 GitHub 安装：

You can also install from GitHub:

~~~bash
pi install git:github.com/Dchll/pi-dchll-qqbot
~~~

由 Dchll 维护，基于 gtiders/pi-agent-qqbot 派生，使用 Apache-2.0 许可证。

Maintained by Dchll, derived from gtiders/pi-agent-qqbot, and licensed under Apache-2.0.
