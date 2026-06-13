# MiMo TTS Client 开发计划

## 项目概述

基于小米 MiMo-V2.5-TTS 系列模型，开发跨平台桌面端语音合成客户端。

### 技术栈

- **后端**：Go + Wails v2 + GORM + SQLite
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **API**：MiMo-V2.5-TTS（兼容 OpenAI 接口）

---

## 已完成

### 2. 后端核心
- `internal/core/service.go` - 服务初始化、设置管理
- `internal/core/settings.go` - 设置读写（language, theme, apiKey, baseUrl, model, voice, style）
- `internal/core/db.go` - SQLite 数据库
- `internal/core/tts.go` - MiMo TTS API 调用（已完成）
- `internal/httpapi/server.go` - REST API（/api/settings, /api/synthesize, /api/about）

### 3. 前端界面
- 左右布局：左侧配置+输入，右侧记录
- API 配置（API Key, Base URL）
- 合成设置（模型、音色、风格）
- 文本输入区域
- 风格预设标签（13种）
- 合成历史列表（播放、下载、删除）
- 深色/浅色主题切换
- 中英文切换
- 设置自动保存/恢复

### 4. API 对接
- MiMo TTS API 调用（POST /v1/chat/completions）
- 请求/响应日志记录
- 错误处理
- WAV 格式处理（自动添加 WAV header）

---

## 待实现

### Phase 1: 完善核心功能

#### 1.1 流式合成
- [x] 支持流式合成（PCM16 实时流）
- [x] 实时播放流式音频

#### 1.2 音频播放增强
- [x] 播放进度条
- [x] 播放/暂停/停止控制
- [x] 音量控制

### Phase 2: 音色管理

#### 2.1 音色设计
- [x] 前端：音色描述输入界面
- [x] 后端：调用 mimo-v2.5-tts-voicedesign 模型

#### 2.2 音色复刻
- [x] 前端：音频文件上传界面
- [x] 后端：Base64 编码、调用 mimo-v2.5-tts-voiceclone 模型

### Phase 3: 增强功能

#### 3.1 风格控制
- [x] 导演模式界面（角色、场景、指导三栏输入）

#### 3.2 历史管理
- [x] 合成历史持久化存储
- [ ] 历史记录搜索与筛选

#### 3.3 音频导出
- [ ] 下载为 MP3 文件（需 ffmpeg）

---

## 项目结构

```
TTS/
├── main.go                    # Desktop 入口
├── main_web.go                # Web 入口
├── version.go                 # 版本号
├── wails.json                 # Wails 配置
├── go.mod / go.sum
├── desktop/
│   ├── app.go                 # App 结构体
│   ├── app_bindings.go        # Wails 绑定方法
│   ├── app_ui.go              # UI 交互
│   └── types.go               # 类型定义
├── internal/
│   ├── core/
│   │   ├── service.go         # 核心服务
│   │   ├── tts.go             # TTS 合成（MiMo API）
│   │   ├── settings.go        # 设置管理
│   │   ├── db.go              # 数据库
│   │   ├── types.go           # 类型定义
│   │   └── i18n.go            # 国际化
│   ├── httpapi/
│   │   ├── server.go          # HTTP API
│   │   └── events.go          # SSE 事件
│   └── platform/
│       └── hidecmd.go         # Windows CMD 隐藏
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # 主界面（左右布局）
│   │   ├── App.css            # 样式
│   │   ├── types.ts           # TypeScript 类型
│   │   ├── lib/
│   │   │   ├── backend.ts     # API 层
│   │   │   └── runtime.ts     # 事件系统
│   │   └── i18n/
│   │       ├── context.tsx
│   │       ├── zh-CN.ts
│   │       └── en-US.ts
│   └── package.json
└── PLAN.md
```

---

## API 接口

### POST /api/synthesize
合成语音

**请求**:
```json
{
  "text": "要合成的文本",
  "model": "mimo-v2.5-tts",
  "voice": "冰糖",
  "style": "开心"
}
```

**响应**:
```json
{
  "audioData": "base64编码的WAV音频",
  "format": "wav",
  "error": ""
}
```

### GET /api/settings
获取设置

### POST /api/settings
保存设置

### GET /api/about
获取应用信息

---

## 运行方式

```bash
# 开发模式
wails dev

# 构建
wails build

# Web 模式
go build -tags web -o tts-server .
./tts-server
```
