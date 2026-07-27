import type { Metadata } from "next";
import { MathOcrStudio } from "./MathOcrStudio";

export const metadata: Metadata = {
  title: "Mathora Studio",
  description:
    "Không gian OCR đề thi Toán, bảo toàn công thức, hình ảnh và cấu trúc câu hỏi.",
};

export default function Home() {
  return <MathOcrStudio />;
}
