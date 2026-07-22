"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import PageHint from "@/components/PageHint";

export default function BotPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/channels/telegram");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <PageHint id="bot" />
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}
