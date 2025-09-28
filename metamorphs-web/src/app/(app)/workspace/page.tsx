// Simplified MVP workspace layout (replaces legacy shell)
// TODO: Journey view (post-MVP)
import Pane from "@/components/layout/Pane";
import ChatComposer from "@/components/chat/ChatComposer";
import UploadsTray from "@/components/chat/UploadsTray";
import AttachmentButton from "@/components/chat/AttachmentButton";
import { useUploadsStore } from "@/state/uploads";
import PoemViewer from "@/components/poem/PoemViewer";
import LineFrame from "@/components/poem/LineFrame";
import ExplodedLineView from "@/components/poem/ExplodedLineView";
import VersionsGrid from "@/components/versions/VersionsGrid";
import NotebookPanel from "@/components/notebook/NotebookPanel";

const DEMO_POEM = `Je est un autre.
Le Poète se fait voyant…`;

const DEMO_EXPLODED = [
  {
    idx: 1,
    tokens: [
      { surface: "Je", options: ["I", "Me", "I myself"] },
      { surface: "est", options: ["is", "am (intentional)", "be"] },
      { surface: "un autre", options: ["another", "an other", "someone else"] },
    ],
  },
];

const DEMO_VERSIONS = [
  {
    id: "A",
    title: "Standard/Poetic",
    text: "I am another.\nThe poet makes himself a seer…",
    meta: { model: "gpt-4o-mini" },
  },
  {
    id: "B",
    title: "Vernacular",
    text: "Me, I’m an other guy.\nPoets turn into seers…",
    meta: { model: "gpt-4o-mini" },
  },
  {
    id: "C",
    title: "Creole-ish",
    text: "Mi is a nex one.\nDi poet make demself a seer…",
    meta: { model: "gpt-4o-mini" },
  },
];

export const metadata = { title: "Workspace • Metamorphs" };

export default function WorkspacePage() {
  const { items, add } = useUploadsStore();
  function onFiles(files: FileList) {
    Array.from(files).forEach((f) =>
      add({ name: f.name, size: f.size, status: "queued" } as any)
    );
  }
  return (
    <main className="mx-auto max-w-[1400px] p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Chat & Source */}
        <Pane title="Chat & Source" className="lg:col-span-3">
          <PoemViewer text={DEMO_POEM} />
          <LineFrame lines={6} />
          <div className="mt-4">
            <AttachmentButton onFiles={onFiles} />
          </div>
          <div className="mt-4">
            <UploadsTray items={items} />
          </div>
          <div className="mt-4">
            <ChatComposer />
          </div>
        </Pane>

        {/* Center: Suggestions */}
        <Pane title="Suggestions" className="lg:col-span-6">
          <ExplodedLineView lines={DEMO_EXPLODED as any} />
          <div className="mt-4">
            <VersionsGrid versions={DEMO_VERSIONS as any} source={DEMO_POEM} />
          </div>
        </Pane>

        {/* Right: Notebook (collapsible on <lg) */}
        <Pane
          title="Notebook"
          collapsible
          className="lg:col-span-3"
          id="notebook-panel"
        >
          <NotebookPanel />
        </Pane>
      </div>
    </main>
  );
}
