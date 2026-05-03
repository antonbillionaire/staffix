"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
}

const TYPE_LABEL: Record<FieldDef["type"], string> = {
  text: "Текст",
  number: "Число",
  date: "Дата",
  select: "Выбор",
};

interface Props {
  isDark: boolean;
}

export default function ClientFieldsManager({ isDark }: Props) {
  const { t } = useLanguage();
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  useEffect(() => {
    fetch("/api/business/client-fields")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.fields)) setFields(data.fields);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateField = (idx: number, patch: Partial<FieldDef>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const addField = () => {
    if (fields.length >= 20) return;
    // Auto-generate a unique key: field_1, field_2, ...
    let n = fields.length + 1;
    while (fields.some((f) => f.key === `field_${n}`)) n++;
    setFields((prev) => [...prev, { key: `field_${n}`, label: "", type: "text" }]);
  };

  const removeField = (idx: number) => {
    if (!confirm(t("settings.fieldRemoveConfirm"))) return;
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Normalize select-options coming from textarea-like state
      const payload = fields.map((f) => ({
        ...f,
        ...(f.type === "select" ? { options: (f.options ?? []).filter(Boolean) } : { options: undefined }),
      }));
      const res = await fetch("/api/business/client-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
      } else {
        setFields(data.fields);
        setSavedAt(Date.now());
      }
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`${cardBg} border ${borderColor} rounded-xl p-6`}>
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <div>
          <h3 className={`text-lg font-medium ${textPrimary}`}>{t("settings.clientFieldsTitle")}</h3>
          <p className={`text-sm ${textSecondary} mt-1`}>{t("settings.clientFieldsDescription")}</p>
        </div>
        <span className={`text-xs ${textSecondary}`}>{fields.length}/20</span>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {fields.map((f, idx) => (
          <div key={idx} className={`p-3 rounded-lg border ${inputBorder} ${inputBg}`}>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
              <input
                type="text"
                value={f.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder={t("settings.fieldLabelPlaceholder")}
                className={`sm:col-span-5 px-3 py-2 rounded-lg border ${inputBorder} ${isDark ? "bg-black/20 text-white" : "bg-white"} text-sm`}
              />
              <input
                type="text"
                value={f.key}
                onChange={(e) => updateField(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                placeholder="key_name"
                className={`sm:col-span-3 px-3 py-2 rounded-lg border ${inputBorder} ${isDark ? "bg-black/20 text-white" : "bg-white"} text-sm font-mono`}
              />
              <select
                value={f.type}
                onChange={(e) => updateField(idx, { type: e.target.value as FieldDef["type"] })}
                className={`sm:col-span-3 px-3 py-2 rounded-lg border ${inputBorder} ${isDark ? "bg-black/20 text-white" : "bg-white"} text-sm`}
              >
                {(Object.keys(TYPE_LABEL) as FieldDef["type"][]).map((tp) => (
                  <option key={tp} value={tp} className={isDark ? "bg-[#12122a]" : "bg-white"}>
                    {TYPE_LABEL[tp]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeField(idx)}
                className={`sm:col-span-1 p-2 rounded-lg ${isDark ? "text-gray-500 hover:text-red-400 hover:bg-white/5" : "text-gray-400 hover:text-red-500 hover:bg-gray-100"}`}
                title={t("settings.fieldRemove")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {f.type === "select" && (
              <div className="mt-2">
                <input
                  type="text"
                  value={(f.options || []).join(", ")}
                  onChange={(e) =>
                    updateField(idx, {
                      options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder={t("settings.fieldOptionsPlaceholder")}
                  className={`w-full px-3 py-2 rounded-lg border ${inputBorder} ${isDark ? "bg-black/20 text-white" : "bg-white"} text-sm`}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>{t("settings.fieldOptionsHint")}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={addField}
          disabled={fields.length >= 20}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${inputBorder} text-sm ${textSecondary} hover:opacity-80 disabled:opacity-50`}
        >
          <Plus className="h-4 w-4" />
          {t("settings.fieldAdd")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedAt && Date.now() - savedAt < 3000 ? <Check className="h-4 w-4" /> : null}
          {t("settings.fieldSave")}
        </button>
      </div>
    </div>
  );
}
