"use client";

import React from "react";
import { JourneyReflection } from "./JourneyReflection";

interface JourneyReflectionViewProps {
  projectId: string;
}

export function JourneyReflectionView({
  projectId,
}: JourneyReflectionViewProps) {
  return (
    <div className="h-full">
      <JourneyReflection
        open={true}
        onOpenChange={() => {}}
        projectId={projectId}
        embedded={true}
      />
    </div>
  );
}
