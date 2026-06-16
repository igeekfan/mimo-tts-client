import {VoicePreset} from '../types'

export const PRESET_VOICES: VoicePreset[] = [
    {name: '默认', voiceId: 'mimo_default', language: 'zh-CN', gender: 'female'},
    {name: '冰糖', voiceId: '冰糖', language: 'zh-CN', gender: 'female'},
    {name: '茉莉', voiceId: '茉莉', language: 'zh-CN', gender: 'female'},
    {name: '苏打', voiceId: '苏打', language: 'zh-CN', gender: 'male'},
    {name: '白桦', voiceId: '白桦', language: 'zh-CN', gender: 'male'},
    {name: 'Mia', voiceId: 'Mia', language: 'en-US', gender: 'female'},
    {name: 'Chloe', voiceId: 'Chloe', language: 'en-US', gender: 'female'},
    {name: 'Milo', voiceId: 'Milo', language: 'en-US', gender: 'male'},
    {name: 'Dean', voiceId: 'Dean', language: 'en-US', gender: 'male'},
]

export const VOICE_DESIGN_EXAMPLES = [
    '年轻女性，声音温柔甜美，语速适中',
    '成熟男性，声音低沉磁性，语速稍慢',
    'Heavy Russian accent, gruff middle-aged male',
    '少女，声音清脆活泼，带点俏皮',
    '一位年迈的老先生，嗓音略带沙哑和沧桑感',
    'Young female, ASMR feel, speaks very slowly',
]

export const STYLE_PRESETS: {label: string; value: string; category?: string; ttsOnly?: boolean}[] = [
    // 基础情绪
    {label: '开心', value: '开心', category: 'emotion'}, {label: '悲伤', value: '悲伤', category: 'emotion'}, {label: '愤怒', value: '愤怒', category: 'emotion'},
    {label: '恐惧', value: '恐惧', category: 'emotion'}, {label: '惊讶', value: '惊讶', category: 'emotion'}, {label: '兴奋', value: '兴奋', category: 'emotion'},
    {label: '委屈', value: '委屈', category: 'emotion'}, {label: '平静', value: '平静', category: 'emotion'}, {label: '冷漠', value: '冷漠', category: 'emotion'},
    // 复合情绪
    {label: '怅然', value: '怅然', category: 'compound'}, {label: '欣慰', value: '欣慰', category: 'compound'}, {label: '无奈', value: '无奈', category: 'compound'},
    {label: '愧疚', value: '愧疚', category: 'compound'}, {label: '释然', value: '释然', category: 'compound'}, {label: '嫉妒', value: '嫉妒', category: 'compound'},
    {label: '厌倦', value: '厌倦', category: 'compound'}, {label: '忐忑', value: '忐忑', category: 'compound'}, {label: '动情', value: '动情', category: 'compound'},
    // 整体语调
    {label: '温柔', value: '温柔', category: 'tone'}, {label: '高冷', value: '高冷', category: 'tone'}, {label: '活泼', value: '活泼', category: 'tone'},
    {label: '严肃', value: '严肃', category: 'tone'}, {label: '慵懒', value: '慵懒', category: 'tone'}, {label: '俏皮', value: '俏皮', category: 'tone'},
    {label: '深沉', value: '深沉', category: 'tone'}, {label: '干练', value: '干练', category: 'tone'}, {label: '凌厉', value: '凌厉', category: 'tone'},
    // 音色定位
    {label: '磁性', value: '磁性', category: 'voice'}, {label: '醇厚', value: '醇厚', category: 'voice'}, {label: '清亮', value: '清亮', category: 'voice'},
    {label: '空灵', value: '空灵', category: 'voice'}, {label: '稚嫩', value: '稚嫩', category: 'voice'}, {label: '苍老', value: '苍老', category: 'voice'},
    {label: '甜美', value: '甜美', category: 'voice'}, {label: '沙哑', value: '沙哑', category: 'voice'}, {label: '醇雅', value: '醇雅', category: 'voice'},
    // 人设腔调
    {label: '夹子音', value: '夹子音', category: 'persona'}, {label: '御姐音', value: '御姐音', category: 'persona'}, {label: '正太音', value: '正太音', category: 'persona'},
    {label: '大叔音', value: '大叔音', category: 'persona'}, {label: '台湾腔', value: '台湾腔', category: 'persona'},
    // 方言
    {label: '东北话', value: '东北话', category: 'dialect'}, {label: '四川话', value: '四川话', category: 'dialect'},
    {label: '河南话', value: '河南话', category: 'dialect'}, {label: '粤语', value: '粤语', category: 'dialect'},
    // 唱歌
    {label: '唱歌', value: '唱歌', ttsOnly: true},
]

export const AUDIO_TAGS = [
    // 语速与节奏
    {label: '吸气', tag: '[吸气]'}, {label: '深呼吸', tag: '[深呼吸]'}, {label: '叹气', tag: '[叹气]'},
    {label: '长叹一口气', tag: '[长叹一口气]'}, {label: '喘息', tag: '[喘息]'}, {label: '屏息', tag: '[屏息]'},
    // 情绪状态
    {label: '紧张', tag: '[紧张]'}, {label: '害怕', tag: '[害怕]'}, {label: '激动', tag: '[激动]'},
    {label: '疲惫', tag: '[疲惫]'}, {label: '委屈', tag: '[委屈]'}, {label: '撒娇', tag: '[撒娇]'},
    {label: '心虚', tag: '[心虚]'}, {label: '震惊', tag: '[震惊]'}, {label: '不耐烦', tag: '[不耐烦]'},
    // 语音特征
    {label: '颤抖', tag: '[颤抖]'}, {label: '变调', tag: '[变调]'}, {label: '破音', tag: '[破音]'},
    {label: '鼻音', tag: '[鼻音]'}, {label: '气声', tag: '[气声]'},
    // 哭笑表达
    {label: '笑', tag: '[笑]'}, {label: '轻笑', tag: '[轻笑]'}, {label: '大笑', tag: '[大笑]'},
    {label: '冷笑', tag: '[冷笑]'}, {label: '抽泣', tag: '[抽泣]'}, {label: '呜咽', tag: '[呜咽]'},
    {label: '哽咽', tag: '[哽咽]'}, {label: '嚎啕大哭', tag: '[嚎啕大哭]'},
]

export const DIRECTOR_MODE_EXAMPLES = {
    role: '百年门阀的现任大当家，自幼被塑造成完美无瑕的家族图腾，常年深居简出',
    scene: '在祠堂的阴影里，看着不顾一切冲来找她的男人，要用最冷硬的阶级壁垒绞杀对方',
    direction: '冰冷慵懒的低音御姐，语速极慢，每个字都像在舌尖滚过才吐出来，带着上位者的傲慢'
}
