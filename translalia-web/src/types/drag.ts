/**
 * Drag and Drop Type Definitions
 *
 * These types define the data structure for dragging translation options
 * from the Workshop to the Notebook.
 */

export interface DragData {
  /** Unique identifier for the dragged item */
  id: string;

  /** The translated word/text being dragged */
  text: string;

  /** The original source word */
  originalWord: string;

  /** Part of speech tag for the word */
  partOfSpeech?:
    | "noun"
    | "verb"
    | "adjective"
    | "adverb"
    | "pronoun"
    | "preposition"
    | "conjunction"
    | "article"
    | "interjection"
    | "neutral";

  /** Source line number in the poem */
  sourceLineNumber: number;

  /** Position of word in the source line */
  position: number;

  /** Type of drag item to distinguish between source words and translation options */
  dragType: "sourceWord" | "option";
}

export type DragSource = "workshop" | "notebook";

export interface DragContext {
  source: DragSource;
  data: DragData;
}
