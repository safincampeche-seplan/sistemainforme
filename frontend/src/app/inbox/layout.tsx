"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedRoute module="REVISION">{children}</ProtectedRoute>;
}
