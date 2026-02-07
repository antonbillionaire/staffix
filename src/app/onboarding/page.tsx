"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages as appLanguages } from "@/lib/translations";
import {
  Scissors,
  Stethoscope,
  Car,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Store,
  Upload,
  X,
  Brain,
  Sparkles,
  Truck,
  SprayCanIcon,
  PawPrint,
  ShoppingCart,
  Briefcase,
  Dumbbell,
  GraduationCap,
  PartyPopper,
  Droplets,
  type LucideIcon,
} from "lucide-react";

interface BusinessType {
  id: string;
  nameKey: string;
  icon: LucideIcon;
}

const businessTypes: BusinessType[] = [
  { id: "salon", nameKey: "onboarding.type.salon", icon: Scissors },
  { id: "barbershop", nameKey: "onboarding.type.barbershop", icon: Scissors },
  { id: "clinic", nameKey: "onboarding.type.clinic", icon: Stethoscope },
  { id: "spa", nameKey: "onboarding.type.spa", icon: Droplets },
  { id: "fitness", nameKey: "onboarding.type.fitness", icon: Dumbbell },
  { id: "auto_service", nameKey: "onboarding.type.autoService", icon: Car },
  { id: "delivery", nameKey: "onboarding.type.delivery", icon: Truck },
  { id: "cleaning", nameKey: "onboarding.type.cleaning", icon: SprayCanIcon },
  { id: "pet_care", nameKey: "onboarding.type.petCare", icon: PawPrint },
  { id: "online_shop", nameKey: "onboarding.type.onlineShop", icon: ShoppingCart },
  { id: "professional", nameKey: "onboarding.type.professional", icon: Briefcase },
  { id: "education", nameKey: "onboarding.type.education", icon: GraduationCap },
  { id: "events", nameKey: "onboarding.type.events", icon: PartyPopper },
  { id: "other", nameKey: "onboarding.type.other", icon: Store },
];

const staffCountKeys = [
  { id: "1", nameKey: "onboarding.staff.solo" },
  { id: "2-5", nameKey: "onboarding.staff.small" },
  { id: "6-10", nameKey: "onboarding.staff.medium" },
  { id: "11+", nameKey: "onboarding.staff.large" },
];

interface UploadedFile {
  id?: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "success" | "error";
  error?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const [formData, setFormData] = useState({
    businessType: "",
    businessName: "",
    phone: "",
    address: "",
    staffCount: "",
    language: "ru",
  });

  const totalSteps = 5;

