"use client";

/**
 * /dashboard/products/import-photos (12 августа 2026, client-upload flow)
 *
 * Массовая загрузка фото товаров через прямой upload в Vercel Blob из
 * браузера (обходим 4.5 MB body-лимит serverless-функций Vercel'а).
 *
 * Flow:
 *  1. Пользователь дропает картинки или ZIP
 *  2. ZIP распаковывается прямо в браузере (JSZip.loadAsync)
 *  3. Каждая картинка через @vercel/blob/client.upload() уходит НАПРЯМУЮ
 *     в Blob storage — файл не проходит через нашу serverless-функцию,
 *     значит 4.5 MB лимит не работает. Токен выдаёт /api/import/product-photos/token
 *     (auth + businessId + content-type whitelist + 5 MB/файл)
 *  4. После заливки всех файлов POST /api/import/product-photos/commit
 *     с массивом { url, filename } → матчит по имени к Product.sku,
 *     обновляет imageUrl, возвращает отчёт
 *
 * До этого через классический multipart грузилось всё через нашу функцию,
 * и Vercel'овский 413 «Request Entity Too Large» ловил Farrukh на ZIP'ах
 * больше 4.5 MB (см. Telegram-скрины 11-12 августа).
 */

import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import JSZip from "jszip";
import { upload } from "@vercel/blob/client";
import { useTheme } from "@/contexts/ThemeContext";

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 500;
const UPLOAD_CONCURRENCY = 4;

interface UploadResult {
  success: boolean;
  totalFiles: number;
  matchedCount: number;
  duplicateCount?: number;
  unmatchedCount: number;
  invalidCount: number;
  failedCount: number;
  unmatchedSample: string[];
  matchedSample?: Array<{ file: string; product: string }>;
  duplicateSample?: Array<{ file: string; product: string }>;
  message: string;
}

interface ExtractedFile {
  name: string;
  size: number;
  /** Реальный File или Blob для upload() — из drag-drop или из ZIP */
  data: File | Blob;
}

function isImageExtension(filename: string): boolean {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx < 0) return false;
  const ext = filename.slice(dotIdx + 1).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

