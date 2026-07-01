export namespace desktop {
	
	export class AboutInfo {
	    appVersion: string;
	    systemVersion: string;
	    githubRepo: string;
	    githubUrl: string;
	    authorEmail: string;
	
	    static createFrom(source: any = {}) {
	        return new AboutInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appVersion = source["appVersion"];
	        this.systemVersion = source["systemVersion"];
	        this.githubRepo = source["githubRepo"];
	        this.githubUrl = source["githubUrl"];
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
	export class HistorySearchResult {
	    items: HistoryItem[];
	    total: number;
	    offset: number;
	    limit: number;
	
	    static createFrom(source: any = {}) {
	        return new HistorySearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], HistoryItem);
	        this.total = source["total"];
	        this.offset = source["offset"];
	        this.limit = source["limit"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
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
	    styleHistory: string[];
	    hasApiKey?: boolean;
	
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
	        this.styleHistory = source["styleHistory"];
	        this.hasApiKey = source["hasApiKey"];
	    }
	}
	export class StreamTTSRequest {
	    streamId: string;
	    text: string;
	    model: string;
	    voice: string;
	    style: string;
	    optimizeTextPreview: boolean;
	
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
	        this.optimizeTextPreview = source["optimizeTextPreview"];
	    }
	}
	export class TTSRequest {
	    text: string;
	    model: string;
	    voice: string;
	    style: string;
	    outputDir: string;
	    optimizeTextPreview: boolean;
	
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
	        this.optimizeTextPreview = source["optimizeTextPreview"];
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
	export class UpdateInfo {
	    hasUpdate: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    releaseName: string;
	    releaseBody: string;
	    htmlUrl: string;
	    publishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasUpdate = source["hasUpdate"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseName = source["releaseName"];
	        this.releaseBody = source["releaseBody"];
	        this.htmlUrl = source["htmlUrl"];
	        this.publishedAt = source["publishedAt"];
	    }
	}

}

