"use client";

/**
 * Admin страница: promo-материалы для партнёров (баннеры + шаблоны текстов).
 * Отображаются в кабинете партнёра /partners/dashboard.
 *
 * Banner — картинка через Vercel Blob upload.
 * Template — готовый текст для копипасты в социалки/мессенджеры.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Plus,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  Languages,
} from "lucide-react";

interface Asset {
  id: string;
  type: "banner" | "template";
  title: string;
  description: string | null;
  imageUrl: string | null;
  content: string | null;
  category: string | null;
  language: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: "social", label: "Соцсети (Instagram / FB)" },
  { value: "messenger", label: "Мессенджеры (Telegram / WA)" },
  { value: "email", label: "Email-рассылки" },
  { value: "ads", label: "Реклама" },
  { value: "other", label: "Другое" },
];

const LANGUAGES = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "uz", label: "O'zbek" },
  { value: "kz", label: "Қазақша" },
];

export default function AdminPartnerAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [savingNew, setSavingNew] = useState(false);

  // form state
  const [type, setType] = useState<"banner" | "template">("template");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("messenger");
  const [language, setLanguage] = useState("ru");
  const [sortOrder, setSortOrder] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/partners/assets");
      const d = await res.json();
      setAssets(d.assets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setType("template");
    setTitle("");
    setDescription("");
    setContent("");
    setCategory("messenger");
    setLanguage("ru");
    setSortOrder(0);
    setFile(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Введите название");
      return;
    }
    if (type === "banner" && !file) {
      alert("Выберите картинку для баннера");
      return;
    }
    if (type === "template" && !content.trim()) {
      alert("Введите текст шаблона");
      return;
    }

    setSavingNew(true);
    try {
      const form = new FormData();
      form.append("type", type);
      form.append("title", title.trim());
      if (description.trim()) form.append("description", description.trim());
      if (content.trim()) form.append("content", content.trim());
      form.append("category", category);
      form.append("language", language);
      form.append("sortOrder", String(sortOrder));
      if (file) form.append("file", file);

      const res = await fetch("/api/admin/partners/assets", {
        method: "POST",
        body: form,
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || "Ошибка");
        return;
      }
      resetForm();
      setShowForm(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingNew(false);
    }
  };

  const toggleActive = async (asset: Asset) => {
    try {
      const res = await fetch(`/api/admin/partners/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !asset.isActive }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Ошибка");
        return;
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const remove = async (asset: Asset) => {
    if (!confirm(`Удалить "${asset.title}"? Действие необратимо.`)) return;
    try {
      const res = await fetch(`/api/admin/partners/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Ошибка");
        return;
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const banners = assets.filter((a) => a.type === "banner");
  const templates = assets.filter((a) => a.type === "template");

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> К списку партнёров
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-purple-400" /> Promo-материалы
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Баннеры и шаблоны текстов для партнёров. Видны в их кабинете.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Добавить
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Всего" value={assets.length} />
          <StatCard label="Баннеры" value={banners.length} />
          <StatCard label="Шаблоны" value={templates.length} />
        </div>

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#12122a] border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Новый promo-материал</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={submit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2">Тип</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setType("template")}
                      className={`flex items-center gap-2 justify-center px-3 py-3 rounded-lg border text-sm transition-colors ${
                        type === "template"
                          ? "bg-purple-500/20 border-purple-400 text-white"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      <FileText className="h-4 w-4" /> Шаблон текста
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("banner")}
                      className={`flex items-center gap-2 justify-center px-3 py-3 rounded-lg border text-sm transition-colors ${
                        type === "banner"
                          ? "bg-purple-500/20 border-purple-400 text-white"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                      }`}
                    >
                      <ImageIcon className="h-4 w-4" /> Баннер
                    </button>
                  </div>
                </div>

                <Field label="Название (для админа и партнёра)">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder='Например: "Пост для Instagram о Staffix"'
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-purple-400 outline-none"
                    required
                  />
                </Field>

                <Field label="Подсказка партнёру (необязательно)">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder='Например: "Лучше публиковать в будни 18-21"'
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-purple-400 outline-none"
                  />
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Категория">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-purple-400 outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-[#12122a]">
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Язык">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-purple-400 outline-none"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value} className="bg-[#12122a]">
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Порядок">
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-purple-400 outline-none"
                    />
                  </Field>
                </div>

                {type === "template" ? (
                  <Field label="Текст шаблона (партнёр будет копировать целиком)">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      placeholder="Здравствуйте! Хочу порекомендовать Staffix..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-purple-400 outline-none font-mono"
                      required
                    />
                  </Field>
                ) : (
                  <Field label="Картинка (JPG / PNG / WebP, до 5MB)">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30"
                      required
                    />
                    {file && (
                      <div className="text-xs text-gray-500 mt-1">
                        {file.name} · {(file.size / 1024).toFixed(0)}KB
                      </div>
                    )}
                  </Field>
                )}

                <div className="flex gap-2 pt-3">
                  <button
                    type="submit"
                    disabled={savingNew}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-lg text-sm font-medium"
                  >
                    {savingNew && <Loader2 className="h-4 w-4 animate-spin" />}
                    Создать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center p-12 bg-[#12122a] border border-white/5 rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-[#12122a] border border-white/5 rounded-xl p-12 text-center text-gray-500">
            Пока нет ни одного материала. Добавьте первый — партнёры увидят его в кабинете.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onToggle={() => toggleActive(asset)}
                onDelete={() => remove(asset)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#12122a] border border-white/5 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function AssetCard({
  asset,
  onToggle,
  onDelete,
}: {
  asset: Asset;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const categoryLabel = CATEGORIES.find((c) => c.value === asset.category)?.label || asset.category;
  return (
    <div
      className={`bg-[#12122a] border rounded-xl p-4 transition-opacity ${
        asset.isActive ? "border-white/5" : "border-white/5 opacity-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 text-xs">
            <span
              className={`px-2 py-0.5 rounded font-medium ${
                asset.type === "banner"
                  ? "bg-blue-500/15 text-blue-300"
                  : "bg-purple-500/15 text-purple-300"
              }`}
            >
              {asset.type === "banner" ? "Баннер" : "Шаблон"}
            </span>
            {categoryLabel && <span className="text-gray-500">{categoryLabel}</span>}
            <span className="text-gray-600 inline-flex items-center gap-1">
              <Languages className="h-3 w-3" /> {asset.language}
            </span>
            <span className="text-gray-600">№{asset.sortOrder}</span>
          </div>
          <h3 className="font-semibold text-sm text-white truncate">{asset.title}</h3>
          {asset.description && <p className="text-xs text-gray-500 mt-1">{asset.description}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white"
            title={asset.isActive ? "Скрыть от партнёров" : "Показать партнёрам"}
          >
            {asset.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400"
            title="Удалить"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {asset.type === "banner" && asset.imageUrl && (
        <div className="mt-2 rounded-lg overflow-hidden bg-black/30 border border-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.imageUrl} alt={asset.title} className="w-full max-h-48 object-contain" />
        </div>
      )}

      {asset.type === "template" && asset.content && (
        <div className="mt-2 p-3 bg-black/20 border border-white/5 rounded-lg text-xs text-gray-300 font-mono whitespace-pre-wrap line-clamp-6">
          {asset.content}
        </div>
      )}
    </div>
  );
}
