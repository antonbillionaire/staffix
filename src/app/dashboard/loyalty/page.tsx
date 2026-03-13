"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  Save,
  Percent,
  Award,
  Layers,
  TrendingUp,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
} from "lucide-react";

interface Tier {
  name: string;
  minSpent: number;
  discount: number;
}

interface ProgramData {
  enabled: boolean;
  type: string;
  name: string;
  cashbackPercent: number;
  visitsForReward: number;
  rewardType: "free" | "discount";
  rewardDiscount: number;
  tiers: Tier[] | null;
}

const DEFAULT_TIERS: Tier[] = [
  { name: "Bronze", minSpent: 0, discount: 0 },
  { name: "Silver", minSpent: 50000, discount: 5 },
  { name: "Gold", minSpent: 150000, discount: 10 },
  { name: "Platinum", minSpent: 500000, discount: 15 },
];

const PROGRAM_TYPES = [
  {
    type: "cashback",
    labelKey: "loyalty.cashback",
    icon: Percent,
    descKey: "loyalty.cashbackDesc",
    color: "blue",
  },
  {
    type: "visits",
    labelKey: "loyalty.visits",
    icon: Award,
    descKey: "loyalty.visitsDesc",
    color: "green",
  },
  {
    type: "tiered",
    labelKey: "loyalty.tiered",
    icon: Layers,
    descKey: "loyalty.tieredDesc",
    color: "purple",
  },
] as const;

function defaultProgram(type: string): ProgramData {
  return {
    enabled: false,
    type,
    name: "",
    cashbackPercent: 5,
    visitsForReward: 10,
    rewardType: "discount",
    rewardDiscount: 50,
    tiers: type === "tiered" ? DEFAULT_TIERS : null,
  };
}

