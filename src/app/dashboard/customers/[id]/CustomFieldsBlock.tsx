"use client";

import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
}

interface Props {
  customerId: string;
  initialValues: Record<string, string | number>;
  isDark: boolean;
  onUpdated?: () => void;
}

export default function CustomFieldsBlock({ customerId, initialValues, isDark, onUpdated }: Props) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, string | number>>(initialValues || {});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/client-fields")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.fields)) setConfig(data.fields);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveField = async (key: string, value: string | number | null) => {
    setSavingKey(key);
    try {
      await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: { [key]: value } }),
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey((curr) => (curr === key ? null : curr)), 2000);
      onUpdated?.();
    } catch (e) {
      console.error("Save custom field failed:", e);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading || config.length === 0) return null;

  const labelClass = `text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-500"} uppercase`;
  const inputClass = `w-full px-3 py-2 rounded-lg border ${
    isDark ? "bg-white/5 border-white/10 text-white" : "bg-white border-gray-300 text-gray-900"
  } text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;
  const cardBg = isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200";
  const titleColor = isDark ? "text-white" : "text-gray-900";

  return (
    <div className={`rounded-xl border ${cardBg} p-4`}>
      <h3 className={`font-medium ${titleColor} mb-3`}>{t("customers.customFieldsTitle")}</h3>
      <div className="space-y-3">
        {config.map((f) => {
          const v = values[f.key];
          const stringV = v === undefined || v === null ? "" : String(v);

          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass}>{f.label}</label>
                {savingKey === f.key ? (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                ) : savedKey === f.key ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : null}
              </div>
              {f.type === "text" && (
                <input
                  type="text"
                  value={stringV}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  onBlur={(e) => {
                    if (String(initialValues[f.key] ?? "") !== e.target.value) {
                      saveField(f.key, e.target.value);
                    }
                  }}
                  className={inputClass}
                />
              )}
              {f.type === "number" && (
                <input
                  type="number"
                  value={stringV}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  onBlur={(e) => {
                    const num = e.target.value === "" ? null : Number(e.target.value);
                    if (initialValues[f.key] !== num) saveField(f.key, num);
                  }}
                  className={inputClass}
                />
              )}
              {f.type === "date" && (
                <input
                  type="date"
                  value={stringV.slice(0, 10)}
                  onChange={(e) => {
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }));
                    saveField(f.key, e.target.value || null);
                  }}
                  className={inputClass}
                />
              )}
              {f.type === "select" && (
                <select
                  value={stringV}
                  onChange={(e) => {
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }));
                    saveField(f.key, e.target.value || null);
                  }}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
