# MiMo TTS Client — 开发参考

> 项目介绍、功能特性、运行方式等请参见 [README](README.md) 或 [README.zh-CN.md](README.zh-CN.md)。

## 架构

```
Frontend (React + TS)
       │
   ┌───┴───┐
桌面模式    Web 模式
Wails Bind  fetch/SSE
   │           │
   └───┬───────┘
   core/Service  ← 共享业务逻辑
       │
   GORM + SQLite
```

---

## 目录结构

```
├── main.go                    # Desktop 入口
├── main_web.go                # Web 入口（build tag: web）
├── version.go                 # 版本号
├── wails.json                 # Wails 配置
├── Dockerfile                 # Docker 构建（Web 模式）
├── desktop/
│   ├── app.go                 # App 结构体
│   ├── app_bindings.go        # Wails 绑定方法
│   ├── app_ui.go              # UI 交互（SelectFolder, OpenFile 等）
│   └── types.go               # Desktop 类型定义
├── internal/
│   ├── core/
│   │   ├── service.go         # 核心服务、启动逻辑、环境变量
│   │   ├── tts.go             # TTS 合成（MiMo API 调用）
│   │   ├── history.go         # 历史记录 CRUD
│   │   ├── settings.go        # 设置管理（GORM）
│   │   ├── about.go           # 应用信息
│   │   ├── update.go          # 自动更新检测
│   │   ├── db.go              # 数据库初始化
│   │   ├── types.go           # 类型定义
│   │   └── i18n.go            # 后端国际化
│   ├── httpapi/
│   │   ├── server.go          # REST API + SPA 文件服务
│   │   └── events.go          # SSE EventHub
│   └── platform/
│       └── hidecmd.go         # Windows CMD 窗口隐藏
├── frontend/
│   └── src/
│       ├── App.tsx            # 根组件（组合各页面）
│       ├── main.tsx           # 入口（先引导 Web 鉴权再渲染）
│       ├── types.ts           # TS 类型
│       ├── hooks/             # useSynthesis / useSettings / useHistory / ...
│       ├── lib/
│       │   ├── backend.ts     # 双模式 API 层
│       │   ├── runtime.ts     # 双模式事件系统
│       │   └── webAuth.ts     # Web 模式 token 鉴权
│       ├── components/
│       │   ├── ErrorBoundary.tsx
│       │   └── ui/            # shadcn/ui 组件
│       └── i18n/
│           ├── context.tsx    # useI18n hook
│           ├── zh-CN.ts
│           └── en-US.ts
└── cmd/test-api/main.go       # API 测试工具
```

---

## API 接口（Web 模式）

### TTS 合成
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/synthesize` | 非流式合成，返回 base64 WAV |
| POST | `/api/synthesize-stream` | 流式合成（SSE），逐块返回 PCM16 |

### 设置
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取设置 |
| POST | `/api/settings` | 保存设置 |

### 历史记录
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/history` | 获取历史（默认最多 50 条，数据库最多保留 200 条） |
| POST | `/api/history` | 保存记录 |
| GET | `/api/history/search?q=&offset=&limit=` | 搜索（分页） |
| GET | `/api/history/audio?id=` | 获取音频数据 |
| POST | `/api/history/delete` | 删除记录 `{id}` |
| POST | `/api/history/clear` | 清空全部 |

### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/about` | 应用信息 |
| GET | `/api/events` | SSE 事件流 |

---

## 功能规划与完成状态

### 风格预设补全
- [x] 补充 API 文档中缺失的风格分类与预设值

| 分类 | 缺失风格 |
|------|---------|
| 复合情绪 | 怅然、欣慰、无奈、愧疚、释然、嫉妒、厌倦、忐忑、动情 |
| 整体语调 | 俏皮、深沉、干练、凌厉 |
| 音色定位 | 醇厚、清亮、稚嫩、苍老、醇雅 |
| 人设腔调 | 夹子音、御姐音、正太音、大叔音、台湾腔 |
| 方言 | 河南话 |

### 音频标签（Audio Tags）
- [x] 提供 UI 一键插入音频标签到文本中

API 支持在 `assistant` content 中嵌入 `[标签]` 实现细粒度控制：

