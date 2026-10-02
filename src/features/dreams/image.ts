/** Максимальная ширина сохраняемой картинки и качество JPEG. */
const MAX_WIDTH = 800;
const QUALITY = 0.85;

/** Размеры картинки браузер знает сразу после заголовка — полный кадр для этого декодировать не нужно. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать картинку'));
    };
    img.src = url;
  });
}

/**
 * Декодирование сразу в нужном размере: фотография на 12 мегапикселей
 * не попадает в память целиком. Где `createImageBitmap` нет — вернём null и рисуем как раньше.
 */
async function resizedBitmap(file: File, width: number, height: number): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
  } catch {
    return null;
  }
}

/**
 * Читает файл, уменьшает его до `maxWidth` по ширине и возвращает data URL в JPEG.
 * Картинки хранятся прямо в записи мечты, поэтому исходники в несколько мегабайт
 * класть в хранилище нельзя.
 */
export async function downscaleImage(file: File, maxWidth = MAX_WIDTH, quality = QUALITY): Promise<string> {
  const img = await loadImage(file);
  const srcW = img.naturalWidth || maxWidth;
  const srcH = img.naturalHeight || maxWidth;
  const scale = Math.min(1, maxWidth / srcW);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Холст недоступен');

  const bitmap = scale < 1 ? await resizedBitmap(file, w, h) : null;
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  return canvas.toDataURL('image/jpeg', quality);
}
