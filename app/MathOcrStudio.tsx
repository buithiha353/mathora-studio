"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Filter,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  Layers3,
  LibraryBig,
  LockKeyhole,
  Maximize2,
  PencilRuler,
  Plus,
  RefreshCcw,
  RotateCw,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  Waves,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { demoIllustrationSpec, demoOcrResult } from "@/lib/demo-data";
import { OCR_MODEL_ID, OCR_MODEL_LABEL } from "@/lib/gemini-models";

type View =
  | "review"
  | "library"
  | "exam"
  | "enhance"
  | "illustration"
  | "settings";
type Difficulty = "BIET" | "HIEU" | "VAN_DUNG" | "VAN_DUNG_CAO";
type WorkflowStage = "EMPTY" | "UPLOADED" | "REVIEW" | "COMPLETED";

type Question = {
  id?: string;
  code: string;
  grade?: number;
  content: string;
  latex: string;
  topic: string;
  difficulty: Difficulty;
  confidence?: number;
  assetCount: number;
  answer?: string;
  status?: string;
};

type Region = {
  id: string;
  label: string;
  box: number[];
  questionCode: string;
  questionId?: string | null;
  regionType?: "geometry" | "chart" | "table" | "formula";
  confidence: number;
  status?: string;
};

type OcrResult = {
  document: { name: string; pages: number; confidence: number };
  imageRegions: Region[];
  questions: Question[];
};

type ApiKeyItem = {
  id: string;
  label: string;
  projectId: string;
  hint: string;
  model: string;
  priority: number;
  usageCount: number;
  failureCount?: number;
  status: string;
  cooldownUntil?: string | null;
  lastUsedAt?: string | null;
};

type IllustrationSpec = typeof demoIllustrationSpec;

const navigation: Array<{
  id: View;
  label: string;
  description: string;
  icon: typeof ScanLine;
}> = [
  { id: "review", label: "Bàn xử lý", description: "OCR và duyệt vùng", icon: ScanLine },
  { id: "library", label: "Thư viện", description: "Kho câu hỏi", icon: LibraryBig },
  { id: "exam", label: "Tạo đề", description: "Theo ma trận", icon: FilePlus2 },
  {
    id: "enhance",
    label: "Làm nét",
    description: "Công cụ ảnh riêng",
    icon: Sparkles,
  },
  {
    id: "illustration",
    label: "Minh họa",
    description: "Vẽ hình từ đề",
    icon: WandSparkles,
  },
  { id: "settings", label: "Kết nối", description: "Gemini API", icon: KeyRound },
];

const difficultyMeta: Record<
  Difficulty,
  { label: string; short: string; className: string }
> = {
  BIET: { label: "Biết", short: "B", className: "level-know" },
  HIEU: { label: "Hiểu", short: "H", className: "level-understand" },
  VAN_DUNG: { label: "Vận dụng", short: "VD", className: "level-apply" },
  VAN_DUNG_CAO: {
    label: "Vận dụng cao",
    short: "VDC",
    className: "level-advanced",
  },
};

const stepLabels = [
  "Tải lên",
  "Nhận diện AI",
  "Duyệt vùng",
  "Kiểm tra nội dung",
  "Thư viện",
];

const initialOverview = {
  metrics: { documents: 12, questions: 248, exams: 7, activeKeys: 0 },
  questions: demoOcrResult.questions.map((question, index) => ({
    ...question,
    id: `local-${index}`,
    answer: "",
    status: "REVIEWED",
  })),
};

function IconButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DifficultyBadge({ value }: { value: Difficulty }) {
  const item = difficultyMeta[value] ?? difficultyMeta.HIEU;
  return (
    <span className={`difficulty-badge ${item.className}`}>
      <span className="difficulty-dot" />
      {item.label}
    </span>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentPaper({
  result,
  selectedRegion,
  confirmed,
  onSelectRegion,
  preview,
  previewType,
}: {
  result: OcrResult;
  selectedRegion: string;
  confirmed: string[];
  onSelectRegion: (id: string) => void;
  preview: string | null;
  previewType: string | null;
}) {
  return (
    <div className="paper-shell" aria-label="Bản xem trước tài liệu">
      <div className="paper">
        {preview && previewType?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="uploaded-preview" src={preview} alt="Tài liệu đã tải lên" />
        ) : preview && previewType === "application/pdf" ? (
          <object
            className="uploaded-preview"
            data={preview}
            type="application/pdf"
            aria-label="Tệp PDF đã tải lên"
          >
            <p>Trình duyệt không thể hiển thị PDF này.</p>
          </object>
        ) : (
          <div className="sample-page">
            <div className="paper-kicker">PHÒNG GIÁO DỤC VÀ ĐÀO TẠO</div>
            <h2>ĐỀ KIỂM TRA CHẤT LƯỢNG LỚP 9</h2>
            <div className="paper-meta">
              <span>Môn: TOÁN</span>
              <span>Thời gian: 90 phút</span>
            </div>
            <div className="paper-rule" />
            <p>
              <strong>Câu 1.</strong> Giải phương trình{" "}
              <span className="math">x² − 5x + 6 = 0</span>.
            </p>
            <div className="answers">
              <span>A. x = 2; 3</span>
              <span>B. x = −2; −3</span>
              <span>C. x = 1; 6</span>
              <span>D. x = −1; −6</span>
            </div>
            <p>
              <strong>Câu 2.</strong> Tam giác ABC vuông tại A, AB = 6 cm,
              AC = 8 cm. Tính BC.
            </p>
            <div className="display-math">BC = √(AB² + AC²)</div>
            <div className="answers">
              <span>A. 1</span>
              <span>B. 2</span>
              <span>C. 3</span>
              <span>D. 4</span>
            </div>
            <p>
              <strong>Câu 3.</strong> Một con thuyền đi qua sông rộng 120 m, hướng
              đi tạo với bờ một góc 30°. Tính quãng đường thuyền đi được.
            </p>
            <p>
              <strong>Câu 4.</strong> Từ điểm A ngoài đường tròn (O), kẻ hai
              tiếp tuyến AB và AC. Chứng minh AB = AC.
            </p>
            <div className="circle-sketch" aria-label="Hai tiếp tuyến từ A đến đường tròn O">
              <i className="circle-shape" />
              <i className="circle-line circle-line-ab" />
              <i className="circle-line circle-line-ac" />
              <i className="circle-line circle-line-ob" />
              <i className="circle-line circle-line-oc" />
              <span className="circle-point circle-point-a">A</span>
              <span className="circle-point circle-point-o">O</span>
              <span className="circle-point circle-point-b">B</span>
              <span className="circle-point circle-point-c">C</span>
            </div>
            <div className="paper-page-number">1 / {result.document.pages}</div>
          </div>
        )}

        {result.imageRegions.map((region) => {
          const [top, left, bottom, right] = region.box;
          return (
            <button
              type="button"
              key={region.id}
              className={`region-box ${
                selectedRegion === region.id ? "is-selected" : ""
              } ${confirmed.includes(region.id) ? "is-confirmed" : ""}`}
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: `${Math.max(8, right - left)}%`,
                height: `${Math.max(6, bottom - top)}%`,
              }}
              onClick={() => onSelectRegion(region.id)}
              aria-label={`Chọn vùng ${region.label}`}
            >
              <span>
                {confirmed.includes(region.id) ? <Check size={12} /> : null}
                {region.questionCode} · {region.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Sidebar({
  view,
  onChange,
  activeKeys,
}: {
  view: View;
  onChange: (view: View) => void;
  activeKeys: number;
}) {
  return (
    <aside className="sidebar">
      <button
        type="button"
        className="brand"
        onClick={() => onChange("review")}
        aria-label="Mathora Studio"
      >
        <span className="brand-mark">
          <Sigma size={21} strokeWidth={2.4} />
        </span>
        <span className="brand-copy">
          <strong>Mathora</strong>
          <small>AI assessment studio</small>
        </span>
      </button>

      <nav className="primary-nav" aria-label="Điều hướng chính">
        <p className="nav-eyebrow">Không gian làm việc</p>
        {navigation.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${view === item.id ? "is-active" : ""}`}
              onClick={() => onChange(item.id)}
            >
              <span className="nav-icon">
                <Icon size={18} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              {item.id === "review" ? <span className="nav-count">3</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />
      <div className={`key-health ${activeKeys ? "is-ready" : ""}`}>
        <span className="key-health-icon">
          {activeKeys ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
        </span>
        <div>
          <strong>{activeKeys ? `${activeKeys} Gemini key` : "Chế độ dùng thử"}</strong>
          <small>
            {activeKeys ? "Bộ xoay vòng sẵn sàng" : "Thêm key để OCR tài liệu thật"}
          </small>
        </div>
      </div>
      <button
        type="button"
        className={`nav-item nav-settings ${
          view === "settings" ? "is-active" : ""
        }`}
        onClick={() => onChange("settings")}
      >
        <span className="nav-icon">
          <Settings2 size={18} />
        </span>
        <span>
          <strong>Cài đặt</strong>
          <small>Kết nối & giới hạn</small>
        </span>
      </button>
      <div className="profile-chip">
        <span className="avatar">MN</span>
        <span>
          <strong>Minh Nguyễn</strong>
          <small>Quản trị viên</small>
        </span>
        <ChevronDown size={16} />
      </div>
    </aside>
  );
}

function WorkspaceHeader({
  title,
  eyebrow,
  onUpload,
}: {
  title: string;
  eyebrow: string;
  onUpload?: () => void;
}) {
  return (
    <header className="workspace-header">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        <button type="button" className="button button-quiet">
          <Clock3 size={16} />
          Lịch sử
        </button>
        {onUpload ? (
          <button type="button" className="button button-primary" onClick={onUpload}>
            <UploadCloud size={17} />
            Thêm tài liệu
          </button>
        ) : null}
      </div>
    </header>
  );
}

function ReviewWorkspace({
  result,
  selectedFile,
  selectedPreview,
  documentId,
  workflowStage,
  onFileChange,
  isUploading,
  isProcessing,
  isSaving,
  onProcess,
  onResultChange,
  onSaveReview,
  processingMode,
}: {
  result: OcrResult;
  selectedFile: File | null;
  selectedPreview: string | null;
  documentId: string | null;
  workflowStage: WorkflowStage;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  isProcessing: boolean;
  isSaving: boolean;
  onProcess: () => void;
  onResultChange: (result: OcrResult) => void;
  onSaveReview: (
    confirmedQuestionIds: string[],
    confirmedRegionIds: string[],
  ) => Promise<void>;
  processingMode: string | null;
}) {
  const [selectedRegion, setSelectedRegion] = useState(
    result.imageRegions[0]?.id ?? "",
  );
  const [confirmedRegions, setConfirmedRegions] = useState<string[]>([]);
  const [confirmedQuestions, setConfirmedQuestions] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<"regions" | "questions">(
    "regions",
  );
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const region =
    result.imageRegions.find((item) => item.id === selectedRegion) ??
    result.imageRegions[0];
  const question =
    result.questions[
      Math.min(selectedQuestionIndex, Math.max(0, result.questions.length - 1))
    ];
  const questionId = question?.id ?? question?.code ?? "";
  const allRegionsConfirmed = result.imageRegions.every((item) =>
    confirmedRegions.includes(item.id),
  );
  const allQuestionsConfirmed = result.questions.every((item) =>
    confirmedQuestions.includes(item.id ?? item.code),
  );
  const isBusy = isUploading || isProcessing || isSaving;

  function confirmRegion() {
    if (!region) return;
    setConfirmedRegions((current) =>
      current.includes(region.id) ? current : [...current, region.id],
    );
    const currentIndex = result.imageRegions.findIndex(
      (item) => item.id === region.id,
    );
    const next = result.imageRegions[currentIndex + 1];
    if (next) {
      setSelectedRegion(next.id);
    } else {
      setActivePanel("questions");
    }
  }

  function confirmQuestion() {
    if (!questionId) return;
    setConfirmedQuestions((current) =>
      current.includes(questionId) ? current : [...current, questionId],
    );
    if (selectedQuestionIndex < result.questions.length - 1) {
      setSelectedQuestionIndex((current) => current + 1);
    }
  }

  function updateRegion(patch: Partial<Region>) {
    if (!region) return;
    onResultChange({
      ...result,
      imageRegions: result.imageRegions.map((item) =>
        item.id === region.id ? { ...item, ...patch } : item,
      ),
    });
    setConfirmedRegions((current) =>
      current.filter((item) => item !== region.id),
    );
  }

  function updateQuestion(patch: Partial<Question>) {
    if (!question) return;
    const nextQuestion = { ...question, ...patch };
    onResultChange({
      ...result,
      questions: result.questions.map((item, index) =>
        index === selectedQuestionIndex ? nextQuestion : item,
      ),
      imageRegions:
        patch.code && question.id
          ? result.imageRegions.map((item) =>
              item.questionId === question.id
                ? { ...item, questionCode: patch.code ?? item.questionCode }
                : item,
            )
          : result.imageRegions,
    });
    setConfirmedQuestions((current) =>
      current.filter((item) => item !== questionId),
    );
  }

  function stepStatus(index: number) {
    if (workflowStage === "COMPLETED") return "done";
    if (workflowStage === "EMPTY") return index === 0 ? "active" : "upcoming";
    if (workflowStage === "UPLOADED") {
      return index < 1 ? "done" : index === 1 ? "active" : "upcoming";
    }
    const activeIndex = activePanel === "regions" ? 2 : 3;
    return index < activeIndex ? "done" : index === activeIndex ? "active" : "upcoming";
  }

  function handlePrimaryAction() {
    if (!documentId) {
      fileInput.current?.click();
      return;
    }
    if (workflowStage === "UPLOADED") {
      onProcess();
      return;
    }
    if (activePanel === "regions") {
      if (allRegionsConfirmed) setActivePanel("questions");
      else confirmRegion();
      return;
    }
    if (allQuestionsConfirmed) {
      void onSaveReview(confirmedQuestions, confirmedRegions);
    } else {
      confirmQuestion();
    }
  }

  return (
    <main className="workspace">
      <WorkspaceHeader
        eyebrow="Bàn xử lý / Duyệt vùng"
        title={selectedFile?.name ?? result.document.name}
        onUpload={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={onFileChange}
      />

      <div className="process-strip">
        <div className="stepper">
          {stepLabels.map((label, index) => {
            const status = stepStatus(index);
            return (
            <div className={`step step-${status}`} key={label}>
              <span>{status === "done" ? <Check size={12} /> : index + 1}</span>
              <strong>{label}</strong>
              {index < stepLabels.length - 1 ? <i /> : null}
            </div>
            );
          })}
        </div>
        <div className="process-meta">
          <span className={`mode-pill ${processingMode === "gemini" ? "live" : ""}`}>
            <Sparkles size={13} />
            {processingMode === "gemini"
              ? OCR_MODEL_LABEL
              : processingMode === "demo"
                ? "Bản mẫu an toàn"
                : `${OCR_MODEL_LABEL} sẵn sàng`}
          </span>
          <span>{result.document.pages} trang</span>
          <span>{result.questions.length} câu</span>
        </div>
      </div>

      <section className="review-layout">
        <div className="document-stage">
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <IconButton label="Thu nhỏ">
                <ZoomOut size={17} />
              </IconButton>
              <span className="zoom-value">86%</span>
              <IconButton label="Phóng to">
                <ZoomIn size={17} />
              </IconButton>
            </div>
            <div className="toolbar-group">
              <IconButton label="Xoay trang">
                <RotateCw size={17} />
              </IconButton>
              <IconButton label="Vừa màn hình">
                <Maximize2 size={17} />
              </IconButton>
              <IconButton label="Tùy chỉnh">
                <SlidersHorizontal size={17} />
              </IconButton>
            </div>
          </div>
          <DocumentPaper
            result={result}
            selectedRegion={region?.id ?? ""}
            confirmed={confirmedRegions}
            onSelectRegion={setSelectedRegion}
            preview={selectedPreview}
            previewType={selectedFile?.type ?? null}
          />
          <div className="stage-footer">
            <span>
              Trang <strong>1</strong> / {result.document.pages}
            </span>
            <div className="page-dots">
              <button type="button" className="is-active" aria-label="Trang 1" />
              <button type="button" aria-label="Trang 2" />
              <button type="button" aria-label="Trang 3" />
              <button type="button" aria-label="Trang 4" />
            </div>
            <span className="autosave">
              <CircleCheck size={14} />
              Đã lưu
            </span>
          </div>
        </div>

        <aside className="review-panel">
          <div className="panel-tabs">
            <button
              type="button"
              className={activePanel === "regions" ? "is-active" : ""}
              onClick={() => setActivePanel("regions")}
            >
              <ImageIcon size={15} />
              Vùng hình
              <span>
                {confirmedRegions.length}/{result.imageRegions.length}
              </span>
            </button>
            <button
              type="button"
              className={activePanel === "questions" ? "is-active" : ""}
              onClick={() => setActivePanel("questions")}
            >
              <Sigma size={15} />
              Câu hỏi
              <span>
                {confirmedQuestions.length}/{result.questions.length}
              </span>
            </button>
          </div>

          <div className="panel-scroll">
            {activePanel === "regions" ? (
              <div className="review-panel-section">
                <div className="selected-block-heading">
                  <div>
                    <p>Vùng đang chọn</p>
                    <h3>{region?.questionCode ?? "Chưa có vùng"}</h3>
                  </div>
                  <span className="review-progress">
                    {confirmedRegions.length}/{result.imageRegions.length}
                  </span>
                </div>

                {region ? (
                  <>
                    <div className="region-selector" aria-label="Danh sách vùng ảnh">
                      {result.imageRegions.map((item, index) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`${item.id === region.id ? "is-active" : ""} ${
                            confirmedRegions.includes(item.id) ? "is-confirmed" : ""
                          }`}
                          onClick={() => setSelectedRegion(item.id)}
                        >
                          {confirmedRegions.includes(item.id) ? (
                            <Check size={12} />
                          ) : (
                            index + 1
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="region-preview">
                      <div className="mini-circle">
                        <i className="mini-circle-shape" />
                        <i className="mini-tangent mini-tangent-one" />
                        <i className="mini-tangent mini-tangent-two" />
                        <b>A</b>
                        <span>O</span>
                        <em>B</em>
                        <small>C</small>
                      </div>
                      <span className="crop-label">Ảnh crop gốc · PNG</span>
                    </div>

                    <div className="confidence-row">
                      <div>
                        <span>Độ tin cậy khoanh vùng</span>
                        <strong>{Math.round(region.confidence * 100)}%</strong>
                      </div>
                      <div className="confidence-bar">
                        <i style={{ width: `${region.confidence * 100}%` }} />
                      </div>
                    </div>

                    <label className="field-group">
                      <span>Nhãn vùng</span>
                      <input
                        value={region.label}
                        onChange={(event) =>
                          updateRegion({ label: event.target.value })
                        }
                      />
                    </label>

                    <label className="field-group">
                      <span>Loại nội dung</span>
                      <select
                        value={region.regionType ?? "geometry"}
                        onChange={(event) =>
                          updateRegion({
                            regionType: event.target.value as Region["regionType"],
                          })
                        }
                      >
                        <option value="geometry">Hình học / Sơ đồ</option>
                        <option value="chart">Đồ thị / Biểu đồ</option>
                        <option value="table">Bảng dữ liệu</option>
                        <option value="formula">Công thức dạng ảnh</option>
                      </select>
                    </label>

                    <label className="field-group">
                      <span>Gắn vào câu hỏi</span>
                      <select
                        value={
                          region.questionId ??
                          result.questions.find(
                            (item) => item.code === region.questionCode,
                          )?.id ??
                          ""
                        }
                        onChange={(event) => {
                          const linked = result.questions.find(
                            (item) => item.id === event.target.value,
                          );
                          updateRegion({
                            questionId: linked?.id ?? null,
                            questionCode: linked?.code ?? region.questionCode,
                          });
                        }}
                      >
                        <option value="">Chưa gắn</option>
                        {result.questions.map((item) => (
                          <option key={item.id ?? item.code} value={item.id}>
                            {item.code}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <div className="empty-state">Không có vùng ảnh cần duyệt.</div>
                )}

                <div className="review-checklist">
                  <p>Kiểm tra nhanh</p>
                  <div>
                    <CircleCheck size={16} />
                    <span>
                      Không cắt mất nhãn
                      <small>Đủ khoảng đệm quanh hình</small>
                    </span>
                  </div>
                  <div>
                    <CircleCheck size={16} />
                    <span>
                      Đúng câu hỏi
                      <small>Ảnh sẽ đi cùng câu khi xuất đề</small>
                    </span>
                  </div>
                  <div>
                    <CircleCheck size={16} />
                    <span>
                      Giữ bản nguồn
                      <small>Tọa độ vùng được lưu riêng</small>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="review-panel-section">
                <div className="selected-block-heading">
                  <div>
                    <p>Kiểm tra nội dung</p>
                    <h3>{question?.code ?? "Chưa có câu hỏi"}</h3>
                  </div>
                  <span className="review-progress">
                    {confirmedQuestions.length}/{result.questions.length}
                  </span>
                </div>

                <div className="question-review-list" aria-label="Danh sách câu hỏi">
                  {result.questions.map((item, index) => {
                    const id = item.id ?? item.code;
                    return (
                      <button
                        type="button"
                        key={id}
                        className={`${index === selectedQuestionIndex ? "is-active" : ""} ${
                          confirmedQuestions.includes(id) ? "is-confirmed" : ""
                        }`}
                        onClick={() => setSelectedQuestionIndex(index)}
                      >
                        {confirmedQuestions.includes(id) ? <Check size={12} /> : index + 1}
                      </button>
                    );
                  })}
                </div>

                {question ? (
                  <>
                    <div className="confidence-row compact-confidence">
                      <div>
                        <span>Độ tin cậy OCR</span>
                        <strong>
                          {Math.round((question.confidence ?? 0) * 100)}%
                        </strong>
                      </div>
                    </div>

                    <label className="field-group">
                      <span>Mã câu</span>
                      <input
                        value={question.code}
                        onChange={(event) =>
                          updateQuestion({ code: event.target.value })
                        }
                      />
                    </label>

                    <label className="field-group">
                      <span>Nội dung câu hỏi</span>
                      <textarea
                        className="question-content-editor"
                        value={question.content}
                        onChange={(event) =>
                          updateQuestion({ content: event.target.value })
                        }
                      />
                    </label>

                    <label className="field-group">
                      <span>LaTeX công thức</span>
                      <textarea
                        className="formula-editor"
                        value={question.latex}
                        onChange={(event) =>
                          updateQuestion({ latex: event.target.value })
                        }
                        spellCheck={false}
                      />
                    </label>
                    <div className="formula-review-preview">
                      <Sigma size={15} />
                      <code>{question.latex || "Không có công thức riêng"}</code>
                    </div>

                    <div className="two-column-fields review-fields">
                      <label className="field-group">
                        <span>Khối lớp</span>
                        <select
                          value={question.grade ?? 9}
                          onChange={(event) =>
                            updateQuestion({ grade: Number(event.target.value) })
                          }
                        >
                          {[9, 8, 7, 6].map((grade) => (
                            <option key={grade} value={grade}>
                              Lớp {grade}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-group">
                        <span>Độ khó</span>
                        <select
                          value={question.difficulty}
                          onChange={(event) =>
                            updateQuestion({
                              difficulty: event.target.value as Difficulty,
                            })
                          }
                        >
                          {(Object.keys(difficultyMeta) as Difficulty[]).map(
                            (value) => (
                              <option key={value} value={value}>
                                {difficultyMeta[value].label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    <label className="field-group">
                      <span>Mảng kiến thức</span>
                      <input
                        value={question.topic}
                        onChange={(event) =>
                          updateQuestion({ topic: event.target.value })
                        }
                      />
                    </label>

                    <label className="field-group">
                      <span>Đáp án / Gợi ý</span>
                      <input
                        value={question.answer ?? ""}
                        onChange={(event) =>
                          updateQuestion({ answer: event.target.value })
                        }
                        placeholder="Có thể bổ sung sau"
                      />
                    </label>
                  </>
                ) : (
                  <div className="empty-state">Không có câu hỏi để kiểm tra.</div>
                )}
              </div>
            )}
          </div>

          <div className="panel-actions">
            <button
              type="button"
              className="button button-quiet grow"
              disabled={isBusy || workflowStage !== "REVIEW"}
              onClick={() => {
                if (activePanel === "regions" && region) {
                  setConfirmedRegions((current) =>
                    current.filter((item) => item !== region.id),
                  );
                } else {
                  setSelectedQuestionIndex((current) => Math.max(0, current - 1));
                }
              }}
            >
              {activePanel === "regions" ? (
                <RefreshCcw size={16} />
              ) : (
                <ChevronRight className="rotate-back" size={16} />
              )}
              {activePanel === "regions" ? "Kiểm tra lại" : "Câu trước"}
            </button>
            <button
              type="button"
              className="button button-primary grow"
              onClick={handlePrimaryAction}
              disabled={isBusy}
            >
              {isBusy ? (
                <span className="spinner" />
              ) : workflowStage === "UPLOADED" ? (
                <Sparkles size={16} />
              ) : activePanel === "questions" && allQuestionsConfirmed ? (
                <LibraryBig size={16} />
              ) : (
                <Check size={16} />
              )}
              {isUploading
                ? "Đang tải..."
                : isProcessing
                  ? "Gemini đang đọc..."
                  : isSaving
                    ? "Đang nhập thư viện..."
                    : !documentId
                      ? "Chọn tài liệu"
                      : workflowStage === "UPLOADED"
                        ? "Nhận diện tài liệu"
                        : activePanel === "regions"
                          ? allRegionsConfirmed
                            ? "Kiểm tra câu hỏi"
                            : "Xác nhận vùng"
                          : allQuestionsConfirmed
                            ? "Đưa vào thư viện"
                            : "Xác nhận câu"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function LibraryView({
  questions,
  onCreateExam,
}: {
  questions: Question[];
  onCreateExam: () => void;
}) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("ALL");
  const filtered = questions.filter((question) => {
    const matchesQuery = `${question.content} ${question.topic}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return (
      matchesQuery &&
      (difficulty === "ALL" || question.difficulty === difficulty)
    );
  });

  return (
    <main className="workspace">
      <WorkspaceHeader
        eyebrow="Thư viện / Câu hỏi đã duyệt"
        title="Thư viện câu hỏi"
      />
      <div className="library-summary">
        <div>
          <span className="summary-icon mint">
            <BookOpenCheck size={20} />
          </span>
          <div>
            <strong>{questions.length}</strong>
            <small>Câu hỏi sẵn sàng</small>
          </div>
        </div>
        <div>
          <span className="summary-icon blue">
            <Layers3 size={20} />
          </span>
          <div>
            <strong>{new Set(questions.map((question) => question.topic)).size}</strong>
            <small>Mảng kiến thức</small>
          </div>
        </div>
        <div>
          <span className="summary-icon amber">
            <Gauge size={20} />
          </span>
          <div>
            <strong>4</strong>
            <small>Mức độ nhận thức</small>
          </div>
        </div>
        <button type="button" className="button button-primary" onClick={onCreateExam}>
          <Shuffle size={17} />
          Tạo đề từ thư viện
        </button>
      </div>

      <section className="content-card library-card">
        <div className="library-tools">
          <label className="search-field">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm nội dung, công thức hoặc chủ đề..."
            />
            <kbd>⌘ K</kbd>
          </label>
          <label className="filter-select">
            <Filter size={16} />
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="BIET">Biết</option>
              <option value="HIEU">Hiểu</option>
              <option value="VAN_DUNG">Vận dụng</option>
              <option value="VAN_DUNG_CAO">Vận dụng cao</option>
            </select>
          </label>
          <button type="button" className="button button-quiet">
            <SlidersHorizontal size={16} />
            Bộ lọc
          </button>
        </div>

        <div className="question-table">
          <div className="question-table-head">
            <span>Câu hỏi</span>
            <span>Phân loại</span>
            <span>Nguồn</span>
            <span />
          </div>
          {filtered.map((question) => (
            <article className="question-row" key={question.id ?? question.code}>
              <div className="question-main">
                <span className="question-code">{question.code}</span>
                <div>
                  <p>{question.content}</p>
                  {question.latex ? (
                    <code className="latex-chip">{question.latex}</code>
                  ) : null}
                </div>
              </div>
              <div className="classification">
                <DifficultyBadge value={question.difficulty} />
                <span>{question.topic}</span>
              </div>
              <div className="source-cell">
                <span>
                  {question.assetCount ? <ImageIcon size={14} /> : <FileText size={14} />}
                  {question.assetCount ? `${question.assetCount} hình` : "Chỉ văn bản"}
                </span>
                <small>{question.status === "AWAITING_REVIEW" ? "Chờ duyệt" : "Đã duyệt"}</small>
              </div>
              <IconButton label={`Mở ${question.code}`}>
                <ChevronRight size={17} />
              </IconButton>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ExamView({
  questions,
  onNotice,
}: {
  questions: Question[];
  onNotice: (message: string) => void;
}) {
  const [title, setTitle] = useState("Đề luyện tập cuối học kỳ II");
  const [grade, setGrade] = useState(9);
  const [duration, setDuration] = useState(90);
  const [matrix, setMatrix] = useState<Record<Difficulty, number>>({
    BIET: 2,
    HIEU: 2,
    VAN_DUNG: 1,
    VAN_DUNG_CAO: 1,
  });
  const [generated, setGenerated] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const total = Object.values(matrix).reduce((sum, value) => sum + value, 0);

  async function generate() {
    setLoading(true);
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          duration,
          totalQuestions: total,
          grade,
          difficulty: matrix,
        }),
      });
      const payload = (await response.json()) as {
        exam?: { questions: Question[] };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error);
      setGenerated(payload.exam?.questions ?? []);
      onNotice("Đã tạo đề và lưu snapshot câu hỏi.");
    } catch {
      setGenerated(questions.slice(0, total));
      onNotice("Đã tạo bản xem trước từ dữ liệu hiện có.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspace">
      <WorkspaceHeader eyebrow="Bộ sinh đề / Ma trận" title="Tạo đề thi mới" />
      <section className="exam-layout">
        <div className="exam-builder content-card">
          <div className="section-heading">
            <div>
              <span className="section-number">01</span>
              <div>
                <p>Thông tin đề</p>
                <h2>Cấu hình chung</h2>
              </div>
            </div>
            <span className="required-note">Tự động lưu</span>
          </div>
          <div className="form-grid">
            <label className="field-group span-2">
              <span>Tên đề thi</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field-group">
              <span>Khối lớp</span>
              <select
                value={grade}
                onChange={(event) => setGrade(Number(event.target.value))}
              >
                <option value="9">Lớp 9</option>
                <option value="8">Lớp 8</option>
                <option value="7">Lớp 7</option>
                <option value="6">Lớp 6</option>
              </select>
            </label>
            <label className="field-group">
              <span>Thời gian</span>
              <div className="input-suffix">
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
                <span>phút</span>
              </div>
            </label>
          </div>

          <div className="builder-divider" />
          <div className="section-heading">
            <div>
              <span className="section-number">02</span>
              <div>
                <p>Ma trận nhận thức</p>
                <h2>Phân bổ độ khó</h2>
              </div>
            </div>
            <strong className="total-chip">{total} câu</strong>
          </div>

          <div className="matrix-grid">
            {(Object.keys(matrix) as Difficulty[]).map((key) => {
              const meta = difficultyMeta[key];
              return (
                <div className={`matrix-card ${meta.className}`} key={key}>
                  <div>
                    <span className="matrix-short">{meta.short}</span>
                    <strong>{meta.label}</strong>
                  </div>
                  <div className="number-stepper">
                    <button
                      type="button"
                      onClick={() =>
                        setMatrix((current) => ({
                          ...current,
                          [key]: Math.max(0, current[key] - 1),
                        }))
                      }
                      aria-label={`Giảm ${meta.label}`}
                    >
                      −
                    </button>
                    <span>{matrix[key]}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setMatrix((current) => ({
                          ...current,
                          [key]: current[key] + 1,
                        }))
                      }
                      aria-label={`Tăng ${meta.label}`}
                    >
                      +
                    </button>
                  </div>
                  <small>{total ? Math.round((matrix[key] / total) * 100) : 0}% đề</small>
                </div>
              );
            })}
          </div>

          <div className="builder-divider" />
          <div className="section-heading compact">
            <div>
              <span className="section-number">03</span>
              <div>
                <p>Nguồn câu hỏi</p>
                <h2>Quy tắc lựa chọn</h2>
              </div>
            </div>
          </div>
          <div className="rule-list">
            <label>
              <input type="checkbox" defaultChecked />
              <span>
                Loại câu gần trùng
                <small>So khớp nội dung và công thức</small>
              </span>
            </label>
            <label>
              <input type="checkbox" defaultChecked />
              <span>
                Chỉ dùng câu đã duyệt
                <small>Không lấy bản nháp hoặc đang chỉnh sửa</small>
              </span>
            </label>
            <label>
              <input type="checkbox" defaultChecked />
              <span>
                Hạn chế câu đã dùng gần đây
                <small>Không lặp lại trong 60 ngày</small>
              </span>
            </label>
          </div>
          <button
            type="button"
            className="button button-primary button-large"
            onClick={generate}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : <Sparkles size={18} />}
            {loading ? "Đang giải ma trận..." : "Tạo đề theo ma trận"}
            <ArrowRight size={17} />
          </button>
        </div>

        <aside className="exam-preview">
          <div className="preview-heading">
            <div>
              <p>Bản xem trước</p>
              <h3>{generated.length ? "Đề đã tạo" : "Đề sẽ xuất hiện ở đây"}</h3>
            </div>
            <div>
              <IconButton label="Xem toàn màn hình">
                <Eye size={17} />
              </IconButton>
              <IconButton label="Tải xuống">
                <Download size={17} />
              </IconButton>
            </div>
          </div>
          {generated.length ? (
            <div className="generated-paper">
              <div className="generated-paper-head">
                <span>MATHORA STUDIO</span>
                <strong>{title.toUpperCase()}</strong>
                <small>Thời gian làm bài: {duration} phút</small>
              </div>
              {generated.map((question, index) => (
                <div className="generated-question" key={question.id ?? index}>
                  <strong>Câu {index + 1}.</strong> {question.content}
                  {question.latex ? <code>{question.latex}</code> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="preview-empty">
              <span>
                <FileText size={28} />
              </span>
              <strong>Chưa tạo đề</strong>
              <p>
                Điều chỉnh ma trận bên trái, hệ thống sẽ chọn câu bằng bộ giải ràng
                buộc và giữ nguyên công thức, hình ảnh.
              </p>
            </div>
          )}
          <div className="preview-audit">
            <ShieldCheck size={17} />
            <span>
              <strong>Kiểm tra trước xuất</strong>
              <small>Đáp án, hình và công thức được đối soát tự động</small>
            </span>
          </div>
        </aside>
      </section>
    </main>
  );
}

function IllustrationScene({ spec }: { spec: IllustrationSpec }) {
  return (
    <div className="illustration-canvas" aria-label="Hình minh họa bài toán">
      <div className="sky-label">Bờ bên kia</div>
      <div className="mountain mountain-one" />
      <div className="mountain mountain-two" />
      <div className="tree tree-one">
        <i />
      </div>
      <div className="tree tree-two">
        <i />
      </div>
      <div className="far-bank" />
      <div className="river">
        <Waves className="wave wave-one" />
        <Waves className="wave wave-two" />
        <Waves className="wave wave-three" />
      </div>
      <div className="near-bank" />
      <div className="boat">
        <i />
        <span />
      </div>
      <div className="boat-path">
        <i />
        <span>x</span>
      </div>
      <div className="river-width">
        <i />
        <span>{spec.facts[0]?.value ?? "120 m"}</span>
      </div>
      <div className="angle-mark">
        <i />
        <span>{spec.facts[1]?.value ?? "30°"}</span>
      </div>
      <p>{spec.caption}</p>
    </div>
  );
}

type EnhanceLevel = "LIGHT" | "MEDIUM" | "STRONG";

const enhanceMeta: Record<
  EnhanceLevel,
  { label: string; description: string; strength: number; contrast: number }
> = {
  LIGHT: {
    label: "Nhẹ",
    description: "Ảnh chụp rõ, chỉ cần tăng viền chữ",
    strength: 0.16,
    contrast: 1.05,
  },
  MEDIUM: {
    label: "Vừa",
    description: "Cân bằng cho đề in và ảnh điện thoại",
    strength: 0.32,
    contrast: 1.1,
  },
  STRONG: {
    label: "Mạnh",
    description: "Bản scan mờ hoặc chữ có độ tương phản thấp",
    strength: 0.5,
    contrast: 1.16,
  },
};

async function enhanceImage(file: File, level: EnhanceLevel) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

  context.filter = `contrast(${enhanceMeta[level].contrast}) grayscale(.08)`;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  context.filter = "none";

  const imageData = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(imageData.data);
  const output = imageData.data;
  const strength = enhanceMeta[level].strength;
  const row = width * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * row + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = source[index + channel];
        const neighbors =
          source[index - 4 + channel] +
          source[index + 4 + channel] +
          source[index - row + channel] +
          source[index + row + channel];
        output[index + channel] = Math.max(
          0,
          Math.min(255, center * (1 + 4 * strength) - neighbors * strength),
        );
      }
    }
  }
  context.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png", 0.96),
  );
  if (!blob) throw new Error("Không thể xuất ảnh đã làm nét.");
  return { blob, width, height };
}

function EnhanceView({
  onNotice,
  onSendToOcr,
}: {
  onNotice: (message: string) => void;
  onSendToOcr: (file: File) => Promise<void>;
}) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);
  const [enhancedPreview, setEnhancedPreview] = useState<string | null>(null);
  const [level, setLevel] = useState<EnhanceLevel>("MEDIUM");
  const [dimensions, setDimensions] = useState("");
  const [processing, setProcessing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sourceUrl = useRef<string | null>(null);
  const enhancedUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      if (enhancedUrl.current) URL.revokeObjectURL(enhancedUrl.current);
    },
    [],
  );

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    if (enhancedUrl.current) URL.revokeObjectURL(enhancedUrl.current);
    sourceUrl.current = URL.createObjectURL(file);
    enhancedUrl.current = null;
    setSourceFile(file);
    setSourcePreview(sourceUrl.current);
    setEnhancedFile(null);
    setEnhancedPreview(null);
    setDimensions("");
    onNotice(`Đã chọn ${file.name} · ảnh gốc được giữ nguyên.`);
  }

  async function runEnhancement() {
    if (!sourceFile) {
      fileInput.current?.click();
      return;
    }
    setProcessing(true);
    try {
      const result = await enhanceImage(sourceFile, level);
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "");
      const output = new File([result.blob], `${baseName}-lam-net.png`, {
        type: "image/png",
      });
      if (enhancedUrl.current) URL.revokeObjectURL(enhancedUrl.current);
      enhancedUrl.current = URL.createObjectURL(output);
      setEnhancedFile(output);
      setEnhancedPreview(enhancedUrl.current);
      setDimensions(`${result.width} × ${result.height} px`);
      onNotice(`Đã làm nét ở mức ${enhanceMeta[level].label}; ảnh gốc không đổi.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Không thể làm nét ảnh.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main className="workspace">
      <WorkspaceHeader
        eyebrow="Studio ảnh / Công cụ độc lập"
        title="Làm nét ảnh độc lập"
        onUpload={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        className="visually-hidden"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={chooseFile}
      />
      <section className="enhance-layout">
        <div className="enhance-controls content-card">
          <div className="illustration-intro">
            <span>
              <Sparkles size={21} />
            </span>
            <div>
              <p>Công cụ riêng · Không thuộc luồng OCR</p>
              <h2>Tăng độ rõ cho ảnh đề</h2>
            </div>
          </div>

          <button
            type="button"
            className={`enhance-dropzone ${sourceFile ? "has-file" : ""}`}
            onClick={() => fileInput.current?.click()}
          >
            <span>
              {sourceFile ? <CircleCheck size={23} /> : <UploadCloud size={23} />}
            </span>
            <strong>{sourceFile?.name ?? "Chọn ảnh PNG, JPG hoặc WebP"}</strong>
            <small>
              {sourceFile
                ? `${formatFileSize(sourceFile.size)} · bấm để đổi ảnh`
                : "Xử lý ngay trên thiết bị, không ghi đè tệp gốc"}
            </small>
          </button>

          <div className="field-group">
            <span>Mức làm nét</span>
            <div className="segmented-control enhance-levels">
              {(Object.keys(enhanceMeta) as EnhanceLevel[]).map((value) => (
                <button
                  type="button"
                  className={level === value ? "is-active" : ""}
                  key={value}
                  onClick={() => setLevel(value)}
                >
                  {enhanceMeta[value].label}
                </button>
              ))}
            </div>
            <small>{enhanceMeta[level].description}</small>
          </div>

          <div className="safety-card">
            <ShieldCheck size={19} />
            <div>
              <strong>Giữ nguyên bản gốc</strong>
              <p>
                Ảnh kết quả là một tệp PNG mới. Bạn có thể tải xuống hoặc chủ động
                đưa bản này sang OCR.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="button button-primary button-large"
            onClick={runEnhancement}
            disabled={processing}
          >
            {processing ? <span className="spinner" /> : <Sparkles size={18} />}
            {processing ? "Đang làm nét..." : "Làm nét ảnh"}
            <ArrowRight size={17} />
          </button>
        </div>

        <div className="enhance-comparison">
          <div className="illustration-output-head">
            <div>
              <span className="mode-pill">
                <ImageIcon size={13} />
                So sánh trước / sau
              </span>
              <h2>{dimensions || "Bản xem trước"}</h2>
            </div>
            {enhancedFile && enhancedPreview ? (
              <div className="toolbar-group">
                <a
                  className="icon-button"
                  href={enhancedPreview}
                  download={enhancedFile.name}
                  aria-label="Tải ảnh đã làm nét"
                  title="Tải ảnh đã làm nét"
                >
                  <Download size={17} />
                </a>
              </div>
            ) : null}
          </div>

          <div className="comparison-grid">
            <figure>
              <figcaption>Ảnh gốc</figcaption>
              {sourcePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourcePreview} alt="Ảnh gốc trước khi làm nét" />
              ) : (
                <div className="comparison-empty">
                  <ImageIcon size={34} />
                  <span>Chọn ảnh để bắt đầu</span>
                </div>
              )}
            </figure>
            <figure>
              <figcaption>Ảnh đã làm nét · {enhanceMeta[level].label}</figcaption>
              {enhancedPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={enhancedPreview} alt="Ảnh sau khi làm nét" />
              ) : (
                <div className="comparison-empty">
                  <Sparkles size={34} />
                  <span>Kết quả mới sẽ xuất hiện ở đây</span>
                </div>
              )}
            </figure>
          </div>

          <div className="enhance-actions">
            <p>
              <ShieldCheck size={15} />
              Kiểm tra công thức và nét hình trước khi dùng bản đã xử lý.
            </p>
            <div>
              {enhancedFile && enhancedPreview ? (
                <a
                  className="button button-quiet"
                  href={enhancedPreview}
                  download={enhancedFile.name}
                >
                  <Download size={16} />
                  Tải PNG
                </a>
              ) : null}
              <button
                type="button"
                className="button button-primary"
                disabled={!enhancedFile}
                onClick={() => enhancedFile && void onSendToOcr(enhancedFile)}
              >
                <ScanLine size={16} />
                Đưa sang OCR
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function IllustrationView({ onNotice }: { onNotice: (message: string) => void }) {
  const [problem, setProblem] = useState(
    "Một con thuyền đi qua con sông rộng 120 m. Hướng chuyển động của thuyền tạo với bờ sông một góc 30°. Tính độ dài quãng đường thuyền đi được.",
  );
  const [mode, setMode] = useState("HYBRID");
  const [purpose, setPurpose] = useState("QUESTION");
  const [spec, setSpec] = useState<IllustrationSpec>(demoIllustrationSpec);
  const [loading, setLoading] = useState(false);
  const [generationMode, setGenerationMode] = useState("demo");

  async function generateIllustration() {
    setLoading(true);
    try {
      const response = await fetch("/api/illustrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problem, mode, purpose }),
      });
      const payload = (await response.json()) as {
        illustration?: { spec: IllustrationSpec };
        mode?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error);
      if (payload.illustration?.spec) setSpec(payload.illustration.spec);
      setGenerationMode(payload.mode ?? "demo");
      onNotice(
        payload.mode === "gemini"
          ? "Gemini đã tạo đặc tả; mọi dữ kiện đã qua kiểm tra."
          : "Đã tạo bản minh họa mẫu an toàn.",
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Không thể tạo hình.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspace">
      <WorkspaceHeader
        eyebrow="Studio minh họa / Hình 2D"
        title="Hình dung bài toán thực tế"
      />
      <section className="illustration-layout">
        <div className="illustration-controls content-card">
          <div className="illustration-intro">
            <span>
              <PencilRuler size={21} />
            </span>
            <div>
              <p>AI hiểu đề, renderer dựng hình</p>
              <h2>Biến dữ kiện thành hình minh họa</h2>
            </div>
          </div>
          <label className="field-group">
            <span>Nội dung bài toán</span>
            <textarea
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              rows={8}
            />
            <small>{problem.length} ký tự · Tiếng Việt</small>
          </label>
          <div className="two-column-fields">
            <label className="field-group">
              <span>Kiểu hình</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="HYBRID">Bối cảnh + sơ đồ</option>
                <option value="TECHNICAL_DIAGRAM">Sơ đồ kỹ thuật</option>
                <option value="CONTEXTUAL_DIAGRAM">Minh họa hoàn cảnh</option>
              </select>
            </label>
            <label className="field-group">
              <span>Mục đích</span>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                <option value="QUESTION">Đề bài · Không lộ đáp án</option>
                <option value="SOLUTION">Lời giải</option>
                <option value="TEACHING">Giảng dạy</option>
              </select>
            </label>
          </div>
          <div className="safety-card">
            <ShieldCheck size={19} />
            <div>
              <strong>Khóa dữ kiện đang bật</strong>
              <p>
                Số liệu trên hình phải truy ngược về đề. Đại lượng cần tìm không
                được tính trước ở chế độ đề bài.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="button button-primary button-large"
            onClick={generateIllustration}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : <WandSparkles size={18} />}
            {loading ? "Đang hiểu hoàn cảnh..." : "Tạo hình minh họa"}
            <ArrowRight size={17} />
          </button>
        </div>

        <div className="illustration-output">
          <div className="illustration-output-head">
            <div>
              <span className={`mode-pill ${generationMode === "gemini" ? "live" : ""}`}>
                <Sparkles size={13} />
                {generationMode === "gemini" ? "Gemini spec" : "Safe demo"}
              </span>
              <h2>Phương án 01</h2>
            </div>
            <div className="toolbar-group">
              <IconButton label="Sao chép">
                <Copy size={17} />
              </IconButton>
              <IconButton label="Toàn màn hình">
                <Maximize2 size={17} />
              </IconButton>
              <IconButton label="Tải SVG">
                <Download size={17} />
              </IconButton>
            </div>
          </div>
          <IllustrationScene spec={spec} />
          <div className="fact-panel">
            <div className="fact-panel-title">
              <div>
                <ShieldCheck size={18} />
                <strong>Dữ kiện đã xác minh</strong>
              </div>
              <span>{spec.facts.length}/{spec.facts.length} hợp lệ</span>
            </div>
            <div className="fact-list">
              {spec.facts.map((fact) => (
                <div key={`${fact.label}-${fact.value}`}>
                  <span>
                    <Check size={13} />
                  </span>
                  <div>
                    <small>{fact.label}</small>
                    <strong>{fact.value}</strong>
                  </div>
                  <em>Trong đề</em>
                </div>
              ))}
            </div>
          </div>
          <div className="illustration-actions">
            <button type="button" className="button button-quiet">
              <RefreshCcw size={16} />
              Tạo phương án khác
            </button>
            <button type="button" className="button button-primary">
              <Check size={16} />
              Dùng hình này
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function SettingsView({
  keys,
  refreshKeys,
  onNotice,
}: {
  keys: ApiKeyItem[];
  refreshKeys: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [projectId, setProjectId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(OCR_MODEL_ID);
  const [priority, setPriority] = useState(5);
  const [saving, setSaving] = useState(false);

  async function saveKey(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, projectId, apiKey, model, priority }),
      });
      const payload = (await response.json()) as {
        error?: string;
        warning?: string;
      };
      if (!response.ok) throw new Error(payload.error);
      setLabel("");
      setProjectId("");
      setApiKey("");
      await refreshKeys();
      onNotice(payload.warning ?? "API key đã được kiểm tra và mã hóa.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Không thể lưu API key.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: string) {
    const response = await fetch("/api/keys", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      await refreshKeys();
      onNotice("Đã xóa key khỏi bộ xoay vòng.");
    }
  }

  return (
    <main className="workspace">
      <WorkspaceHeader
        eyebrow="Cài đặt / Gemini"
        title="Kết nối và xoay vòng API key"
      />
      <section className="settings-layout">
        <div className="content-card settings-main">
          <div className="section-heading">
            <div>
              <span className="section-number">
                <KeyRound size={17} />
              </span>
              <div>
                <p>Kho bí mật</p>
                <h2>Gemini API keys</h2>
              </div>
            </div>
            <span className="safe-tag">
              <LockKeyhole size={13} />
              AES-GCM
            </span>
          </div>

          {keys.length ? (
            <div className="key-list">
              {keys.map((key) => (
                <article className="key-row" key={key.id}>
                  <span className={`key-status ${key.status.toLowerCase()}`}>
                    <KeyRound size={17} />
                  </span>
                  <div className="key-identity">
                    <div>
                      <strong>{key.label}</strong>
                      <span
                        className={`status-badge ${
                          key.status === "ACTIVE" ? "active" : ""
                        }`}
                      >
                        {key.status}
                      </span>
                    </div>
                    <code>{key.hint}</code>
                  </div>
                  <div className="key-project">
                    <small>Project</small>
                    <span>{key.projectId}</span>
                  </div>
                  <div className="key-usage">
                    <small>Lượt gọi</small>
                    <strong>{key.usageCount}</strong>
                  </div>
                  <div className="priority-pill">P{key.priority}</div>
                  <IconButton label={`Xóa ${key.label}`} onClick={() => deleteKey(key.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </article>
              ))}
            </div>
          ) : (
            <div className="key-empty">
              <span>
                <KeyRound size={24} />
              </span>
              <div>
                <strong>Chưa có Gemini API key</strong>
                <p>
                  Ứng dụng đang dùng dữ liệu mẫu. Thêm key để nhận diện PDF và tạo
                  đặc tả hình thực tế.
                </p>
              </div>
            </div>
          )}

          <div className="builder-divider" />
          <form className="key-form" onSubmit={saveKey}>
            <div className="section-heading compact">
              <div>
                <span className="section-number">
                  <Plus size={17} />
                </span>
                <div>
                  <p>Kết nối mới</p>
                  <h2>Thêm API key</h2>
                </div>
              </div>
            </div>
            <div className="form-grid">
              <label className="field-group">
                <span>Tên gợi nhớ</span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Gemini chính"
                  required
                />
              </label>
              <label className="field-group">
                <span>Google Cloud project</span>
                <input
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  placeholder="mathora-production"
                  required
                />
              </label>
              <label className="field-group span-2">
                <span>API key</span>
                <div className="secret-input">
                  <LockKeyhole size={16} />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="AIza..."
                    required
                  />
                </div>
              </label>
              <label className="field-group">
                <span>Model nhận diện đề</span>
                <select value={model} onChange={(event) => setModel(event.target.value)}>
                  <option value={OCR_MODEL_ID}>{OCR_MODEL_LABEL}</option>
                </select>
                <small>Model ổn định được ghim riêng cho bước nhận diện OCR.</small>
              </label>
              <label className="field-group">
                <span>Độ ưu tiên: {priority}</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value))}
                />
              </label>
            </div>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <ShieldCheck size={17} />}
              {saving ? "Đang xác thực..." : "Kiểm tra và lưu key"}
            </button>
          </form>
        </div>

        <aside className="settings-aside">
          <div className="info-card">
            <span className="summary-icon mint">
              <Shuffle size={20} />
            </span>
            <h3>Xoay vòng theo sức khỏe</h3>
            <p>
              Hệ thống chọn key theo project, ưu tiên và lượng tải; tự cooldown khi
              gặp lỗi tạm thời.
            </p>
            <div className="mini-flow">
              <span>Active</span>
              <ArrowRight size={14} />
              <span>Cooldown</span>
              <ArrowRight size={14} />
              <span>Probe</span>
            </div>
          </div>
          <div className="info-card">
            <span className="summary-icon blue">
              <Database size={20} />
            </span>
            <h3>Quota theo project</h3>
            <p>
              Các key cùng project chia sẻ hạn mức. Bộ điều phối không chuyển giữa
              chúng để né lỗi 429.
            </p>
          </div>
          <div className="info-card usage-card">
            <div>
              <Activity size={18} />
              <strong>Ngân sách tháng</strong>
            </div>
            <span>0 / 2.000.000 token</span>
            <div className="usage-bar">
              <i style={{ width: "4%" }} />
            </div>
            <small>Cảnh báo ở mức 80% · Khóa ở 100%</small>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function MathOcrStudio() {
  const [view, setView] = useState<View>("review");
  const [overview, setOverview] = useState(initialOverview);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [ocrResult, setOcrResult] = useState<OcrResult>(demoOcrResult as OcrResult);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [workflowStage, setWorkflowStage] =
    useState<WorkflowStage>("EMPTY");
  const [reviewNonce, setReviewNonce] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingMode, setProcessingMode] = useState<string | null>("demo");
  const [notice, setNotice] = useState<string | null>(null);

  const questions = useMemo(
    () => overview.questions as Question[],
    [overview.questions],
  );

  async function loadOverview() {
    try {
      const response = await fetch("/api/overview");
      if (!response.ok) return;
      const payload = (await response.json()) as typeof initialOverview;
      setOverview(payload);
    } catch {
      // Local demo remains usable when platform storage is unavailable.
    }
  }

  async function loadKeys() {
    try {
      const response = await fetch("/api/keys");
      if (!response.ok) return;
      const payload = (await response.json()) as { keys: ApiKeyItem[] };
      setKeys(payload.keys);
    } catch {
      // Keep the secure-key view usable in demo mode.
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOverview();
      void loadKeys();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function uploadForOcr(file: File) {
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    const preview = URL.createObjectURL(file);
    setSelectedFile(file);
    setSelectedPreview(preview);
    setDocumentId(null);
    setWorkflowStage("EMPTY");
    setProcessingMode(null);
    setReviewNonce((current) => current + 1);
    setIsUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sharpenProfile", "NONE");
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const payload = (await response.json()) as {
        document?: { id: string };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error);
      setDocumentId(payload.document?.id ?? null);
      setWorkflowStage("UPLOADED");
      setNotice(`Đã tải ${file.name} · ${formatFileSize(file.size)}`);
      await loadOverview();
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể tải tài liệu lên kho.",
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await uploadForOcr(file);
  }

  async function sendEnhancedToOcr(file: File) {
    const uploaded = await uploadForOcr(file);
    if (uploaded) {
      setView("review");
      setNotice("Ảnh đã làm nét đã được đưa sang Bàn xử lý. Sẵn sàng nhận diện.");
    }
  }

  async function processDocument() {
    if (!documentId) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const payload = (await response.json()) as {
        result?: OcrResult;
        mode?: string;
        model?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error);
      if (payload.result) setOcrResult(payload.result);
      setProcessingMode(payload.mode ?? "demo");
      setWorkflowStage("REVIEW");
      setReviewNonce((current) => current + 1);
      setNotice(
        payload.mode === "gemini"
          ? `Đã nhận diện bằng ${payload.model ?? "Gemini"}; cần duyệt vùng ảnh.`
          : "Chưa có API key; đang hiển thị kết quả mẫu để duyệt luồng.",
      );
      await loadOverview();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xử lý tài liệu.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function saveReview(
    confirmedQuestionIds: string[],
    confirmedRegionIds: string[],
  ) {
    if (!documentId) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentId,
          questions: ocrResult.questions.map((question) => ({
            id: question.id,
            code: question.code,
            content: question.content,
            latex: question.latex,
            grade: question.grade ?? 9,
            topic: question.topic,
            difficulty: question.difficulty,
            answer: question.answer ?? "",
            assetCount: question.assetCount,
          })),
          regions: ocrResult.imageRegions.map((region) => ({
            id: region.id,
            label: region.label,
            regionType: region.regionType ?? "geometry",
            box: region.box,
            questionId:
              region.questionId ??
              ocrResult.questions.find(
                (question) => question.code === region.questionCode,
              )?.id ??
              null,
            questionCode: region.questionCode,
          })),
          confirmedQuestionIds,
          confirmedRegionIds,
        }),
      });
      const payload = (await response.json()) as {
        reviewed?: { questions: number; regions: number };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error);
      setWorkflowStage("COMPLETED");
      await loadOverview();
      setNotice(
        `Đã nhập ${payload.reviewed?.questions ?? ocrResult.questions.length} câu đã duyệt vào thư viện.`,
      );
      setView("library");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể nhập câu hỏi vào thư viện.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        onChange={setView}
        activeKeys={
          overview.metrics.activeKeys ||
          keys.filter((key) => key.status === "ACTIVE").length
        }
      />
      {view === "review" ? (
        <ReviewWorkspace
          key={reviewNonce}
          result={ocrResult}
          selectedFile={selectedFile}
          selectedPreview={selectedPreview}
          documentId={documentId}
          workflowStage={workflowStage}
          onFileChange={handleFileChange}
          isUploading={isUploading}
          isProcessing={isProcessing}
          isSaving={isSaving}
          onProcess={processDocument}
          onResultChange={setOcrResult}
          onSaveReview={saveReview}
          processingMode={processingMode}
        />
      ) : null}
      {view === "library" ? (
        <LibraryView questions={questions} onCreateExam={() => setView("exam")} />
      ) : null}
      {view === "exam" ? <ExamView questions={questions} onNotice={setNotice} /> : null}
      {view === "enhance" ? (
        <EnhanceView onNotice={setNotice} onSendToOcr={sendEnhancedToOcr} />
      ) : null}
      {view === "illustration" ? <IllustrationView onNotice={setNotice} /> : null}
      {view === "settings" ? (
        <SettingsView
          keys={keys}
          refreshKeys={async () => {
            await loadKeys();
            await loadOverview();
          }}
          onNotice={setNotice}
        />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          <CircleCheck size={17} />
          {notice}
        </div>
      ) : null}
    </div>
  );
}
