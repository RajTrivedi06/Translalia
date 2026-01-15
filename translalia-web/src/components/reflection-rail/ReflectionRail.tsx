"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ReflectionHeader } from "@/components/reflection-rail/ReflectionHeader";

interface ReflectionRailProps {
  showHeaderTitle?: boolean;
}

export function ReflectionRail({
  showHeaderTitle = true,
}: ReflectionRailProps) {
  const t = useTranslations("Thread");

  return (
    <div className="h-full flex flex-col">
      {showHeaderTitle && <ReflectionHeader showTitle={showHeaderTitle} />}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <p className="text-slate-600">{t("reflectionDescription")}</p>
        </div>
      </div>
    </div>
  );
}
