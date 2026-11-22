import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import express from 'express';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

interface ImageGenerateBody {
  prompt?: string;
  aspectRatio?: string;
  quality?: 'fast' | 'hd';
  imageSize?: '1K' | '2K';
  referenceImageBase64?: string;
  referenceMimeType?: string;
}

interface VideoGenerateBody {
  prompt?: string;
  aspectRatio?: '16:9' | '9:16';
  duration?: string;
  resolution?: '360p' | '720p' | '1080p';
  referenceImageBase64?: string;
  referenceMimeType?: string;
  previousInteractionId?: string;
}

const VALID_IMAGE_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
const VALID_VIDEO_DURATIONS = new Set([
  '3s',
  '4s',
  '5s',
  '6s',
  '7s',
  '8s',
  '9s',
  '10s',
  '11s',
  '12s',
  '13s',
  '14s',
  '15s',
]);

const VALID_EXTENSION_DURATIONS = new Set([
  '3s',
  '4s',
  '5s',
  '6s',
  '7s',
  '8s',
  '9s',
  '10s',
]);

const TERMINAL_FAILURE_STATUSES = new Set([
  'failed',
  'cancelled',
  'incomplete',
  'budget_exceeded',
]);

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Check your API key in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 403,
      message: `${raw} — Please verify your billing-enabled API key in the Settings > Secrets panel.`,
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: `${raw} — Quota reached. Selecting a billing-enabled API key in Settings > Secrets increases quota.`,
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return { status: 404, message: raw };
  }
  if (raw.includes('INVALID_ARGUMENT') || raw.includes('400')) {
    return { status: 400, message: raw };
  }
  return { status: 500, message: raw };
}

function normalizeImageAspectRatio(raw?: string): '1:1' | '3:4' | '4:3' | '9:16' | '16:9' {
  if (raw === '4:5') return '3:4';
  if (raw && VALID_IMAGE_RATIOS.has(raw)) {
    return raw as '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  }
  return '1:1';
}

function stripDataUrlPrefix(input: string): string {
  const commaIdx = input.indexOf(',');
  if (input.startsWith('data:') && commaIdx !== -1) {
    return input.slice(commaIdx + 1);
  }
  return input;
}

interface ExtractedVideoResult {
  videoDataUrl: string;
  mimeType: string;
  interactionId: string;
  modelUsed: string;
}

interface VideoInteractionLike {
  id?: string;
  status: string;
  output_text?: string | null;
  output_video?: {
    data?: string;
    uri?: string;
    mime_type?: string;
  } | null;
  steps?: Array<{
    type?: string;
    content?: Array<Record<string, unknown>>;
  }>;
  errors?: Array<{ message?: string } | Record<string, unknown>>;
}

async function extractVideoFromInteraction(
  interaction: VideoInteractionLike
): Promise<{ result?: ExtractedVideoResult; error?: string }> {
  let videoBase64 = interaction.output_video?.data ?? '';
  let videoUri = interaction.output_video?.uri ?? '';
  let videoMime = interaction.output_video?.mime_type || 'video/mp4';

  if (!videoBase64 && !videoUri && Array.isArray(interaction.steps)) {
    for (const step of interaction.steps) {
      if (step.type === 'model_output' && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item.type === 'video') {
            if (typeof item.data === 'string' && item.data) {
              videoBase64 = item.data;
            }
            if (typeof item.uri === 'string' && item.uri) {
              videoUri = item.uri;
            }
            if (typeof item.mime_type === 'string' && item.mime_type) {
              videoMime = item.mime_type;
            }
          }
        }
      }
    }
  }

  if (!videoBase64 && videoUri) {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    const dlRes = await fetch(videoUri, {
      headers: apiKey ? { 'x-goog-api-key': apiKey } : undefined,
    });
    if (!dlRes.ok) {
      return {
        error: `Generated video URI could not be retrieved (HTTP ${dlRes.status}).`,
      };
    }
    const arrBuf = await dlRes.arrayBuffer();
    videoBase64 = Buffer.from(arrBuf).toString('base64');
    const contentType = dlRes.headers.get('content-type');
    if (contentType) {
      videoMime = contentType;
    }
  }

  if (!videoBase64) {
    const apiErrors = Array.isArray(interaction.errors)
      ? interaction.errors
          .map((e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : ''))
          .filter(Boolean)
          .join('; ')
      : '';
    return {
      error:
        apiErrors ||
        interaction.output_text ||
        'No video clip was returned by gemini-omni-1.2-flash. Try refining the motion prompt.',
    };
  }

  return {
    result: {
      videoDataUrl: `data:${videoMime};base64,${videoBase64}`,
      mimeType: videoMime,
      interactionId: interaction.id ?? '',
      modelUsed: 'gemini-omni-1.2-flash',
    },
  };
}

