/**
 * FROZEN GOLDEN FIXTURE — CJK segmentation baseline.
 *
 * Captured 2026-08-09 from `Intl.Segmenter(locale, { granularity: "word" })`
 * running on:
 *
 *   node    v22.3.0
 *   icu     75.1
 *   unicode 15.1
 *   cldr    45.0   (full ICU; `icu_small` unset)
 *
 * WHAT THIS IS FOR
 * This is not an assertion that the segmentation below is *good*. It is a
 * record of what it is *today*, so that when the segmenter is swapped — for a
 * bundled dictionary, a different ICU version, a model-driven segmenter — the
 * diff against this file shows exactly what changed and where. Without it that
 * comparison is impossible to reconstruct after the fact.
 *
 * WHEN THIS TEST FAILS
 * Do not "fix" the fixture reflexively. A failure means the segmenter changed
 * under you. Read the diff first, decide whether the change is an improvement,
 * and only then re-freeze — in a commit that does nothing else.
 *
 * To re-freeze: run `segmentText` over each `text` below and write the result
 * back into `segments`, recording the new engine versions in this header.
 */

import type { Segment } from "../segmentText";

export interface CjkGoldenCase {
  /** Stable id, used in test names. */
  id: string;
  /** Provenance of the line. */
  source: string;
  /** Locale passed to Intl.Segmenter when this baseline was captured. */
  locale: string;
  /** The input line. */
  text: string;
  /** Expected output of segmentText(text) — punctuation included. */
  segments: Segment[];
}

/**
 * 16 lines: the 4 from the project brief, 6 classical Chinese, 4 modern
 * Chinese, 2 Japanese. 153 segments total.
 */
