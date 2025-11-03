export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Fill viewport below global header for all workspaces routes
    <div className="h-[calc(100vh-var(--header-h))] overflow-hidden">
      {children}
    </div>
  );
}
