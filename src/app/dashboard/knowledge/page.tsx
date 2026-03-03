"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { generatePrompt, PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  FileText,
  File,
  Loader2,
  HelpCircle,
  FolderOpen,
  Sparkles,
  Check,
  AlertCircle,
  Sliders,
  Save,
  Wand2,
  Brain,
} from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size: number;
  createdAt: string;
}

type Tab = "personality" | "faq" | "documents";

export default function KnowledgeBasePage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("personality");
  const [loading, setLoading] = useState(true);

  // AI personality state
  const [aiSettings, setAiSettings] = useState({
    tone: "friendly",
    welcomeMessage: "",
    rules: "",
    language: "ru",
    botDisplayName: "",
  });
  const [businessName, setBusinessName] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Bot test state
  const [testMessage, setTestMessage] = useState("");
  const [testReply, setTestReply] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // FAQ state
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({ question: "", answer: "" });

  // AI generation state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState<FAQ[]>([]);
  const [aiSelected, setAiSelected] = useState<Set<number>>(new Set());
  const [aiError, setAiError] = useState("");
  const [aiSaving, setAiSaving] = useState(false);

  // Document state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Theme
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-white";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [businessRes, faqRes, docRes] = await Promise.all([
        fetch("/api/business"),
        fetch("/api/faq"),
        fetch("/api/documents"),
      ]);

      if (businessRes.ok) {
        const data = await businessRes.json();
        if (data.business) {
          setAiSettings({
            tone: data.business.aiTone || "friendly",
            welcomeMessage: data.business.welcomeMessage || "",
            rules: data.business.aiRules || "",
            language: data.business.language || "ru",
            botDisplayName: data.business.botDisplayName || "",
          });
          setBusinessName(data.business.name || "");
        }
      }

      if (faqRes.ok) {
        const data = await faqRes.json();
        setFaqs(data.faqs || []);
      }

      if (docRes.ok) {
        const data = await docRes.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // AI personality handlers
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiTone: aiSettings.tone,
          welcomeMessage: aiSettings.welcomeMessage,
          aiRules: aiSettings.rules,
          language: aiSettings.language,
          botDisplayName: aiSettings.botDisplayName || null,
        }),
      });
      if (!res.ok) throw new Error(t("botPage.saveError"));
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestBot = async () => {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    setTestReply("");
    try {
      const res = await fetch("/api/bot/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestReply(data.reply || "Нет ответа");
      } else {
        setTestReply("Ошибка: сначала сохраните настройки и добавьте хотя бы одну услугу.");
      }
    } catch {
      setTestReply("Ошибка подключения к серверу.");
    } finally {
      setTestLoading(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    setAiSettings({ ...aiSettings, rules: generatePrompt(templateId, businessName) });
  };

  // FAQ handlers
  const openModal = (faq?: FAQ) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({ question: faq.question, answer: faq.answer });
    } else {
      setEditingFaq(null);
      setFormData({ question: "", answer: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingFaq(null);
    setFormData({ question: "", answer: "" });
  };

  const handleSubmitFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        const res = await fetch(`/api/faq/${editingFaq.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const data = await res.json();
          setFaqs(faqs.map((f) => (f.id === editingFaq.id ? data.faq : f)));
        }
      } else {
        const res = await fetch("/api/faq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const data = await res.json();
          setFaqs([...faqs, data.faq]);
        }
      }
    } catch (error) {
      console.error("Error saving FAQ:", error);
    }
    closeModal();
  };

  const deleteFaq = async (id: string) => {
    if (!confirm(t("faqPage.deleteQuestionConfirm"))) return;
    try {
      const res = await fetch(`/api/faq/${id}`, { method: "DELETE" });
      if (res.ok) setFaqs(faqs.filter((f) => f.id !== id));
    } catch (error) {
      console.error("Error deleting FAQ:", error);
    }
  };

  // Document handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");

    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "other");

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: fd,
        });

        if (!res.ok) {
          let errorMsg = "Ошибка загрузки";
          try { const data = await res.json(); errorMsg = data.error || errorMsg; } catch { errorMsg = `Ошибка сервера (${res.status})`; }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        setDocuments((prev) => [data.document, ...prev]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Ошибка загрузки");
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    e.target.value = "";
  };

  const deleteDocument = async (id: string) => {
    if (!confirm(t("faqPage.deleteDocumentConfirm"))) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) setDocuments(documents.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (mimeType: string | undefined, name: string) => {
    const type = mimeType || "";
    const lower = name.toLowerCase();
    if (type.includes("pdf") || lower.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes("word") || lower.endsWith(".doc") || lower.endsWith(".docx")) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.includes("text") || lower.endsWith(".txt")) return <FileText className="h-5 w-5 text-gray-500" />;
    return <File className="h-5 w-5 text-gray-400" />;
  };

  // AI FAQ generation
  const handleAiGenerate = async () => {
    if (!aiDescription.trim() || aiDescription.length < 10) {
      setAiError("Опишите ваш бизнес подробнее");
      return;
    }
    setAiError("");
    setAiGenerating(true);
    setAiGenerated([]);
    setAiSelected(new Set());

    try {
      const res = await fetch("/api/ai/generate-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      const withIds = data.faqs.map((f: { question: string; answer: string }, i: number) => ({
        id: `ai_${i}`,
        question: f.question,
        answer: f.answer,
      }));
      setAiGenerated(withIds);
      setAiSelected(new Set(withIds.map((_: FAQ, i: number) => i)));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiSave = async () => {
    const toSave = aiGenerated.filter((_, i) => aiSelected.has(i));
    if (toSave.length === 0) return;
    setAiSaving(true);
    const saved: FAQ[] = [];
    for (const faq of toSave) {
      try {
        const res = await fetch("/api/faq", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: faq.question, answer: faq.answer }),
        });
        if (res.ok) {
          const data = await res.json();
          saved.push(data.faq);
        }
      } catch { /* skip */ }
    }
    setFaqs((prev) => [...prev, ...saved]);
    setAiSaving(false);
    setAiModalOpen(false);
    setAiGenerated([]);
    setAiDescription("");
    setAiSelected(new Set());
  };

  const toggleAiSelect = (i: number) => {
    setAiSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Brain; count?: number }[] = [
    { id: "personality", label: "AI Личность", icon: Brain },
    { id: "faq", label: "FAQ", icon: HelpCircle, count: faqs.length },
    { id: "documents", label: "Документы", icon: FileText, count: documents.length },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary} mb-2`}>База знаний</h1>
        <p className={textSecondary}>
          Настройте личность AI-сотрудника, добавьте FAQ и загрузите документы
        </p>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? isDark
                  ? "bg-white/10 text-white shadow-sm"
                  : "bg-white text-gray-900 shadow-sm"
                : isDark
                ? "text-gray-500 hover:text-gray-300"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? "bg-blue-500/20 text-blue-400"
                  : isDark ? "bg-white/10 text-gray-500" : "bg-gray-200 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* AI Personality Tab */}
      {activeTab === "personality" && (
        <div className="space-y-6">
          {/* Prompt templates */}
          <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
              <Wand2 className="h-5 w-5 text-yellow-400" />
              {t("botPage.promptTemplates")}
            </h3>
            <p className={`${textSecondary} text-sm mb-4`}>{t("botPage.chooseTemplate")}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={`p-4 border rounded-xl text-left transition-all group ${
                    selectedTemplate === template.id
                      ? "bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30"
                      : `${isDark ? "bg-white/5 hover:bg-white/10 border-white/10" : "bg-gray-50 hover:bg-gray-100 border-gray-200"} hover:border-blue-500/50`
                  }`}
                >
                  <span className="text-2xl block mb-2">{template.icon}</span>
                  <span className={`text-sm font-medium transition-colors ${
                    selectedTemplate === template.id ? "text-blue-400" : `${textPrimary} group-hover:text-blue-400`
                  }`}>
                    {template.name}
                  </span>
                  {selectedTemplate === template.id && (
                    <span className="block text-xs text-blue-400 mt-1">{t("botPage.selected") || "Выбрано"}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* AI Settings */}
          <div className={`${bgCard} rounded-xl border ${borderColor} p-6`}>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-4 flex items-center gap-2`}>
              <Sliders className="h-5 w-5 text-purple-400" />
              {t("botPage.aiPersonality")}
            </h3>
            <div className="space-y-5">
              {/* Tone */}
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-3`}>
                  {t("botPage.communicationStyle")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "friendly", nameKey: "botPage.friendly", emoji: "😊" },
                    { id: "professional", nameKey: "botPage.professional", emoji: "👔" },
                    { id: "casual", nameKey: "botPage.casual", emoji: "😎" },
                  ].map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => setAiSettings({ ...aiSettings, tone: tone.id })}
                      className={`p-2 sm:p-4 rounded-xl border text-center transition-all ${
                        aiSettings.tone === tone.id
                          ? "bg-blue-500/20 border-blue-500/50 text-white"
                          : `${isDark ? "bg-white/5 border-white/10 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600"} hover:border-white/20`
                      }`}
                    >
                      <span className="text-xl sm:text-2xl block mb-1">{tone.emoji}</span>
                      <span className="text-[10px] sm:text-sm leading-tight break-words">{t(tone.nameKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-2`}>Язык бота</label>
                <select
                  value={aiSettings.language}
                  onChange={(e) => setAiSettings({ ...aiSettings, language: e.target.value })}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="uz">O&apos;zbek (Узбекский)</option>
                  <option value="kz">Қазақ (Казахский)</option>
                  <option value="kg">Кыргыз (Кыргызский)</option>
                  <option value="tj">Тоҷикӣ (Таджикский)</option>
                  <option value="am">Հայերեն (Армянский)</option>
                  <option value="ge">ქართული (Грузинский)</option>
                </select>
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"} mt-1`}>
                  Бот будет отвечать на выбранном языке. Если клиент пишет на другом — бот автоматически переключится.
                </p>
              </div>

              {/* Welcome message */}
              <div>
                <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-2`}>
                  {t("botPage.welcomeMessage")}
                </label>
                <textarea
                  value={aiSettings.welcomeMessage}
                  onChange={(e) => setAiSettings({ ...aiSettings, welcomeMessage: e.target.value })}
                  placeholder={t("botPage.welcomePlaceholder")}
                  rows={3}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                />
              </div>

              {/* Rules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    {t("botPage.specialInstructions")}
                  </label>
                  <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>{aiSettings.rules.length} / 2000</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { label: "🚫 Не обсуждать конкурентов", text: "Никогда не упоминай и не обсуждай конкурентов." },
                    { label: "💰 Без скидок", text: "Не давай скидки самостоятельно, направляй к менеджеру." },
                    { label: "📋 Уточнять имя", text: "В начале разговора всегда уточняй имя клиента." },
                    { label: "🌐 Только русский", text: "Отвечай только на русском языке." },
                    { label: "📦 Проверять наличие", text: "Перед оформлением заказа уточняй актуальное наличие товара." },
                    { label: "🎯 Только по теме", text: "Отвечай только на вопросы, связанные с нашим бизнесом. На посторонние темы вежливо отказывай." },
                    { label: "⏰ Время ответа", text: "Если клиент ждёт — сообщай, что ответишь в течение нескольких минут." },
                    { label: "📞 Предлагать звонок", text: "При сложных вопросах предлагай связаться по телефону." },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        const sep = aiSettings.rules && !aiSettings.rules.endsWith("\n") ? "\n" : "";
                        setAiSettings({ ...aiSettings, rules: aiSettings.rules + sep + chip.text });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        isDark
                          ? "bg-white/5 border-white/10 text-gray-400 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-300"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={aiSettings.rules}
                  onChange={(e) => setAiSettings({ ...aiSettings, rules: e.target.value })}
                  placeholder={t("botPage.instructionsPlaceholder")}
                  rows={7}
                  maxLength={2000}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                />
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"} mt-2`}>{t("botPage.rulesHelp")}</p>
              </div>

              {/* Bot display name */}
              <div>
                <label className={`block text-sm font-medium ${textPrimary} mb-2`}>
                  Имя бота
                </label>
                <input
                  type="text"
                  value={aiSettings.botDisplayName}
                  onChange={(e) => setAiSettings({ ...aiSettings, botDisplayName: e.target.value })}
                  placeholder="Например: Алия, Виктор, Ассистент"
                  maxLength={50}
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"} mt-2`}>
                  Бот будет представляться этим именем клиентам. Оставьте пустым для "AI-помощник".
                </p>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className={`w-full ${isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-gray-100 border-gray-200 hover:bg-gray-200"} border ${textPrimary} py-3 px-4 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all`}
              >
                {savingSettings ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t("botPage.saving")}</>
                ) : settingsSaved ? (
                  <><Check className="h-4 w-4 text-green-400" /> {t("botPage.saved")}</>
                ) : (
                  <><Save className="h-4 w-4" /> {t("botPage.saveSettings")}</>
                )}
              </button>

              {/* Test your bot */}
              <div className={`mt-6 p-5 rounded-xl border ${isDark ? "border-blue-500/30 bg-blue-500/5" : "border-blue-200 bg-blue-50/50"}`}>
                <h3 className={`text-sm font-semibold ${textPrimary} mb-3 flex items-center gap-2`}>
                  <Brain className="h-4 w-4 text-blue-500" />
                  Протестируйте бота
                </h3>
                <p className={`text-xs ${textSecondary} mb-3`}>
                  Напишите сообщение как клиент — и посмотрите как бот ответит с текущими настройками.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && testMessage.trim() && !testLoading) {
                        handleTestBot();
                      }
                    }}
                    placeholder="Напишите тестовое сообщение..."
                    className={`flex-1 px-4 py-2.5 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                  />
                  <button
                    onClick={handleTestBot}
                    disabled={testLoading || !testMessage.trim()}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Тест
                  </button>
                </div>
                {testReply && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${isDark ? "bg-white/5 text-gray-300" : "bg-white text-gray-700"} border ${isDark ? "border-white/10" : "border-gray-200"}`}>
                    <p className={`text-xs font-medium ${isDark ? "text-blue-400" : "text-blue-600"} mb-1`}>
                      {aiSettings.botDisplayName || "AI-помощник"}:
                    </p>
                    <p className="whitespace-pre-wrap">{testReply}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Tab */}
      {activeTab === "faq" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("faqPage.faq")}</h2>
              <p className={`text-sm ${textSecondary}`}>{t("faqPage.faqDesc")}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAiModalOpen(true)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 border transition-colors ${
                  isDark
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                    : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                AI генерация
              </button>
              <button
                onClick={() => openModal()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("faqPage.add")}
              </button>
            </div>
          </div>

          <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
            {faqs.length === 0 ? (
              <div className="p-8 text-center">
                <HelpCircle className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                <p className={textSecondary}>{t("faqPage.noQuestions")}</p>
                <p className={`text-sm ${textSecondary} mt-1`}>{t("faqPage.noQuestionsDesc")}</p>
              </div>
            ) : (
              <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                {faqs.map((faq) => (
                  <div key={faq.id} className={`p-4 ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"} transition-colors`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`font-medium ${textPrimary}`}>{faq.question}</h3>
                        <p className={`text-sm ${textSecondary} mt-1`}>{faq.answer}</p>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <button onClick={() => openModal(faq)} className={`${textSecondary} hover:text-blue-500 p-2 transition-colors`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteFaq(faq.id)} className={`${textSecondary} hover:text-red-500 p-2 transition-colors`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("faqPage.documents")}</h2>
              <p className={`text-sm ${textSecondary}`}>{t("faqPage.documentsDesc")}</p>
            </div>
            <div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept=".pdf,.doc,.docx,.txt,.xlsx,.xls" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t("faqPage.uploadFile")}
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {uploadError}
            </div>
          )}

          <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
            {documents.length === 0 ? (
              <div className="p-8 text-center">
                <FolderOpen className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
                <p className={textSecondary}>{t("faqPage.noDocuments")}</p>
                <p className={`text-sm ${textSecondary} mt-1`}>{t("faqPage.noDocumentsDesc")}</p>
              </div>
            ) : (
              <div className={`divide-y ${isDark ? "divide-white/5" : "divide-gray-100"}`}>
                {documents.map((doc) => (
                  <div key={doc.id} className={`flex items-center justify-between p-4 ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"} transition-colors`}>
                    <div className="flex items-center gap-3">
                      {getFileIcon(doc.mimeType, doc.name)}
                      <div>
                        <p className={`font-medium ${textPrimary}`}>{doc.name}</p>
                        <p className={`text-xs ${textSecondary}`}>
                          {formatFileSize(doc.size)} • {new Date(doc.createdAt).toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => deleteDocument(doc.id)} className={`${textSecondary} hover:text-red-500 p-2 transition-colors`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* AI Generation Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${bgCard} rounded-2xl border ${borderColor} w-full max-w-2xl max-h-[90vh] flex flex-col`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <h3 className={`text-lg font-semibold ${textPrimary}`}>AI-генерация FAQ</h3>
              </div>
              <button onClick={() => { setAiModalOpen(false); setAiGenerated([]); setAiError(""); }} className={`${textSecondary} hover:${textPrimary}`}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Опишите ваш бизнес</label>
                <textarea
                  rows={4}
                  value={aiDescription}
                  onChange={(e) => { setAiDescription(e.target.value); setAiError(""); }}
                  placeholder="Например: Салон красоты в Алматы, услуги маникюра, педикюра, наращивания ресниц..."
                  className={`w-full px-4 py-3 ${inputBg} border ${inputBorder} rounded-xl ${textPrimary} resize-none text-sm focus:outline-none focus:ring-2 focus:ring-purple-500`}
                />
                {aiError && <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{aiError}</p>}
              </div>
              {aiGenerated.length === 0 && (
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || aiDescription.length < 10}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {aiGenerating ? <><Loader2 className="h-4 w-4 animate-spin" />AI генерирует...</> : <><Sparkles className="h-4 w-4" />Сгенерировать FAQ</>}
                </button>
              )}
              {aiGenerated.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${textPrimary}`}>Сгенерировано {aiGenerated.length} вопросов:</p>
                    <button onClick={() => aiSelected.size === aiGenerated.length ? setAiSelected(new Set()) : setAiSelected(new Set(aiGenerated.map((_, i) => i)))} className="text-sm text-purple-400 hover:text-purple-300">
                      {aiSelected.size === aiGenerated.length ? "Снять все" : "Выбрать все"}
                    </button>
                  </div>
                  {aiGenerated.map((faq, i) => (
                    <div key={i} onClick={() => toggleAiSelect(i)} className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      aiSelected.has(i)
                        ? isDark ? "bg-purple-500/10 border-purple-500/40" : "bg-purple-50 border-purple-300"
                        : isDark ? "bg-white/3 border-white/8 hover:bg-white/5" : "bg-gray-50 border-gray-200 hover:border-gray-300"
                    }`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          aiSelected.has(i) ? "bg-purple-500 border-purple-500" : isDark ? "border-white/20" : "border-gray-300"
                        }`}>
                          {aiSelected.has(i) && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${textPrimary}`}>{faq.question}</p>
                          <p className={`text-sm ${textSecondary} mt-1`}>{faq.answer}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={handleAiGenerate} disabled={aiGenerating} className={`w-full py-2 rounded-xl text-sm border ${isDark ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {aiGenerating ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Генерирую...</span> : "↻ Сгенерировать заново"}
                  </button>
                </div>
              )}
            </div>
            {aiGenerated.length > 0 && (
              <div className={`px-6 py-4 border-t ${borderColor} flex items-center justify-between gap-3`}>
                <p className={`text-sm ${textSecondary}`}>Выбрано: <strong className={textPrimary}>{aiSelected.size}</strong> из {aiGenerated.length}</p>
                <div className="flex gap-3">
                  <button onClick={() => { setAiModalOpen(false); setAiGenerated([]); }} className={`px-4 py-2 rounded-lg border text-sm font-medium ${textSecondary} ${isDark ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"}`}>Отмена</button>
                  <button onClick={handleAiSave} disabled={aiSaving || aiSelected.size === 0} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                    {aiSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Сохраняю...</> : <><Check className="h-4 w-4" />Сохранить {aiSelected.size} вопросов</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAQ Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl border ${borderColor} p-6 w-full max-w-md mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                {editingFaq ? t("faqPage.editQuestion") : t("faqPage.newQuestion")}
              </h3>
              <button onClick={closeModal} className={`${textSecondary} hover:${textPrimary}`}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmitFaq} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>{t("faqPage.question")}</label>
                <input type="text" required value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })} placeholder={t("faqPage.questionPlaceholder")} className={`w-full px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>{t("faqPage.answer")}</label>
                <textarea required rows={3} value={formData.answer} onChange={(e) => setFormData({ ...formData, answer: e.target.value })} placeholder={t("faqPage.answerPlaceholder")} className={`w-full px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg ${textPrimary} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className={`flex-1 px-4 py-2 border ${inputBorder} rounded-lg font-medium ${textSecondary} hover:bg-white/5`}>{t("faqPage.cancel")}</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90">{editingFaq ? t("faqPage.save") : t("faqPage.add")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
