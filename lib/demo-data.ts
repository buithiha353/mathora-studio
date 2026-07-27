export const demoOcrResult = {
  document: {
    name: "Đề khảo sát Toán 12 · Học kỳ II",
    pages: 4,
    confidence: 96.8,
  },
  imageRegions: [
    {
      id: "region-geometry",
      label: "Hình học không gian",
      box: [48, 55, 73, 91],
      questionCode: "Câu 4",
      confidence: 0.94,
    },
    {
      id: "region-formula",
      label: "Công thức hiển thị",
      box: [24, 12, 33, 88],
      questionCode: "Câu 2",
      confidence: 0.98,
    },
  ],
  questions: [
    {
      code: "Câu 1",
      content: "Cho hàm số y = x³ − 3x + 1. Tìm các điểm cực trị của hàm số.",
      latex: "y=x^3-3x+1",
      topic: "Hàm số",
      difficulty: "HIEU",
      confidence: 0.98,
      assetCount: 0,
    },
    {
      code: "Câu 2",
      content: "Tính tích phân ∫₀¹(3x² + 2x)dx.",
      latex: "\\int_0^1(3x^2+2x)\\,dx",
      topic: "Nguyên hàm – Tích phân",
      difficulty: "BIET",
      confidence: 0.99,
      assetCount: 0,
    },
    {
      code: "Câu 3",
      content: "Một con thuyền đi qua sông rộng 120 m, hướng đi tạo với bờ một góc 30°.",
      latex: "d=\\frac{120}{\\cos30^\\circ}",
      topic: "Hệ thức lượng",
      difficulty: "VAN_DUNG",
      confidence: 0.93,
      assetCount: 1,
    },
    {
      code: "Câu 4",
      content: "Cho hình chóp S.ABCD có đáy là hình vuông cạnh a và SA vuông góc với đáy.",
      latex: "SA\\perp(ABCD)",
      topic: "Hình học không gian",
      difficulty: "VAN_DUNG_CAO",
      confidence: 0.91,
      assetCount: 1,
    },
  ],
};

export const demoIllustrationSpec = {
  illustrationType: "CONTEXTUAL_DIAGRAM",
  environment: "river",
  purpose: "QUESTION",
  toScale: false,
  facts: [
    { label: "Độ rộng sông", value: "120 m", sourceVerified: true },
    { label: "Góc lệch", value: "30°", sourceVerified: true },
    { label: "Quãng đường cần tìm", value: "x", sourceVerified: true },
  ],
  caption: "Hình minh họa không theo tỉ lệ",
};
