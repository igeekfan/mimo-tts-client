const enUS: Record<string, string> = {
    // Input
    'input.title': 'Text Input',
    'input.placeholder': 'Enter text to synthesize...',
    'input.characters': 'characters',
    'input.audioTags': 'Audio Tags',

    // Model
    'model': 'Model',
    'model.select': 'Select Model',
    'model.preset': 'Preset Voices',
    'model.voiceDesign': 'Voice Design',
    'model.voiceClone': 'Voice Clone',

    // Voice
    'voice': 'Voice',
    'voice.select': 'Select Voice',
    'voice.description': 'Voice Description',
    'voice.descriptionPlaceholder': 'e.g. Young female, gentle and sweet voice, moderate pace',
    'voice.audioSample': 'Audio Sample',
    'voice.chooseFile': 'Choose File',
    'voice.noFileSelected': 'No file selected',
    'voice.supportedFormats': 'Supported formats',
    'voice.maxFileSize': 'Max file size',
    'voice.designTip': 'Voice Design model generates custom voices from text descriptions, no preset voices or audio samples needed',
    'voice.loading': 'Loading...',
    'voice.fileTooLarge': 'File exceeds 10MB limit',
    'voice.readFileError': 'Failed to read file',

    // Style
    'style': 'Style',
    'style.directorMode': 'Director Mode',
    'style.director.role': 'Role',
    'style.director.scene': 'Scene',
    'style.director.direction': 'Direction',
    'style.placeholder': 'e.g. Bright, bouncy tone with fast pace',
    'style.history': 'History',

    // Synthesis
    'synthesis.title': 'Synthesis Settings',
    'synthesis.synthesize': 'Synthesize',
    'synthesis.stream': 'Stream',
    'synthesis.synthesizing': 'Synthesizing...',
    'synthesis.streaming': 'Streaming...',
    'synthesis.completed': 'Synthesis completed',
    'synthesis.enterText': 'Please enter text',
    'synthesis.cancelled': 'Synthesis cancelled',
    'synthesis.smartPolish': 'Smart Polish',
    'synthesis.autoPolishTip': 'When enabled, the synthesis text will be automatically polished by the model',
    'synthesis.streamLimitTip': 'Low-latency streaming is not yet available for this model. Stream calls will run in compatibility mode (waits for full inference before returning results)',

    // History
    'history.title': 'History',
    'history.clearCompleted': 'Clear Completed',
    'history.empty': 'No synthesis records yet',
    'history.search': 'Search history',
    'history.noMore': 'No more records',
    'history.loadMore': 'Load more',
    'history.firstHint': 'Start synthesizing your first voice',
    'history.loadingAudio': 'Loading audio...',

    // Settings
    'settings.title': 'Settings',
    'settings.app': 'App Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark',
    'settings.theme.light': 'Light',
    'settings.language': 'Language',
    'settings.autoSave': 'Settings auto-saved',
    'settings.saved': 'Settings saved',
    'settings.save': 'Save Settings',
    'settings.apiKey': 'API Key',
    'settings.baseUrl': 'Base URL',
    'settings.apiConfig': 'API Config',
    'settings.apiKeyPlaceholder': 'Enter your API Key',
    'settings.baseUrlPlaceholder': 'Enter Base URL',

    // About
    'about.title': 'About',
    'about.checkUpdate': 'Check for Updates',
    'about.checking': 'Checking...',
    'about.upToDate': 'Up to date (v{version})',
    'about.newVersion': 'New version v{version} available!',
    'about.download': 'Download Update',
    'about.checkFailed': 'Failed to check for updates',
    'about.later': 'Later',
    'about.systemVersion': 'System Version',
    'about.authorEmail': 'Author Email',
    'about.openSource': 'Open Source',

    // Logs
    'logs.title': 'Logs',
    'logs.output': 'Log Output',
    'logs.empty': 'No logs yet',

    // Audio
    'audio.loading': 'Loading audio...',
    'audio.notAvailable': 'No audio available',

    // Tags
    'tags.emotion': 'Emotion',
    'tags.compound': 'Compound',
    'tags.tone': 'Tone',
    'tags.persona': 'Persona',
    'tags.dialect': 'Dialect',
    'tags.other': 'Other',
    'tags.rhythm': 'Rhythm',
    'tags.feature': 'Feature',
    'tags.laughCry': 'Laugh/Cry',

    // Common
    'common.save': 'Save',
    'common.pause': 'Pause',
    'common.resume': 'Resume',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.clear': 'Clear',
    'common.quickSelect': 'Quick Select',
    'common.back': 'Back',

    // Error Boundary
    'errorBoundary.title': 'Something went wrong',
    'errorBoundary.retry': 'Retry',
    'errorBoundary.reload': 'Reload page',
}

export default enUS