  const handleNext = () => {
    if (step === 1 && !formData.businessType) {
      setError(t("onboarding.error.selectType"));
      return;
    }
    if (step === 2 && !formData.businessName) {
      setError(t("onboarding.error.enterName"));
      return;
    }
    setError("");
    setStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    setStep(step - 1);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'text/plain'
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!allowedTypes.includes(file.type) &&
          !file.name.endsWith('.xlsx') &&
          !file.name.endsWith('.xls') &&
          !file.name.endsWith('.docx') &&
          !file.name.endsWith('.doc')) {
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          status: "error",
          error: t("onboarding.error.fileTooLarge")
        }]);
        continue;
      }

      const tempId = `temp-${Date.now()}-${i}`;
      setUploadedFiles(prev => [...prev, {
        id: tempId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading"
      }]);

      try {
        const fd = new FormData();
        fd.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setUploadedFiles(prev => prev.map(f =>
            f.id === tempId
              ? { ...f, id: data.document.id, status: "success" as const }
              : f
          ));
        } else {
          setUploadedFiles(prev => prev.map(f =>
            f.id === tempId
              ? { ...f, status: "error" as const, error: data.error || t("onboarding.error.uploadFailed") }
              : f
          ));
        }
      } catch {
        setUploadedFiles(prev => prev.map(f =>
          f.id === tempId
            ? { ...f, status: "error" as const, error: t("onboarding.error.networkError") }
            : f
        ));
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = async (index: number) => {
    const file = uploadedFiles[index];

    if (file.status === "success" && file.id && !file.id.startsWith("temp-")) {
      try {
        await fetch(`/api/upload?id=${file.id}`, { method: "DELETE" });
      } catch {
        // Ignore delete errors
      }
    }

    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFinish = async () => {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("onboarding.error.saveFailed"));
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.error.saveFailed"));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 bg-[#12122a] border border-white/5 rounded-2xl max-w-2xl w-full p-8">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Staffix</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                  s < step
                    ? "bg-green-500 text-white"
                    : s === step
                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                    : "bg-white/5 text-gray-500"
                }`}
              >
                {s < step ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < totalSteps && (
                <div
                  className={`w-12 sm:w-16 h-1 mx-1 sm:mx-2 rounded ${
                    s < step ? "bg-green-500" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("onboarding.step1.title")}
            </h2>
            <p className="text-gray-400 mb-6">
              {t("onboarding.step1.subtitle")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {businessTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setFormData({ ...formData, businessType: type.id })}
                    className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                      formData.businessType === type.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/10 hover:border-white/20 bg-white/5"
                    }`}
                  >
                    <Icon
                      className={`h-7 w-7 mx-auto mb-2 ${
                        formData.businessType === type.id
                          ? "text-blue-400"
                          : "text-gray-400"
                      }`}
                    />
                    <p
                      className={`text-xs sm:text-sm font-medium ${
                        formData.businessType === type.id
                          ? "text-blue-400"
                          : "text-gray-300"
                      }`}
                    >
                      {t(type.nameKey)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Business Info */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("onboarding.step2.title")}
            </h2>
            <p className="text-gray-400 mb-6">
              {t("onboarding.step2.subtitle")}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("onboarding.step2.businessName")} *
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder={t("onboarding.step2.businessNamePlaceholder")}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("onboarding.step2.phone")}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+998 90 123 45 67"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t("onboarding.step2.address")}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder={t("onboarding.step2.addressPlaceholder")}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {t("onboarding.step2.staffCount")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {staffCountKeys.map((count) => (
                    <button
                      key={count.id}
                      onClick={() =>
                        setFormData({ ...formData, staffCount: count.id })
                      }
                      className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                        formData.staffCount === count.id
                          ? "border-blue-500 bg-blue-500/10 text-blue-400"
                          : "border-white/10 text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {t(count.nameKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: File Upload */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("onboarding.step3.title")}
            </h2>
            <p className="text-gray-400 mb-6">
              {t("onboarding.step3.subtitle")}
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
            >
              <Upload className="h-12 w-12 mx-auto text-gray-500 mb-4" />
              <p className="text-gray-300 font-medium">
                {t("onboarding.step3.clickToUpload")}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {t("onboarding.step3.fileFormats")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-gray-300">{t("onboarding.step3.uploadedFiles")}:</p>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={file.id || index}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      file.status === "error"
                        ? "bg-red-500/10 border border-red-500/30"
                        : file.status === "uploading"
                        ? "bg-blue-500/10 border border-blue-500/30"
                        : "bg-green-500/10 border border-green-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {file.status === "uploading" ? (
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                      ) : file.status === "error" ? (
                        <X className="h-5 w-5 text-red-400" />
                      ) : (
                        <Check className="h-5 w-5 text-green-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {file.status === "uploading"
                            ? t("onboarding.step3.uploading")
                            : file.status === "error"
                            ? file.error
                            : formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    {file.status !== "uploading" && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-sm text-gray-500">
              {t("onboarding.step3.skipNote")}
            </p>
          </div>
        )}

        {/* Step 4: Language */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t("onboarding.step4.title")}
            </h2>
            <p className="text-gray-400 mb-6">
              {t("onboarding.step4.subtitle")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {appLanguages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setFormData({ ...formData, language: lang.id })}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    formData.language === lang.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="text-4xl mb-3 block">{lang.flag}</span>
                  <p
                    className={`text-sm font-medium ${
                      formData.language === lang.id
                        ? "text-blue-400"
                        : "text-gray-300"
                    }`}
                  >
                    {lang.name}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 5 && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {t("onboarding.step5.title")}
              </h2>
              <p className="text-gray-400">
                {t("onboarding.step5.subtitle")}
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">{t("onboarding.step5.businessType")}:</span>
                <span className="text-white font-medium">
                  {t(businessTypes.find((bt) => bt.id === formData.businessType)?.nameKey || "")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("onboarding.step5.name")}:</span>
                <span className="text-white font-medium">{formData.businessName}</span>
              </div>
              {formData.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("onboarding.step2.phone")}:</span>
                  <span className="text-white font-medium">{formData.phone}</span>
                </div>
              )}
              {formData.address && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("onboarding.step2.address")}:</span>
                  <span className="text-white font-medium">{formData.address}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">{t("onboarding.step5.documents")}:</span>
                <span className="text-white font-medium">
                  {uploadedFiles.filter(f => f.status === "success").length > 0
                    ? `${uploadedFiles.filter(f => f.status === "success").length} ${t("onboarding.step5.filesCount")}`
                    : t("onboarding.step5.notUploaded")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t("onboarding.step5.language")}:</span>
                <span className="text-white font-medium">
                  {appLanguages.find((l) => l.id === formData.language)?.flag}{" "}
                  {appLanguages.find((l) => l.id === formData.language)?.name}
                </span>
              </div>
            </div>

            <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                {t("onboarding.step5.trialInfo")}
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("onboarding.back")}
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-all"
            >
              {t("onboarding.next")}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("onboarding.saving")}
                </>
              ) : (
                <>
                  {t("onboarding.start")}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
