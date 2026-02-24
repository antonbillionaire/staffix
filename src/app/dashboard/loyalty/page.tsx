"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Gift,
  Star,
  Users,
  Loader2,
  Save,
  Percent,
  Award,
  Layers,
  TrendingUp,
  Plus,
  Trash2,
} from "lucide-react";

interface Tier {
  name: string;
  minSpent: number;
  discount: number;
}

interface LoyaltyProgram {
  enabled: boolean;
  type: "cashback" | "visits" | "tiered";
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

export default function LoyaltyPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [program, setProgram] = useState<LoyaltyProgram>({
    enabled: false,
    type: "cashback",
    cashbackPercent: 5,
    visitsForReward: 10,
    rewardType: "discount",
    rewardDiscount: 50,
    tiers: DEFAULT_TIERS,
  });
  const [stats, setStats] = useState({ activeMembers: 0, totalPointsIssued: 0 });

  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  useEffect(() => {
    fetchProgram();
  }, []);

  const fetchProgram = async () => {
    try {
      const res = await fetch("/api/loyalty");
      if (res.ok) {
        const data = await res.json();
        if (data.program) {
          setProgram({
            enabled: data.program.enabled,
            type: data.program.type || "cashback",
            cashbackPercent: data.program.cashbackPercent ?? 5,
            visitsForReward: data.program.visitsForReward ?? 10,
            rewardType: data.program.rewardType || "discount",
            rewardDiscount: data.program.rewardDiscount ?? 50,
            tiers: data.program.tiers || DEFAULT_TIERS,
          });
        }
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load loyalty:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(program),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save loyalty:", err);
    } finally {
      setSaving(false);
    }
  };

  const addTier = () => {
    const tiers = program.tiers || [];
    const lastTier = tiers[tiers.length - 1];
    setProgram({
      ...program,
      tiers: [...tiers, { name: "", minSpent: (lastTier?.minSpent || 0) + 100000, discount: (lastTier?.discount || 0) + 5 }],
    });
  };

  const removeTier = (index: number) => {
    const tiers = [...(program.tiers || [])];
    tiers.splice(index, 1);
    setProgram({ ...program, tiers });
  };

  const updateTier = (index: number, field: keyof Tier, value: string | number) => {
    const tiers = [...(program.tiers || [])];
    tiers[index] = { ...tiers[index], [field]: value };
    setProgram({ ...program, tiers });
  };

  // Preview calculation
  const getPreview = () => {
    const spent = 100000;
    if (program.type === "cashback") {
      const bonus = Math.round(spent * program.cashbackPercent / 100);
      return `Клиент потратил ${spent.toLocaleString()} → получает ${bonus.toLocaleString()} бонусов (${program.cashbackPercent}%)`;
    }
    if (program.type === "visits") {
      return `Каждый ${program.visitsForReward}-й визит → ${program.rewardType === "free" ? "бесплатно" : `скидка ${program.rewardDiscount}%`}`;
    }
    if (program.type === "tiered" && program.tiers) {
      const tier = [...program.tiers].reverse().find(t => spent >= t.minSpent);
      return tier ? `При ${spent.toLocaleString()} потрачено → уровень "${tier.name}" (скидка ${tier.discount}%)` : "Нет подходящего уровня";
    }
    return "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const typeOptions = [
    { value: "cashback", label: "Кэшбэк", icon: Percent, desc: "% от суммы возвращается бонусами" },
    { value: "visits", label: "Визиты", icon: Award, desc: "Каждый N-й визит бесплатно/со скидкой" },
    { value: "tiered", label: "Уровни", icon: Layers, desc: "Скидки растут с суммой покупок" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Программа лояльности</h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            Настройте систему бонусов для ваших клиентов
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Star className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Сохранено!" : "Сохранить"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-5`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${textPrimary}`}>{stats.activeMembers}</p>
              <p className={`text-sm ${textSecondary}`}>Участников</p>
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
              <p className={`text-sm ${textSecondary}`}>Бонусов начислено</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enable toggle */}
      <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gift className={`h-5 w-5 ${program.enabled ? "text-green-500" : textSecondary}`} />
            <div>
              <p className={`font-medium ${textPrimary}`}>Программа лояльности</p>
              <p className={`text-sm ${textSecondary}`}>
                {program.enabled ? "Активна — клиенты накапливают бонусы" : "Выключена"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setProgram({ ...program, enabled: !program.enabled })}
            className={`relative w-12 h-7 rounded-full transition-colors ${program.enabled ? "bg-green-500" : isDark ? "bg-white/10" : "bg-gray-300"}`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow ${program.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {program.enabled && (
        <>
          {/* Type selection */}
          <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
            <h3 className={`font-medium ${textPrimary} mb-4`}>Тип программы</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProgram({ ...program, type: opt.value as LoyaltyProgram["type"] })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    program.type === opt.value
                      ? "border-blue-500 bg-blue-500/10"
                      : `${borderColor} ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`
                  }`}
                >
                  <opt.icon className={`h-5 w-5 mb-2 ${program.type === opt.value ? "text-blue-500" : textSecondary}`} />
                  <p className={`font-medium ${program.type === opt.value ? "text-blue-500" : textPrimary}`}>{opt.label}</p>
                  <p className={`text-xs ${textSecondary} mt-1`}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Type-specific settings */}
          <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
            <h3 className={`font-medium ${textPrimary} mb-4`}>Настройки</h3>

            {program.type === "cashback" && (
              <div>
                <label className={`block text-sm ${textSecondary} mb-2`}>Процент кэшбэка</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={program.cashbackPercent}
                    onChange={(e) => setProgram({ ...program, cashbackPercent: parseInt(e.target.value) || 5 })}
                    className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-center`}
                  />
                  <span className={textSecondary}>%</span>
                </div>
                <p className={`text-xs ${textSecondary} mt-2`}>
                  Клиент получает {program.cashbackPercent}% от суммы каждого заказа в виде бонусных баллов
                </p>
              </div>
            )}

            {program.type === "visits" && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm ${textSecondary} mb-2`}>Каждый N-й визит</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={program.visitsForReward}
                      onChange={(e) => setProgram({ ...program, visitsForReward: parseInt(e.target.value) || 10 })}
                      className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-center`}
                    />
                    <span className={textSecondary}>визит</span>
                  </div>
                </div>
                <div>
                  <label className={`block text-sm ${textSecondary} mb-2`}>Награда</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setProgram({ ...program, rewardType: "free" })}
                      className={`px-4 py-2 rounded-lg border ${program.rewardType === "free" ? "border-blue-500 bg-blue-500/10 text-blue-500" : `${borderColor} ${textSecondary}`}`}
                    >
                      Бесплатно
                    </button>
                    <button
                      onClick={() => setProgram({ ...program, rewardType: "discount" })}
                      className={`px-4 py-2 rounded-lg border ${program.rewardType === "discount" ? "border-blue-500 bg-blue-500/10 text-blue-500" : `${borderColor} ${textSecondary}`}`}
                    >
                      Скидка
                    </button>
                  </div>
                </div>
                {program.rewardType === "discount" && (
                  <div>
                    <label className={`block text-sm ${textSecondary} mb-2`}>Размер скидки</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={program.rewardDiscount}
                        onChange={(e) => setProgram({ ...program, rewardDiscount: parseInt(e.target.value) || 50 })}
                        className={`w-24 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-center`}
                      />
                      <span className={textSecondary}>%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {program.type === "tiered" && (
              <div className="space-y-3">
                {(program.tiers || []).map((tier, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${borderColor}`}>
                    <input
                      placeholder="Название"
                      value={tier.name}
                      onChange={(e) => updateTier(i, "name", e.target.value)}
                      className={`flex-1 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} text-sm`}
                    />
                    <div className="flex items-center gap-1">
                      <span className={`text-xs ${textSecondary}`}>от</span>
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
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed ${borderColor} ${textSecondary} hover:border-blue-500 hover:text-blue-500 transition-colors text-sm`}
                >
                  <Plus className="h-4 w-4" />
                  Добавить уровень
                </button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className={`${bgCard} border ${borderColor} rounded-xl p-6`}>
            <h3 className={`font-medium ${textPrimary} mb-3`}>Как это работает</h3>
            <div className={`p-4 rounded-lg ${isDark ? "bg-blue-500/5 border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}>
              <p className={`text-sm ${textPrimary}`}>{getPreview()}</p>
            </div>
            <p className={`text-xs ${textSecondary} mt-3`}>
              AI-бот автоматически информирует клиентов о бонусах и уровнях лояльности
            </p>
          </div>
        </>
      )}
    </div>
  );
}
