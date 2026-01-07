import type { SimplePoemStanzas, SimpleStanza } from "./stanzaUtils";
import type { CustomSegmentation } from "@/components/guide/SegmentEditor";

/**
 * Converts custom segmentation to SimplePoemStanzas format
 * @param poemLines - Array of non-empty lines
 * @param segmentation - Custom segmentation mapping
 * @returns SimplePoemStanzas
 */
export function customSegmentationToStanzas(
  poemLines: string[],
  segmentation: CustomSegmentation
): SimplePoemStanzas {
  const stanzas: SimpleStanza[] = [];
  const { lineToSegment, totalSegments } = segmentation;

  // Group lines by segment
  const segmentLines = new Map<number, string[]>();

  poemLines.forEach((line, lineIndex) => {
    const segmentNum = lineToSegment.get(lineIndex) || 1;
    if (!segmentLines.has(segmentNum)) {
      segmentLines.set(segmentNum, []);
    }
    segmentLines.get(segmentNum)!.push(line);
  });

  // Create stanzas in order
  for (let segNum = 1; segNum <= totalSegments; segNum++) {
    const lines = segmentLines.get(segNum);
    if (lines && lines.length > 0) {
      stanzas.push({
        number: segNum,
        lines,
        text: lines.join("\n"),
      });
    }
  }

  return {
    stanzas,
    totalStanzas: stanzas.length,
  };
}
