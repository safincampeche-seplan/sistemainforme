"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: number | string;
    name: string;
    email: string;
    roles: string[];
    dependency?: string;
    dependency_id?: string | null;
    mission_id?: string | null;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    selectedPeriod: number;
    setPeriod: (period: number) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<number>(2026);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const savedToken = localStorage.getItem('v2_token');
        const savedUser = localStorage.getItem('v2_user');

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }

        const savedPeriod = localStorage.getItem('v2_period');
        if (savedPeriod) {
            setSelectedPeriod(parseInt(savedPeriod));
        }

        setLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('v2_token', newToken);
        localStorage.setItem('v2_user', JSON.stringify(newUser));
        router.push('/');
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('v2_token');
        localStorage.removeItem('v2_user');
        router.push('/login');
    };

    const setPeriod = (period: number) => {
        setSelectedPeriod(period);
        localStorage.setItem('v2_period', period.toString());
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, selectedPeriod, setPeriod, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
