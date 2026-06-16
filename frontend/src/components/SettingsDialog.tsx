import {useI18n} from '../i18n/context'
import {AboutInfo, UpdateInfo} from '../types'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Badge} from '@/components/ui/badge'
import {Separator} from '@/components/ui/separator'
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select'
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Mic, ExternalLink, Globe, Mail, GitFork, RefreshCw, Download, Settings} from 'lucide-react'

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    theme: 'light' | 'dark'
    setTheme: (theme: 'light' | 'dark') => void
    lang: 'zh-CN' | 'en-US'
    setLang: (lang: 'zh-CN' | 'en-US') => void
    apiKey: string
    setApiKey: (key: string) => void
    baseUrl: string
    setBaseUrl: (url: string) => void
    aboutInfo: AboutInfo | null
    updateInfo: UpdateInfo | null
    updateLoading: boolean
    updateError: string
    handleCheckUpdate: () => void
    handleOpenReleasePage: () => void
}

export default function SettingsDialog({
    open, onOpenChange,
    theme, setTheme, lang, setLang,
    apiKey, setApiKey, baseUrl, setBaseUrl,
    aboutInfo, updateInfo, updateLoading, updateError,
    handleCheckUpdate, handleOpenReleasePage
}: SettingsDialogProps) {
    const {t} = useI18n()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('settings.title')}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[480px]">
                <DialogHeader><DialogTitle>{t('settings.title')}</DialogTitle></DialogHeader>
                <Tabs defaultValue="settings" className="mt-4">
                    <TabsList className="w-full">
                        <TabsTrigger value="settings" className="flex-1">{t('settings.title')}</TabsTrigger>
                        <TabsTrigger value="about" className="flex-1">{t('about.title')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="settings" className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground">{t('settings.appearance')}</h4>
                            <div className="space-y-2">
                                <Label>{t('settings.theme')}</Label>
                                <Select value={theme} onValueChange={v => setTheme(v as 'light' | 'dark')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                                        <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.language')}</Label>
                                <Select value={lang} onValueChange={v => setLang(v as 'zh-CN' | 'en-US')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="zh-CN">简体中文</SelectItem>
                                        <SelectItem value="en-US">English</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium text-muted-foreground">{t('settings.apiConfig')}</h4>
                            <div className="space-y-2">
                                <Label>{t('settings.apiKey')}</Label>
                                <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={t('settings.apiKeyPlaceholder')} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.baseUrl')}</Label>
                                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={t('settings.baseUrlPlaceholder')} />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <span className="text-xs text-muted-foreground italic">{t('settings.autoSave')}</span>
                        </div>
                    </TabsContent>
                    <TabsContent value="about">
                        <Card>
                            <CardHeader className="text-center">
                                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
                                    <Mic className="h-6 w-6 text-primary-foreground" />
                                </div>
                                <CardTitle>MiMo TTS</CardTitle>
                                {aboutInfo && (
                                    <Badge variant="secondary" className="w-fit mx-auto">v{aboutInfo.appVersion}</Badge>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {aboutInfo && (
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <GitFork className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">{t('about.openSource')}:</span>
                                            <a href={aboutInfo.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                                {aboutInfo.githubRepo} <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                        <div className="flex items-center gap-2 flex-nowrap">
                                            <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <span className="text-muted-foreground whitespace-nowrap">{t('about.systemVersion')}:</span>
                                            <span>{aboutInfo.systemVersion}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">{t('about.authorEmail')}:</span>
                                            <a href={`mailto:${aboutInfo.authorEmail}`} className="text-primary">{aboutInfo.authorEmail}</a>
                                        </div>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex flex-col items-center gap-2">
                                    <Button onClick={handleCheckUpdate} disabled={updateLoading} variant="outline" size="sm">
                                        <RefreshCw className={`w-4 h-4 mr-2 ${updateLoading ? 'animate-spin' : ''}`} />
                                        {updateLoading ? t('about.checking') : t('about.checkUpdate')}
                                    </Button>
                                    {updateInfo?.hasUpdate && (
                                        <Button onClick={handleOpenReleasePage} size="sm">
                                            <Download className="w-4 h-4 mr-2" />
                                            {t('about.download')}
                                        </Button>
                                    )}
                                    {updateInfo && !updateInfo.hasUpdate && !updateLoading && (
                                        <span className="text-xs text-muted-foreground">{t('about.upToDate', {version: updateInfo.currentVersion})}</span>
                                    )}
                                    {updateError && <span className="text-xs text-destructive">{updateError}</span>}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
