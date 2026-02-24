"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Users,
  Scissors,
  Package,
  ArrowRight,
  Loader2,
  Plus,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string | null;
  avatar: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number | null;
  duration: number | null;
}

interface Product {
  id: string;
  name: string;
  price: number | null;
}

export default function CompanyPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#12122a]" : "bg-white";
  const borderColor = isDark ? "border-white/5" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [staffRes, servicesRes, productsRes] = await Promise.all([
          fetch("/api/staff"),
          fetch("/api/services"),
          fetch("/api/products"),
        ]);

        if (staffRes.ok) {
          const data = await staffRes.json();
          setTeam((data.staff || data || []).slice(0, 6));
        }
        if (servicesRes.ok) {
          const data = await servicesRes.json();
          setServices((data.services || data || []).slice(0, 6));
        }
        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts((data.products || data || []).slice(0, 6));
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary} mb-1`}>{t("nav.myCompany")}</h1>
        <p className={textSecondary}>Управляйте командой, услугами и продукцией</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${borderColor}`}>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              <h2 className={`font-semibold ${textPrimary}`}>{t("staff.title")}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"} ${textMuted}`}>
                {team.length}
              </span>
            </div>
            <Link href="/dashboard/staff" className="text-blue-500 hover:text-blue-400 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-3 space-y-1">
            {team.length === 0 ? (
              <div className="py-6 text-center">
                <Users className={`h-10 w-10 ${textMuted} mx-auto mb-2`} />
                <p className={`text-sm ${textMuted}`}>{t("staff.noStaff")}</p>
              </div>
            ) : (
              team.map((member) => (
                <div key={member.id} className={`flex items-center gap-3 px-2 py-2 rounded-lg ${hoverBg}`}>
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${textPrimary} truncate`}>{member.name}</p>
                    {member.role && <p className={`text-xs ${textMuted} truncate`}>{member.role}</p>}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={`px-5 py-3 border-t ${borderColor}`}>
            <Link
              href="/dashboard/staff"
              className={`flex items-center justify-center gap-2 w-full text-sm ${textSecondary} hover:text-blue-400 transition-colors py-1`}
            >
              <Plus className="h-4 w-4" />
              {t("staff.addStaff")}
            </Link>
          </div>
        </div>

        {/* Services */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${borderColor}`}>
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-green-400" />
              <h2 className={`font-semibold ${textPrimary}`}>{t("services.title")}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"} ${textMuted}`}>
                {services.length}
              </span>
            </div>
            <Link href="/dashboard/services" className="text-blue-500 hover:text-blue-400 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-3 space-y-1">
            {services.length === 0 ? (
              <div className="py-6 text-center">
                <Scissors className={`h-10 w-10 ${textMuted} mx-auto mb-2`} />
                <p className={`text-sm ${textMuted}`}>{t("services.noServices")}</p>
              </div>
            ) : (
              services.map((svc) => (
                <div key={svc.id} className={`flex items-center justify-between px-2 py-2 rounded-lg ${hoverBg}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${textPrimary} truncate`}>{svc.name}</p>
                    {svc.duration && <p className={`text-xs ${textMuted}`}>{svc.duration} {t("common.minutes")}</p>}
                  </div>
                  {svc.price !== null && (
                    <span className={`text-sm font-semibold ${textPrimary} ml-2 flex-shrink-0`}>
                      {svc.price.toLocaleString()}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className={`px-5 py-3 border-t ${borderColor}`}>
            <Link
              href="/dashboard/services"
              className={`flex items-center justify-center gap-2 w-full text-sm ${textSecondary} hover:text-green-400 transition-colors py-1`}
            >
              <Plus className="h-4 w-4" />
              {t("services.addService")}
            </Link>
          </div>
        </div>

        {/* Products */}
        <div className={`${cardBg} border ${borderColor} rounded-xl overflow-hidden`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${borderColor}`}>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-400" />
              <h2 className={`font-semibold ${textPrimary}`}>{t("nav.myProducts")}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/10" : "bg-gray-100"} ${textMuted}`}>
                {products.length}
              </span>
            </div>
            <Link href="/dashboard/products" className="text-blue-500 hover:text-blue-400 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-3 space-y-1">
            {products.length === 0 ? (
              <div className="py-6 text-center">
                <Package className={`h-10 w-10 ${textMuted} mx-auto mb-2`} />
                <p className={`text-sm ${textMuted}`}>Товары не добавлены</p>
              </div>
            ) : (
              products.map((prod) => (
                <div key={prod.id} className={`flex items-center justify-between px-2 py-2 rounded-lg ${hoverBg}`}>
                  <p className={`text-sm font-medium ${textPrimary} flex-1 truncate`}>{prod.name}</p>
                  {prod.price !== null && (
                    <span className={`text-sm font-semibold ${textPrimary} ml-2 flex-shrink-0`}>
                      {prod.price.toLocaleString()}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className={`px-5 py-3 border-t ${borderColor}`}>
            <Link
              href="/dashboard/products"
              className={`flex items-center justify-center gap-2 w-full text-sm ${textSecondary} hover:text-orange-400 transition-colors py-1`}
            >
              <Plus className="h-4 w-4" />
              Добавить товар
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
