const zhCN: Record<string, string> = {
    // Input
    'input.title': '文本输入',
    'input.placeholder': '请输入要合成的文本...',
    'input.characters': '字符',
    'input.audioTags': '音频标签',

    // Model
    'model': '模型',
    'model.select': '选择模型',
    'model.preset': '预置音色',
    'model.voiceDesign': '音色设计',
    'model.voiceClone': '音色复刻',

    // Voice
    'voice': '音色',
    'voice.select': '选择音色',
    'voice.description': '音色描述',
    'voice.descriptionPlaceholder': '如: 年轻女性，声音温柔甜美，语速适中',
    'voice.audioSample': '音频样本',
    'voice.chooseFile': '选择文件',
    'voice.noFileSelected': '未选择文件',
    'voice.supportedFormats': '支持格式',
    'voice.maxFileSize': '最大文件大小',
    'voice.designTip': '音色设计模型将通过文本描述自动生成音色，无需预置或音频样本',

    // Style
    'style': '风格',
    'style.directorMode': '导演模式',
    'style.director.role': '角色',
    'style.director.scene': '场景',
    'style.director.direction': '指导',
    'style.placeholder': '如: 用轻快上扬的语调，语速稍快',
    'style.history': '历史风格',

    // Synthesis
    'synthesis.title': '合成设置',
    'synthesis.synthesize': '合成语音',
    'synthesis.stream': '流式合成',
    'synthesis.synthesizing': '合成中...',
    'synthesis.completed': '合成完成',
    'synthesis.enterText': '请输入文本',
    'synthesis.cancelled': '合成已取消',
    'synthesis.smartPolish': '智能润色',
    'synthesis.autoPolishTip': '开启后，合成文本将由模型智能润色，无需手动填写',
    'synthesis.streamLimitTip': '该模型的低延迟流式输出暂未上线，流式调用将以兼容模式运行（等待全部推理完成后返回结果）',

    // History
    'history.title': '合成记录',
    'history.clearCompleted': '清除已完成',
    'history.empty': '暂无合成记录',
    'history.search': '搜索历史记录',
    'history.noMore': '暂无更多记录',
    'history.loadMore': '加载更多',
    'history.firstHint': '开始合成你的第一段语音',

    // Settings
    'settings.title': '设置',
    'settings.app': '应用设置',
    'settings.appearance': '外观',
    'settings.theme': '主题',
    'settings.theme.dark': '深色',
    'settings.theme.light': '浅色',
    'settings.language': '语言',
    'settings.autoSave': '设置自动保存',
    'settings.saved': '设置已保存',
    'settings.save': '保存设置',
    'settings.apiKey': 'API Key',
    'settings.baseUrl': 'Base URL',
    'settings.apiConfig': 'API 配置',
    'settings.apiKeyPlaceholder': '请输入 API Key',
    'settings.baseUrlPlaceholder': '请输入 Base URL',

    // About
    'about.title': '关于',
    'about.checkUpdate': '检查更新',
    'about.checking': '检查中...',
    'about.upToDate': '已是最新版本 (v{version})',
    'about.newVersion': '发现新版本 v{version}！',
    'about.download': '下载更新',
    'about.checkFailed': '检查更新失败',
    'about.later': '稍后',
    'about.systemVersion': '系统版本',
    'about.authorEmail': '作者邮箱',
    'about.openSource': '开源项目',

    // Logs
    'logs.title': '日志',
    'logs.output': '日志输出',
    'logs.empty': '暂无日志',

    // Tags
    'tags.emotion': '情绪',
    'tags.compound': '复合',
    'tags.tone': '语调',
    'tags.persona': '腔调',
    'tags.dialect': '方言',
    'tags.other': '其他',
    'tags.rhythm': '节奏',
    'tags.feature': '特征',
    'tags.laughCry': '哭笑',

    // Common
    'common.save': '保存',
    'common.pause': '暂停',
    'common.resume': '继续',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.clear': '清空',
    'common.quickSelect': '快速选择',

    // Error Boundary
    'errorBoundary.title': '出错了',
    'errorBoundary.retry': '重试',
    'errorBoundary.reload': '重新加载',
}

export default zhCN
