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
| GET | `/api/history` | 获取历史（最多 50 条） |
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

## 待实现

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

## 待修复问题 TODO（2026-07-01 代码审查）

> 按优先级排序。分析自代码静态审查，落地前建议逐条复现确认。
>
> **状态：以下全部已实现（2026-07-01）。** 新增环境变量 `TTS_WEB_TOKEN`、
> `TTS_CORS_ORIGIN`（见 AGENTS.md 环境变量表）；新增 Go 单元测试与 `.golangci.yml`
> + CI 工作流（`.github/workflows/ci.yml`）。

### P0 — 安全（Web 模式）
- [x] **API Key 明文泄露**：`GET /api/settings` 直接返回 `apiKey` 字段（`internal/httpapi/server.go:67`）。任何能访问 Web 服务的人都能读到密钥。应在 Web 模式下对返回的 settings 做脱敏（掩码或省略 `apiKey`），保存时保留原值。
- [x] **Web 模式无任何鉴权**：`/api/*`（合成、历史、设置）全部公开。Docker/远程部署时等于开放代理，会消耗用户 API 配额。至少提供可选的 token / basic auth（如 `TTS_WEB_TOKEN` 环境变量）。
- [x] **API Key 明文落库**：`SettingsRecord.ApiKey` 未加密存储于 `settings.db`（`internal/core/db.go:13`）。考虑加密或改为仅从环境变量读取。

### P1 — 可靠性与资源
- [x] **HTTP 客户端无超时**：`tts.go` 两处 `client := &http.Client{}`（`:144`、`:239`）无 `Timeout`，上游卡住会永久挂起。对照 `update.go:41` 已设 15s。合成请求应设置合理超时。
- [x] **取消/中断未透传到上游**：`tts.go` 用 `http.NewRequest` 而非 `NewRequestWithContext`。前端已加 AbortSignal（web）与取消按钮，但后端不会真正中止对 MiMo API 的请求 → 配额浪费 + goroutine/连接泄漏。`server.go:handleSynthesizeStream` 也未监听 `r.Context().Done()`。应把请求 context 一路传到 `SynthesizeSpeech(Stream)`。
- [x] **桌面流式合成无法取消**：`app_bindings.go:StartSynthesizeSpeechStream` 起了 goroutine 但没有停止机制，前端 desktop 分支的 AbortSignal 被忽略（`backend.ts:328`）。需要 streamId → cancel 的注册表 + `CancelStream` 绑定方法。
- [x] **历史音频无限增长**：音频 blob 全量存进 SQLite（`db.go:HistoryRecord.AudioData`），无条数/容量上限、无自动清理。长期使用 DB 会膨胀。增加保留上限或定期裁剪。

### P2 — 一致性与健壮性
- [x] **后端错误信息硬编码中文**：`tts.go` 中 "API Key 未配置" "API 错误" 等（`:90`、`:159` 等）绕过了 i18n，英文界面下会露出中文。应走 `i18n` 或返回错误码由前端翻译。
- [x] **`fmt.Sscanf` 忽略解析错误**：`server.go` 解析 `id/offset/limit`（`:222`、`:254`）忽略返回值，非法输入会静默变成 0。改用 `strconv` 并校验。
- [x] **EventHub 丢消息竞争**：`events.go:Emit` 在 `RLock` 下从 channel 读取（drain）以腾位（`:42`），并发 Emit 时存在竞争且会丢最旧消息。评估是否改为每订阅者独立 goroutine 或加大缓冲/换写锁。
- [x] **CORS 源为空串**：Web 模式默认 `corsOrigin=""`（`main_web.go:20`），`Access-Control-Allow-Origin` 被设为空值。明确策略（同源不设该头，或改为可配置）。

### P3 — 工程质量
- [x] **缺少 linter**：无 `golangci-lint` 配置，`frontend/package.json` 无 `lint` 脚本（仅 tsc）。补充静态检查并接入 CI。
- [x] **单元测试覆盖不足**：`tts_test.go` 仅有需真实 API key 的集成测试。为纯函数补测：`buildMessages`（各模型分支）、`addWavHeader`、SSE 解析（`backend.ts:parseSseEvent`）、`GetSettings` 默认值合并。
- [x] **冗余 `min` 函数**：`tts.go:289` 自定义 `min` 遮蔽了 Go 1.21+ 内置且未被引用，可删除。
- [x] **文档已过期**：`AGENTS.md` / 本文件的目录结构仍写 "单个 App.tsx + 单个 App.css"，实际前端已拆分为 `components/`、`hooks/`、`lib/`（含 `api_client.ts` 等）。更新目录树描述。