export default function LoyaltyPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Record<string, ProgramData>>({
    cashback: defaultProgram("cashback"),
    visits: defaultProgram("visits"),
    tiered: defaultProgram("tiered"),
  });
  const [stats, setStats] = useState({ activeMembers: 0, totalPointsIssued: 0 });

  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await fetch("/api/loyalty");
      if (res.ok) {
        const data = await res.json();
        if (data.programs && Array.isArray(data.programs)) {
          const map: Record<string, ProgramData> = {
            cashback: defaultProgram("cashback"),
            visits: defaultProgram("visits"),
            tiered: defaultProgram("tiered"),
          };
          for (const p of data.programs) {
            const pType = p.type || "cashback";
            map[pType] = {
              enabled: p.enabled,
              type: pType,
              name: p.name || "",
              cashbackPercent: p.cashbackPercent ?? 5,
              visitsForReward: p.visitsForReward ?? 10,
              rewardType: p.rewardType || "discount",
              rewardDiscount: p.rewardDiscount ?? 50,
              tiers: p.tiers || (pType === "tiered" ? DEFAULT_TIERS : null),
            };
          }
          setPrograms(map);
        }
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load loyalty:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveProgram = async (type: string) => {
    setSavingType(type);
    setSavedType(null);
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programs[type]),
      });
      if (res.ok) {
        setSavedType(type);
        setTimeout(() => setSavedType(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSavingType(null);
    }
  };

  const updateProgram = (type: string, updates: Partial<ProgramData>) => {
    setPrograms((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...updates },
    }));
  };

  const toggleProgram = (type: string) => {
    const p = programs[type];
    updateProgram(type, { enabled: !p.enabled });
  };

  const addTier = () => {
    const tiers = programs.tiered.tiers || [];
    const last = tiers[tiers.length - 1];
    updateProgram("tiered", {
      tiers: [
        ...tiers,
        { name: "", minSpent: (last?.minSpent || 0) + 100000, discount: (last?.discount || 0) + 5 },
      ],
    });
  };

  const removeTier = (index: number) => {
    const tiers = [...(programs.tiered.tiers || [])];
    tiers.splice(index, 1);
    updateProgram("tiered", { tiers });
  };

  const updateTier = (index: number, field: keyof Tier, value: string | number) => {
    const tiers = [...(programs.tiered.tiers || [])];
    tiers[index] = { ...tiers[index], [field]: value };
    updateProgram("tiered", { tiers });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
    blue: {
      bg: "bg-blue-500/10",
      text: "text-blue-500",
      border: "border-blue-500/50",
      ring: "bg-blue-500",
    },
    green: {
      bg: "bg-green-500/10",
      text: "text-green-500",
      border: "border-green-500/50",
      ring: "bg-green-500",
    },
    purple: {
      bg: "bg-purple-500/10",
      text: "text-purple-500",
      border: "border-purple-500/50",
      ring: "bg-purple-500",
    },
  };

  const enabledCount = Object.values(programs).filter((p) => p.enabled).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary}`}>{t("loyalty.title")}</h1>
        <p className={`text-sm ${textSecondary} mt-1`}>
          {t("loyalty.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.activeMembers}</p>
              <p className={`text-sm ${textSecondary}`}>{t("loyalty.members")}</p>
            </div>
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.totalPointsIssued.toLocaleString()}</p>
              <p className={`text-sm ${textSecondary}`}>{t("loyalty.pointsIssued")}</p>
            </div>
          </div>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{enabledCount} / 3</p>
              <p className={`text-sm ${textSecondary}`}>{t("loyalty.activePrograms")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Program Cards */}
      {PROGRAM_TYPES.map(({ type, labelKey, icon: Icon, descKey, color }) => {
        const label = t(labelKey);
        const desc = t(descKey);
        const p = programs[type];
        const c = colorMap[color];
        const isSaving = savingType === type;
        const isSaved = savedType === type;

        return (
          <div
            key={type}
            className={`${bgCard} border rounded-xl overflow-hidden transition-colors ${
              p.enabled ? c.border : borderColor
            }`}
          >
            {/* Card Header */}
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 ${c.text}`} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${textPrimary}`}>{label}</h3>
                    <p className={`text-sm ${textSecondary}`}>{desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleProgram(type)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      p.enabled ? c.ring : isDark ? "bg-white/10" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                        p.enabled ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Card Body — shown when enabled */}
            {p.enabled && (
              <div className={`px-6 pb-6 space-y-4 border-t ${borderColor} pt-4`}>
                {/* Custom name */}
                <div>
                  <label className={`block text-sm ${textSecondary} mb-1`}>{t("loyalty.nameOptional")}</label>
                  <input
                    value={p.name}
                    onChange={(e) => updateProgram(type, { name: e.target.value })}
                    placeholder={`${label}`}
                    className={`w-full max-w-xs px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-sm`}
                  />
                </div>

                {/* Cashback settings */}
                {type === "cashback" && (
                  <div>
                    <label className={`block text-sm ${textSecondary} mb-2`}>{t("loyalty.cashbackPercent")}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={p.cashbackPercent}
                        onChange={(e) => updateProgram(type, { cashbackPercent: parseInt(e.target.value) || 5 })}
                        className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-center`}
                      />
                      <span className={textSecondary}>%</span>
                    </div>
                    <p className={`text-xs ${textSecondary} mt-2`}>
                      {t("loyalty.cashbackHint").replace("{percent}", String(p.cashbackPercent))}
                    </p>
                  </div>
                )}

                {/* Visits settings */}
                {type === "visits" && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm ${textSecondary} mb-2`}>{t("loyalty.everyNthVisit")}</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={p.visitsForReward}
                          onChange={(e) => updateProgram(type, { visitsForReward: parseInt(e.target.value) || 10 })}
                          className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-center`}
                        />
                        <span className={textSecondary}>{t("loyalty.visit")}</span>
                      </div>
                    </div>
                    <div>
                      <label className={`block text-sm ${textSecondary} mb-2`}>{t("loyalty.reward")}</label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => updateProgram(type, { rewardType: "free" })}
                          className={`px-4 py-2 rounded-lg border ${
                            p.rewardType === "free"
                              ? "border-green-500 bg-green-500/10 text-green-500"
                              : `${borderColor} ${textSecondary}`
                          }`}
                        >
                          {t("loyalty.free")}
                        </button>
                        <button
                          onClick={() => updateProgram(type, { rewardType: "discount" })}
                          className={`px-4 py-2 rounded-lg border ${
                            p.rewardType === "discount"
                              ? "border-green-500 bg-green-500/10 text-green-500"
                              : `${borderColor} ${textSecondary}`
                          }`}
                        >
                          {t("loyalty.discount")}
                        </button>
                      </div>
                    </div>
                    {p.rewardType === "discount" && (
                      <div>
                        <label className={`block text-sm ${textSecondary} mb-2`}>{t("loyalty.discountAmount")}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={p.rewardDiscount}
                            onChange={(e) =>
                              updateProgram(type, { rewardDiscount: parseInt(e.target.value) || 50 })
                            }
                            className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-center`}
                          />
                          <span className={textSecondary}>%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tiered settings */}
                {type === "tiered" && (
                  <div className="space-y-3">
                    {(p.tiers || []).map((tier, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${borderColor}`}>
                        <input
                          placeholder={t("loyalty.tierName")}
                          value={tier.name}
                          onChange={(e) => updateTier(i, "name", e.target.value)}
                          className={`flex-1 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-sm`}
                        />
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${textSecondary}`}>{t("loyalty.from")}</span>
                          <input
                            type="number"
                            value={tier.minSpent}
                            onChange={(e) => updateTier(i, "minSpent", parseInt(e.target.value) || 0)}
                            className={`w-28 px-2 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-sm text-center`}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={tier.discount}
                            onChange={(e) => updateTier(i, "discount", parseInt(e.target.value) || 0)}
                            className={`w-16 px-2 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-sm text-center`}
                          />
                          <span className={`text-xs ${textSecondary}`}>%</span>
                        </div>
                        <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addTier}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed ${borderColor} ${textSecondary} hover:border-purple-500 hover:text-purple-500 transition-colors text-sm`}
                    >
                      <Plus className="h-4 w-4" />
                      {t("loyalty.addTier")}
                    </button>
                  </div>
                )}

                {/* Save button */}
                <div className="pt-2">
                  <button
                    onClick={() => saveProgram(type)}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-5 py-2.5 ${c.ring} text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50`}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isSaved ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaved ? t("loyalty.saved") : t("loyalty.save")}
                  </button>
                </div>
              </div>
            )}

            {/* Disabled state — save toggle */}
            {!p.enabled && (
              <div className={`px-6 pb-4`}>
                <button
                  onClick={() => {
                    toggleProgram(type);
                    saveProgram(type);
                  }}
                  className={`text-sm ${textSecondary} hover:${c.text} transition-colors`}
                >
                  {/* hidden save on disable */}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
