# MiMo TTS 语音合成客户端

[English](README.md) | [简体中文](README.zh-CN.md)

基于 [MiMo-V2.5-TTS](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/speech-synthesis-v2.5) 的跨平台桌面端语音合成客户端。采用 Go + Wails + React 技术栈。

当前版本：[v0.0.6](https://github.com/igeekfan/mimo-tts-client/releases/tag/v0.0.6)。

## 功能特性

- **三种合成模型**：预置音色、音色设计（文本描述生成音色）、音色复刻（音频样本复刻音色）
- **9种预置音色**：中文（冰糖、茉莉、苏打、白桦）、英文（Mia、Chloe、Milo、Dean、默认）
- **16+ 风格预设**：含方言（东北话、四川话、粤语）、唱歌及多种情感
- **导演模式**：通过角色、场景、指导三维度精细控制语音表演
- **音色设计**：从文本描述生成自定义音色
- **音色复刻**：从音频样本克隆音色
- **流式输出**：低延迟 PCM16 实时音频流，支持播放/暂停/取消
- **音频播放器**：进度条、拖动、音量控制、播放/暂停/停止
- **合成历史**：持久化存储，支持播放、下载、删除，并限制最多 200 条记录、总音频 512 MiB
- **风格历史**：最近使用的风格标签，方便快速复用
- **深色/浅色主题**：手动切换主题
- **中英双语界面**：设置自动保存/恢复
- **双模式运行**：桌面应用（Wails）+ Web 服务器（HTTP/SSE），共享代码
- **REST API**：完整的 HTTP API，支持无头/远程使用

## 支持的模型

| 模型 ID | 描述 |
|---------|------|
| `mimo-v2.5-tts` | 预置音色，支持唱歌 |
| `mimo-v2.5-tts-voicedesign` | 文本描述生成音色 |
| `mimo-v2.5-tts-voiceclone` | 基于音频样本复刻音色 |

## 环境要求

- [Go](https://go.dev/dl/) 1.25.13+
- [Node.js](https://nodejs.org/) 22.x
- [Wails v2.12.0](https://wails.io/docs/gettingstarted/installation)

## 开发

```bash
# 安装依赖
cd frontend && npm ci && cd ..

# 运行开发服务器
wails dev

# 构建生产版本
wails build
```

## API Key

设置环境变量：

```bash
export TTS_API_KEY="your_api_key_here"
```

也可以在桌面应用设置界面中配置 API Key 和 Base URL。Web 模式的上游地址只能由可信的 `TTS_BASE_URL` 环境变量固定配置，不能通过 Web API 修改。

## 使用方法

1. 启动应用
2. 选择模型（预置音色 / 音色设计 / 音色复刻）
3. 选择音色或描述期望的音色
4. 输入要合成的文本
5. 可选：添加风格控制指令或使用导演模式
6. 点击 **合成语音** 或 **流式合成** 实时播放
7. 播放、暂停或下载生成的音频

## macOS 安装说明

如果在 macOS 上安装后无法打开，提示“开发者不受信任”或“已损坏，请移到废纸篓”，可以先移除隔离属性后再打开：

```bash
sudo xattr -rd com.apple.quarantine /Applications/MiMo-TTS.app
```

如果你的应用不在 `/Applications/MiMo-TTS.app`，请把命令里的路径替换成实际安装路径。

这个处理方式与当前未签名/未公证的 macOS 发布包相匹配，但从长期看，仍然建议补齐 Apple 签名和公证流程。

## Web 模式

除了桌面应用，也可作为独立 Web 服务器运行：

```bash
go build -tags web -o tts-server .
./tts-server
# 打开 http://localhost:8080
```

Web 默认只监听本机回环地址 `127.0.0.1:8080`。监听非回环地址时，必须配置至少 16 个字符的 `TTS_WEB_TOKEN`。

或使用 Docker：

```bash
docker build -t tts .
docker run -p 8080:8080 \
  -v mimo-tts-data:/data \
  -e TTS_API_KEY=your_key \
  -e TTS_WEB_TOKEN='replace-with-a-long-random-token' \
  tts
```

远程使用时请在容器前配置 TLS 反向代理。容器使用非回环监听，如果访问令牌缺失或过短会拒绝启动。

### Web 模式环境变量

| 变量 | 说明 |
|------|------|
| `TTS_API_KEY` | MiMo API Key（设置中未配置时的回退值） |
| `TTS_WEB_ADDR` | 监听地址（默认 `127.0.0.1:8080`；非回环监听要求强令牌） |
| `TTS_WEB_TOKEN` | `/api/*` 访问令牌；非回环监听时必填。只有 SSE 事件流可使用 `?token=`。 |
| `TTS_CORS_ORIGIN` | 可选的跨域来源 |
| `TTS_BASE_URL` | Web 模式可信且固定的 MiMo 兼容上游地址，默认 `https://api.xiaomimimo.com/v1` |

Web API 不会返回保存的 API Key 或音色复刻参考音频；API Key 会加密落盘。

Web API 使用严格 JSON 结构和输入大小限制。桌面端和 Web 端都支持取消合成，并会将取消传递到上游请求。Web 模式默认只允许同源访问；只有确实需要跨域客户端时才配置 `TTS_CORS_ORIGIN`。

## 技术栈

- **后端**：Go, Wails v2, GORM + SQLite
- **前端**：React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **API**：MiMo-V2.5-TTS（兼容 OpenAI 接口）

## 项目结构

详见 [PLAN.md](PLAN.md) 项目结构和开发计划。

自动化检查覆盖 Go 单元/合同测试、Web 模式测试、前端 Vitest、TypeScript 检查、Vite 生产构建和 Windows Wails 构建。真实 MiMo API、Docker daemon、本地 macOS 签名/公证和浏览器交互验收仍需在对应发布环境验证。

## 许可证

MIT
