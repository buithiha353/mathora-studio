import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Mathora Studio",
      template: "%s · Mathora Studio",
    },
    description:
      "OCR đề thi Toán THCS bằng Gemini, bảo toàn công thức, hình ảnh và cấu trúc câu hỏi.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Mathora Studio",
      description: "OCR đề Toán THCS. Giữ trọn công thức & hình ảnh.",
      type: "website",
      locale: "vi_VN",
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1731,
          height: 909,
          alt: "Mathora Studio — không gian OCR đề thi Toán THCS",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Mathora Studio",
      description: "OCR đề Toán THCS. Giữ trọn công thức & hình ảnh.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
