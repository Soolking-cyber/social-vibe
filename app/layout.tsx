import { Providers } from "@/components/providers"
import AuthWrapper from "@/components/AuthWrapper"
import { GlobalVerificationStatus } from "@/components/WidgetVerificationStatus"
import "./globals.css"

export const metadata = {
  title: 'Social Impact - Drive Change Through Engagement',
  description: 'Create positive social impact through meaningful Twitter engagement and earn rewards for making a difference.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <AuthWrapper>
            {children}
            <GlobalVerificationStatus />
          </AuthWrapper>
        </Providers>
      </body>
    </html>
  )
}