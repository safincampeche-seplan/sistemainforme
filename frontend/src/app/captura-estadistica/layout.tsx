"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CapturaEstadisticaLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedRoute module="CAPTURA">{children}</ProtectedRoute>;
}
