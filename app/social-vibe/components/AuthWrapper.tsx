"use client"

import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import Navigation from "./Navigation"

interface AuthWrapperProps {
    children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        // If not loading and no session, redirect to login (except if already on login page)
        if (status !== "loading" && !session && pathname !== '/login') {
            router.push('/login')
        }

        // If authenticated and on login page, redirect to home
        if (session && pathname === '/login') {
            router.push('/')
        }
    }, [session, status, router, pathname])

    // Show loading spinner while checking authentication
    if (status === "loading") {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-300 text-sm">Loading...</span>
                </div>
            </div>
        )
    }

    // If on login page, show without navigation
    if (pathname === '/login') {
        return <>{children}</>
    }

    // If not authenticated and not on login page, show loading (will redirect)
    if (!session) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-300 text-sm">Redirecting to login...</span>
                </div>
            </div>
        )
    }

    // User is authenticated, show navigation and protected content
    return (
        <>
            <Navigation />
            {children}
        </>
    )
}