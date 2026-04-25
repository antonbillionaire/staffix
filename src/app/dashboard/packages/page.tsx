"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, X, Pencil, Trash2, Package as PackageIcon, AlertTriangle, Check } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface PackageItem {
  id: string;
  serviceId: string;
  service: Service;
}

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  discountType: "percent" | "fixed" | "none";
  discountPercent: number | null;
  fixedPrice: number | null;
  isActive: boolean;
  autoSuggest: boolean;
  items: PackageItem[];
  totalRegularPrice: number;
  finalPrice: number;
  savedAmount: number;
  totalDuration: number;
}

interface Incompatibility {
  id: string;
  serviceA: { id: string; name: string };
  serviceB: { id: string; name: string };
  cooldownDays: number;
  bidirectional: boolean;
  reason: string | null;
}

function formatMoney(n: number): string {
  return n.toLocaleString("ru-RU");
}

export default function PackagesPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [incompatibilities, setIncompatibilities] = useState<Incompatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"packages" | "incompatibilities">("packages");

  // Package modal
  const [pkgModal, setPkgModal] = useState<ServicePackage | "new" | null>(null);
  const [pkgForm, setPkgForm] = useState({
    name: "",
    description: "",
    discountType: "percent" as "percent" | "fixed" | "none",
    discountPercent: "" as string | number,
    fixedPrice: "" as string | number,
    autoSuggest: true,
    serviceIds: [] as string[],
  });
  const [savingPkg, setSavingPkg] = useState(false);

  // Incompatibility modal
  const [incModal, setIncModal] = useState<boolean>(false);
  const [incForm, setIncForm] = useState({
    serviceAId: "",
    serviceBId: "",
    cooldownDays: 7,
    bidirectional: true,
    reason: "",
  });
  const [savingInc, setSavingInc] = useState(false);

  const card = isDark ? "bg-[#12122a] border-white/5" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark ? "bg-[#0c0c1f] border-white/10 text-white" : "bg-white border-gray-300 text-gray-900";

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pkgRes, srvRes, incRes] = await Promise.all([
        fetch("/api/packages"),
        fetch("/api/services"),
        fetch("/api/incompatibilities"),
      ]);
      if (pkgRes.ok) setPackages((await pkgRes.json()).packages || []);
      if (srvRes.ok) setServices((await srvRes.json()).services || []);
      if (incRes.ok) setIncompatibilities((await incRes.json()).incompatibilities || []);
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openPkgModal = (pkg?: ServicePackage) => {
    if (pkg) {
      setPkgModal(pkg);
      setPkgForm({
        name: pkg.name,
        description: pkg.description || "",
        discountType: pkg.discountType,
        discountPercent: pkg.discountPercent ?? "",
        fixedPrice: pkg.fixedPrice ?? "",
        autoSuggest: pkg.autoSuggest,
        serviceIds: pkg.items.map((i) => i.serviceId),
      });
    } else {
      setPkgModal("new");
      setPkgForm({
        name: "",
        description: "",
        discountType: "percent",
        discountPercent: "",
        fixedPrice: "",
        autoSuggest: true,
        serviceIds: [],
      });
    }
  };

  const savePkg = async () => {
    if (!pkgForm.name || pkgForm.serviceIds.length === 0) return;
    setSavingPkg(true);
    try {
      const isEdit = pkgModal && pkgModal !== "new";
      const url = isEdit ? `/api/packages/${(pkgModal as ServicePackage).id}` : "/api/packages";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pkgForm.name,
          description: pkgForm.description,
          discountType: pkgForm.discountType,
          discountPercent: pkgForm.discountPercent ? Number(pkgForm.discountPercent) : null,
          fixedPrice: pkgForm.fixedPrice ? Number(pkgForm.fixedPrice) : null,
          autoSuggest: pkgForm.autoSuggest,
          serviceIds: pkgForm.serviceIds,
        }),
      });
      if (res.ok) {
        setPkgModal(null);
        await fetchAll();
      }
    } catch (e) {
      console.error("Save package error:", e);
    }
    setSavingPkg(false);
  };

  const deletePkg = async (id: string) => {
    if (!confirm(t("packages.deleteConfirm") || "Удалить пакет?")) return;
    try {
      const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
      if (res.ok) await fetchAll();
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  const togglePkgActive = async (pkg: ServicePackage) => {
    try {
      const res = await fetch(`/api/packages/${pkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pkg.isActive }),
      });
      if (res.ok) await fetchAll();
    } catch (e) {
      console.error("Toggle error:", e);
    }
  };

  const saveInc = async () => {
    if (!incForm.serviceAId || !incForm.serviceBId) return;
    setSavingInc(true);
    try {
      const res = await fetch("/api/incompatibilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(incForm),
      });
      if (res.ok) {
        setIncModal(false);
        setIncForm({ serviceAId: "", serviceBId: "", cooldownDays: 7, bidirectional: true, reason: "" });
        await fetchAll();
      }
    } catch (e) {
      console.error("Save incompatibility error:", e);
    }
    setSavingInc(false);
  };

  const deleteInc = async (id: string) => {
    if (!confirm(t("packages.deleteIncConfirm") || "Удалить правило несовместимости?")) return;
    try {
      const res = await fetch(`/api/incompatibilities/${id}`, { method: "DELETE" });
      if (res.ok) await fetchAll();
    } catch (e) {
      console.error("Delete incompatibility error:", e);
    }
  };

  const toggleService = (sid: string) => {
    setPkgForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(sid)
        ? f.serviceIds.filter((id) => id !== sid)
        : [...f.serviceIds, sid],
    }));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${text}`}>{t("packages.title") || "Мои пакеты услуг"}</h1>
          <p className={`text-sm ${sub} mt-1`}>{t("packages.subtitle") || "Комбо со скидкой и правила несовместимости услуг"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("packages")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "packages" ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
        >
          {t("packages.tabPackages") || "Пакеты"} ({packages.length})
        </button>
        <button
          onClick={() => setTab("incompatibilities")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "incompatibilities" ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
        >
          {t("packages.tabIncompatibilities") || "Несовместимости"} ({incompatibilities.length})
        </button>
      </div>

      {tab === "packages" ? (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => openPkgModal()}
              disabled={services.length < 2}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t("packages.addPackage") || "Создать пакет"}
            </button>
          </div>

          {loading ? (
            <div className={`${card} border rounded-xl p-8 text-center`}>
              <Loader2 className={`w-6 h-6 mx-auto animate-spin ${sub}`} />
            </div>
          ) : packages.length === 0 ? (
            <div className={`${card} border rounded-xl p-12 text-center`}>
              <PackageIcon className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
              <p className={`text-lg font-medium ${text}`}>{t("packages.noPackages") || "Нет пакетов"}</p>
              <p className={`text-sm ${sub} mt-2`}>
                {services.length < 2
                  ? t("packages.needMoreServices") || "Сначала добавьте минимум 2 услуги"
                  : t("packages.noPackagesHint") || "Создайте комбо услуг со скидкой — бот будет предлагать их клиентам"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className={`${card} border rounded-xl p-4 ${!pkg.isActive ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className={`font-semibold ${text}`}>{pkg.name}</h3>
                        {pkg.autoSuggest && (
                          <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                            {t("packages.autoSuggest") || "AI предлагает"}
                          </span>
                        )}
                      </div>
                      {pkg.description && <p className={`text-sm ${sub} mb-2`}>{pkg.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {pkg.items.map((item) => (
                          <span
                            key={item.id}
                            className={`text-xs px-2 py-1 rounded ${isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
                          >
                            {item.service.name} · {formatMoney(item.service.price)}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className={sub}>{t("packages.regularPrice") || "Обычная цена"}: </span>
                          <span className={`line-through ${sub}`}>{formatMoney(pkg.totalRegularPrice)}</span>
                        </div>
                        <div>
                          <span className={sub}>{t("packages.packagePrice") || "Цена пакета"}: </span>
                          <span className={`font-bold ${text}`}>{formatMoney(pkg.finalPrice)}</span>
                        </div>
                        {pkg.savedAmount > 0 && (
                          <div className="text-green-500 font-medium">
                            {t("packages.save") || "Экономия"}: {formatMoney(pkg.savedAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => togglePkgActive(pkg)} className={`text-xs px-2 py-1 rounded ${pkg.isActive ? "bg-green-500/10 text-green-500" : isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                        {pkg.isActive ? t("packages.active") || "Активен" : t("packages.inactive") || "Выключен"}
                      </button>
                      <button onClick={() => openPkgModal(pkg)} className={`p-1.5 rounded ${isDark ? "hover:bg-white/5 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deletePkg(pkg.id)} className={`p-1.5 rounded text-red-500 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setIncModal(true)}
              disabled={services.length < 2}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t("packages.addIncompatibility") || "Добавить правило"}
            </button>
          </div>

          {incompatibilities.length === 0 ? (
            <div className={`${card} border rounded-xl p-12 text-center`}>
              <AlertTriangle className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
              <p className={`text-lg font-medium ${text}`}>{t("packages.noIncompatibilities") || "Нет правил несовместимости"}</p>
              <p className={`text-sm ${sub} mt-2`}>
                {t("packages.noIncompatibilitiesHint") || "Например: \"После ботокса нельзя массаж лица 5 дней\". Бот будет предупреждать клиентов."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incompatibilities.map((inc) => (
                <div key={inc.id} className={`${card} border rounded-xl p-4`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`font-medium ${text}`}>{inc.serviceA.name}</span>
                        <span className={sub}>{inc.bidirectional ? "↔" : "→"}</span>
                        <span className={`font-medium ${text}`}>{inc.serviceB.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600"}`}>
                          {inc.cooldownDays} {t("packages.days") || "дн."}
                        </span>
                      </div>
                      {inc.reason && <p className={`text-sm ${sub}`}>{inc.reason}</p>}
                    </div>
                    <button onClick={() => deleteInc(inc.id)} className={`p-1.5 rounded text-red-500 ${isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Package modal */}
      {pkgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${card} border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className={`font-semibold ${text}`}>
                {pkgModal === "new" ? t("packages.newPackage") || "Новый пакет" : t("packages.editPackage") || "Редактировать пакет"}
              </h3>
              <button onClick={() => setPkgModal(null)} className={sub}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("packages.name") || "Название"}</label>
                <input
                  type="text"
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  placeholder="Стрижка + Борода"
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("packages.description") || "Описание"}</label>
                <input
                  type="text"
                  value={pkgForm.description}
                  onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                  placeholder=""
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                />
              </div>

              <div>
                <label className={`block text-sm mb-2 ${text}`}>{t("packages.services") || "Услуги в пакете"}</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {services.map((s) => (
                    <label key={s.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${pkgForm.serviceIds.includes(s.id) ? (isDark ? "bg-blue-500/10" : "bg-blue-50") : isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}>
                      <input
                        type="checkbox"
                        checked={pkgForm.serviceIds.includes(s.id)}
                        onChange={() => toggleService(s.id)}
                        className="rounded"
                      />
                      <span className={`flex-1 text-sm ${text}`}>{s.name}</span>
                      <span className={`text-xs ${sub}`}>{formatMoney(s.price)} · {s.duration} мин</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-sm mb-2 ${text}`}>{t("packages.discountType") || "Тип цены"}</label>
                <div className="flex gap-2">
                  {(["percent", "fixed", "none"] as const).map((dt) => (
                    <button
                      key={dt}
                      onClick={() => setPkgForm({ ...pkgForm, discountType: dt })}
                      className={`px-3 py-1.5 rounded-lg text-sm ${pkgForm.discountType === dt ? "bg-blue-600 text-white" : isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}
                    >
                      {dt === "percent" ? t("packages.percent") || "Скидка %" : dt === "fixed" ? t("packages.fixed") || "Фикс. цена" : t("packages.none") || "Без скидки"}
                    </button>
                  ))}
                </div>
              </div>

              {pkgForm.discountType === "percent" && (
                <div>
                  <label className={`block text-sm mb-1 ${text}`}>{t("packages.discountPercent") || "Скидка %"}</label>
                  <input
                    type="number"
                    value={pkgForm.discountPercent}
                    onChange={(e) => setPkgForm({ ...pkgForm, discountPercent: e.target.value })}
                    placeholder="10"
                    min="1"
                    max="99"
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                  />
                </div>
              )}

              {pkgForm.discountType === "fixed" && (
                <div>
                  <label className={`block text-sm mb-1 ${text}`}>{t("packages.fixedPrice") || "Цена за весь пакет"}</label>
                  <input
                    type="number"
                    value={pkgForm.fixedPrice}
                    onChange={(e) => setPkgForm({ ...pkgForm, fixedPrice: e.target.value })}
                    placeholder="500000"
                    min="0"
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                  />
                </div>
              )}

              <label className={`flex items-center gap-2 ${text}`}>
                <input
                  type="checkbox"
                  checked={pkgForm.autoSuggest}
                  onChange={(e) => setPkgForm({ ...pkgForm, autoSuggest: e.target.checked })}
                />
                <span className="text-sm">{t("packages.autoSuggestLabel") || "AI бот будет автоматически предлагать этот пакет клиентам"}</span>
              </label>
            </div>
            <div className="flex gap-3 p-5 border-t border-white/5">
              <button onClick={() => setPkgModal(null)} className={`flex-1 px-4 py-2 rounded-lg text-sm ${isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                {t("packages.cancel") || "Отмена"}
              </button>
              <button
                onClick={savePkg}
                disabled={savingPkg || !pkgForm.name || pkgForm.serviceIds.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                {savingPkg && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                {t("packages.save") || "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incompatibility modal */}
      {incModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${card} border rounded-xl w-full max-w-md`}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className={`font-semibold ${text}`}>{t("packages.newIncompatibility") || "Новое правило несовместимости"}</h3>
              <button onClick={() => setIncModal(false)} className={sub}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("packages.serviceA") || "После услуги"}</label>
                <select
                  value={incForm.serviceAId}
                  onChange={(e) => setIncForm({ ...incForm, serviceAId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                >
                  <option value="">—</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("packages.serviceB") || "Нельзя делать"}</label>
                <select
                  value={incForm.serviceBId}
                  onChange={(e) => setIncForm({ ...incForm, serviceBId: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                >
                  <option value="">—</option>
                  {services.filter(s => s.id !== incForm.serviceAId).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("packages.cooldownDays") || "Период (дней)"}</label>
                <input
                  type="number"
                  value={incForm.cooldownDays}
                  onChange={(e) => setIncForm({ ...incForm, cooldownDays: Number(e.target.value) })}
                  min="1"
                  max="365"
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                />
              </div>
              <label className={`flex items-center gap-2 ${text}`}>
                <input
                  type="checkbox"
                  checked={incForm.bidirectional}
                  onChange={(e) => setIncForm({ ...incForm, bidirectional: e.target.checked })}
                />
                <span className="text-sm">{t("packages.bidirectional") || "Действует в обе стороны"}</span>
              </label>
              <div>
                <label className={`block text-sm mb-1 ${text}`}>{t("packages.reason") || "Причина"} ({t("packages.optional") || "опционально"})</label>
                <input
                  type="text"
                  value={incForm.reason}
                  onChange={(e) => setIncForm({ ...incForm, reason: e.target.value })}
                  placeholder={t("packages.reasonPlaceholder") || "Чтобы препарат не сместился"}
                  className={`w-full px-3 py-2 rounded-lg border outline-none ${input}`}
                />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-white/5">
              <button onClick={() => setIncModal(false)} className={`flex-1 px-4 py-2 rounded-lg text-sm ${isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                {t("packages.cancel") || "Отмена"}
              </button>
              <button
                onClick={saveInc}
                disabled={savingInc || !incForm.serviceAId || !incForm.serviceBId}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                {savingInc && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("packages.save") || "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