function contentTypeFromName(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

function basenameNoDir(pathInZip: string): string {
  const parts = pathInZip.split(/[\\/]/);
  return parts[parts.length - 1] || pathInZip;
}

export default function ImportProductPhotosPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const bg = isDark ? "bg-gray-900" : "bg-gray-50";
  const text = isDark ? "text-gray-100" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-600";
  const card = isDark ? "bg-gray-800" : "bg-white";
  const border = isDark ? "border-gray-700" : "border-gray-200";

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string }>({
    done: 0,
    total: 0,
    phase: "",
  });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Загружаем businessId один раз — нужен для pathname префикса при upload()
  // (token-эндпоинт требует `products/{businessId}/...`, иначе отказывает).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/business")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.id) setBusinessId(data.id);
      })
      .catch(() => {
        /* если API упал — покажем ошибку при первой попытке upload */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilesSelected = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.name.toLowerCase().endsWith(".zip") ||
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed"
    );
    if (arr.length === 0) {
      setError("Только изображения (jpg/png/webp/gif/avif) или ZIP архив");
      return;
    }
    setError("");
    setResult(null);
    setFiles(arr);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  /** Собираем ExtractedFile[] из drag-drop списка: ZIP распаковываем, картинки берём как есть. */
  async function extractAll(input: File[]): Promise<ExtractedFile[]> {
    const out: ExtractedFile[] = [];
    for (const f of input) {
      const isZip =
        f.name.toLowerCase().endsWith(".zip") ||
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed";
      if (!isZip) {
        if (isImageExtension(f.name) && f.size > 0 && f.size <= MAX_FILE_SIZE) {
          out.push({ name: f.name, size: f.size, data: f });
        }
        continue;
      }

      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(f);
      } catch {
        throw new Error(`Не удалось распаковать ${f.name}`);
      }
      for (const entry of Object.values(zip.files)) {
        if (out.length >= MAX_FILES) break;
        if (entry.dir) continue;
        const baseName = basenameNoDir(entry.name);
        if (!isImageExtension(baseName)) continue;
        // Пропускаем macOS-мусор из архивов (__MACOSX/, .DS_Store, ._filename)
        if (entry.name.startsWith("__MACOSX/")) continue;
        if (baseName.startsWith("._") || baseName === ".DS_Store") continue;
        const blob = await entry.async("blob");
        if (blob.size === 0 || blob.size > MAX_FILE_SIZE) continue;
        out.push({ name: baseName, size: blob.size, data: blob });
      }
    }
    return out.slice(0, MAX_FILES);
  }

  /** Параллельно грузим extracted-файлы в Vercel Blob с ограничением concurrency. */
  async function uploadAllToBlob(
    extracted: ExtractedFile[],
    bizId: string
  ): Promise<Array<{ url: string; filename: string } | null>> {
    const out: Array<{ url: string; filename: string } | null> = new Array(
      extracted.length
    ).fill(null);
    let done = 0;
    let cursor = 0;
    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= extracted.length) return;
        const f = extracted[idx];
        try {
          // Уникальный pathname: businessId + basename + timestamp — addRandomSuffix
          // на сервере всё равно допишет свой суффикс, но так URL'ы читаемее.
          const safeName = f.name.replace(/[^\w.-]+/g, "_");
          const pathname = `products/${bizId}/bulk-${Date.now()}-${safeName}`;
          const blob = await upload(pathname, f.data, {
            access: "public",
            handleUploadUrl: "/api/import/product-photos/token",
            contentType: contentTypeFromName(f.name),
          });
          out[idx] = { url: blob.url, filename: f.name };
        } catch (e) {
          console.error(`[import-photos] upload failed for ${f.name}:`, e);
          // out[idx] остаётся null — попадёт в failed count на клиенте
        } finally {
          done++;
          setProgress({ done, total: extracted.length, phase: "upload" });
        }
      }
    }
    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, extracted.length) }, worker);
    await Promise.all(workers);
    return out;
  }

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!businessId) {
      setError("Не удалось определить бизнес. Обновите страницу.");
      return;
    }
    setUploading(true);
    setError("");
    setResult(null);
    setProgress({ done: 0, total: 0, phase: "extract" });

    try {
      // Фаза 1: распаковать ZIP'ы, собрать плоский список файлов
      const extracted = await extractAll(files);
      if (extracted.length === 0) {
        setError(
          "Не найдено файлов изображений. Поддерживаются jpg, png, webp, gif, avif — прямой загрузкой или в ZIP."
        );
        setUploading(false);
        return;
      }
      if (extracted.length >= MAX_FILES) {
        setError(`Слишком много файлов. Максимум ${MAX_FILES} за раз.`);
        setUploading(false);
        return;
      }

      // Фаза 2: параллельно грузим в Vercel Blob напрямую
      setProgress({ done: 0, total: extracted.length, phase: "upload" });
      const uploaded = await uploadAllToBlob(extracted, businessId);
      const successfulUploads = uploaded.filter(
        (u): u is { url: string; filename: string } => u !== null
      );
      const blobFailedCount = extracted.length - successfulUploads.length;

      if (successfulUploads.length === 0) {
        setError("Не удалось загрузить ни один файл. Попробуйте ещё раз.");
        setUploading(false);
        return;
      }

      // Фаза 3: коммит на бэк — матчинг по имени + Product.imageUrl update
      setProgress({ done: successfulUploads.length, total: extracted.length, phase: "commit" });
      const commitRes = await fetch("/api/import/product-photos/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploads: successfulUploads }),
      });
      const contentType = commitRes.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Не JSON → скорее всего 413 или 502 от Vercel'а. Понятное сообщение
        // вместо крипты вроде «Unexpected token 'R', is not valid JSON».
        throw new Error(
          `Ошибка сервера (HTTP ${commitRes.status}). Попробуйте позже или сократите пачку.`
        );
      }
      const data = (await commitRes.json()) as UploadResult & { error?: string };
      if (!commitRes.ok) {
        setError(data.error || "Ошибка загрузки");
      } else {
        // Прибавим фейлы Blob'а к статистике сервера — пользователь видит полную картину.
        setResult({
          ...data,
          totalFiles: extracted.length,
          failedCount: (data.failedCount || 0) + blobFailedCount,
          message:
            blobFailedCount > 0
              ? `${data.message} · Не удалось загрузить в хранилище: ${blobFailedCount}`
              : data.message,
        });
        setFiles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      setProgress({ done: 0, total: 0, phase: "" });
    }
  };

  const progressPct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const progressLabel =
    progress.phase === "extract"
      ? "Распаковка архива..."
      : progress.phase === "upload"
      ? `Загрузка в хранилище: ${progress.done}/${progress.total}`
      : progress.phase === "commit"
      ? "Матчинг с товарами..."
      : "";

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-3xl mx-auto p-6">
        <Link
          href="/dashboard/products"
          className={`inline-flex items-center gap-1 text-sm mb-4 ${sub} hover:opacity-80`}
        >
          <ArrowLeft className="w-4 h-4" /> Назад к товарам
        </Link>

        <h1 className={`text-2xl font-semibold mb-2 ${text}`}>Массовая загрузка фото</h1>
        <p className={`text-sm mb-2 ${sub}`}>
          Загрузите ZIP-архив или несколько картинок сразу. Мы сопоставим каждое фото с
          товаром по имени файла — имя должно совпадать со штрихкодом или артикулом (например{" "}
          <code
            className={`${isDark ? "bg-gray-800" : "bg-gray-100"} px-1.5 py-0.5 rounded text-xs`}
          >
            8809722156116.jpg
          </code>{" "}
          привяжется к товару со штрихкодом 8809722156116).
        </p>
        <p className={`text-xs mb-6 ${sub} opacity-80`}>
          Поддерживаем суффиксы вариантов:{" "}
          <code className={`${isDark ? "bg-gray-800" : "bg-gray-100"} px-1 py-0.5 rounded`}>
            8809722156116_001.jpg
          </code>
          ,{" "}
          <code className={`${isDark ? "bg-gray-800" : "bg-gray-100"} px-1 py-0.5 rounded`}>
            8809722156116-2.jpg
          </code>{" "}
          — тоже привяжутся к товару 8809722156116 (главное фото = наименьший номер).
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`${card} border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
            dragOver
              ? isDark
                ? "border-blue-500 bg-blue-500/10"
                : "border-blue-500 bg-blue-50"
              : border
          }`}
        >
          <Upload className={`w-10 h-10 mx-auto mb-3 ${sub}`} />
          <p className={`text-base font-medium mb-1 ${text}`}>
            Перетащите файлы сюда или нажмите чтобы выбрать
          </p>
          <p className={`text-sm ${sub}`}>
            ZIP-архив, JPG, PNG, WebP, GIF, AVIF · до {MAX_FILES} файлов · до 5 MB каждый
          </p>
          <p className={`text-xs ${sub} mt-1 opacity-70`}>
            Размер ZIP не ограничен — файлы уходят напрямую в хранилище
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.zip,application/zip"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFilesSelected(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className={`mt-4 ${card} rounded-xl border ${border} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <p className={`text-sm font-medium ${text}`}>Выбрано файлов: {files.length}</p>
              <button
                onClick={() => setFiles([])}
                disabled={uploading}
                className={`text-xs ${sub} hover:opacity-70 flex items-center gap-1 disabled:opacity-30`}
              >
                <X className="w-3 h-3" /> Очистить
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {files.slice(0, 20).map((f, i) => (
                <div key={i} className={`text-xs ${sub} flex justify-between`}>
                  <span className="truncate">{f.name}</span>
                  <span className="ml-2">
                    {f.size > 1024 * 1024
                      ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
                      : `${(f.size / 1024).toFixed(0)} KB`}
                  </span>
                </div>
              ))}
              {files.length > 20 && (
                <div className={`text-xs italic ${sub}`}>...и ещё {files.length - 20}</div>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading || !businessId}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading
                ? progressLabel || "Загрузка..."
                : `Загрузить ${files.length} файл(ов)`}
            </button>
            {uploading && progress.total > 0 && (
              <div className="mt-3">
                <div
                  className={`w-full h-2 rounded-full overflow-hidden ${
                    isDark ? "bg-gray-700" : "bg-gray-200"
                  }`}
                >
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 ${sub}`}>{progressLabel}</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              isDark
                ? "bg-red-500/10 text-red-300 border border-red-500/30"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {error}
          </div>
        )}

        {result && (
          <div className={`mt-4 ${card} rounded-xl border ${border} p-5 space-y-3`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className={`font-medium ${text}`}>Готово</h2>
            </div>
            <p className={`text-sm ${text}`}>{result.message}</p>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Сматчено"
                value={result.matchedCount}
                total={result.totalFiles}
                variant="ok"
                isDark={isDark}
              />
              <Stat
                label="Не сматчено"
                value={result.unmatchedCount}
                total={result.totalFiles}
                variant={result.unmatchedCount > 0 ? "warn" : "ok"}
                isDark={isDark}
              />
              {result.duplicateCount ? (
                <Stat
                  label="Пропущено дублей"
                  value={result.duplicateCount}
                  total={result.totalFiles}
                  variant="warn"
                  isDark={isDark}
                />
              ) : null}
              {result.failedCount > 0 && (
                <Stat
                  label="Ошибок"
                  value={result.failedCount}
                  total={result.totalFiles}
                  variant="err"
                  isDark={isDark}
                />
              )}
            </div>

            {result.matchedSample && result.matchedSample.length > 0 && (
              <div
                className={`mt-3 p-3 rounded-lg text-xs ${
                  isDark
                    ? "bg-green-500/10 border border-green-500/30 text-green-200"
                    : "bg-green-50 border border-green-200 text-green-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium mb-1">Привязано к товарам:</p>
                    <ul className="space-y-0.5">
                      {result.matchedSample.map((m) => (
                        <li key={m.file} className="flex gap-2">
                          <span className="opacity-60 truncate flex-shrink-0 max-w-[45%]">
                            {m.file}
                          </span>
                          <span className="opacity-40">→</span>
                          <span className="font-medium truncate">{m.product}</span>
                        </li>
                      ))}
                    </ul>
                    {result.matchedCount > result.matchedSample.length && (
                      <p className="mt-1 italic opacity-70">
                        ...и ещё {result.matchedCount - result.matchedSample.length}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {result.duplicateSample && result.duplicateSample.length > 0 && (
              <div
                className={`mt-3 p-3 rounded-lg text-xs ${
                  isDark
                    ? "bg-blue-500/10 border border-blue-500/30 text-blue-200"
                    : "bg-blue-50 border border-blue-200 text-blue-800"
                }`}
              >
                <p className="font-medium mb-1">
                  Пропущено (у товара уже выбрано главное фото):
                </p>
                <ul className="space-y-0.5">
                  {result.duplicateSample.map((m) => (
                    <li key={m.file} className="flex gap-2">
                      <span className="opacity-60 truncate flex-shrink-0 max-w-[45%]">
                        {m.file}
                      </span>
                      <span className="opacity-40">→</span>
                      <span className="truncate">{m.product}</span>
                    </li>
                  ))}
                </ul>
                {(result.duplicateCount || 0) > result.duplicateSample.length && (
                  <p className="mt-1 italic opacity-70">
                    ...и ещё {(result.duplicateCount || 0) - result.duplicateSample.length}
                  </p>
                )}
              </div>
            )}

            {result.unmatchedSample.length > 0 && (
              <div
                className={`mt-3 p-3 rounded-lg text-xs ${
                  isDark
                    ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-200"
                    : "bg-yellow-50 border border-yellow-200 text-yellow-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">
                      Не сматчено — нет товара с таким штрихкодом/артикулом:
                    </p>
                    <ul className="space-y-0.5">
                      {result.unmatchedSample.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                    {result.unmatchedCount > result.unmatchedSample.length && (
                      <p className="mt-1 italic">
                        ...и ещё {result.unmatchedCount - result.unmatchedSample.length}
                      </p>
                    )}
                    <p className="mt-2">
                      Проверьте что имя файла совпадает со штрихкодом или артикулом товара в{" "}
                      <Link href="/dashboard/products" className="underline">
                        каталоге товаров
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  total,
  variant,
  isDark,
}: {
  label: string;
  value: number;
  total: number;
  variant: "ok" | "warn" | "err";
  isDark: boolean;
}) {
  const color =
    variant === "ok"
      ? isDark
        ? "text-green-400"
        : "text-green-600"
      : variant === "warn"
      ? isDark
        ? "text-yellow-400"
        : "text-yellow-600"
      : isDark
      ? "text-red-400"
      : "text-red-600";
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`${isDark ? "bg-gray-700/50" : "bg-gray-50"} rounded-lg p-3`}>
      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"} mb-0.5`}>{label}</p>
      <p className={`text-xl font-semibold ${color}`}>
        {value}{" "}
        <span
          className={`text-xs font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}
        >
          / {total} ({pct}%)
        </span>
      </p>
    </div>
  );
}
