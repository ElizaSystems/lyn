import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LYN AI Lite - Free Link Security Check",
  description: "Check suspicious links with LYN AI - Free crypto security assistant",
  keywords: "crypto security, link checker, phishing detection, scam detection, web3 security",
  openGraph: {
    title: "LYN AI Lite - Free Link Security Check",
    description: "Check suspicious links with LYN AI - Free crypto security assistant",
    images: ["/logo.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LYN AI Lite",
    description: "Free crypto link security checker",
    images: ["/logo.jpg"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        <div className="min-h-screen flex flex-col">
          {/* Simple Header */}
          <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/logo.jpg" alt="LYN AI" className="w-8 h-8 rounded-full" />
                <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  LYN AI Lite
                </span>
                <span className="text-xs text-zinc-500 ml-2">Free Link Checker</span>
              </div>
              
              {/* Premium Button */}
              <a
                href="https://app.lynai.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="relative group"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                <button className="relative px-6 py-2 bg-black rounded-lg leading-none flex items-center divide-x divide-gray-600">
                  <span className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-100 font-semibold">LYN HEAVY</span>
                  </span>
                  <span className="pl-4 text-purple-400 group-hover:text-purple-300 transition duration-200">
                    Full Features →
                  </span>
                </button>
              </a>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Simple Footer */}
          <footer className="border-t border-zinc-800 py-4 mt-auto">
            <div className="container mx-auto px-4 text-center text-sm text-zinc-500">
              <p>Free tier: 2 link checks per day</p>
              <p className="mt-1">
                Need more? Try{" "}
                <a 
                  href="https://app.lynai.xyz" 
                  className="text-purple-400 hover:text-purple-300 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LYN HEAVY
                </a>
                {" "}for unlimited checks, wallet security, and more
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}