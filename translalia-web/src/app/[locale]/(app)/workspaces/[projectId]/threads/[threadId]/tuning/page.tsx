"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TranslationTuningLayout } from "@/components/tuning/TranslationTuningLayout";
import { PipelineTimeline } from "@/components/tuning/PipelineTimeline";
import { DownstreamAnalysis } from "@/components/tuning/DownstreamAnalysis";
import { PlaybackScrubber } from "@/components/tuning/PlaybackScrubber";
import { routes } from "@/lib/routers";
import {
  lineInfo,
  pipelineNodes,
  pipelineStats,
  presets,
  sourcePoem,
} from "@/components/tuning/mockData";

/**
 * Translation Tuning (Beta) — pipeline visualization / tuning workspace.
 *
 * UI-only for now: everything renders from hardcoded mock data — the timeline,
 * the inline node detail, the downstream analysis list, and the playback
 * scrubber pinned to the bottom.
 */
export default function TranslationTuningPage() {
  const params = useParams<{ projectId: string; threadId: string }>();
  const projectId = params?.projectId ?? "";
  const threadId = params?.threadId ?? "";
  const backHref = routes.projectWithThread(projectId, threadId);

  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    null,
  );

  return (
    <TranslationTuningLayout
      backHref={backHref}
      poemTitle={sourcePoem.title}
      lineInfo={lineInfo}
      stats={pipelineStats}
      presets={presets}
      footer={
        <PlaybackScrubber
          nodes={pipelineNodes}
          progressPercent={80}
          totalSeconds={pipelineStats.timeSeconds}
        />
      }
    >
      <PipelineTimeline
        nodes={pipelineNodes}
        selectedNodeId={selectedNodeId}
        onSelectNode={(id) =>
          setSelectedNodeId((prev) => (prev === id ? null : id))
        }
      />

      <DownstreamAnalysis />
    </TranslationTuningLayout>
  );
}
