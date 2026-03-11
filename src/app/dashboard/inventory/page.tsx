"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Package,
  Loader2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  stock: number | null;
  isActive: boolean;
}

type SortField = "name" | "stock" | "category";
type SortDir = "asc" | "desc";

export default function InventoryPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Track edited stock values
  const [editedStock, setEditedStock] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  const tableBg = isDark ? "bg-white/5" : "bg-gray-50";

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleStockChange = (productId: string, value: string) => {
    setEditedStock((prev) => ({ ...prev, [productId]: value }));
    setSaved(false);
  };

  const hasChanges = Object.keys(editedStock).length > 0;

  const handleSaveAll = async () => {
    if (!hasChanges) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const updates = Object.entries(editedStock).map(([id, val]) => ({
        id,
        stock: val === "" ? null : parseInt(val),
      }));

      const res = await fetch("/api/products/bulk-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state
        setProducts((prev) =>
          prev.map((p) => {
            const update = data.updated?.find((u: { id: string; stock: number | null }) => u.id === p.id);
            return update ? { ...p, stock: update.stock } : p;
          })
        );
        setEditedStock({});
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Error saving");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Filter and sort
  const filtered = products
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return a.name.localeCompare(b.name) * dir;
      if (sortField === "category") return (a.category || "").localeCompare(b.category || "") * dir;
      if (sortField === "stock") {
        const aStock = a.stock ?? 999999;
        const bStock = b.stock ?? 999999;
        return (aStock - bStock) * dir;
      }
      return 0;
    });

  // Stats
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= 5).length;
  const unlimited = products.filter((p) => p.stock === null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary} flex items-center gap-2`}>
            <Package className="h-6 w-6 text-blue-500" />
            Контроль остатков
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            Быстрое обновление остатков по всем товарам
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchProducts}
            className={`flex items-center gap-2 px-3 py-2 ${isDark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} rounded-xl ${textSecondary} transition-colors`}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              hasChanges
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90"
                : `${isDark ? "bg-white/5" : "bg-gray-100"} ${textSecondary} cursor-not-allowed`
            } disabled:opacity-50`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? "Сохранено!" : `Сохранить${hasChanges ? ` (${Object.keys(editedStock).length})` : ""}`}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
          <p className={`text-2xl font-bold ${textPrimary}`}>{products.length}</p>
          <p className={`text-xs ${textSecondary}`}>Всего товаров</p>
        </div>
        <div className={`${bgCard} border ${outOfStock > 0 ? "border-red-500/50" : borderColor} rounded-xl p-4`}>
          <p className={`text-2xl font-bold ${outOfStock > 0 ? "text-red-500" : textPrimary}`}>{outOfStock}</p>
          <p className={`text-xs ${textSecondary}`}>Нет в наличии</p>
        </div>
        <div className={`${bgCard} border ${lowStock > 0 ? "border-yellow-500/50" : borderColor} rounded-xl p-4`}>
          <p className={`text-2xl font-bold ${lowStock > 0 ? "text-yellow-500" : textPrimary}`}>{lowStock}</p>
          <p className={`text-xs ${textSecondary}`}>Мало на складе</p>
        </div>
        <div className={`${bgCard} border ${borderColor} rounded-xl p-4`}>
          <p className={`text-2xl font-bold text-blue-500`}>{unlimited}</p>
          <p className={`text-xs ${textSecondary}`}>Без ограничений</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${textSecondary}`} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, SKU, категории..."
          className={`w-full pl-10 pr-4 py-2.5 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-400 rounded-xl text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${borderColor} ${tableBg}`}>
                <th
                  className={`text-left py-3 px-4 text-xs font-medium ${textSecondary} uppercase cursor-pointer select-none`}
                  onClick={() => toggleSort("name")}
                >
                  <span className="flex items-center gap-1">
                    Товар
                    {sortField === "name" && <ArrowUpDown className="h-3 w-3" />}
                  </span>
                </th>
                <th
                  className={`text-left py-3 px-4 text-xs font-medium ${textSecondary} uppercase cursor-pointer select-none`}
                  onClick={() => toggleSort("category")}
                >
                  <span className="flex items-center gap-1">
                    Категория
                    {sortField === "category" && <ArrowUpDown className="h-3 w-3" />}
                  </span>
                </th>
                <th className={`text-right py-3 px-4 text-xs font-medium ${textSecondary} uppercase`}>Цена</th>
                <th
                  className={`text-center py-3 px-4 text-xs font-medium ${textSecondary} uppercase cursor-pointer select-none`}
                  onClick={() => toggleSort("stock")}
                >
                  <span className="flex items-center justify-center gap-1">
                    Остаток
                    {sortField === "stock" && <ArrowUpDown className="h-3 w-3" />}
                  </span>
                </th>
                <th className={`text-center py-3 px-4 text-xs font-medium ${textSecondary} uppercase`}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const currentStock = editedStock[product.id] !== undefined
                  ? editedStock[product.id]
                  : (product.stock?.toString() ?? "");
                const stockNum = currentStock === "" ? null : parseInt(currentStock);
                const isEdited = editedStock[product.id] !== undefined;

                return (
                  <tr key={product.id} className={`border-b ${borderColor} ${hoverBg}`}>
                    <td className="py-3 px-4">
                      <div>
                        <p className={`${textPrimary} font-medium text-sm`}>{product.name}</p>
                        {product.sku && (
                          <p className={`text-xs ${textSecondary}`}>SKU: {product.sku}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-sm ${textSecondary}`}>{product.category || "—"}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-sm ${textPrimary}`}>{product.price.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        value={currentStock}
                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                        placeholder="Без лимита"
                        className={`w-24 mx-auto block px-2 py-1.5 text-center text-sm rounded-lg border ${
                          isEdited
                            ? "border-blue-500 ring-1 ring-blue-500/30"
                            : inputBorder
                        } ${inputBg} ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      {stockNum === null ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>
                          Без лимита
                        </span>
                      ) : stockNum === 0 ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400">
                          Нет в наличии
                        </span>
                      ) : stockNum <= 5 ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500">
                          Мало
                        </span>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full ${isDark ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-600"}`}>
                          В наличии
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className={`text-center py-12 ${textSecondary}`}>
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Товары не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
}
