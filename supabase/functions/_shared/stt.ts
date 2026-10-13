/**
 * Голосовые сообщения Telegram: что считать голосом, какие ограничения и как превратить запись в текст.
 * Модуль чистый — без Deno, без чтения окружения и без глобального состояния: ключи и сеть передаются
 * снаружи. Поэтому его проверяют тесты веб-проекта (`src/lib/domain/botStt.test.ts`).
 */

export type SttProvider = 'groq' | 'openai';

export interface SttConfig {
  provider: SttProvider;
  key: string;
}

/** Длиннее трёх минут список дел не диктуют, а ожидание ответа у Telegram и у функции ограничено. */
export const MAX_VOICE_SECONDS = 180;
/** Бот может скачивать файлы Telegram до 20 МБ; голосовое в OGG на три минуты весит около полумегабайта. */
export const MAX_VOICE_BYTES = 20 * 1024 * 1024;

const ENDPOINTS: Record<SttProvider, { url: string; model: string }> = {
  groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo' },
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' },
};

/**
 * Какой сервис распознавания включён. Groq раньше OpenAI: у него есть бесплатный лимит.
 * `env` — функция чтения переменной окружения (в функции это `Deno.env.get`).
 */
export function sttConfig(env: (name: string) => string | undefined): SttConfig | null {
  const groq = env('GROQ_API_KEY')?.trim();
  if (groq) return { provider: 'groq', key: groq };
  const openai = env('OPENAI_API_KEY')?.trim();
  if (openai) return { provider: 'openai', key: openai };
  return null;
}

/** Ссылка на запись внутри сообщения Telegram. */
export interface VoiceRef {
  fileId: string;
  seconds: number;
  bytes?: number;
  mime?: string;
  /** Что это: голосовое, аудиофайл или «кружок». От этого зависит имя файла для распознавания. */
  kind: 'voice' | 'audio' | 'video_note';
}

interface TgMedia {
  file_id?: unknown;
  duration?: unknown;
  file_size?: unknown;
  mime_type?: unknown;
}

const asMedia = (v: unknown): TgMedia | null => (typeof v === 'object' && v !== null ? (v as TgMedia) : null);

/** Запись из сообщения: голосовое, аудиофайл (mp3, m4a) или видеосообщение-«кружок». Текста у такого сообщения нет. */
export function voiceOf(msg: unknown): VoiceRef | null {
  const m = asMedia(msg) as Record<string, unknown> | null;
  if (!m) return null;
  for (const kind of ['voice', 'audio', 'video_note'] as const) {
    const media = asMedia(m[kind]);
    if (!media || typeof media.file_id !== 'string' || !media.file_id) continue;
    return {
      fileId: media.file_id,
      seconds: typeof media.duration === 'number' ? media.duration : 0,
      bytes: typeof media.file_size === 'number' ? media.file_size : undefined,
      mime: typeof media.mime_type === 'string' ? media.mime_type : kind === 'video_note' ? 'video/mp4' : 'audio/ogg',
      kind,
    };
  }
  return null;
}

/** Текст отказа, если запись не подходит; `null` — можно распознавать. */
export function checkVoice(v: VoiceRef): string | null {
  if (v.seconds > MAX_VOICE_SECONDS) {
    return `Слишком длинная запись: больше ${MAX_VOICE_SECONDS / 60} минут. Надиктуй короче или разбей на несколько.`;
  }
  if (v.bytes !== undefined && v.bytes > MAX_VOICE_BYTES) return 'Файл слишком большой. Надиктуй короче.';
  return null;
}

const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'video/mp4': 'mp4',
};

/** Имя файла для сервиса распознавания: по расширению он определяет формат. */
export const audioFilename = (mime: string | undefined): string => `voice.${EXTENSIONS[(mime ?? '').toLowerCase()] ?? 'ogg'}`;

/** Пробелы и переводы строк — в один пробел, края — долой. */
export const cleanTranscript = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

/**
 * Нейросеть, получив тишину или шум, нередко «дописывает» стандартные фразы из субтитров.
 * Такой текст дел не содержит, и записывать его нельзя.
 */
const SILENCE_PHRASES = [
  /продолжение следует/i,
  /субтитры (сделал|создавал|подготовил|делал)/i,
  /редактор субтитров/i,
  /корректор\s+[а-я]\./i,
  /спасибо за (просмотр|внимание)/i,
  /подписывайтесь на (канал|мой канал)/i,
  /dimatorzok/i,
];

/** Текст, который можно разбирать дальше, или `null` — пусто, одни знаки препинания или типичная «галлюцинация» тишины. */
export function usableTranscript(raw: string): string | null {
  const text = cleanTranscript(raw);
  if (text.replace(/[\s.,!?…\-–—'"«»()]+/g, '').length < 2) return null;
  if (SILENCE_PHRASES.some(re => re.test(text)) && text.length < 90) return null;
  return text;
}

export interface AudioInput {
  blob: Blob;
  filename?: string;
}

/**
 * Запись → текст. Язык подсказан русский, температура 0 — без «творчества». В подсказке (`prompt`) — слова из мира
 * планировщика: они помогают сервису не путать «задачу» с «задачей» и не искажать названия дней.
 */
export async function transcribe(audio: AudioInput, cfg: SttConfig, fetchImpl: typeof fetch = fetch): Promise<string> {
  const { url, model } = ENDPOINTS[cfg.provider];
  const form = new FormData();
  form.append('file', audio.blob, audio.filename ?? 'voice.ogg');
  form.append('model', model);
  form.append('language', 'ru');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', 'Список дел: позвонить, купить, написать, записаться, напомнить; завтра, в пятницу, на следующей неделе.');
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.key}` },
    body: form,
    // Вебхук Telegram ждёт ответа: зависший запрос не должен съесть весь лимит функции.
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`stt ${cfg.provider} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { text?: unknown };
  return typeof json.text === 'string' ? cleanTranscript(json.text) : '';
}
