package desktop

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) SelectFolder() string {
	dir, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Output Directory",
	})
	if err != nil {
		return ""
	}
	return dir
}

func (a *App) OpenFolder(path string) error {
	path = filepath.Clean(path)
	fileInfo, err := os.Stat(path)
	isFile := err == nil && !fileInfo.IsDir()

	openPath := path
	if err != nil {
		parent := filepath.Dir(path)
		if _, parentErr := os.Stat(parent); parentErr == nil {
			openPath = parent
		} else {
			return fmt.Errorf("path does not exist: %s", path)
		}
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		if isFile {
			cmd = exec.Command("explorer", "/select,", path)
		} else {
			cmd = exec.Command("explorer", openPath)
		}
	case "darwin":
		if isFile {
			cmd = exec.Command("open", "-R", path)
		} else {
			cmd = exec.Command("open", openPath)
		}
	default:
		cmd = exec.Command("xdg-open", openPath)
	}
	return cmd.Start()
}

func (a *App) OpenFile(path string) error {
	path = filepath.Clean(path)
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", path)
	case "darwin":
		cmd = exec.Command("open", path)
	default:
		cmd = exec.Command("xdg-open", path)
	}
	return cmd.Start()
}
