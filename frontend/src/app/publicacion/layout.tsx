"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function PublicacionLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedRoute module="EXPORTACION">{children}</ProtectedRoute>;
}
