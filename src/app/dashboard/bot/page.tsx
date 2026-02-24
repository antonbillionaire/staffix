"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Loader2,
  Sparkles,
  Sliders,
  Save,
  Upload,
  FileText,
  X,
  Wand2,
  Image,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AIEmployeePage() {
  const { t } = useLanguage();
  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [loading, setLoading] = useState(true);

  // Bot connection info
  const [botInfo, setBotInfo] = useState({
    connected: false,
    username: "",
    name: "",
  });

  // AI personality settings
  const [aiSettings, setAiSettings] = useState({
    tone: "friendly",
    welcomeMessage: "",
    rules: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<Array<{id: string; name: string; size: number; url: string}>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");


  // Selected template tracking
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Payment settings
  const [paymentSettings, setPaymentSettings] = useState({
    paymeId: "",
    clickServiceId: "",
    clickMerchantId: "",
    kaspiPayLink: "",
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // WhatsApp settings
  const [waSettings, setWaSettings] = useState({
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    active: false,
  });
  const [savingWa, setSavingWa] = useState(false);
  const [waSaved, setWaSaved] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  // Facebook Messenger settings
  const [fbSettings, setFbSettings] = useState({
    pageId: "",
    pageAccessToken: "",
    verifyToken: "",
    active: false,
  });
  const [savingFb, setSavingFb] = useState(false);
  const [fbSaved, setFbSaved] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);

  // Business ID for webhook URLs
  const [businessId, setBusinessId] = useState("");

  // Prompt templates
  const promptTemplates = [
    {
      id: "salon",
      nameKey: "botPage.beautySalon",
      icon: "💇",
      promptKey: "botPage.templateSalon",
    },
    {
      id: "clinic",
      nameKey: "botPage.medicalClinic",
      icon: "🏥",
      promptKey: "botPage.templateClinic",
    },
    {
      id: "restaurant",
      nameKey: "botPage.restaurant",
      icon: "🍽️",
      promptKey: "botPage.templateRestaurant",
    },
    {
      id: "fitness",
      nameKey: "botPage.fitnessClub",
      icon: "🏋️",
      promptKey: "botPage.templateFitness",
    },
    {
      id: "auto",
      nameKey: "botPage.autoService",
      icon: "🚗",
      promptKey: "botPage.templateAuto",
    },
    {
      id: "shop",
      nameKey: "botPage.onlineShop",
      icon: "🛒",
      promptKey: "botPage.templateShop",
    },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch business data
        const businessRes = await fetch("/api/business");
        if (businessRes.ok) {
          const data = await businessRes.json();
          if (data.business) {
            if (data.business.botToken) {
              setToken(data.business.botToken);
              setBotInfo({
                connected: data.business.botActive || false,
                username: data.business.botUsername || "",
                name: data.business.name || "",
              });
            }
            setAiSettings({
              tone: data.business.aiTone || "friendly",
              welcomeMessage: data.business.welcomeMessage || "",
              rules: data.business.aiRules || "",
            });
            setPaymentSettings({
              paymeId: data.business.paymeId || "",
              clickServiceId: data.business.clickServiceId || "",
              clickMerchantId: data.business.clickMerchantId || "",
              kaspiPayLink: data.business.kaspiPayLink || "",
            });
            setBusinessId(data.business.id || "");
            setWaSettings({
              phoneNumberId: data.business.waPhoneNumberId || "",
              accessToken: "", // masked in GET, don't show
              verifyToken: data.business.waVerifyToken || "",
              active: data.business.waActive || false,
            });
            setFbSettings({
              pageId: data.business.fbPageId || "",
              pageAccessToken: "", // masked in GET
              verifyToken: data.business.fbVerifyToken || "",
              active: data.business.fbActive || false,
            });
          }
        }

        // Fetch uploaded documents
        const docsRes = await fetch("/api/documents");
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setUploadedFiles(docsData.documents || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveToken = async () => {
    if (!token.trim()) {
      setTokenError(t("botPage.enterToken"));
      return;
    }

    setSavingToken(true);
    setTokenError("");

    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("botPage.saveError"));
      }

      // Обновляем UI с данными из ответа
      if (data.business) {
        setBotInfo({
          connected: data.business.botActive || false,
          username: data.business.botUsername || "",
          name: data.business.name || "",
        });
      }

      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 3000);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : t("botPage.saveError"));
    } finally {
      setSavingToken(false);
    }
  };

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
        }),
      });

      if (!res.ok) {
        throw new Error(t("botPage.saveError"));
      }

      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError("");

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "other");

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          let errorMsg = t("botPage.saveError");
          try {
            const data = await res.json();
            errorMsg = data.error || errorMsg;
          } catch {
            errorMsg = `Ошибка сервера (${res.status})`;
          }
          throw new Error(errorMsg);
        }

        const data = await res.json();
        setUploadedFiles(prev => [data.document, ...prev]);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : t("botPage.saveError"));
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const removeFile = async (documentId: string) => {
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      if (res.ok) {
        setUploadedFiles(uploadedFiles.filter((f) => f.id !== documentId));
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const applyTemplate = (templateId: string, promptKey: string) => {
    setSelectedTemplate(templateId);
    setAiSettings({ ...aiSettings, rules: t(promptKey) });
  };

  const handleSavePayment = async () => {
    setSavingPayment(true);
    try {
      const res = await fetch("/api/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentSettings),
      });
      if (res.ok) {
        setPaymentSaved(true);
        setTimeout(() => setPaymentSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Status card */}
      <div className={`rounded-xl p-6 border ${
        botInfo.connected
          ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30"
          : "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            botInfo.connected
              ? "bg-green-500/20"
              : "bg-gradient-to-br from-blue-500 to-purple-600"
          }`}>
            <Brain className={`h-7 w-7 ${botInfo.connected ? "text-green-400" : "text-white"}`} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {botInfo.connected ? t("botPage.aiActive") : t("botPage.activateAI")}
            </h2>
            <p className="text-gray-400 text-sm">
              {botInfo.connected
                ? `@${botInfo.username} ${t("botPage.readyToRespond")}`
                : t("botPage.connectToStart")}
            </p>
          </div>
          {botInfo.connected && (
            <div className="ml-auto flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-400 text-sm font-medium">{t("botPage.online247")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      {!botInfo.connected && (
        <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            {t("botPage.howToCreate")}
          </h3>

          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="text-white font-medium">{t("botPage.step1")}</p>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
                >
                  {t("botPage.openBotFather")} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="text-white font-medium">{t("botPage.step2")}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg text-sm text-gray-300">/newbot</code>
                  <button
                    onClick={() => copyToClipboard("/newbot")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="text-white font-medium">{t("botPage.step3")}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {t("botPage.step3Desc")}
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                <p className="text-white font-medium">{t("botPage.step4")}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {t("botPage.step4Desc")}
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                5
              </span>
              <div>
                <p className="text-white font-medium">{t("botPage.step5")}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {t("botPage.step5Desc")}
                </p>
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* Token input */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {botInfo.connected ? t("botPage.connectedBot") : t("botPage.botToken")}
        </h3>

        {tokenError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {tokenError}
          </div>
        )}

        {botInfo.connected ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">{t("botPage.botConnected")}</p>
                <p className="text-gray-400 text-sm">@{botInfo.username}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {t("botPage.pasteToken")}
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <button
              onClick={handleSaveToken}
              disabled={savingToken || !token.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {savingToken ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("botPage.connecting")}
                </>
              ) : tokenSaved ? (
                <>
                  <Check className="h-4 w-4" />
                  {t("botPage.connected")}
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  {t("botPage.activateButton")}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Prompt templates */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-yellow-400" />
          {t("botPage.promptTemplates")}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          {t("botPage.chooseTemplate")}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {promptTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template.id, template.promptKey)}
              className={`p-4 border rounded-xl text-left transition-all group ${
                selectedTemplate === template.id
                  ? "bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30"
                  : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-blue-500/50"
              }`}
            >
              <span className="text-2xl block mb-2">{template.icon}</span>
              <span className={`text-sm font-medium transition-colors ${
                selectedTemplate === template.id
                  ? "text-blue-400"
                  : "text-white group-hover:text-blue-400"
              }`}>
                {t(template.nameKey)}
              </span>
              {selectedTemplate === template.id && (
                <span className="block text-xs text-blue-400 mt-1">{t("botPage.selected") || "Выбрано"}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* File upload */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-green-400" />
          {t("botPage.knowledgeBase")}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          {t("botPage.uploadDocs")}
        </p>

        <label className="block">
          <div className="border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors">
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-blue-400 animate-spin mb-3" />
                <p className="text-gray-400">{t("botPage.uploading")}</p>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                <p className="text-white font-medium">{t("botPage.clickToUpload")}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {t("botPage.fileFormats")}
                </p>
              </>
            )}
          </div>
        </label>

        {uploadError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {uploadError}
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-400" />
                  <div>
                    <p className="text-sm text-white">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bot avatar instructions */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Image className="h-5 w-5 text-pink-400" />
          Аватарка бота
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Чтобы установить аватарку бота в Telegram, используйте @BotFather:
        </p>
        <div className="bg-white/5 rounded-lg p-4 space-y-2 text-sm text-gray-300">
          <p>1. Откройте <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@BotFather</a> в Telegram</p>
          <p>2. Отправьте <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">/mybots</code></p>
          <p>3. Выберите вашего бота</p>
          <p>4. Edit Bot → Edit Botpic</p>
          <p>5. Отправьте картинку</p>
        </div>
      </div>

      {/* AI Personality settings */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Sliders className="h-5 w-5 text-purple-400" />
          {t("botPage.aiPersonality")}
        </h3>

        <div className="space-y-5">
          {/* Tone selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
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
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-xl sm:text-2xl block mb-1">{tone.emoji}</span>
                  <span className="text-[10px] sm:text-sm leading-tight break-words">{t(tone.nameKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Welcome message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t("botPage.welcomeMessage")}
            </label>
            <textarea
              value={aiSettings.welcomeMessage}
              onChange={(e) => setAiSettings({ ...aiSettings, welcomeMessage: e.target.value })}
              placeholder={t("botPage.welcomePlaceholder")}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Rules / Prompt Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">
                {t("botPage.specialInstructions")}
              </label>
              <span className="text-xs text-gray-500">{aiSettings.rules.length} / 2000</span>
            </div>

            {/* Quick-insert chips */}
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
                  className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-300 transition-colors"
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
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              {t("botPage.rulesHelp")}
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="w-full bg-white/5 border border-white/10 text-white py-3 px-4 rounded-xl font-medium hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {savingSettings ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("botPage.saving")}
              </>
            ) : settingsSaved ? (
              <>
                <Check className="h-4 w-4 text-green-400" />
                {t("botPage.saved")}
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {t("botPage.saveSettings")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 overflow-hidden">
        <button
          onClick={() => setPaymentOpen(!paymentOpen)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-green-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">💳 Приём оплаты</h3>
              <p className="text-sm text-gray-400">Payme, Click, Kaspi — клиент платит прямо в Telegram</p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${paymentOpen ? "rotate-180" : ""}`} />
        </button>

        {paymentOpen && (
          <div className="px-6 pb-6 space-y-5 border-t border-white/5 pt-5">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm text-green-300">
              Введите свои ID из личных кабинетов Payme/Click — и бот будет автоматически отправлять кнопки оплаты клиентам после каждого заказа.
            </div>

            {/* Payme */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Payme Merchant ID
              </label>
              <input
                type="text"
                value={paymentSettings.paymeId}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, paymeId: e.target.value })}
                placeholder="6505e7cb3e9d89693d95eef5"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">Найдите в личном кабинете Payme → Настройки → Мерчант ID</p>
            </div>

            {/* Click */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Click Service ID
                </label>
                <input
                  type="text"
                  value={paymentSettings.clickServiceId}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, clickServiceId: e.target.value })}
                  placeholder="12345"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Click Merchant ID
                </label>
                <input
                  type="text"
                  value={paymentSettings.clickMerchantId}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, clickMerchantId: e.target.value })}
                  placeholder="67890"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 -mt-3">Найдите в личном кабинете my.click.uz → Мои сервисы</p>

            {/* Kaspi */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Kaspi Pay ссылка
              </label>
              <input
                type="url"
                value={paymentSettings.kaspiPayLink}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, kaspiPayLink: e.target.value })}
                placeholder="https://kaspi.kz/pay/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">Ваша персональная ссылка Kaspi для получения оплаты</p>
            </div>

            <button
              onClick={handleSavePayment}
              disabled={savingPayment}
              className="w-full bg-green-600/20 border border-green-500/30 text-green-300 py-3 px-4 rounded-xl font-medium hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {savingPayment ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Сохраняем...</>
              ) : paymentSaved ? (
                <><Check className="h-4 w-4" /> Сохранено!</>
              ) : (
                <><Save className="h-4 w-4" /> Сохранить настройки оплаты</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── WhatsApp ────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setWaOpen(!waOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center">
              <span className="text-green-400 text-lg">💬</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-white">WhatsApp Business API</p>
              <p className="text-xs text-gray-500">
                {waSettings.active ? (
                  <span className="text-green-400">● Активен</span>
                ) : waSettings.phoneNumberId ? (
                  <span className="text-yellow-400">● Настроен, не активен</span>
                ) : (
                  "Подключите WhatsApp к вашему боту"
                )}
              </p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${waOpen ? "rotate-180" : ""}`} />
        </button>

        {waOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300 space-y-1">
              <p className="font-medium">Как подключить:</p>
              <p>1. Откройте <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="underline">developers.facebook.com</a> → Ваше приложение → WhatsApp</p>
              <p>2. Скопируйте <strong>Phone Number ID</strong> из раздела "Начало работы"</p>
              <p>3. Создайте <strong>постоянный токен</strong> в System Users вашего Meta Business</p>
              <p>4. Вставьте данные ниже → сохраните → скопируйте Webhook URL</p>
              <p>5. В Meta Developers → WhatsApp → Configuration → вставьте Webhook URL и Verify Token</p>
            </div>

            {/* Webhook URL */}
            {businessId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Webhook URL (скопируйте в Meta)</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`https://staffix.io/api/whatsapp/webhook?businessId=${businessId}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-400 text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://staffix.io/api/whatsapp/webhook?businessId=${businessId}`);
                    }}
                    className="px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-colors"
                  >
                    <Copy className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number ID</label>
              <input
                type="text"
                value={waSettings.phoneNumberId}
                onChange={(e) => setWaSettings({ ...waSettings, phoneNumberId: e.target.value })}
                placeholder="1234567890123456"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Access Token</label>
              <input
                type="password"
                value={waSettings.accessToken}
                onChange={(e) => setWaSettings({ ...waSettings, accessToken: e.target.value })}
                placeholder="EAAxxxxxxxx..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50"
              />
              <p className="text-xs text-gray-500 mt-1">Токен уже сохранён (показан как ***). Введите новый только если хотите обновить.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Verify Token (придумайте сами)</label>
              <input
                type="text"
                value={waSettings.verifyToken}
                onChange={(e) => setWaSettings({ ...waSettings, verifyToken: e.target.value })}
                placeholder="my_secret_token_2025"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={waSettings.active}
                  onChange={(e) => setWaSettings({ ...waSettings, active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
              <span className="text-sm text-gray-300">Активировать WhatsApp канал</span>
            </div>

            <button
              onClick={async () => {
                setSavingWa(true);
                try {
                  const body: Record<string, unknown> = {
                    waPhoneNumberId: waSettings.phoneNumberId,
                    waVerifyToken: waSettings.verifyToken,
                    waActive: waSettings.active,
                  };
                  if (waSettings.accessToken) body.waAccessToken = waSettings.accessToken;
                  await fetch("/api/business", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  setWaSaved(true);
                  setTimeout(() => setWaSaved(false), 3000);
                } catch {}
                setSavingWa(false);
              }}
              disabled={savingWa}
              className="w-full bg-green-600/20 border border-green-500/30 text-green-300 py-3 px-4 rounded-xl font-medium hover:bg-green-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {savingWa ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Сохраняем...</>
              ) : waSaved ? (
                <><Check className="h-4 w-4" /> Сохранено!</>
              ) : (
                <><Save className="h-4 w-4" /> Сохранить WhatsApp</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Facebook Messenger ──────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setFbOpen(!fbOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <span className="text-blue-400 text-lg">💙</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-white">Facebook Messenger</p>
              <p className="text-xs text-gray-500">
                {fbSettings.active ? (
                  <span className="text-green-400">● Активен</span>
                ) : fbSettings.pageId ? (
                  <span className="text-yellow-400">● Настроен, не активен</span>
                ) : (
                  "Подключите Facebook страницу к боту"
                )}
              </p>
            </div>
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${fbOpen ? "rotate-180" : ""}`} />
        </button>

        {fbOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300 space-y-1">
              <p className="font-medium">Как подключить:</p>
              <p>1. <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="underline">developers.facebook.com</a> → Ваше приложение → Messenger → Настройка</p>
              <p>2. Привяжите Facebook Страницу → скопируйте <strong>Page ID</strong> и сгенерируйте <strong>Page Access Token</strong></p>
              <p>3. Вставьте данные ниже → сохраните → скопируйте Webhook URL</p>
              <p>4. В Meta Developers → Messenger → Webhooks → вставьте Webhook URL и Verify Token → выберите events: <strong>messages</strong></p>
            </div>

            {businessId && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Webhook URL (скопируйте в Meta)</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={`https://staffix.io/api/facebook/webhook?businessId=${businessId}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-400 text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://staffix.io/api/facebook/webhook?businessId=${businessId}`);
                    }}
                    className="px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-colors"
                  >
                    <Copy className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Page ID</label>
              <input
                type="text"
                value={fbSettings.pageId}
                onChange={(e) => setFbSettings({ ...fbSettings, pageId: e.target.value })}
                placeholder="123456789012345"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Page Access Token</label>
              <input
                type="password"
                value={fbSettings.pageAccessToken}
                onChange={(e) => setFbSettings({ ...fbSettings, pageAccessToken: e.target.value })}
                placeholder="EAAxxxxxxxx..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Verify Token (придумайте сами)</label>
              <input
                type="text"
                value={fbSettings.verifyToken}
                onChange={(e) => setFbSettings({ ...fbSettings, verifyToken: e.target.value })}
                placeholder="my_fb_secret_2025"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={fbSettings.active}
                  onChange={(e) => setFbSettings({ ...fbSettings, active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
              <span className="text-sm text-gray-300">Активировать Facebook Messenger</span>
            </div>

            <button
              onClick={async () => {
                setSavingFb(true);
                try {
                  const body: Record<string, unknown> = {
                    fbPageId: fbSettings.pageId,
                    fbVerifyToken: fbSettings.verifyToken,
                    fbActive: fbSettings.active,
                  };
                  if (fbSettings.pageAccessToken) body.fbPageAccessToken = fbSettings.pageAccessToken;
                  await fetch("/api/business", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  setFbSaved(true);
                  setTimeout(() => setFbSaved(false), 3000);
                } catch {}
                setSavingFb(false);
              }}
              disabled={savingFb}
              className="w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 py-3 px-4 rounded-xl font-medium hover:bg-blue-600/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {savingFb ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Сохраняем...</>
              ) : fbSaved ? (
                <><Check className="h-4 w-4" /> Сохранено!</>
              ) : (
                <><Save className="h-4 w-4" /> Сохранить Facebook Messenger</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
