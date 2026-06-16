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
│       ├── App.tsx            # 主组件
│       ├── App.css            # 样式
│       ├── types.ts           # TS 类型
│       ├── lib/
│       │   ├── backend.ts     # 双模式 API 层
│       │   └── runtime.ts     # 双模式事件系统
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
