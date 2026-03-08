"use client";

import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "./AccessDenied";
import { ModuleName, hasPermission } from "@/lib/permissions";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
    children: React.ReactNode;
    module: ModuleName;
}

export function ProtectedRoute({ children, module }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        if (!loading) {
            setIsAuthorized(hasPermission(user?.roles, module));
        }
    }, [user, loading, module]);

    if (loading || isAuthorized === null) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center">
                <div className="h-8 w-8 border-4 border-guinda-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return <AccessDenied />;
    }

    return <>{children}</>;
}
