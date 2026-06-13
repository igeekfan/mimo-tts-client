# MiMo TTS Client 开发计划

## 项目概述

基于小米 MiMo-V2.5-TTS 系列模型，开发跨平台桌面端语音合成客户端。

### 技术栈

- **后端**：Go + Wails v2 + GORM + SQLite
- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **API**：MiMo-V2.5-TTS（兼容 OpenAI 接口）

---

## 待实现

### 历史管理
- [ ] 前端搜索与筛选 UI

### 音频导出
- [ ] 下载为 MP3 文件（需 ffmpeg）

---

## 项目结构

```
TTS/
├── main.go                    # Desktop 入口
├── main_web.go                # Web 入口（build tag: web）
├── version.go                 # 版本号
├── wails.json                 # Wails 配置
├── Dockerfile                 # Docker 构建（Web 模式）
├── AGENTS.md                  # AI 助手指南
├── go.mod / go.sum
├── cmd/
│   └── test-api/
│       └── main.go            # API 测试工具
├── desktop/
│   ├── app.go                 # App 结构体
│   ├── app_bindings.go        # Wails 绑定方法
│   ├── app_ui.go              # UI 交互（SelectFolder, OpenFile 等）
│   └── types.go               # Desktop 类型定义
├── internal/
│   ├── core/
│   │   ├── service.go         # 核心服务
│   │   ├── tts.go             # TTS 合成（MiMo API）
│   │   ├── settings.go        # 设置管理
│   │   ├── db.go              # 数据库（SQLite + GORM）
│   │   ├── types.go           # 类型定义
│   │   └── i18n.go            # 国际化
│   ├── httpapi/
│   │   ├── server.go          # HTTP API + SPA 文件服务
│   │   └── events.go          # SSE EventHub
│   └── platform/
│       └── hidecmd.go         # Windows CMD 窗口隐藏
├── frontend/
│   ├── src/
│   │   ├── main.tsx           # 入口
│   │   ├── App.tsx            # 主组件
│   │   ├── App.css            # 主样式
│   │   ├── style.css          # 额外样式
│   │   ├── theme.css          # 主题变量
│   │   ├── types.ts           # TypeScript 类型
│   │   ├── vite-env.d.ts
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ui/            # shadcn/ui 组件
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── lib/
│   │   │   ├── backend.ts     # 双模式 API 层（Wails/HTTP）
│   │   │   └── runtime.ts     # 双模式事件系统
│   │   └── i18n/
│   │       ├── context.tsx    # useI18n hook
│   │       ├── zh-CN.ts
│   │       └── en-US.ts
│   └── package.json
├── build/
│   └── README.md
└── PLAN.md
```

---

## API 接口（Web 模式）

### POST /api/synthesize
非流式合成语音

**请求**: `{text, model, voice, style, optimizeTextPreview}`
**响应**: `{audioData (base64), format, error}`

### POST /api/synthesize-stream
流式合成（SSE），每个事件返回 base64 编码的 PCM16 块，`data: [DONE]` 结束

### GET /api/settings
获取设置

### POST /api/settings
保存设置

### GET /api/about
获取应用信息

### GET /api/history
获取合成历史（GET，最多 50 条）

### POST /api/history
保存合成记录

### GET /api/history/search?q=&offset=&limit=
搜索合成历史（支持分页）

### GET /api/history/audio?id=
获取历史音频数据

### POST /api/history/delete
删除历史记录 `{id}`

### POST /api/history/clear
清空所有历史记录

### GET /api/events
SSE 事件流（用于桌面模式日志转发等）

---

## 运行方式

```bash
# 开发模式
wails dev

# 构建桌面版
wails build

# Web 模式
go build -tags web -o tts-server .
./tts-server

# Web 模式 Docker 构建
docker build -t tts .
docker run -p 8080:8080 -e TTS_API_KEY=your_key tts
```
