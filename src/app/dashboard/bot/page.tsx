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

  // Logo upload
  const [botLogo, setBotLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Selected template tracking
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

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
            // Load logo if exists
            if (data.business.botLogo) {
              setBotLogo(data.business.botLogo);
            }
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("botPage.saveError"));
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
          const data = await res.json();
          throw new Error(data.error || t("botPage.saveError"));
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

      {/* Logo upload */}
      <div className="bg-[#12122a] rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Image className="h-5 w-5 text-pink-400" />
          {t("botPage.botLogo")}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          {t("botPage.uploadLogo")}
        </p>

        <div className="flex items-center gap-6">
          {/* Preview */}
          <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
            {botLogo ? (
              <img src={botLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Brain className="h-10 w-10 text-gray-500" />
            )}
          </div>

          {/* Upload button */}
          <div className="flex-1">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingLogo(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("type", "logo");
                    const res = await fetch("/api/documents/upload", {
                      method: "POST",
                      body: formData,
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setBotLogo(data.document.url);
                      // Save logo URL to business
                      await fetch("/api/business", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ botLogo: data.document.url }),
                      });
                    }
                  } catch (error) {
                    console.error("Logo upload error:", error);
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white text-sm font-medium cursor-pointer transition-colors">
                {uploadingLogo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("botPage.uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {t("botPage.uploadLogoBtn")}
                  </>
                )}
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-2">
              {t("botPage.logoFormats")}
            </p>
          </div>
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
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "friendly", nameKey: "botPage.friendly", emoji: "😊" },
                { id: "professional", nameKey: "botPage.professional", emoji: "👔" },
                { id: "casual", nameKey: "botPage.casual", emoji: "😎" },
              ].map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setAiSettings({ ...aiSettings, tone: tone.id })}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    aiSettings.tone === tone.id
                      ? "bg-blue-500/20 border-blue-500/50 text-white"
                      : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-2xl block mb-1">{tone.emoji}</span>
                  <span className="text-sm">{t(tone.nameKey)}</span>
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

          {/* Rules */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t("botPage.specialInstructions")}
            </label>
            <textarea
              value={aiSettings.rules}
              onChange={(e) => setAiSettings({ ...aiSettings, rules: e.target.value })}
              placeholder={t("botPage.instructionsPlaceholder")}
              rows={4}
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
    </div>
  );
}
