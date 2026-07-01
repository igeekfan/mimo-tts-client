package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	apiKey := os.Getenv("TTS_API_KEY")
	if apiKey == "" {
		fmt.Println("请设置环境变量 TTS_API_KEY")
		os.Exit(1)
	}

	baseUrl := "https://api.xiaomimimo.com/v1"

	messages := []map[string]string{
		{"role": "user", "content": "用轻快的语调"},
		{"role": "assistant", "content": "你好世界，今天天气真好！"},
	}

	reqBody := map[string]interface{}{
		"model":    "mimo-v2.5-tts",
		"messages": messages,
		"audio": map[string]string{
			"format": "wav",
			"voice":  "mimo_default",
		},
		"stream": false,
	}

	jsonData, _ := json.Marshal(reqBody)
	fmt.Printf("请求: %s\n\n", string(jsonData))

	url := baseUrl + "/chat/completions"
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("请求失败: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("状态码: %d\n", resp.StatusCode)
	fmt.Printf("响应长度: %d bytes\n\n", len(body))

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("API 错误: %s\n", string(body))
		os.Exit(1)
	}

	// 打印响应结构（隐藏音频数据）
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if choices, ok := result["choices"].([]interface{}); ok && len(choices) > 0 {
		choice := choices[0].(map[string]interface{})
		if message, ok := choice["message"].(map[string]interface{}); ok {
			if audio, ok := message["audio"].(map[string]interface{}); ok {
				if data, ok := audio["data"].(string); ok {
					fmt.Printf("音频数据长度: %d chars\n", len(data))

					decoded, err := base64.StdEncoding.DecodeString(data)
					if err != nil {
						fmt.Printf("Base64 解码失败: %v\n", err)
						os.Exit(1)
					}

					fmt.Printf("解码后音频: %d bytes\n", len(decoded))
					fmt.Printf("前16字节: %x\n", decoded[:min(16, len(decoded))])

					// 检查是否是 WAV 格式 (RIFF header)
					if len(decoded) >= 4 && string(decoded[:4]) == "RIFF" {
						fmt.Println("格式: WAV (RIFF)")
					} else {
						fmt.Println("格式: 原始 PCM 数据")
						fmt.Println("注意: 浏览器 Audio 对象需要 WAV 格式，需要添加 WAV header")
					}

					err = os.WriteFile("test_output.wav", decoded, 0644)
					if err != nil {
						fmt.Printf("写入文件失败: %v\n", err)
					} else {
						fmt.Println("\n音频已保存到 test_output.wav")
					}
				}
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
