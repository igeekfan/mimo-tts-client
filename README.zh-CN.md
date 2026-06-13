# MiMo TTS 语音合成客户端

[English](README.md) | [简体中文](README.zh-CN.md)

基于 [MiMo-V2.5-TTS](https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/multimodal-understanding/speech-synthesis-v2.5) 的跨平台桌面端语音合成客户端。采用 Go + Wails + React 技术栈。

## 功能特性

- **三种合成模型**：预置音色、音色设计（文本描述生成音色）、音色复刻（音频样本复刻音色）
- **9种预置音色**：中文（冰糖、茉莉、苏打、白桦）、英文（Mia、Chloe、Milo、Dean、默认）
- **丰富的风格控制**：自然语言指令控制 + 音频标签控制
- **导演模式**：通过角色、场景、指导三维度精细控制语音表演
- **唱歌模式**：支持中文歌词的歌唱合成
- **流式输出**：低延迟实时音频流
- **深色/浅色主题**：自动跟随系统主题
- **中英双语界面**

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
export MIMO_API_KEY="your_api_key_here"
```

## 使用方法

1. 启动应用
2. 选择模型（预置音色 / 音色设计 / 音色复刻）
3. 选择音色或描述期望的音色
4. 输入要合成的文本
5. 可选：添加风格控制指令
6. 点击 **合成语音**
7. 播放或下载生成的音频

## 技术栈

- **后端**：Go, Wails v2, GORM + SQLite
- **前端**：React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **API**：MiMo-V2.5-TTS（兼容 OpenAI 接口）

## 许可证

MIT
