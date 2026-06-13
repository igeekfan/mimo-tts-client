package core

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

const (
	githubRepoURL = "https://github.com/igeekfan/mimo-tts-client"
	authorEmail   = "igeekfan@foxmail.com"
)

func (s *Service) GetAboutInfo() AboutInfo {
	return AboutInfo{
		AppVersion:    s.appVersion,
		SystemVersion: detectSystemVersion(),
		GithubRepo:    "igeekfan/mimo-tts-client",
		GithubURL:     githubRepoURL,
		AuthorEmail:   authorEmail,
	}
}

func detectSystemVersion() string {
	switch runtime.GOOS {
	case "windows":
		return commandOutput("cmd", "/c", "ver")
	case "darwin":
		out, _ := exec.Command("sw_vers", "-productVersion").Output()
		return "macOS " + strings.TrimSpace(string(out))
	case "linux":
		out, _ := exec.Command("uname", "-sr").Output()
		return strings.TrimSpace(string(out))
	}
	return runtime.GOOS
}

func commandOutput(name string, arg ...string) string {
	out, err := exec.Command(name, arg...).Output()
	if err != nil {
		return fmt.Sprintf("%s %s", runtime.GOOS, runtime.GOARCH)
	}
	return strings.TrimSpace(string(out))
}
