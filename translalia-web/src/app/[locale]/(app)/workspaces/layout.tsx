export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Fill viewport below global header for all workspaces routes
    // Changed from overflow-hidden to overflow-y-auto to enable scrolling
    <div className="h-[calc(100vh-var(--header-h))] overflow-y-auto">
      {children}
    </div>
  );
}
