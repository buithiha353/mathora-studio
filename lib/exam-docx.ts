import {
  AlignmentType,
  Document,
  Footer,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export type ExamDocxAsset = {
  id: string;
  label: string;
  data: Uint8Array;
  width: number;
  height: number;
};

export type ExamDocxQuestion = {
  content: string;
  latex?: string;
  assets?: ExamDocxAsset[];
};

export function createExamDocument({
  title,
  duration,
  questions,
}: {
  title: string;
  duration: number;
  questions: ExamDocxQuestion[];
}) {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "MATHORA STUDIO",
          bold: true,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          font: "Times New Roman",
          size: 30,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Môn: Toán THCS  •  Thời gian làm bài: ${duration} phút`,
          italics: true,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    }),
  ];

  questions.forEach((question, index) => {
    children.push(
      new Paragraph({
        spacing: { before: index === 0 ? 0 : 120, after: 80, line: 300 },
        keepNext: Boolean(question.latex || question.assets?.length),
        children: [
          new TextRun({
            text: `Câu ${index + 1}. `,
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
          new TextRun({
            text: question.content,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
    );

    if (question.latex) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: question.latex,
              font: "Cambria Math",
              size: 23,
              italics: true,
            }),
          ],
        }),
      );
    }

    for (const asset of question.assets ?? []) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new ImageRun({
              type: "png",
              data: asset.data,
              transformation: {
                width: asset.width,
                height: asset.height,
              },
              altText: {
                title: asset.label,
                description: `Hình đi kèm câu ${index + 1}: ${asset.label}`,
                name: asset.id,
              },
            }),
          ],
        }),
      );
    }
  });

  return new Document({
    creator: "Mathora Studio",
    title,
    description: "Đề thi Toán THCS được xuất từ Mathora Studio",
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24,
          },
          paragraph: {
            spacing: { after: 80, line: 300 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: 1134,
              right: 1134,
              bottom: 1134,
              left: 1134,
              header: 567,
              footer: 567,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Mathora Studio • Đề thi Toán THCS",
                    color: "6B756F",
                    font: "Times New Roman",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

export async function packExamDocument(options: Parameters<typeof createExamDocument>[0]) {
  return Packer.toBlob(createExamDocument(options));
}
