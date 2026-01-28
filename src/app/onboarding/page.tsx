"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Stethoscope,
  Car,
  Users,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Store,
  Upload,
  FileText,
  X,
} from "lucide-react";

const businessTypes = [
  { id: "salon", name: "Салон красоты", icon: Scissors },
  { id: "barbershop", name: "Барбершоп", icon: Scissors },
  { id: "clinic", name: "Клиника / Медцентр", icon: Stethoscope },
  { id: "auto_service", name: "Автосервис", icon: Car },
  { id: "spa", name: "СПА / Массаж", icon: Users },
  { id: "other", name: "Другое", icon: Store },
];

const languages = [
  { id: "ru", name: "Русский", flag: "🇷🇺" },
  { id: "uz", name: "O'zbek", flag: "🇺🇿" },
  { id: "kz", name: "Қазақша", flag: "🇰🇿" },
];

const staffCounts = [
  { id: "1", name: "Только я" },
  { id: "2-5", name: "2-5 человек" },
  { id: "6-10", name: "6-10 человек" },
  { id: "11+", name: "Больше 10" },
];

interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

export default function OnboardingPage() {
  const router = useRouter();
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
      setError("Выберите тип бизнеса");
      return;
    }
    if (step === 2 && !formData.businessName) {
      setError("Введите название бизнеса");
      return;
    }
    setError("");
    setStep(step + 1);
  };

  const handleBack = () => {
    setError("");
    setStep(step - 1);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles: UploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Accept PDF, Excel, Word, images
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
        if (allowedTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          newFiles.push({
            name: file.name,
            size: file.size,
            type: file.type
          });
        }
      }
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
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
        body: JSON.stringify({
          ...formData,
          files: uploadedFiles
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка сохранения");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  s < step
                    ? "bg-green-500 text-white"
                    : s === step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {s < step ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < totalSteps && (
                <div
                  className={`w-12 sm:w-16 h-1 mx-1 sm:mx-2 ${
                    s < step ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Какой у вас бизнес?
            </h2>
            <p className="text-gray-600 mb-6">
              Это поможет настроить AI-ассистента под ваши потребности
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {businessTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setFormData({ ...formData, businessType: type.id })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.businessType === type.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon
                      className={`h-8 w-8 mx-auto mb-2 ${
                        formData.businessType === type.id
                          ? "text-blue-600"
                          : "text-gray-400"
                      }`}
                    />
                    <p
                      className={`text-sm font-medium ${
                        formData.businessType === type.id
                          ? "text-blue-600"
                          : "text-gray-700"
                      }`}
                    >
                      {type.name}
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Расскажите о бизнесе
            </h2>
            <p className="text-gray-600 mb-6">
              Эта информация будет доступна вашим клиентам
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название бизнеса *
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder="Салон красоты 'Звезда'"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+998 90 123 45 67"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Адрес
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="г. Ташкент, ул. Навои, 10"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сколько сотрудников?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {staffCounts.map((count) => (
                    <button
                      key={count.id}
                      onClick={() =>
                        setFormData({ ...formData, staffCount: count.id })
                      }
                      className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.staffCount === count.id
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {count.name}
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Загрузите документы
            </h2>
            <p className="text-gray-600 mb-6">
              Прайс-лист, меню услуг, FAQ — AI изучит их и будет использовать в работе
            </p>

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">
                Нажмите для загрузки или перетащите файлы
              </p>
              <p className="text-sm text-gray-400 mt-2">
                PDF, Excel, Word, изображения (до 10 MB)
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

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-gray-700">Загруженные файлы:</p>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-sm text-gray-500">
              Можно пропустить этот шаг и загрузить документы позже
            </p>
          </div>
        )}

        {/* Step 4: Language */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Выберите язык
            </h2>
            <p className="text-gray-600 mb-6">
              На этом языке будет общаться AI-ассистент с вашими клиентами
            </p>

            <div className="grid grid-cols-3 gap-4">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setFormData({ ...formData, language: lang.id })}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    formData.language === lang.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-4xl mb-3 block">{lang.flag}</span>
                  <p
                    className={`text-sm font-medium ${
                      formData.language === lang.id
                        ? "text-blue-600"
                        : "text-gray-700"
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
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Всё готово!
              </h2>
              <p className="text-gray-600">
                Проверьте данные и нажмите "Начать работу"
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Тип бизнеса:</span>
                <span className="font-medium">
                  {businessTypes.find((t) => t.id === formData.businessType)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Название:</span>
                <span className="font-medium">{formData.businessName}</span>
              </div>
              {formData.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Телефон:</span>
                  <span className="font-medium">{formData.phone}</span>
                </div>
              )}
              {formData.address && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Адрес:</span>
                  <span className="font-medium">{formData.address}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Документы:</span>
                <span className="font-medium">
                  {uploadedFiles.length > 0 ? `${uploadedFiles.length} файл(ов)` : "Не загружены"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Язык:</span>
                <span className="font-medium">
                  {languages.find((l) => l.id === formData.language)?.flag}{" "}
                  {languages.find((l) => l.id === formData.language)?.name}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              {step === 3 ? "Далее" : "Далее"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  Начать работу
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
