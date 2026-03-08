"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CapturaNarrativaLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedRoute module="CAPTURA">{children}</ProtectedRoute>;
}
