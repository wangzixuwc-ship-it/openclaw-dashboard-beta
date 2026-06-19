---
name: lark-voice
description: 在飞书（Lark）上把文字转成语音发送。当用户要求发语音消息或用语音回复时使用。
metadata: {
  "openclaw": {
    "requires": {
      "bins": ["ffmpeg"]
    }
  }
}
---

# 飞书语音（Lark Voice）

把文字转成语音，作为语音消息发到飞书。

## 依赖（Requirements）

- `ffmpeg` —— 音频格式转换
- 至少一个 TTS（文字转语音）来源（技能或内置工具）

## 用法（Usage）

### 1. 找到 TTS 来源

扫描已安装技能里名字带 `tts` 的，并检查 OpenClaw 内置的 `tts` 工具是否可用。

- 用户指定了 TTS 来源 → 直接用
- 没指定、只有一个可用 → 直接用
- 没指定、有多个可用 → 让用户选
- 一个都没有 → 用 OpenClaw 内置 `tts` 工具，并建议装个 TTS 技能以获得更多音色

### 2. 生成音频

调用选定的 TTS 来源，生成 wav/mp3 或其它中间格式的音频文件，存到 `/tmp/openclaw/`。

### 3. 转成 Opus

飞书语音消息只支持 opus 格式（OGG 容器）。

```bash
ffmpeg -y -i /tmp/openclaw/input.wav -c:a libopus -b:a 24k -ar 24000 -ac 1 /tmp/openclaw/voice.opus
```
> 🔍 这条命令：用 ffmpeg 把 wav 音频转成飞书要求的 opus 格式。`-c:a libopus` 指定编码器，`-b:a 24k` 码率 24k，`-ar 24000` 采样率 24kHz，`-ac 1` 单声道，`-y` 表示覆盖已有文件不询问。

### 4. 发送语音

用 `message` 工具发送。openclaw-lark 插件会自动识别 `.opus` 后缀、解析时长，并以 `msg_type: audio`（语音气泡）形式发出。

```
message(action=send, media="/tmp/openclaw/voice.opus", message="可选的文字")
```
> 即：把转好的 .opus 文件交给 message 工具，插件自动当成语音消息发出去。