function getInteractionErrorMessage(interaction: VideoInteractionLike): string {
  const apiErrors = Array.isArray(interaction.errors)
    ? interaction.errors
        .map((e) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : ''))
        .filter(Boolean)
        .join('; ')
    : '';
  return (
    apiErrors ||
    interaction.output_text ||
    `Video generation stopped with status "${interaction.status}".`
  );
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Server-side Image, Logo & Icon Generation / Editing
  app.post('/api/gemini/image', async (req: Request, res: Response) => {
    try {
      const body = req.body as ImageGenerateBody;
      const prompt = (body.prompt ?? '').trim();
      if (!prompt) {
        res.status(400).json({ error: 'A creative prompt is required.' });
        return;
      }

      const ai = createGeminiClient();
      const useHdModel = body.quality === 'hd' || body.imageSize === '2K';
      const model = useHdModel ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';
      const aspectRatio = normalizeImageAspectRatio(body.aspectRatio);

      const parts: Array<
        | { text: string }
        | { inlineData: { data: string; mimeType: string } }
      > = [];

      if (body.referenceImageBase64) {
        parts.push({
          inlineData: {
            data: stripDataUrlPrefix(body.referenceImageBase64),
            mimeType: body.referenceMimeType || 'image/png',
          },
        });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          imageConfig: useHdModel
            ? {
                aspectRatio,
                imageSize: body.imageSize === '2K' ? '2K' : '1K',
              }
            : {
                aspectRatio,
              },
        },
      });

      let imageBase64 = '';
      let mimeType = 'image/png';
      let captionText = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data && !imageBase64) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
        } else if (part.text) {
          captionText += part.text;
        }
      }

      if (!imageBase64) {
        res.status(502).json({
          error:
            captionText.trim() ||
            'Gemini did not return an image for this prompt. Try adjusting the description.',
        });
        return;
      }

      res.json({
        imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
        mimeType,
        captionText: captionText.trim(),
        modelUsed: model,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Server-side Video Ad Generation, Image-to-Video Animation & Multi-turn Extension (Omni Flash)
  app.post('/api/gemini/video', async (req: Request, res: Response) => {
    try {
      const body = req.body as VideoGenerateBody;
      const prompt = (body.prompt ?? '').trim();
      if (!prompt) {
        res.status(400).json({ error: 'A video prompt or script instruction is required.' });
        return;
      }

      const ai = createGeminiClient();
      const aspectRatio: '16:9' | '9:16' = body.aspectRatio === '9:16' ? '9:16' : '16:9';
      const isExtension = Boolean(body.previousInteractionId);
      const duration = isExtension
        ? body.duration && VALID_EXTENSION_DURATIONS.has(body.duration)
          ? body.duration
          : '8s'
        : body.duration && VALID_VIDEO_DURATIONS.has(body.duration)
          ? body.duration
          : '8s';
      const resolution: '360p' | '720p' | '1080p' =
        body.resolution === '1080p' || body.resolution === '360p' ? body.resolution : '720p';

      const inputPayload = body.referenceImageBase64
        ? [
            {
              type: 'image' as const,
              mime_type: body.referenceMimeType || 'image/png',
              data: stripDataUrlPrefix(body.referenceImageBase64),
            },
            {
              type: 'text' as const,
              text: prompt,
            },
          ]
        : prompt;

      const interaction = await ai.interactions.create({
        model: 'gemini-omni-1.2-flash',
        ...(body.previousInteractionId
          ? { previous_interaction_id: body.previousInteractionId }
          : {}),
        input: inputPayload,
        background: true,
        store: true,
        stream: false,
        response_format: isExtension
          ? {
              type: 'video',
              duration,
            }
          : {
              type: 'video',
              aspect_ratio: aspectRatio,
              duration,
              resolution,
            },
        api_version: 'v1beta',
      });

      if (interaction.status === 'completed') {
        const extracted = await extractVideoFromInteraction(interaction);
        if (extracted.error || !extracted.result) {
          res.status(502).json({ error: extracted.error || 'Video output missing.' });
          return;
        }
        res.json({ status: 'completed', ...extracted.result });
        return;
      }

      if (TERMINAL_FAILURE_STATUSES.has(interaction.status)) {
        res.status(502).json({ error: getInteractionErrorMessage(interaction) });
        return;
      }

      if (!interaction.id) {
        res.status(502).json({ error: 'Video interaction started without a trackable ID.' });
        return;
      }

      res.status(202).json({
        status: 'pending',
        jobId: interaction.id,
        providerStatus: interaction.status,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/gemini/video/:jobId', async (req: Request, res: Response) => {
    try {
      const rawId = req.params.jobId;
      const interactionId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!interactionId || !/^[a-zA-Z0-9_.-]{4,180}$/.test(interactionId)) {
        res.status(400).json({ error: 'Invalid video interaction ID.' });
        return;
      }

      const ai = createGeminiClient();
      const interaction = await ai.interactions.get(interactionId, {
        api_version: 'v1beta',
        stream: false,
      });

      if (interaction.status === 'completed') {
        const extracted = await extractVideoFromInteraction(interaction);
        if (extracted.error || !extracted.result) {
          res.status(502).json({
            status: 'failed',
            error: extracted.error || 'Video output missing.',
          });
          return;
        }
        res.json({ status: 'completed', ...extracted.result });
        return;
      }

      if (TERMINAL_FAILURE_STATUSES.has(interaction.status)) {
        res.status(502).json({
          status: 'failed',
          error: getInteractionErrorMessage(interaction),
        });
        return;
      }

      res.json({
        status: 'pending',
        jobId: interaction.id,
        providerStatus: interaction.status,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ status: 'failed', error: formatted.message });
    }
  });

  const distPath = path.join(__dirname, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tidyups server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
