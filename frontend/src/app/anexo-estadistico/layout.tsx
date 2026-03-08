"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AnexoEstadisticoLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedRoute module="REVISION">{children}</ProtectedRoute>;
}
