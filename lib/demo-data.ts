export const demoOcrResult = {
  document: {
    name: "Đề kiểm tra Toán 9 · Học kỳ II",
    pages: 4,
    confidence: 96.8,
  },
  imageRegions: [
    {
      id: "region-geometry",
      label: "Hình học đường tròn",
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
      grade: 9,
      content: "Giải phương trình x² − 5x + 6 = 0.",
      latex: "x^2-5x+6=0",
      topic: "Phương trình bậc hai",
      difficulty: "HIEU",
      confidence: 0.98,
      assetCount: 0,
    },
    {
      code: "Câu 2",
      grade: 9,
      content: "Tam giác ABC vuông tại A, có AB = 6 cm và AC = 8 cm. Tính BC.",
      latex: "BC=\\sqrt{AB^2+AC^2}",
      topic: "Định lý Pythagore",
      difficulty: "BIET",
      confidence: 0.99,
      assetCount: 1,
    },
    {
      code: "Câu 3",
      grade: 9,
      content: "Một con thuyền đi qua sông rộng 120 m, hướng đi tạo với bờ một góc 30°.",
      latex: "d=\\frac{120}{\\cos30^\\circ}",
      topic: "Hệ thức lượng",
      difficulty: "VAN_DUNG",
      confidence: 0.93,
      assetCount: 1,
    },
    {
      code: "Câu 4",
      grade: 9,
      content: "Từ điểm A ngoài đường tròn (O), kẻ hai tiếp tuyến AB và AC. Chứng minh AB = AC.",
      latex: "AB=AC",
      topic: "Đường tròn",
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