export const CJK_GOLDEN: CjkGoldenCase[] = [
  {
    id: "brief-1",
    source: "Project brief (Raj), 2026-08-09",
    locale: "zh",
    text: "那里，蝉在垂死挣扎",
    segments: [
      { text: "那里", start: 0, end: 2, wordLike: true },
      { text: "，", start: 2, end: 3, wordLike: false },
      { text: "蝉", start: 3, end: 4, wordLike: true },
      { text: "在", start: 4, end: 5, wordLike: true },
      { text: "垂死", start: 5, end: 7, wordLike: true },
      { text: "挣扎", start: 7, end: 9, wordLike: true },
    ],
  },
  {
    id: "brief-2",
    source: "Project brief (Raj), 2026-08-09",
    locale: "zh",
    text: "此处，知了正濒临绝境",
    segments: [
      { text: "此", start: 0, end: 1, wordLike: true },
      { text: "处", start: 1, end: 2, wordLike: true },
      { text: "，", start: 2, end: 3, wordLike: false },
      { text: "知", start: 3, end: 4, wordLike: true },
      { text: "了", start: 4, end: 5, wordLike: true },
      { text: "正", start: 5, end: 6, wordLike: true },
      { text: "濒临绝境", start: 6, end: 10, wordLike: true },
    ],
  },
  {
    id: "brief-3",
    source: "Project brief (Raj), 2026-08-09",
    locale: "zh",
    text: "那蝉鸣的尽头，是引擎的哀鸣",
    segments: [
      { text: "那", start: 0, end: 1, wordLike: true },
      { text: "蝉", start: 1, end: 2, wordLike: true },
      { text: "鸣", start: 2, end: 3, wordLike: true },
      { text: "的", start: 3, end: 4, wordLike: true },
      { text: "尽头", start: 4, end: 6, wordLike: true },
      { text: "，", start: 6, end: 7, wordLike: false },
      { text: "是", start: 7, end: 8, wordLike: true },
      { text: "引擎", start: 8, end: 10, wordLike: true },
      { text: "的", start: 10, end: 11, wordLike: true },
      { text: "哀鸣", start: 11, end: 13, wordLike: true },
    ],
  },
  {
    id: "brief-4",
    source: "Project brief (Raj), 2026-08-09",
    locale: "zh",
    text: "风过处，翅羽翻卷于灰绿之上",
    segments: [
      { text: "风", start: 0, end: 1, wordLike: true },
      { text: "过处", start: 1, end: 3, wordLike: true },
      { text: "，", start: 3, end: 4, wordLike: false },
      { text: "翅", start: 4, end: 5, wordLike: true },
      { text: "羽", start: 5, end: 6, wordLike: true },
      { text: "翻", start: 6, end: 7, wordLike: true },
      { text: "卷", start: 7, end: 8, wordLike: true },
      { text: "于", start: 8, end: 9, wordLike: true },
      { text: "灰", start: 9, end: 10, wordLike: true },
      { text: "绿", start: 10, end: 11, wordLike: true },
      { text: "之上", start: 11, end: 13, wordLike: true },
    ],
  },
  {
    id: "classical-libai-1",
    source: "李白《静夜思》(Li Bai, Quiet Night Thoughts)",
    locale: "zh",
    text: "床前明月光，疑是地上霜",
    segments: [
      { text: "床", start: 0, end: 1, wordLike: true },
      { text: "前", start: 1, end: 2, wordLike: true },
      { text: "明", start: 2, end: 3, wordLike: true },
      { text: "月光", start: 3, end: 5, wordLike: true },
      { text: "，", start: 5, end: 6, wordLike: false },
      { text: "疑", start: 6, end: 7, wordLike: true },
      { text: "是", start: 7, end: 8, wordLike: true },
      { text: "地上", start: 8, end: 10, wordLike: true },
      { text: "霜", start: 10, end: 11, wordLike: true },
    ],
  },
  {
    id: "classical-libai-2",
    source: "李白《静夜思》(Li Bai, Quiet Night Thoughts)",
    locale: "zh",
    text: "举头望明月，低头思故乡",
    segments: [
      { text: "举头", start: 0, end: 2, wordLike: true },
      { text: "望", start: 2, end: 3, wordLike: true },
      { text: "明月", start: 3, end: 5, wordLike: true },
      { text: "，", start: 5, end: 6, wordLike: false },
      { text: "低头", start: 6, end: 8, wordLike: true },
      { text: "思", start: 8, end: 9, wordLike: true },
      { text: "故乡", start: 9, end: 11, wordLike: true },
    ],
  },
  {
    id: "classical-dufu",
    source: "杜甫《春望》(Du Fu, Spring View)",
    locale: "zh",
    text: "国破山河在，城春草木深",
    segments: [
      { text: "国", start: 0, end: 1, wordLike: true },
      { text: "破", start: 1, end: 2, wordLike: true },
      { text: "山河", start: 2, end: 4, wordLike: true },
      { text: "在", start: 4, end: 5, wordLike: true },
      { text: "，", start: 5, end: 6, wordLike: false },
      { text: "城", start: 6, end: 7, wordLike: true },
      { text: "春", start: 7, end: 8, wordLike: true },
      { text: "草木", start: 8, end: 10, wordLike: true },
      { text: "深", start: 10, end: 11, wordLike: true },
    ],
  },
  {
    id: "classical-wangzhihuan",
    source: "王之涣《登鹳雀楼》(Wang Zhihuan)",
    locale: "zh",
    text: "白日依山尽，黄河入海流",
    segments: [
      { text: "白", start: 0, end: 1, wordLike: true },
      { text: "日", start: 1, end: 2, wordLike: true },
      { text: "依", start: 2, end: 3, wordLike: true },
      { text: "山", start: 3, end: 4, wordLike: true },
      { text: "尽", start: 4, end: 5, wordLike: true },
      { text: "，", start: 5, end: 6, wordLike: false },
      { text: "黄河", start: 6, end: 8, wordLike: true },
      { text: "入", start: 8, end: 9, wordLike: true },
      { text: "海流", start: 9, end: 11, wordLike: true },
    ],
  },
  {
    id: "classical-liuzongyuan",
    source: "柳宗元《江雪》(Liu Zongyuan, River Snow)",
    locale: "zh",
    text: "孤舟蓑笠翁，独钓寒江雪",
    segments: [
      { text: "孤舟", start: 0, end: 2, wordLike: true },
      { text: "蓑笠翁", start: 2, end: 5, wordLike: true },
      { text: "，", start: 5, end: 6, wordLike: false },
      { text: "独", start: 6, end: 7, wordLike: true },
      { text: "钓", start: 7, end: 8, wordLike: true },
      { text: "寒", start: 8, end: 9, wordLike: true },
      { text: "江", start: 9, end: 10, wordLike: true },
      { text: "雪", start: 10, end: 11, wordLike: true },
    ],
  },
  {
    id: "classical-mazhiyuan",
    source: "马致远《天净沙·秋思》(Ma Zhiyuan)",
    locale: "zh",
    text: "枯藤老树昏鸦，小桥流水人家",
    segments: [
      { text: "枯", start: 0, end: 1, wordLike: true },
      { text: "藤", start: 1, end: 2, wordLike: true },
      { text: "老树", start: 2, end: 4, wordLike: true },
      { text: "昏", start: 4, end: 5, wordLike: true },
      { text: "鸦", start: 5, end: 6, wordLike: true },
      { text: "，", start: 6, end: 7, wordLike: false },
      { text: "小桥流水", start: 7, end: 11, wordLike: true },
      { text: "人家", start: 11, end: 13, wordLike: true },
    ],
  },
  {
    id: "modern-xuzhimo",
    source: "徐志摩《再别康桥》(Xu Zhimo)",
    locale: "zh",
    text: "轻轻的我走了，正如我轻轻的来",
    segments: [
      { text: "轻轻", start: 0, end: 2, wordLike: true },
      { text: "的", start: 2, end: 3, wordLike: true },
      { text: "我", start: 3, end: 4, wordLike: true },
      { text: "走了", start: 4, end: 6, wordLike: true },
      { text: "，", start: 6, end: 7, wordLike: false },
      { text: "正如", start: 7, end: 9, wordLike: true },
      { text: "我", start: 9, end: 10, wordLike: true },
      { text: "轻轻", start: 10, end: 12, wordLike: true },
      { text: "的", start: 12, end: 13, wordLike: true },
      { text: "来", start: 13, end: 14, wordLike: true },
    ],
  },
  {
    id: "modern-bianzhilin",
    source: "卞之琳《断章》(Bian Zhilin, Fragment)",
    locale: "zh",
    text: "你站在桥上看风景，看风景的人在楼上看你",
    segments: [
      { text: "你", start: 0, end: 1, wordLike: true },
      { text: "站在", start: 1, end: 3, wordLike: true },
      { text: "桥", start: 3, end: 4, wordLike: true },
      { text: "上", start: 4, end: 5, wordLike: true },
      { text: "看", start: 5, end: 6, wordLike: true },
      { text: "风景", start: 6, end: 8, wordLike: true },
      { text: "，", start: 8, end: 9, wordLike: false },
      { text: "看", start: 9, end: 10, wordLike: true },
      { text: "风景", start: 10, end: 12, wordLike: true },
      { text: "的", start: 12, end: 13, wordLike: true },
      { text: "人", start: 13, end: 14, wordLike: true },
      { text: "在", start: 14, end: 15, wordLike: true },
      { text: "楼上", start: 15, end: 17, wordLike: true },
      { text: "看", start: 17, end: 18, wordLike: true },
      { text: "你", start: 18, end: 19, wordLike: true },
    ],
  },
  {
    id: "modern-beidao",
    source: "北岛《回答》(Bei Dao, The Answer)",
    locale: "zh",
    text: "卑鄙是卑鄙者的通行证，高尚是高尚者的墓志铭",
    segments: [
      { text: "卑鄙", start: 0, end: 2, wordLike: true },
      { text: "是", start: 2, end: 3, wordLike: true },
      { text: "卑鄙", start: 3, end: 5, wordLike: true },
      { text: "者", start: 5, end: 6, wordLike: true },
      { text: "的", start: 6, end: 7, wordLike: true },
      { text: "通行", start: 7, end: 9, wordLike: true },
      { text: "证", start: 9, end: 10, wordLike: true },
      { text: "，", start: 10, end: 11, wordLike: false },
      { text: "高尚", start: 11, end: 13, wordLike: true },
      { text: "是", start: 13, end: 14, wordLike: true },
      { text: "高尚", start: 14, end: 16, wordLike: true },
      { text: "者", start: 16, end: 17, wordLike: true },
      { text: "的", start: 17, end: 18, wordLike: true },
      { text: "墓志铭", start: 18, end: 21, wordLike: true },
    ],
  },
  {
    id: "modern-haizi",
    source: "海子《面朝大海，春暖花开》(Hai Zi)",
    locale: "zh",
    text: "从明天起，做一个幸福的人",
    segments: [
      { text: "从", start: 0, end: 1, wordLike: true },
      { text: "明天", start: 1, end: 3, wordLike: true },
      { text: "起", start: 3, end: 4, wordLike: true },
      { text: "，", start: 4, end: 5, wordLike: false },
      { text: "做", start: 5, end: 6, wordLike: true },
      { text: "一个", start: 6, end: 8, wordLike: true },
      { text: "幸福", start: 8, end: 10, wordLike: true },
      { text: "的", start: 10, end: 11, wordLike: true },
      { text: "人", start: 11, end: 12, wordLike: true },
    ],
  },
  {
    id: "ja-basho",
    source: "松尾芭蕉 (Matsuo Bashō, frog haiku)",
    locale: "ja",
    text: "古池や蛙飛び込む水の音",
    segments: [
      { text: "古池", start: 0, end: 2, wordLike: true },
      { text: "や", start: 2, end: 3, wordLike: true },
      { text: "蛙", start: 3, end: 4, wordLike: true },
      { text: "飛び込む", start: 4, end: 8, wordLike: true },
      { text: "水", start: 8, end: 9, wordLike: true },
      { text: "の", start: 9, end: 10, wordLike: true },
      { text: "音", start: 10, end: 11, wordLike: true },
    ],
  },
  {
    id: "ja-modern",
    source: "Constructed modern Japanese prose line",
    locale: "ja",
    text: "私は昨日、東京の古い書店で詩集を買いました",
    segments: [
      { text: "私", start: 0, end: 1, wordLike: true },
      { text: "は", start: 1, end: 2, wordLike: true },
      { text: "昨日", start: 2, end: 4, wordLike: true },
      { text: "、", start: 4, end: 5, wordLike: false },
      { text: "東京", start: 5, end: 7, wordLike: true },
      { text: "の", start: 7, end: 8, wordLike: true },
      { text: "古い", start: 8, end: 10, wordLike: true },
      { text: "書店", start: 10, end: 12, wordLike: true },
      { text: "で", start: 12, end: 13, wordLike: true },
      { text: "詩集", start: 13, end: 15, wordLike: true },
      { text: "を", start: 15, end: 16, wordLike: true },
      { text: "買い", start: 16, end: 18, wordLike: true },
      { text: "ま", start: 18, end: 19, wordLike: true },
      { text: "した", start: 19, end: 21, wordLike: true },
    ],
  },
];
