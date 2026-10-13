import { describe, it, expect, vi } from 'vitest';
// Распознавание речи — чистый модуль рядом с edge-функциями (Deno): сеть и ключи передаются снаружи.
import {
  audioFilename,
  checkVoice,
  cleanTranscript,
  MAX_VOICE_BYTES,
  MAX_VOICE_SECONDS,
  sttConfig,
  transcribe,
  usableTranscript,
  voiceOf,
} from '../../../supabase/functions/_shared/stt.ts';

const env = (vars: Record<string, string>) => (name: string) => vars[name];

describe('sttConfig', () => {
  it('is off without keys, and blank keys do not count', () => {
    expect(sttConfig(env({}))).toBeNull();
    expect(sttConfig(env({ GROQ_API_KEY: '  ', OPENAI_API_KEY: '' }))).toBeNull();
  });

  it('prefers Groq (free tier) over OpenAI and trims the key', () => {
    expect(sttConfig(env({ GROQ_API_KEY: ' gsk_1 ', OPENAI_API_KEY: 'sk-2' }))).toEqual({ provider: 'groq', key: 'gsk_1' });
    expect(sttConfig(env({ OPENAI_API_KEY: 'sk-2' }))).toEqual({ provider: 'openai', key: 'sk-2' });
  });
});

describe('voiceOf', () => {
  it('reads a voice message', () => {
    expect(voiceOf({ voice: { file_id: 'F1', duration: 12, file_size: 20000, mime_type: 'audio/ogg' } })).toEqual({
      fileId: 'F1', seconds: 12, bytes: 20000, mime: 'audio/ogg', kind: 'voice',
    });
  });

  it('reads an audio file and a round video, with sensible default types', () => {
    expect(voiceOf({ audio: { file_id: 'A1', duration: 60, mime_type: 'audio/mpeg' } })).toMatchObject({ kind: 'audio', mime: 'audio/mpeg' });
    expect(voiceOf({ video_note: { file_id: 'V1', duration: 5 } })).toMatchObject({ kind: 'video_note', mime: 'video/mp4' });
    expect(voiceOf({ voice: { file_id: 'F2' } })).toMatchObject({ seconds: 0, mime: 'audio/ogg' });
  });

  it('is null for text, junk and empty ids', () => {
    expect(voiceOf({ text: 'привет' })).toBeNull();
    expect(voiceOf(null)).toBeNull();
    expect(voiceOf('x')).toBeNull();
    expect(voiceOf({ voice: { file_id: '' } })).toBeNull();
    expect(voiceOf({ voice: { duration: 3 } })).toBeNull();
  });
});

describe('checkVoice', () => {
  const ref = (over: Partial<Parameters<typeof checkVoice>[0]> = {}) => ({ fileId: 'F', seconds: 30, kind: 'voice' as const, ...over });

  it('accepts a normal dictation up to the limit', () => {
    expect(checkVoice(ref())).toBeNull();
    expect(checkVoice(ref({ seconds: MAX_VOICE_SECONDS }))).toBeNull();
  });

  it('refuses a too long or too big recording with a clear message', () => {
    expect(checkVoice(ref({ seconds: MAX_VOICE_SECONDS + 1 }))).toMatch(/длинная запись.*3 минут/);
    expect(checkVoice(ref({ bytes: MAX_VOICE_BYTES + 1 }))).toMatch(/слишком большой/i);
  });
});

describe('audioFilename', () => {
  it('names the file by its type, because the service detects the format by the extension', () => {
    expect(audioFilename('audio/ogg')).toBe('voice.ogg');
    expect(audioFilename('audio/mpeg')).toBe('voice.mp3');
    expect(audioFilename('audio/x-m4a')).toBe('voice.m4a');
    expect(audioFilename('video/mp4')).toBe('voice.mp4');
    expect(audioFilename(undefined)).toBe('voice.ogg');
    expect(audioFilename('application/x-unknown')).toBe('voice.ogg');
  });
});

describe('transcript cleaning', () => {
  it('collapses whitespace', () => {
    expect(cleanTranscript('  позвонить \n маме\t завтра  ')).toBe('позвонить маме завтра');
  });

  it('drops empty, punctuation-only and silence "hallucinations"', () => {
    for (const bad of ['', '   ', '...', '?!', 'Продолжение следует...', 'Субтитры сделал DimaTorzok', 'Спасибо за просмотр!', 'Редактор субтитров А.Семкин']) {
      expect(usableTranscript(bad), bad).toBeNull();
    }
  });

  it('keeps real dictation, even when it happens to mention such a phrase', () => {
    expect(usableTranscript(' купить хлеб и позвонить маме ')).toBe('купить хлеб и позвонить маме');
    const long = 'в пятницу сделать презентацию, потом записаться к врачу на понедельник и написать Асхату, что субтитры сделал уже вчера';
    expect(usableTranscript(long)).toBe(long);
  });
});

describe('transcribe', () => {
  const blob = () => new Blob([new Uint8Array([79, 103, 103, 83])], { type: 'audio/ogg' });
  const ok = (text: unknown) => new Response(JSON.stringify({ text }), { status: 200, headers: { 'content-type': 'application/json' } });

  it('sends the recording to Groq with the key, Russian language and zero temperature', async () => {
    const fetchImpl = vi.fn(async () => ok(' позвонить  маме '));
    const text = await transcribe({ blob: blob(), filename: 'voice.ogg' }, { provider: 'groq', key: 'gsk_key' }, fetchImpl as unknown as typeof fetch);
    expect(text).toBe('позвонить маме');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer gsk_key');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect(form.get('language')).toBe('ru');
    expect(form.get('temperature')).toBe('0');
    expect(form.get('response_format')).toBe('json');
    expect((form.get('file') as File).name).toBe('voice.ogg');
  });

  it('uses the OpenAI endpoint and model when only that key is set', async () => {
    const fetchImpl = vi.fn(async () => ok('ок'));
    await transcribe({ blob: blob() }, { provider: 'openai', key: 'sk-x' }, fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect((init.body as FormData).get('model')).toBe('whisper-1');
  });

  it('turns a service error into an exception with the status and a short reason', async () => {
    const fetchImpl = vi.fn(async () => new Response('rate limit exceeded', { status: 429 }));
    await expect(transcribe({ blob: blob() }, { provider: 'groq', key: 'k' }, fetchImpl as unknown as typeof fetch)).rejects.toThrow(/stt groq 429: rate limit/);
  });

  it('gives an empty string when the answer has no text', async () => {
    const fetchImpl = vi.fn(async () => ok(undefined));
    expect(await transcribe({ blob: blob() }, { provider: 'groq', key: 'k' }, fetchImpl as unknown as typeof fetch)).toBe('');
  });
});