| 分类 | 标签 |
|------|------|
| 语速与节奏 | 吸气、深呼吸、叹气、长叹一口气、喘息、屏息 |
| 情绪状态 | 紧张、害怕、激动、疲惫、委屈、撒娇、心虚、震惊、不耐烦 |
| 语音特征 | 颤抖、声音颤抖、变调、破音、鼻音、气声、沙哑 |
| 哭笑表达 | 笑、轻笑、大笑、冷笑、抽泣、呜咽、哽咽、嚎啕大哭 |

### 唱歌模式限制
- [x] 唱歌风格仅对 `mimo-v2.5-tts` 有效，voicedesign / voiceclone 下应禁用或隐藏

---

## 已完成的安全与可靠性审查（2026-07-01）

> 以下项目已经实现，并通过单元测试、HTTP 合同测试或本地构建验证。
>
> Web 鉴权使用 `TTS_WEB_TOKEN`，跨域使用 `TTS_CORS_ORIGIN`；静态检查和 CI 配置位于
> `.golangci.yml` 与 `.github/workflows/ci.yml`。

### P0 — 安全（Web 模式）
- [x] **API Key 明文泄露**：Web 设置响应由 `internal/httpapi/server.go` 脱敏，保存时保留服务端密钥。
- [x] **Web 模式鉴权**：`TTS_WEB_TOKEN` 保护 `/api/*`；非回环监听要求至少 16 个字符的令牌。
- [x] **API Key 明文落库**：`internal/core/crypto.go` 使用 AES-GCM 加密当前格式的密钥，损坏密钥文件不会被覆盖。

### P1 — 可靠性与资源
- [x] **HTTP 客户端超时**：`internal/core/tts.go` 为普通请求和流式请求设置整体超时与响应头超时。
- [x] **取消透传**：`SynthesizeSpeech`、`SynthesizeSpeechStream` 和 Web 请求均使用 request context；桌面端通过 `CancelSynthesis` 取消普通及流式请求。
- [x] **历史音频无限增长**：`internal/core/history.go` 限制最多 200 条、单条 50 MiB、总音频 512 MiB，并在事务内裁剪。

### P2 — 一致性与健壮性
- [x] **后端错误信息硬编码中文**：`tts.go` 中 "API Key 未配置" "API 错误" 等（`:90`、`:159` 等）绕过了 i18n，英文界面下会露出中文。应走 `i18n` 或返回错误码由前端翻译。
- [x] **HTTP 参数校验**：`internal/httpapi/server.go` 使用严格整数解析，非法 `id/offset/limit` 返回 400。
- [x] **EventHub 并发安全**：`internal/httpapi/events.go` 使用写锁保护发送、丢弃和取消订阅。
- [x] **CORS 策略**：默认同源请求不发送 CORS 头，仅在配置 `TTS_CORS_ORIGIN` 且来源匹配时发送。

### P3 — 工程质量
- [x] **缺少 linter**：无 `golangci-lint` 配置，`frontend/package.json` 无 `lint` 脚本（仅 tsc）。补充静态检查并接入 CI。
- [x] **单元测试覆盖不足**：`tts_test.go` 仅有需真实 API key 的集成测试。为纯函数补测：`buildMessages`（各模型分支）、`addWavHeader`、SSE 解析（`backend.ts:parseSseEvent`）、`GetSettings` 默认值合并。
- [x] **冗余 `min` 函数**：`tts.go:289` 自定义 `min` 遮蔽了 Go 1.21+ 内置且未被引用，可删除。
- [x] **文档结构**：`AGENTS.md`、本文件和 README 已按当前 `components/`、`hooks/`、`lib/` 结构更新。

## 发布验收状态

- [x] `go test ./...`、`go test -tags web ./...`
- [x] `go vet ./...`、`go vet -tags web ./...`、`gofmt -l .`
- [x] `go build ./...`、`go build -tags web ./...`
- [x] `frontend`: `npm test`、`npm run lint`、`npm run build`
- [x] Windows Wails 生产构建
- [x] `v0.0.6` Release 已发布，Windows 与 Linux 产物已上传
- [ ] Docker 本地构建验证（需要运行中的 Docker daemon）
- [ ] `go test -race`（当前环境缺少 gcc/cgo）
- [ ] 真实 MiMo API 三种模型 E2E（需要 API Key，并可能产生费用）
- [ ] macOS 签名、公证和安装验证
- [ ] 浏览器实际交互与截图验收
