export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Fill viewport below header; prevent page-level scrolling for workspace only
    <div className="h-[calc(100vh-var(--header-h))] overflow-hidden">
      {children}
    </div>
  );
}
