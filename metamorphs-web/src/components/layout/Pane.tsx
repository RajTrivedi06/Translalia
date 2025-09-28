// src/components/layout/Pane.tsx
"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Props = {
  title: string;
  id?: string;
  collapsible?: boolean; // hides pane on <lg when true
  children: React.ReactNode;
  className?: string;
};

export default function Pane({
  title,
  id,
  collapsible,
  children,
  className = "",
}: Props) {
  return (
    <Card
      id={id}
      className={className + (collapsible ? " hidden lg:block" : "")}
      role="region"
      aria-label={title}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
