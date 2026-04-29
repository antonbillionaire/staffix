"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Search,
  Loader2,
  Users,
  Crown,
  UserCheck,
  UserX,
  MessageSquare,
  Calendar,
  Star,
  ChevronLeft,
  ChevronRight,
  Phone,
  Clock,
  ExternalLink,
  Ban,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Award,
  Plus,
  Minus,
  ShoppingCart,
} from "lucide-react";

interface Customer {
  id: string;
  telegramId: string | null;
  name: string;
  channel?: string;
  leadStatus?: string | null;
  phone: string | null;
  totalVisits: number;
  lastVisitDate: string | null;
  isBlocked: boolean;
  createdAt: string;
  isActive: boolean;
  isVip: boolean;
  messagesCount: number;
  bookingsCount: number;
  ordersCount?: number;
  ordersTotalSpent?: number;
  avgRating: number | null;
  segment: "vip" | "active" | "inactive";
  loyaltyPoints: number;
  loyaltyVisits: number;
  loyaltyTotalSpent: number;
  loyaltyProgramIds: string[];
  loyaltyCashbackPercent: number | null;
  loyaltyTier: string | null;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  vip: number;
  blocked: number;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
}

export default function CustomersPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, vip: 0, blocked: 0 });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [dashboardMode, setDashboardMode] = useState("service");

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");

  // Loyalty modal state
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null);
  const [loyaltyAmount, setLoyaltyAmount] = useState("");
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  // Theme-aware styles
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textTertiary = isDark ? "text-gray-500" : "text-gray-500";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  const tableBg = isDark ? "bg-white/5" : "bg-gray-50";
  const isSalesMode = dashboardMode === "sales";

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        segment,
      });

      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setStats(data.stats);
        setPagination(data.pagination);
        if (data.dashboardMode) setDashboardMode(data.dashboardMode);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, segment]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
    fetchCustomers();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    setImportError("");
    setImportResult(null);

    if (ext === "xlsx" || ext === "xls") {
      try {
        const mod = await import("xlsx");
        const XLSX = mod.default || mod;
        const buf = await file.arrayBuffer();
        const data = new Uint8Array(buf);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";", rawNumbers: true });
        setImportCsv(csv);
      } catch {
        setImportError("Не удалось прочитать Excel-файл. Убедитесь что это .xlsx или .xls");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => setImportCsv((event.target?.result as string) || "");
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!importCsv.trim()) {
      setImportError(t("customers.importEmptyError"));
      return;
    }
    setImporting(true);
    setImportError("");
    setImportResult(null);

    try {
      const res = await fetch("/api/import/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || t("customers.importError"));
      } else {
        setImportResult(data);
        fetchCustomers();
      }
    } catch {
      setImportError(t("customers.networkError"));
    } finally {
      setImporting(false);
    }
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportCsv("");
    setImportResult(null);
    setImportError("");
  };

  const handleLoyaltyAction = async (action: string, extraBody?: Record<string, unknown>) => {
    if (!loyaltyCustomer) return;
    setLoyaltySaving(true);
    try {
      // For point/visit actions require amount
      const body: Record<string, unknown> = { action, ...extraBody };
      if (!extraBody) {
        const amount = parseInt(loyaltyAmount) || 0;
        if (amount <= 0) { setLoyaltySaving(false); return; }
        body.amount = amount;
      }

      const res = await fetch(`/api/customers/${loyaltyCustomer.id}/loyalty`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedFields = {
          loyaltyPoints: data.client.loyaltyPoints,
          loyaltyVisits: data.client.loyaltyVisits,
          loyaltyTotalSpent: data.client.loyaltyTotalSpent,
          loyaltyCashbackPercent: data.client.loyaltyCashbackPercent ?? null,
          loyaltyTier: data.client.loyaltyTier ?? null,
        };
        setCustomers((prev) =>
          prev.map((c) => c.id === loyaltyCustomer.id ? { ...c, ...updatedFields } : c)
        );
        setLoyaltyCustomer((prev) => prev ? { ...prev, ...updatedFields } : null);
        if (!extraBody) setLoyaltyAmount("");
      }
    } catch (err) {
      console.error("Loyalty action error:", err);
    } finally {
      setLoyaltySaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getSegmentBadge = (customer: Customer) => {
    if (customer.isBlocked) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
          {t("customers.blocked")}
        </span>
      );
    }
    if (customer.isVip) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 flex items-center gap-1">
          <Crown className="h-3 w-3" />
          VIP
        </span>
      );
    }
    if (customer.isActive) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
          {t("customers.active")}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
        {t("customers.inactive")}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>{t("customers.database")}</h1>
          <p className={textSecondary}>
            {stats.total} {t("customers.customersInDatabase")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            <Upload className="h-4 w-4" />
            {t("customers.importCustomers")}
          </button>
          <button
            onClick={fetchCustomers}
            className={`flex items-center gap-2 px-4 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-xl ${textSecondary} transition-colors`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("customers.refresh")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <button
          onClick={() => { setSegment("all"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "all" ? "border-blue-500/50" : `${borderColor} hover:border-blue-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className={`text-xs ${textSecondary}`}>{t("customers.all")}</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.total}</p>
        </button>
        <button
          onClick={() => { setSegment("active"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "active" ? "border-green-500/50" : `${borderColor} hover:border-green-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-green-500" />
            <span className={`text-xs ${textSecondary}`}>{t("customers.activePlural")}</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.active}</p>
        </button>
        <button
          onClick={() => { setSegment("inactive"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "inactive" ? "border-gray-500/50" : `${borderColor} hover:border-gray-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <UserX className={`h-4 w-4 ${textSecondary}`} />
            <span className={`text-xs ${textSecondary}`}>{t("customers.inactivePlural")}</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.inactive}</p>
        </button>
        <button
          onClick={() => { setSegment("vip"); setPagination(p => ({ ...p, page: 1 })); }}
          className={`${cardBg} border rounded-xl p-4 text-left transition-colors ${
            segment === "vip" ? "border-yellow-500/50" : `${borderColor} hover:border-yellow-500/30`
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            <span className={`text-xs ${textSecondary}`}>VIP</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.vip}</p>
        </button>
        <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Ban className="h-4 w-4 text-red-500" />
            <span className={`text-xs ${textSecondary}`}>{t("customers.blockedPlural")}</span>
          </div>
          <p className={`text-xl font-bold ${textPrimary}`}>{stats.blocked}</p>
        </div>
      </div>

      {/* Search */}
      <div className={`${cardBg} border ${borderColor} rounded-xl p-4`}>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${textTertiary}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("customers.searchPlaceholder")}
              className={`w-full pl-10 pr-4 py-2.5 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90"
          >
            {t("customers.find")}
          </button>
        </form>
      </div>

      {/* Customers list */}
      <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : customers.length === 0 ? (
          <div className={`text-center py-12 ${textSecondary}`}>
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t("customers.notFound")}</p>
            <p className="text-sm mt-1">{t("customers.willAppearAfterBot")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor} ${tableBg}`}>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>{t("customers.thClient")}</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>{t("customers.thStatus")}</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium hidden md:table-cell ${textTertiary} uppercase`}>
                    {isSalesMode ? t("customers.thOrders") : t("customers.thVisits")}
                  </th>
                  <th className={`text-left py-3 px-4 text-xs font-medium hidden lg:table-cell ${textTertiary} uppercase`}>
                    {isSalesMode ? t("customers.thTotalSpent") : t("customers.thActivity")}
                  </th>
                  <th className={`text-left py-3 px-4 text-xs font-medium hidden lg:table-cell ${textTertiary} uppercase`}>{t("customers.thRating")}</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium hidden md:table-cell ${textTertiary} uppercase`}>{t("customers.thPoints")}</th>
                  <th className={`text-left py-3 px-4 text-xs font-medium hidden lg:table-cell ${textTertiary} uppercase`}>
                    {isSalesMode ? t("customers.thLastOrder") : t("customers.thLastVisit")}
                  </th>
                  <th className={`text-right py-3 px-4 text-xs font-medium ${textTertiary} uppercase`}>{t("customers.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className={`border-b ${borderColor} ${hoverBg}`}>
                    <td className="py-3 px-4">
                      <div>
                        <p className={`${textPrimary} font-medium flex items-center gap-2`}>
                          {customer.name}
                          {customer.channel && customer.channel !== "telegram" && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              customer.channel === "whatsapp" ? "bg-green-500/20 text-green-400" :
                              customer.channel === "instagram" ? "bg-pink-500/20 text-pink-400" :
                              customer.channel === "facebook" ? "bg-blue-500/20 text-blue-400" :
                              "bg-gray-500/20 text-gray-400"
                            }`}>
                              {customer.channel === "whatsapp" ? "WA" : customer.channel === "instagram" ? "IG" : "FB"}
                            </span>
                          )}
                        </p>
                        {customer.phone && (
                          <p className={`text-sm ${textTertiary} flex items-center gap-1`}>
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getSegmentBadge(customer)}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {isSalesMode ? (
                        <div className="flex items-center gap-3 text-sm">
                          <Link
                            href={`/dashboard/customers/${customer.id}?tab=orders`}
                            className={`flex items-center gap-1 ${textSecondary} hover:text-blue-500 transition-colors`}
                            title={t("customers.clientOrders")}
                          >
                            <ShoppingCart className="h-3 w-3" />
                            {customer.ordersCount || 0}
                          </Link>
                          <Link
                            href={`/dashboard/customers/${customer.id}?tab=messages`}
                            className={`flex items-center gap-1 ${textSecondary} hover:text-blue-500 transition-colors`}
                            title={t("customers.clientMessages")}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {customer.messagesCount}
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-sm">
                          <Link
                            href={`/dashboard/customers/${customer.id}?tab=bookings`}
                            className={`flex items-center gap-1 ${textSecondary} hover:text-blue-500 transition-colors`}
                            title={t("customers.clientBookings")}
                          >
                            <Calendar className="h-3 w-3" />
                            {customer.bookingsCount}
                          </Link>
                          <Link
                            href={`/dashboard/customers/${customer.id}?tab=messages`}
                            className={`flex items-center gap-1 ${textSecondary} hover:text-blue-500 transition-colors`}
                            title={t("customers.clientMessages")}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {customer.messagesCount}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {isSalesMode ? (
                        <span className={textSecondary}>
                          {(customer.ordersTotalSpent || 0).toLocaleString()}
                        </span>
                      ) : (
                        <Link
                          href={`/dashboard/customers/${customer.id}?tab=bookings`}
                          className={`${textSecondary} hover:text-blue-500 transition-colors`}
                        >
                          {customer.totalVisits} {t("customers.visitsCount")}
                        </Link>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {customer.avgRating ? (
                        <span className="flex items-center gap-1 text-yellow-500">
                          <Star className="h-4 w-4 fill-yellow-500" />
                          {customer.avgRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className={textTertiary}>—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <button
                        onClick={() => { setLoyaltyCustomer(customer); setLoyaltyAmount(""); }}
                        className={`flex items-center gap-1 text-sm ${customer.loyaltyPoints > 0 ? "text-purple-500" : textTertiary} hover:text-purple-400 transition-colors`}
                        title={t("customers.managePoints")}
                      >
                        <Award className="h-3.5 w-3.5" />
                        {customer.loyaltyPoints > 0 ? customer.loyaltyPoints : "—"}
                      </button>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className={`flex items-center gap-2 ${textSecondary}`}>
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{formatDate(customer.lastVisitDate)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500 inline-flex`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${borderColor}`}>
            <p className={`text-sm ${textSecondary}`}>
              {t("customers.page")} {pagination.page} {t("customers.of")} {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className={`p-2 ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"} rounded-lg transition-colors ${textSecondary} hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${cardBg} border ${borderColor} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between p-6 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                <h2 className={`text-lg font-bold ${textPrimary}`}>{t("customers.importCustomers")}</h2>
              </div>
              <button onClick={closeImportModal} className={`p-2 ${hoverBg} rounded-lg transition-colors`}>
                <X className={`h-5 w-5 ${textSecondary}`} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Instructions */}
              <div className={`text-sm ${textSecondary} space-y-1`}>
                <p>{t("customers.importInstruction1")}</p>
                <p>{t("customers.importInstruction2")} <span className={textPrimary}>{t("customers.importColumns")}</span></p>
                <p>{t("customers.importInstruction3")}</p>
              </div>

              {/* File upload */}
              <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed ${inputBorder} rounded-xl cursor-pointer ${hoverBg} transition-colors`}>
                <Upload className={`h-5 w-5 ${textSecondary}`} />
                <span className={textSecondary}>{t("customers.chooseFile")}</span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Or paste */}
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  {t("customers.orPasteData")}
                </label>
                <textarea
                  value={importCsv}
                  onChange={(e) => { setImportCsv(e.target.value); setImportError(""); setImportResult(null); }}
                  rows={8}
                  placeholder={t("customers.importPlaceholder")}
                  className={`w-full px-3 py-2 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono`}
                />
              </div>

              {/* Error */}
              {importError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-400 rounded-xl text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {importError}
                </div>
              )}

              {/* Result */}
              {importResult && (
                <div className="p-4 bg-green-500/10 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-green-400 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    {t("customers.importComplete")}
                  </div>
                  <div className={`text-sm ${textSecondary} grid grid-cols-2 gap-1`}>
                    <span>{t("customers.totalRows")}:</span><span className={textPrimary}>{importResult.total}</span>
                    <span>{t("customers.created")}:</span><span className="text-green-400">{importResult.created}</span>
                    <span>{t("customers.updated")}:</span><span className="text-blue-400">{importResult.updated}</span>
                    <span>{t("customers.skipped")}:</span><span className={textTertiary}>{importResult.skipped}</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-sm text-red-400">
                      {importResult.errors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={closeImportModal}
                  className={`flex-1 px-4 py-2.5 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-xl ${textSecondary} font-medium transition-colors`}
                >
                  {importResult ? t("customers.close") : t("customers.cancel")}
                </button>
                {!importResult && (
                  <button
                    onClick={handleImport}
                    disabled={importing || !importCsv.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("customers.importing")}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {t("customers.import")}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Loyalty Modal */}
      {loyaltyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${cardBg} border ${borderColor} rounded-2xl w-full max-w-md`}>
            <div className={`flex items-center justify-between p-6 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-purple-500" />
                <div>
                  <h2 className={`text-lg font-bold ${textPrimary}`}>{t("customers.loyalty")}</h2>
                  <p className={`text-sm ${textSecondary}`}>{loyaltyCustomer.name}</p>
                </div>
              </div>
              <button onClick={() => setLoyaltyCustomer(null)} className={`p-2 ${hoverBg} rounded-lg transition-colors`}>
                <X className={`h-5 w-5 ${textSecondary}`} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Current stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-xl ${isDark ? "bg-purple-500/10" : "bg-purple-50"} text-center`}>
                  <p className={`text-xl font-bold text-purple-500`}>{loyaltyCustomer.loyaltyPoints}</p>
                  <p className={`text-xs ${textSecondary}`}>{t("customers.points")}</p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? "bg-blue-500/10" : "bg-blue-50"} text-center`}>
                  <p className={`text-xl font-bold text-blue-500`}>{loyaltyCustomer.loyaltyVisits}</p>
                  <p className={`text-xs ${textSecondary}`}>{t("customers.visits")}</p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? "bg-green-500/10" : "bg-green-50"} text-center`}>
                  <p className={`text-xl font-bold text-green-500`}>{loyaltyCustomer.loyaltyTotalSpent.toLocaleString()}</p>
                  <p className={`text-xs ${textSecondary}`}>{t("customers.spent")}</p>
                </div>
              </div>

              {/* Adjust points */}
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>{t("customers.managePoints")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={loyaltyAmount}
                    onChange={(e) => setLoyaltyAmount(e.target.value)}
                    placeholder={t("customers.amount")}
                    className={`flex-1 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  />
                  <button
                    onClick={() => handleLoyaltyAction("addPoints")}
                    disabled={loyaltySaving || !loyaltyAmount}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleLoyaltyAction("subtractPoints")}
                    disabled={loyaltySaving || !loyaltyAmount || loyaltyCustomer.loyaltyPoints === 0}
                    className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Add visits */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setLoyaltyAmount("1"); setTimeout(() => handleLoyaltyAction("addVisits"), 0); }}
                  disabled={loyaltySaving}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-lg ${textSecondary} transition-colors text-sm`}
                >
                  <Plus className="h-3 w-3" />
                  {t("customers.visit")}
                </button>
                <button
                  onClick={() => {
                    const amount = prompt(t("customers.purchaseAmount"));
                    if (amount && parseInt(amount) > 0) {
                      setLoyaltyAmount(amount);
                      setTimeout(() => handleLoyaltyAction("addSpent"), 0);
                    }
                  }}
                  disabled={loyaltySaving}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-lg ${textSecondary} transition-colors text-sm`}
                >
                  <Plus className="h-3 w-3" />
                  {t("customers.purchase")}
                </button>
              </div>

              {/* Cashback % */}
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>{t("customers.cashbackPercent")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={loyaltyCustomer.loyaltyCashbackPercent ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const newPercent = val === "" ? null : parseFloat(val);
                      setLoyaltyCustomer((prev) => prev ? { ...prev, loyaltyCashbackPercent: newPercent } : null);
                    }}
                    placeholder={t("customers.byProgram")}
                    className={`flex-1 px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  />
                  <button
                    onClick={() => handleLoyaltyAction("setCashback", { cashbackPercent: loyaltyCustomer.loyaltyCashbackPercent })}
                    disabled={loyaltySaving}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {t("customers.save")}
                  </button>
                </div>
                <p className={`text-xs ${textTertiary} mt-1`}>{t("customers.emptyMeansProgram")}</p>
              </div>

              {/* Tier */}
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>{t("customers.clientTier")}</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { value: null, label: t("customers.tierAuto"), color: "gray" },
                    { value: "bronze", label: t("customers.tierBronze"), color: "orange" },
                    { value: "silver", label: t("customers.tierSilver"), color: "slate" },
                    { value: "gold", label: t("customers.tierGold"), color: "yellow" },
                    { value: "platinum", label: t("customers.tierPlatinum"), color: "blue" },
                  ].map((tier) => {
                    const isSelected = loyaltyCustomer.loyaltyTier === tier.value;
                    const colorClasses: Record<string, string> = {
                      gray: isSelected ? "bg-gray-500/20 border-gray-500 text-gray-300" : `${isDark ? "bg-white/5" : "bg-gray-50"} border-transparent`,
                      orange: isSelected ? "bg-orange-500/20 border-orange-500 text-orange-400" : `${isDark ? "bg-white/5" : "bg-gray-50"} border-transparent`,
                      slate: isSelected ? "bg-slate-400/20 border-slate-400 text-slate-300" : `${isDark ? "bg-white/5" : "bg-gray-50"} border-transparent`,
                      yellow: isSelected ? "bg-yellow-500/20 border-yellow-500 text-yellow-400" : `${isDark ? "bg-white/5" : "bg-gray-50"} border-transparent`,
                      blue: isSelected ? "bg-blue-500/20 border-blue-500 text-blue-400" : `${isDark ? "bg-white/5" : "bg-gray-50"} border-transparent`,
                    };
                    return (
                      <button
                        key={tier.value ?? "auto"}
                        onClick={() => handleLoyaltyAction("setTier", { tier: tier.value })}
                        disabled={loyaltySaving}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${colorClasses[tier.color]} ${!isSelected ? `${textSecondary} hover:border-${tier.color}-500/50` : ""} disabled:opacity-50`}
                      >
                        {tier.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
