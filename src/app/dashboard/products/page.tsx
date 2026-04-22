"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Package, Tag, Search, Upload, ImagePlus } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  stock: number | null;
  sku: string | null;
  category: string | null;
  tags: string[];
  imageUrl: string | null;
  productUrl: string | null;
  isActive: boolean;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  oldPrice: "",
  stock: "",
  sku: "",
  category: "",
  tags: "",
  imageUrl: "",
  productUrl: "",
};

export default function ProductsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState("");

  // CSV Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; errors?: string[] } | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Preview state
  const [previewData, setPreviewData] = useState<{
    hasHeader: boolean;
    usePositional: boolean;
    totalRows: number;
    mapping: Array<{ field: string; label: string; columnIndex: number; headerName: string }>;
    sampleRows: Array<Record<string, string>>;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    const matchCat = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setSaveError("");
    setIsModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setSaveError("");
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price.toString(),
      oldPrice: p.oldPrice?.toString() || "",
      stock: p.stock?.toString() || "",
      sku: p.sku || "",
      category: p.category || "",
      tags: p.tags.join(", "),
      imageUrl: p.imageUrl || "",
      productUrl: p.productUrl || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        oldPrice: form.oldPrice ? parseFloat(form.oldPrice) : null,
        stock: form.stock !== "" ? parseInt(form.stock) : null,
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        imageUrl: form.imageUrl.trim() || null,
        productUrl: form.productUrl.trim() || null,
        isActive: true,
      };

      const res = editingProduct
        ? await fetch(`/api/products/${editingProduct.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        setIsModalOpen(false);
        setSaveError("");
        fetchProducts();
      } else {
        const data = await res.json();
        setSaveError(data.error || t("products.saveError"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("products.confirmHide"))) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
  };

  const [deletingAll, setDeletingAll] = useState(false);
  const handleDeleteAll = async () => {
    if (!confirm(t("products.confirmDeleteAll").replace("{count}", String(products.length)))) return;
    setDeletingAll(true);
    try {
      await fetch("/api/products/bulk-delete", { method: "DELETE" });
      await fetchProducts();
    } finally {
      setDeletingAll(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewData(null);
    setImportResult(null);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      // PDF: send to backend for AI-powered extraction
      setParsingFile(true);
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const res = await fetch("/api/import/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfBase64: base64, preview: true }),
        });
        const data = await res.json();
        if (data.preview) {
          setPreviewData(data);
          // Reconstruct CSV for import step
          const headerRow = data.mapping.map((m: { headerName: string }) => m.headerName).join(";");
          const dataRows = (data.sampleRows as Record<string, string>[]).map((r: Record<string, string>) =>
            data.mapping.map((m: { field: string }) => r[m.field] || "").join(";")
          );
          setImportCsv(headerRow + "\n" + dataRows.join("\n"));
        } else if (data.error) {
          setImportResult({ message: data.error });
        }
      } catch {
        setImportResult({ message: t("products.importError") });
      } finally {
        setParsingFile(false);
      }
    } else if (ext === "xlsx" || ext === "xls") {
      setParsingFile(true);
      try {
        const mod = await import("xlsx");
        const XLSX = mod.default || mod;
        const buf = await file.arrayBuffer();
        const data = new Uint8Array(buf);
        const wb = XLSX.read(data, { type: "array" });
        // Parse ALL sheets, not just the first one
        const csvParts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";", rawNumbers: true });
          if (csv.trim()) csvParts.push(csv);
        }
        setImportCsv(csvParts.join("\n"));
      } catch {
        setImportResult({ message: t("products.excelReadError") });
      } finally {
        setParsingFile(false);
      }
    } else {
      // CSV/TXT: read as text
      const reader = new FileReader();
      reader.onload = (ev) => setImportCsv((ev.target?.result as string) || "");
      reader.readAsText(file, "utf-8");
    }
  };

  const handlePreview = async () => {
    if (!importCsv.trim()) return;
    setLoadingPreview(true);
    setImportResult(null);
    setPreviewData(null);
    try {
      const res = await fetch("/api/import/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv, preview: true }),
      });
      const data = await res.json();
      if (data.preview) {
        setPreviewData(data);
      } else {
        setImportResult({ message: data.error || t("products.previewError") });
      }
    } catch {
      setImportResult({ message: t("products.analyzeError") });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!importCsv.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/import/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();
      setImportResult({ message: data.message || data.error, errors: data.errors });
      setPreviewData(null);
      if (data.created > 0) await fetchProducts();
    } catch {
      setImportResult({ message: t("products.importError") });
    } finally {
      setImporting(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    fetchProducts();
  };

  // Стили
  const bg = isDark ? "bg-gray-900" : "bg-gray-50";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-gray-400" : "text-gray-500";
  const input = isDark
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500";
  const modalBg = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${bg}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`${bg} min-h-screen p-6`}>
      <div className="max-w-5xl mx-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${text}`}>{t("products.title")}</h1>
            <p className={`mt-1 text-sm ${sub}`}>
              {t("products.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            {products.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${isDark ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-300 text-red-600 hover:bg-red-50"} disabled:opacity-50`}
              >
                {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t("products.deleteAll")}
              </button>
            )}
            <button
              onClick={() => { setIsImportOpen(true); setImportResult(null); setImportCsv(""); setPreviewData(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <Upload className="w-4 h-4" />
              {t("products.importCatalog")}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t("products.addProduct")}
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: t("products.totalProducts"), value: products.length },
            { label: t("products.activeProducts"), value: products.filter((p) => p.isActive).length },
            { label: t("products.categoriesCount"), value: categories.length },
          ].map((stat) => (
            <div key={stat.label} className={`${card} border rounded-xl p-4`}>
              <p className={`text-2xl font-bold ${text}`}>{stat.value}</p>
              <p className={`text-sm ${sub}`}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Фильтры */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${sub}`} />
            <input
              type="text"
              placeholder={t("products.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none ${input}`}
            />
          </div>
          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
            >
              <option value="">{t("products.allCategories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Список товаров */}
        {filtered.length === 0 ? (
          <div className={`${card} border rounded-xl p-12 text-center`}>
            <Package className={`w-12 h-12 mx-auto mb-4 ${sub}`} />
            <p className={`text-lg font-medium ${text}`}>
              {products.length === 0 ? t("products.noProducts") : t("products.nothingFound")}
            </p>
            <p className={`mt-2 text-sm ${sub}`}>
              {products.length === 0
                ? t("products.noProductsHint")
                : t("products.tryChangeFilters")}
            </p>
            {products.length === 0 && (
              <button onClick={openCreate} className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                {t("products.addFirstProduct")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((product) => (
              <div
                key={product.id}
                className={`${card} border rounded-xl p-4 flex items-center gap-4 ${!product.isActive ? "opacity-60" : ""}`}
              >
                {/* Фото или иконка */}
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isDark ? "bg-gray-700" : "bg-gray-100"
                  }`}>
                    <Package className={`w-6 h-6 ${sub}`} />
                  </div>
                )}

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${text}`}>{product.name}</span>
                    {!product.isActive && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                        {t("products.hidden")}
                      </span>
                    )}
                    {product.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                        {product.category}
                      </span>
                    )}
                    {product.stock !== null && product.stock <= 5 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        product.stock === 0
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-500"
                      }`}>
                        {product.stock === 0 ? t("products.outOfStock") : t("products.remainingStock").replace("{count}", String(product.stock))}
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className={`text-sm mt-0.5 truncate ${sub}`}>{product.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`font-semibold ${text}`}>
                      {product.price.toLocaleString("ru-RU")}
                    </span>
                    {product.oldPrice && (
                      <span className={`text-sm line-through ${sub}`}>
                        {product.oldPrice.toLocaleString("ru-RU")}
                      </span>
                    )}
                    {product.sku && (
                      <span className={`text-xs ${sub}`}>SKU: {product.sku}</span>
                    )}
                    {product.tags.length > 0 && (
                      <span className={`text-xs ${sub}`}>#{product.tags.join(" #")}</span>
                    )}
                  </div>
                </div>

                {/* Кнопки */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(product)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      product.isActive
                        ? isDark
                          ? "border-gray-600 hover:border-gray-500 text-gray-300"
                          : "border-gray-300 hover:border-gray-400 text-gray-600"
                        : "border-green-500/50 text-green-400 hover:bg-green-500/10"
                    }`}
                  >
                    {product.isActive ? t("products.hide") : t("products.show")}
                  </button>
                  <button
                    onClick={() => openEdit(product)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-red-900/30 text-gray-400 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500"}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========== МОДАЛКА ========== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`${modalBg} border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              <h2 className={`text-lg font-semibold ${text}`}>
                {editingProduct ? t("products.editProduct") : t("products.newProduct")}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {saveError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                  {saveError}
                </div>
              )}
              {/* Название */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  {t("products.nameLabel")} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("products.namePlaceholder")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
              </div>

              {/* Описание */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>{t("products.descriptionLabel")}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("products.descriptionPlaceholder")}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
              </div>

              {/* Цены */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>
                    {t("products.priceLabel")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="25000"
                    min="0"
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>
                    {t("products.oldPriceLabel")}
                  </label>
                  <input
                    type="number"
                    value={form.oldPrice}
                    onChange={(e) => setForm((f) => ({ ...f, oldPrice: e.target.value }))}
                    placeholder="35000"
                    min="0"
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                  />
                </div>
              </div>

              {/* Наличие + Артикул */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>
                    {t("products.stockLabel")}
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder={t("products.stockPlaceholder")}
                    min="0"
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>{t("products.skuLabel")}</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="SKU-001"
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                  />
                </div>
              </div>

              {/* Категория */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>{t("products.categoryLabel")}</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder={t("products.categoryPlaceholder")}
                  list="categories-list"
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
                <datalist id="categories-list">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>

              {/* Теги */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  {t("products.tagsLabel")}
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder={t("products.tagsPlaceholder")}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
                <p className={`text-xs mt-1 ${sub}`}>{t("products.tagsHint")}</p>
              </div>

              {/* Фото товара */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  {t("products.imageLabel") || "Фото товара"}
                </label>
                <div className="flex gap-3 items-start">
                  {form.imageUrl ? (
                    <div className="relative flex-shrink-0">
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        className="w-20 h-20 rounded-lg object-cover border"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer flex-shrink-0 hover:border-blue-400 transition-colors ${isDark ? "border-gray-600 hover:bg-gray-700" : "border-gray-300 hover:bg-gray-50"}`}>
                      {uploadingImage ? (
                        <Loader2 className={`w-6 h-6 animate-spin ${sub}`} />
                      ) : (
                        <>
                          <ImagePlus className={`w-5 h-5 ${sub}`} />
                          <span className={`text-[10px] mt-1 ${sub}`}>Фото</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            setSaveError("Файл слишком большой. Максимум 5 МБ");
                            return;
                          }
                          setUploadingImage(true);
                          setSaveError("");
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload/image", { method: "POST", body: fd });
                            const data = await res.json();
                            if (data.url) {
                              setForm((f) => ({ ...f, imageUrl: data.url }));
                            } else {
                              setSaveError(data.error || "Ошибка загрузки фото");
                            }
                          } catch {
                            setSaveError("Ошибка загрузки фото");
                          } finally {
                            setUploadingImage(false);
                          }
                        }}
                      />
                    </label>
                  )}
                  <div className="flex-1">
                    <input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                      placeholder={t("products.imagePlaceholder") || "Или вставьте ссылку на фото"}
                      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                    />
                    <p className={`text-xs mt-1 ${sub}`}>
                      {t("products.imageHint") || "Загрузите фото или вставьте URL"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ссылка на товар */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  {t("products.productUrlLabel") || "Ссылка на товар"}
                </label>
                <input
                  type="url"
                  value={form.productUrl}
                  onChange={(e) => setForm((f) => ({ ...f, productUrl: e.target.value }))}
                  placeholder={t("products.productUrlPlaceholder") || "https://shop.uz/product/123"}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
                <p className={`text-xs mt-1 ${sub}`}>
                  {t("products.productUrlHint") || "Бот отправит ссылку клиенту вместе с описанием товара"}
                </p>
              </div>
            </div>

            <div className={`flex gap-3 p-5 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                {t("products.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.price}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingProduct ? t("products.save") : t("products.add")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${modalBg} border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}">
              <h3 className={`text-lg font-semibold ${text}`}>{t("products.importTitle")}</h3>
              <button onClick={() => setIsImportOpen(false)} className={sub}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className={`text-sm p-3 rounded-lg ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-600"}`}>
                <p className="font-medium mb-2">{t("products.importCatalogTitle")}</p>
                <p className="text-xs mb-1"><span className="font-medium">{t("products.requiredFields")}</span> {t("products.requiredFieldsList")}</p>
                <p className="text-xs mb-2"><span className="font-medium">{t("products.optionalFields")}</span> {t("products.optionalFieldsList")}</p>
                <code className={`text-xs block ${isDark ? "text-green-400" : "text-green-700"}`}>
                  {t("products.csvHeaderExample")}
                </code>
                <code className={`text-xs block mt-1 ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                  {t("products.csvRowExample")}
                </code>
                <p className="mt-2 text-xs">{t("products.importFormats")}</p>
                <p className="mt-1 text-xs opacity-70">{t("products.importKnowledgeHint")}</p>
              </div>

              {/* Import from URL */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  {t("products.importFromUrl") || "Импорт с сайта (URL)"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://shop.uz/catalog"
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                    id="import-url-input"
                  />
                  <button
                    onClick={async () => {
                      const urlInput = document.getElementById("import-url-input") as HTMLInputElement;
                      const url = urlInput?.value?.trim();
                      if (!url) return;
                      setParsingFile(true);
                      setImportResult(null);
                      setPreviewData(null);
                      try {
                        const res = await fetch("/api/import/products", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ importUrl: url, preview: true }),
                        });
                        const data = await res.json();
                        if (data.preview) {
                          setPreviewData(data);
                          const headerRow = data.mapping.map((m: { headerName: string }) => m.headerName).join(";");
                          const dataRows = (data.sampleRows as Record<string, string>[]).map((r: Record<string, string>) =>
                            data.mapping.map((m: { field: string }) => r[m.field] || "").join(";")
                          );
                          setImportCsv(headerRow + "\n" + dataRows.join("\n"));
                        } else {
                          setImportResult({ message: data.error || "Failed to import" });
                        }
                      } catch {
                        setImportResult({ message: t("products.importError") });
                      } finally {
                        setParsingFile(false);
                      }
                    }}
                    disabled={parsingFile}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                  >
                    {t("products.extractProducts") || "Извлечь"}
                  </button>
                </div>
                <p className={`text-xs mt-1 ${sub}`}>
                  {t("products.importUrlHint") || "AI извлечёт товары и цены с указанной страницы"}
                </p>
              </div>

              <div className={`text-center text-xs ${sub}`}>— {t("products.or") || "или"} —</div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>{t("products.uploadFile")}</label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls,.pdf"
                  onChange={handleFileUpload}
                  className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 ${sub}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>{t("products.orPasteCsv")}</label>
                <textarea
                  value={importCsv}
                  onChange={(e) => { setImportCsv(e.target.value); setPreviewData(null); }}
                  rows={5}
                  placeholder={t("products.csvPlaceholder")}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none resize-none ${input}`}
                />
              </div>

              {(parsingFile || importing || loadingPreview) && (
                <div className={`flex items-center gap-3 p-4 rounded-lg text-sm font-medium ${isDark ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                  <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                  {parsingFile ? t("products.readingFile") : loadingPreview ? t("products.analyzingData") : t("products.importingData")}
                </div>
              )}

              {/* Preview: column mapping + sample rows */}
              {previewData && (
                <div className={`p-3 rounded-lg text-sm space-y-3 ${isDark ? "bg-blue-500/10 border border-blue-500/20" : "bg-blue-50 border border-blue-200"}`}>
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${isDark ? "text-blue-300" : "text-blue-800"}`}>
                      {t("products.rowsFound").replace("{count}", String(previewData.totalRows))}
                      {previewData.usePositional && ` (${t("products.noHeadersDetected")})`}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className={`text-xs font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>{t("products.columnMapping")}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewData.mapping.map((m) => (
                        <span key={m.field} className={`text-xs px-2 py-1 rounded ${isDark ? "bg-gray-700 text-gray-300" : "bg-white text-gray-700 border border-gray-200"}`}>
                          <span className="font-medium">{m.label}</span>
                          <span className={`mx-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>&larr;</span>
                          <span className={isDark ? "text-gray-400" : "text-gray-500"}>{m.headerName}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <p className={`text-xs font-medium mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{t("products.sampleRows").replace("{count}", String(previewData.sampleRows.length))}:</p>
                    <table className={`w-full text-xs ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      <thead>
                        <tr>
                          {previewData.mapping.map((m) => (
                            <th key={m.field} className={`text-left p-1.5 font-medium ${isDark ? "border-b border-gray-700" : "border-b border-gray-200"}`}>
                              {m.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.sampleRows.map((row, i) => (
                          <tr key={i}>
                            {previewData.mapping.map((m) => (
                              <td key={m.field} className={`p-1.5 max-w-[150px] truncate ${isDark ? "border-b border-gray-700/50" : "border-b border-gray-100"}`}>
                                {row[m.field] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult && (
                <div className={`p-3 rounded-lg text-sm ${importResult.errors && importResult.errors.length > 0 ? (isDark ? "bg-yellow-500/10 text-yellow-300" : "bg-yellow-50 text-yellow-800") : (isDark ? "bg-green-500/10 text-green-300" : "bg-green-50 text-green-800")}`}>
                  <p className="font-medium">{importResult.message}</p>
                  {importResult.errors?.map((e, i) => (
                    <p key={i} className="text-xs mt-1">• {e}</p>
                  ))}
                </div>
              )}
            </div>

            <div className={`flex gap-3 p-5 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              <button
                onClick={() => setIsImportOpen(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                {t("products.close")}
              </button>
              {!previewData ? (
                <button
                  onClick={handlePreview}
                  disabled={loadingPreview || !importCsv.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {loadingPreview && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("products.checkData")}
                </button>
              ) : (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("products.importCount").replace("{count}", String(previewData.totalRows))}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
