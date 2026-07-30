"use client";

/**
 * /dashboard/products/import-photos (30 июля 2026)
 *
 * Массовая загрузка фото товаров:
 *  - Drag & drop одного ZIP архива ИЛИ множественных картинок
 *  - Матчинг по имени файла (basename без расширения) с Product.sku
 *    (штрихкод/EAN тоже мапится в sku при CSV-импорте)
 *  - Показ прогресса и отчёта: сматчено N, не сматчено M (с именами)
 *
 * Отдельная страница потому что flow принципиально другой чем у CSV-импорта
 * (там текст, здесь бинарные файлы). Смешивать в одной модалке путано.
 */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface UploadResult {
  success: boolean;
  totalFiles: number;
  matchedCount: number;
  unmatchedCount: number;
  invalidCount: number;
  failedCount: number;
  unmatchedSample: string[];
  message: string;
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
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (list: FileList | null) => {
    if (!list) return;
    // Разрешённые: любой image/* или .zip
    const arr = Array.from(list).filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.name.toLowerCase().endsWith(".zip") ||
        f.type === "application/zip"
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

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/import/product-photos", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка загрузки");
      } else {
        setResult(data);
        setFiles([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

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
        <p className={`text-sm mb-6 ${sub}`}>
          Загрузите ZIP-архив или несколько картинок сразу. Мы сопоставим каждое фото с товаром
          по имени файла — имя должно совпадать со штрихкодом или артикулом товара (например{" "}
          <code className={`${isDark ? "bg-gray-800" : "bg-gray-100"} px-1.5 py-0.5 rounded text-xs`}>
            8809722156116.jpg
          </code>{" "}
          привяжется к товару со штрихкодом 8809722156116).
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
            ZIP-архив, JPG, PNG, WebP, GIF, AVIF · до 500 файлов · до 5 MB каждый
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
                className={`text-xs ${sub} hover:opacity-70 flex items-center gap-1`}
              >
                <X className="w-3 h-3" /> Очистить
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {files.slice(0, 20).map((f, i) => (
                <div key={i} className={`text-xs ${sub} flex justify-between`}>
                  <span className="truncate">{f.name}</span>
                  <span className="ml-2">{(f.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
              {files.length > 20 && (
                <div className={`text-xs italic ${sub}`}>...и ещё {files.length - 20}</div>
              )}
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? "Загрузка..." : `Загрузить ${files.length} файл(ов)`}
            </button>
          </div>
        )}

        {error && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${isDark ? "bg-red-500/10 text-red-300 border border-red-500/30" : "bg-red-50 text-red-700 border border-red-200"}`}>
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
              {result.invalidCount > 0 && (
                <Stat
                  label="Отклонено (не картинка)"
                  value={result.invalidCount}
                  total={result.totalFiles}
                  variant="warn"
                  isDark={isDark}
                />
              )}
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

            {result.unmatchedSample.length > 0 && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${isDark ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-200" : "bg-yellow-50 border border-yellow-200 text-yellow-800"}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Не сматчено — нет товара с таким штрихкодом/артикулом:</p>
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
        {value} <span className={`text-xs font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}>/ {total} ({pct}%)</span>
      </p>
    </div>
  );
}
