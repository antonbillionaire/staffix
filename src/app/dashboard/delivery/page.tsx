"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Truck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  MapPin,
  Clock,
  DollarSign,
  Gift,
} from "lucide-react";

const CURRENCY_CODES = ["UZS", "KZT", "RUB", "KGS", "USD"] as const;

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  currency: string;
  timeFrom: number | null;
  timeTo: number | null;
  freeFrom: number | null;
  isActive: boolean;
  sortOrder: number;
}

export default function DeliveryPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    fee: "",
    currency: "UZS",
    timeFrom: "",
    timeTo: "",
    freeFrom: "",
  });

  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  const fetchData = async () => {
    try {
      const res = await fetch("/api/delivery");
      if (res.ok) {
        const data = await res.json();
        setDeliveryEnabled(data.delivery?.deliveryEnabled || false);
        setZones(data.zones || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = async () => {
    const newVal = !deliveryEnabled;
    setDeliveryEnabled(newVal);
    await fetch("/api/delivery", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newVal }),
    });
  };

  const openAddModal = () => {
    setEditingZone(null);
    setFormData({ name: "", fee: "", currency: "UZS", timeFrom: "", timeTo: "", freeFrom: "" });
    setShowModal(true);
  };

  const openEditModal = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      fee: zone.fee.toString(),
      currency: zone.currency,
      timeFrom: zone.timeFrom?.toString() || "",
      timeTo: zone.timeTo?.toString() || "",
      freeFrom: zone.freeFrom?.toString() || "",
    });
    setShowModal(true);
  };

  const handleSaveZone = async () => {
    if (!formData.name || !formData.fee) return;
    setSaving(true);

    try {
      await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingZone?.id,
          name: formData.name,
          fee: formData.fee,
          currency: formData.currency,
          timeFrom: formData.timeFrom || null,
          timeTo: formData.timeTo || null,
          freeFrom: formData.freeFrom || null,
        }),
      });
      setShowModal(false);
      await fetchData();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await fetch(`/api/delivery?zoneId=${zoneId}`, { method: "DELETE" });
      await fetchData();
    } catch {
      // silent
    }
  };

  const formatTime = (from: number | null, to: number | null) => {
    if (!from && !to) return null;
    if (from && to) {
      if (from >= 60 || to >= 60) {
        const fH = Math.floor((from || 0) / 60);
        const fM = (from || 0) % 60;
        const tH = Math.floor((to || 0) / 60);
        const tM = (to || 0) % 60;
        return `${fH}${t("delivery.hourShort")}${fM ? ` ${fM}${t("delivery.minShort")}` : ""} — ${tH}${t("delivery.hourShort")}${tM ? ` ${tM}${t("delivery.minShort")}` : ""}`;
      }
      return `${from} — ${to} ${t("delivery.minShort")}`;
    }
    if (to) return `${t("delivery.upTo")} ${to} ${t("delivery.minShort")}`;
    return `${t("delivery.from")} ${from} ${t("delivery.minShort")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className={`text-2xl font-bold ${textPrimary} mb-2`}>{t("delivery.title")}</h2>
        <p className={textSecondary}>
          {t("delivery.subtitle")}
        </p>
      </div>

      {/* Toggle */}
      <div className={`${bgCard} rounded-xl border ${borderColor} p-6 mb-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${isDark ? "bg-blue-500/10" : "bg-blue-50"} rounded-lg flex items-center justify-center`}>
              <Truck className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className={`font-medium ${textPrimary}`}>{t("delivery.delivery")}</h3>
              <p className={`text-sm ${textSecondary}`}>
                {deliveryEnabled ? t("delivery.enabledForOrders") : t("delivery.disabled")}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              deliveryEnabled ? "bg-blue-600" : isDark ? "bg-gray-600" : "bg-gray-300"
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              deliveryEnabled ? "translate-x-6" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>

      {/* Zones */}
      {deliveryEnabled && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-medium ${textPrimary}`}>{t("delivery.zones")}</h3>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("delivery.addZone")}
            </button>
          </div>

          {zones.length === 0 ? (
            <div className={`${bgCard} rounded-xl border ${borderColor} p-8 text-center`}>
              <MapPin className={`h-10 w-10 ${textSecondary} mx-auto mb-3 opacity-50`} />
              <p className={textSecondary}>{t("delivery.noZones")}</p>
              <p className={`text-sm mt-1 ${textSecondary} opacity-70`}>
                {t("delivery.noZonesHint")}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {zones.map((zone) => (
                <div key={zone.id} className={`${bgCard} rounded-xl border ${borderColor} p-5`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className={`font-medium ${textPrimary}`}>{zone.name}</h4>
                      {!zone.isActive && (
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          {t("delivery.inactive")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(zone)}
                        className={`p-1.5 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} transition-colors`}
                      >
                        <Pencil className={`h-4 w-4 ${textSecondary}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className={`h-4 w-4 ${textSecondary}`} />
                      <span className={`text-sm ${textPrimary}`}>
                        {zone.fee.toLocaleString()} {zone.currency}
                      </span>
                    </div>

                    {formatTime(zone.timeFrom, zone.timeTo) && (
                      <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${textSecondary}`} />
                        <span className={`text-sm ${textSecondary}`}>
                          {formatTime(zone.timeFrom, zone.timeTo)}
                        </span>
                      </div>
                    )}

                    {zone.freeFrom && (
                      <div className="flex items-center gap-2">
                        <Gift className={`h-4 w-4 text-green-400`} />
                        <span className={`text-sm text-green-400`}>
                          {t("delivery.freeFromAmount")} {zone.freeFrom.toLocaleString()} {zone.currency}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${bgCard} rounded-xl border ${borderColor} w-full max-w-md`}>
            <div className={`flex items-center justify-between p-5 border-b ${borderColor}`}>
              <h3 className={`text-lg font-medium ${textPrimary}`}>
                {editingZone ? t("delivery.editZone") : t("delivery.newZone")}
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className={`h-5 w-5 ${textSecondary}`} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  {t("delivery.zoneName")} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("delivery.zoneNamePlaceholder")}
                  className={`w-full px-3 py-2 border rounded-lg ${inputBg} ${inputBorder} ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                    {t("delivery.fee")} *
                  </label>
                  <input
                    type="number"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    placeholder="5000"
                    className={`w-full px-3 py-2 border rounded-lg ${inputBg} ${inputBorder} ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                    {t("delivery.currency")}
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${inputBg} ${inputBorder} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    {CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>{t(`delivery.currency.${code}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                    {t("delivery.timeFrom")}
                  </label>
                  <input
                    type="number"
                    value={formData.timeFrom}
                    onChange={(e) => setFormData({ ...formData, timeFrom: e.target.value })}
                    placeholder="30"
                    className={`w-full px-3 py-2 border rounded-lg ${inputBg} ${inputBorder} ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                    {t("delivery.timeTo")}
                  </label>
                  <input
                    type="number"
                    value={formData.timeTo}
                    onChange={(e) => setFormData({ ...formData, timeTo: e.target.value })}
                    placeholder="60"
                    className={`w-full px-3 py-2 border rounded-lg ${inputBg} ${inputBorder} ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  {t("delivery.freeFromLabel")}
                </label>
                <input
                  type="number"
                  value={formData.freeFrom}
                  onChange={(e) => setFormData({ ...formData, freeFrom: e.target.value })}
                  placeholder={t("delivery.freeFromPlaceholder")}
                  className={`w-full px-3 py-2 border rounded-lg ${inputBg} ${inputBorder} ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <p className={`text-xs mt-1 ${textSecondary}`}>
                  {t("delivery.freeFromHint")}
                </p>
              </div>

              <button
                onClick={handleSaveZone}
                disabled={saving || !formData.name || !formData.fee}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  editingZone ? t("delivery.save") : t("delivery.addZone")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
