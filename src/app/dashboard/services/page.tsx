"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface Service {
  id: number;
  name: string;
  price: number;
  duration: number;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([
    { id: 1, name: "Стрижка женская", price: 100000, duration: 60 },
    { id: 2, name: "Стрижка мужская", price: 50000, duration: 30 },
    { id: 3, name: "Маникюр", price: 80000, duration: 45 },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    duration: "",
  });

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        price: service.price.toString(),
        duration: service.duration.toString(),
      });
    } else {
      setEditingService(null);
      setFormData({ name: "", price: "", duration: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormData({ name: "", price: "", duration: "" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingService) {
      setServices(
        services.map((s) =>
          s.id === editingService.id
            ? {
                ...s,
                name: formData.name,
                price: parseInt(formData.price),
                duration: parseInt(formData.duration),
              }
            : s
        )
      );
    } else {
      setServices([
        ...services,
        {
          id: Date.now(),
          name: formData.name,
          price: parseInt(formData.price),
          duration: parseInt(formData.duration),
        },
      ]);
    }

    closeModal();
  };

  const deleteService = (id: number) => {
    if (confirm("Удалить услугу?")) {
      setServices(services.filter((s) => s.id !== id));
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("ru-RU") + " сум";
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Услуги</h2>
          <p className="text-sm text-gray-500">
            Услуги, которые бот предлагает клиентам
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>

      {/* Services list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {services.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Нет услуг</p>
            <p className="text-sm mt-1">
              Добавьте услуги, чтобы клиенты могли на них записываться
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  Услуга
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  Цена
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  Длительность
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {service.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatPrice(service.price)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {service.duration} мин
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openModal(service)}
                      className="text-gray-400 hover:text-blue-600 p-1"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteService(service.id)}
                      className="text-gray-400 hover:text-red-600 p-1 ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingService ? "Редактировать услугу" : "Новая услуга"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название услуги
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Стрижка женская"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Цена (сум)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Длительность (минуты)
                </label>
                <input
                  type="number"
                  required
                  min="5"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  placeholder="60"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  {editingService ? "Сохранить" : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
