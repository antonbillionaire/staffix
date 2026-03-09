"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Package, Tag, Search, Upload } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

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
};

export default function ProductsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // CSV Import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; errors?: string[] } | null>(null);
  const [parsingFile, setParsingFile] = useState(false);

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
    setIsModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price.toString(),
      oldPrice: p.oldPrice?.toString() || "",
      stock: p.stock?.toString() || "",
      sku: p.sku || "",
      category: p.category || "",
      tags: p.tags.join(", "),
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
        fetchProducts();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Скрыть товар? Он останется в истории заказов.")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
  };

  const [deletingAll, setDeletingAll] = useState(false);
  const handleDeleteAll = async () => {
    if (!confirm(`Удалить все ${products.length} товаров? Это действие нельзя отменить.`)) return;
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
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      setParsingFile(true);
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
        setImportResult({ message: "Ошибка чтения Excel файла" });
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
      if (data.created > 0) await fetchProducts();
    } catch {
      setImportResult({ message: "Ошибка при импорте" });
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
            <h1 className={`text-2xl font-bold ${text}`}>Товары</h1>
            <p className={`mt-1 text-sm ${sub}`}>
              Каталог товаров для AI-продавца. Добавьте товары — бот сможет их искать и предлагать клиентам.
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
                Удалить все
              </button>
            )}
            <button
              onClick={() => { setIsImportOpen(true); setImportResult(null); setImportCsv(""); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <Upload className="w-4 h-4" />
              Импорт каталога
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Добавить товар
            </button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Всего товаров", value: products.length },
            { label: "Активных", value: products.filter((p) => p.isActive).length },
            { label: "Категорий", value: categories.length },
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
              placeholder="Поиск по названию, артикулу..."
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
              <option value="">Все категории</option>
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
              {products.length === 0 ? "Товары не добавлены" : "Ничего не найдено"}
            </p>
            <p className={`mt-2 text-sm ${sub}`}>
              {products.length === 0
                ? "Добавьте товары и AI-продавец сможет предлагать их клиентам"
                : "Попробуйте изменить фильтры"}
            </p>
            {products.length === 0 && (
              <button onClick={openCreate} className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                Добавить первый товар
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
                {/* Иконка */}
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isDark ? "bg-gray-700" : "bg-gray-100"
                }`}>
                  <Package className={`w-6 h-6 ${sub}`} />
                </div>

                {/* Инфо */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${text}`}>{product.name}</span>
                    {!product.isActive && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                        Скрыт
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
                        {product.stock === 0 ? "Нет в наличии" : `Осталось ${product.stock} шт.`}
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
                    {product.isActive ? "Скрыть" : "Показать"}
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
                {editingProduct ? "Редактировать товар" : "Новый товар"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className={`p-1.5 rounded-lg ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Название */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>
                  Название <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Например: iPhone 15 Pro, Кофе Arabica 250г"
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
              </div>

              {/* Описание */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Краткое описание товара для AI-продавца..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
              </div>

              {/* Цены */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>
                    Цена <span className="text-red-400">*</span>
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
                    Старая цена (скидка)
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
                    Кол-во на складе
                  </label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder="пусто = без ограничений"
                    min="0"
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${text}`}>Артикул (SKU)</label>
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
                <label className={`block text-sm font-medium mb-1 ${text}`}>Категория</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Электроника, Одежда, Косметика..."
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
                  Теги (через запятую)
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="хит, новинка, скидка"
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none ${input}`}
                />
                <p className={`text-xs mt-1 ${sub}`}>AI использует теги при поиске товаров</p>
              </div>
            </div>

            <div className={`flex gap-3 p-5 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? "bg-gray-700 hover:bg-gray-600 text-gray-300" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.price}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingProduct ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${modalBg} border rounded-xl w-full max-w-lg`}>
            <div className="flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}">
              <h3 className={`text-lg font-semibold ${text}`}>Импорт товаров</h3>
              <button onClick={() => setIsImportOpen(false)} className={sub}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className={`text-sm p-3 rounded-lg ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-50 text-gray-600"}`}>
                <p className="font-medium mb-2">Импорт каталога товаров</p>
                <p className="text-xs mb-1"><span className="font-medium">Обязательные поля:</span> Название, Цена</p>
                <p className="text-xs mb-2"><span className="font-medium">Необязательные:</span> Категория, Описание, Остаток, Артикул, Старая цена</p>
                <code className={`text-xs block ${isDark ? "text-green-400" : "text-green-700"}`}>
                  Название;Цена;Категория;Описание;Остаток;Артикул;Старая цена
                </code>
                <code className={`text-xs block mt-1 ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                  iPhone 15;150000;Смартфоны;Новинка 2024;10;IPH15;180000
                </code>
                <p className="mt-2 text-xs">Форматы: .xlsx, .xls, .csv, .txt. Колонки определяются автоматически по заголовкам.</p>
                <p className="mt-1 text-xs opacity-70">Для подробных описаний товаров загрузите документы в Базу знаний (раздел Бот).</p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>Загрузить файл</label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 ${sub}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${text}`}>Или вставьте текст CSV</label>
                <textarea
                  value={importCsv}
                  onChange={(e) => setImportCsv(e.target.value)}
                  rows={5}
                  placeholder={"iPhone 15;150000;Смартфоны\nSamsung S24;130000;Смартфоны\nAirPods Pro;45000;Аксессуары"}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none resize-none ${input}`}
                />
              </div>

              {(parsingFile || importing) && (
                <div className={`flex items-center gap-3 p-4 rounded-lg text-sm font-medium ${isDark ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                  <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                  {parsingFile ? "Чтение файла... Пожалуйста, подождите" : "Импорт данных... Пожалуйста, подождите, не закрывайте окно"}
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
                Закрыть
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !importCsv.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Импортировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
