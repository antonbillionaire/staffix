/**
 * Voice AI module — Speech-to-Text only.
 *
 * Goal: turn client voice messages (Telegram voice/audio, IG/FB audio,
 * WhatsApp voice/audio) into text so the existing AI flow can answer.
 *
 * STT: Groq Whisper Large v3 (primary, ~$0.04/hr), OpenAI Whisper (fallback).
 * Languages: ru, uz, kk, en — all supported by Whisper Large v3.
 */

const WA_API_BASE = "https://graph.facebook.com/v21.0";

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

// ─── STT ─────────────────────────────────────────────────────────────────────

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = "voice.ogg"
): Promise<TranscriptionResult> {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      return await transcribeWithGroq(audioBuffer, filename, groqKey);
    } catch (e) {
      console.error("[VoiceAI] Groq STT failed, falling back to OpenAI:", e);
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return await transcribeWithOpenAI(audioBuffer, filename, openaiKey);
  }

  throw new Error("[VoiceAI] No STT API key configured (GROQ_API_KEY or OPENAI_API_KEY)");
}

async function transcribeWithGroq(
  audioBuffer: Buffer,
  filename: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`Groq STT error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    text: data.text || "",
    language: data.language,
    duration: data.duration,
  };
}

async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  filename: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    throw new Error(`OpenAI STT error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    text: data.text || "",
    language: data.language,
    duration: data.duration,
  };
}

// ─── Media download helpers ──────────────────────────────────────────────────

/**
 * Download a Telegram file by file_id.
 * Step 1: getFile to retrieve file_path
 * Step 2: download from https://api.telegram.org/file/bot<TOKEN>/<file_path>
 */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string
): Promise<Buffer> {
  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  if (!metaRes.ok) {
    throw new Error(`Telegram getFile failed: ${metaRes.status}`);
  }
  const metaData = await metaRes.json();
  if (!metaData.ok || !metaData.result?.file_path) {
    throw new Error(`Telegram getFile bad response: ${JSON.stringify(metaData).slice(0, 200)}`);
  }
  const filePath = metaData.result.file_path as string;

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileRes.ok) {
    throw new Error(`Telegram file download failed: ${fileRes.status}`);
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download a WhatsApp media file by media ID (two-step: get URL, then download).
 */
export async function downloadWAMedia(
  mediaId: string,
  accessToken: string
): Promise<Buffer> {
  const metaRes = await fetch(`${WA_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    throw new Error(`WA Media URL fetch failed: ${metaRes.status}`);
  }
  const metaData = await metaRes.json();
  const mediaUrl = metaData.url as string;
  if (!mediaUrl) throw new Error("WA Media: no URL in response");

  const fileRes = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    throw new Error(`WA Media download failed: ${fileRes.status}`);
  }
  const arrayBuffer = await fileRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download audio from Instagram/Facebook DM attachment URL (direct URL in webhook).
 */
export async function downloadAttachmentMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Media download failed: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
