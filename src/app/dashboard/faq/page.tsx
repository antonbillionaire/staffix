"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
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

export default function FAQPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
  });

  // Theme classes
  const bgCard = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputBg = isDark ? "bg-white/5" : "bg-white";
  const inputBorder = isDark ? "border-white/10" : "border-gray-300";

  // Load FAQs and documents on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load FAQs
      const faqRes = await fetch("/api/faq");
      if (faqRes.ok) {
        const faqData = await faqRes.json();
        setFaqs(faqData.faqs || []);
      }

      // Load documents
      const docRes = await fetch("/api/documents");
      if (docRes.ok) {
        const docData = await docRes.json();
        setDocuments(docData.documents || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (faq?: FAQ) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingFaq) {
        // Update FAQ
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
        // Create FAQ
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
      if (res.ok) {
        setFaqs(faqs.filter((f) => f.id !== id));
      }
    } catch (error) {
      console.error("Error deleting FAQ:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setDocuments((prev) => [...prev, data.document]);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm(t("faqPage.deleteDocumentConfirm"))) return;

    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments(documents.filter((d) => d.id !== id));
      }
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
    const lowerName = name.toLowerCase();
    if (type.includes("pdf") || lowerName.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes("word") || type.includes("document") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx")) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.includes("text") || lowerName.endsWith(".txt")) return <FileText className="h-5 w-5 text-gray-500" />;
    return <File className="h-5 w-5 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* Documents Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("faqPage.documents")}</h2>
            <p className={`text-sm ${textSecondary}`}>
              {t("faqPage.documentsDesc")}
            </p>
          </div>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("faqPage.uploadFile")}
            </button>
          </div>
        </div>

        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          {documents.length === 0 ? (
            <div className="p-8 text-center">
              <FolderOpen className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
              <p className={textSecondary}>{t("faqPage.noDocuments")}</p>
              <p className={`text-sm ${textSecondary} mt-1`}>
                {t("faqPage.noDocumentsDesc")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-4 hover:bg-white/5 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.mimeType, doc.name)}
                    <div>
                      <p className={`font-medium ${textPrimary}`}>{doc.name}</p>
                      <p className={`text-xs ${textSecondary}`}>
                        {formatFileSize(doc.size)} • {new Date(doc.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className={`${textSecondary} hover:text-red-500 p-2 transition-colors`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>{t("faqPage.faq")}</h2>
            <p className={`text-sm ${textSecondary}`}>
              {t("faqPage.faqDesc")}
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("faqPage.add")}
          </button>
        </div>

        <div className={`${bgCard} rounded-xl border ${borderColor} overflow-hidden`}>
          {faqs.length === 0 ? (
            <div className="p-8 text-center">
              <HelpCircle className={`h-12 w-12 mx-auto mb-3 ${textSecondary}`} />
              <p className={textSecondary}>{t("faqPage.noQuestions")}</p>
              <p className={`text-sm ${textSecondary} mt-1`}>
                {t("faqPage.noQuestionsDesc")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className={`p-4 hover:bg-white/5 transition-colors`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`font-medium ${textPrimary}`}>{faq.question}</h3>
                      <p className={`text-sm ${textSecondary} mt-1`}>{faq.answer}</p>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button
                        onClick={() => openModal(faq)}
                        className={`${textSecondary} hover:text-blue-500 p-2 transition-colors`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteFaq(faq.id)}
                        className={`${textSecondary} hover:text-red-500 p-2 transition-colors`}
                      >
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${bgCard} rounded-xl border ${borderColor} p-6 w-full max-w-md mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                {editingFaq ? t("faqPage.editQuestion") : t("faqPage.newQuestion")}
              </h3>
              <button
                onClick={closeModal}
                className={`${textSecondary} hover:${textPrimary} transition-colors`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  {t("faqPage.question")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.question}
                  onChange={(e) =>
                    setFormData({ ...formData, question: e.target.value })
                  }
                  placeholder={t("faqPage.questionPlaceholder")}
                  className={`w-full px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-1`}>
                  {t("faqPage.answer")}
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData({ ...formData, answer: e.target.value })
                  }
                  placeholder={t("faqPage.answerPlaceholder")}
                  className={`w-full px-3 py-2 ${inputBg} border ${inputBorder} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${textPrimary}`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className={`flex-1 px-4 py-2 border ${inputBorder} rounded-lg font-medium ${textSecondary} hover:bg-white/5 transition-colors`}
                >
                  {t("faqPage.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                  {editingFaq ? t("faqPage.save") : t("faqPage.add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
