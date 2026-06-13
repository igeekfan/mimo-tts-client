# MiMo TTS 语音合成客户端

[English](README.md) | [简体中文](README.zh-CN.md)

基于 [MiMo-V2.5-TTS](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/speech-synthesis-v2.5) 的跨平台桌面端语音合成客户端。采用 Go + Wails + React 技术栈。

## 功能特性

- **三种合成模型**：预置音色、音色设计（文本描述生成音色）、音色复刻（音频样本复刻音色）
- **9种预置音色**：中文（冰糖、茉莉、苏打、白桦）、英文（Mia、Chloe、Milo、Dean、默认）
- **16+ 风格预设**：含方言（东北话、四川话、粤语）、唱歌及多种情感
- **导演模式**：通过角色、场景、指导三维度精细控制语音表演
- **音色设计**：从文本描述生成自定义音色
- **音色复刻**：从音频样本克隆音色
- **流式输出**：低延迟 PCM16 实时音频流，支持播放/暂停/取消
- **音频播放器**：进度条、拖动、音量控制、播放/暂停/停止
- **合成历史**：持久化存储，支持播放、下载、删除
- **风格历史**：最近使用的风格标签，方便快速复用
- **深色/浅色主题**：手动切换或自动跟随系统
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

- [Go](https://go.dev/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+
- [Wails v2](https://wails.io/docs/gettingstarted/installation)

## 开发

```bash
# 安装依赖
cd frontend && npm install && cd ..

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

也可以在应用设置界面中配置 API Key 和 Base URL。

## 使用方法

1. 启动应用
2. 选择模型（预置音色 / 音色设计 / 音色复刻）
3. 选择音色或描述期望的音色
4. 输入要合成的文本
5. 可选：添加风格控制指令或使用导演模式
6. 点击 **合成语音** 或 **流式合成** 实时播放
7. 播放、暂停或下载生成的音频

## Web 模式

除了桌面应用，也可作为独立 Web 服务器运行：

```bash
go build -tags web -o tts-server .
./tts-server
# 打开 http://localhost:8080
```

或使用 Docker：

```bash
docker build -t tts .
docker run -p 8080:8080 -e TTS_API_KEY=your_key tts
```

## 技术栈

- **后端**：Go, Wails v2, GORM + SQLite
- **前端**：React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **API**：MiMo-V2.5-TTS（兼容 OpenAI 接口）

## 项目结构

详见 [PLAN.md](PLAN.md) 项目结构和开发计划。

## 许可证

MIT
