export namespace desktop {
	
	export class AboutInfo {
	    appVersion: string;
	    systemVersion: string;
	    authorEmail: string;
	
	    static createFrom(source: any = {}) {
	        return new AboutInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appVersion = source["appVersion"];
	        this.systemVersion = source["systemVersion"];
	        this.authorEmail = source["authorEmail"];
	    }
	}
	export class HistoryAudioResponse {
	    audioData: string;
	    format: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryAudioResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.audioData = source["audioData"];
	        this.format = source["format"];
	    }
	}
	export class HistoryItem {
	    id: number;
	    text: string;
	    model: string;
	    voice: string;
	    style: string;
	    hasAudio: boolean;
	    format: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.text = source["text"];
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.style = source["style"];
	        this.hasAudio = source["hasAudio"];
	        this.format = source["format"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class SaveHistoryRequest {
	    text: string;
	    model: string;
	    voice: string;
	    style: string;
	    audioData: string;
	    format: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveHistoryRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.style = source["style"];
	        this.audioData = source["audioData"];
	        this.format = source["format"];
	    }
	}
	export class Settings {
	    language: string;
	    theme: string;
	    apiKey: string;
	    baseUrl: string;
	    model: string;
	    voice: string;
	    style: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.language = source["language"];
	        this.theme = source["theme"];
	        this.apiKey = source["apiKey"];
	        this.baseUrl = source["baseUrl"];
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.style = source["style"];
	    }
	}
	export class StreamTTSRequest {
	    streamId: string;
	    text: string;
	    model: string;
	    voice: string;
	    style: string;
	
	    static createFrom(source: any = {}) {
	        return new StreamTTSRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.streamId = source["streamId"];
	        this.text = source["text"];
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.style = source["style"];
	    }
	}
	export class TTSRequest {
	    text: string;
	    model: string;
	    voice: string;
	    style: string;
	    outputDir: string;
	
	    static createFrom(source: any = {}) {
	        return new TTSRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.model = source["model"];
	        this.voice = source["voice"];
	        this.style = source["style"];
	        this.outputDir = source["outputDir"];
	    }
	}
	export class TTSResponse {
	    audioData: string;
	    format: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new TTSResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.audioData = source["audioData"];
	        this.format = source["format"];
	        this.error = source["error"];
	    }
	}

}

