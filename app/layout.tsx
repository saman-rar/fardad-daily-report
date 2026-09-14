import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "گزارش‌کار فرداد",
  description: "سامانه هوشمند ثبت و مدیریت گزارش‌کار روزانه فناوران سپهر فرداد",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className={vazirmatn.className}>
        <div className="glass-grid" />
        <div className="floating-orb right-[-8rem] top-[-6rem] h-80 w-80 bg-emerald-300/50" />
        <div className="floating-orb bottom-[-8rem] left-[-6rem] h-96 w-96 bg-lime-200/40 [animation-delay:1.8s]" />
        {children}
      </body>
    </html>
  );
}
