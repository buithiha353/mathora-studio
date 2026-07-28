# Kế hoạch dự án Mathora Studio

## 1. Mục tiêu

Xây dựng ứng dụng web hỗ trợ số hóa, quản lý và tái sử dụng đề thi Toán THCS
(lớp 6–9) bằng Gemini AI. Hệ thống phải bảo toàn công thức, hình ảnh và thứ tự
câu hỏi; mọi kết quả AI quan trọng đều cần người dùng kiểm tra trước khi đưa vào
thư viện hoặc tạo đề.

## 2. Phạm vi sản phẩm

Mathora Studio gồm bốn phân hệ:

1. **OCR đề thi** — luồng nghiệp vụ chính.
2. **Thư viện câu hỏi và tạo đề** — nhận dữ liệu đã duyệt từ OCR.
3. **Làm nét ảnh** — công cụ độc lập, không thuộc combo OCR.
4. **Vẽ hình minh họa** — công cụ độc lập, không thuộc combo OCR.

Hai công cụ “Làm nét ảnh” và “Vẽ hình minh họa” có thể chuyển kết quả sang các
phân hệ khác khi người dùng chủ động yêu cầu, nhưng không được tự động chạy
trong quy trình OCR.

## 3. Luồng chính: OCR đề thi

### 3.1. Đầu vào

- Hỗ trợ PDF, PNG, JPG, JPEG và WebP.
- Kiểm tra định dạng, dung lượng và khả năng đọc trước khi xử lý.
- Lưu tệp gốc để đối chiếu và tái xử lý.
- Với PDF, dùng PDF.js render từng trang thành PNG độ phân giải cao, lưu riêng
  theo số trang và chỉ gửi các ảnh trang này cho Gemini.
- Không tự động làm nét ảnh.

### 3.2. Nhận diện bằng AI

- Bước 1 chỉ phân tích bố cục bằng Document Layout AI, không OCR nội dung.
- Layout Map phải liệt kê toàn bộ vùng theo đúng thứ tự đọc, dùng tọa độ pixel
  của ảnh trang gốc và đánh dấu `need_review` khi độ tin cậy dưới 0,95.
- Không gộp vùng khác loại; đặc biệt tách riêng số câu, văn bản, công thức,
  ảnh thực tế, bảng, đồ thị, hình học và sơ đồ.
- Bước 2 mới OCR nội dung dựa trên ranh giới và thứ tự của Layout Map.
- Cho phép mỗi API key chọn một trong các model:
  `gemini-2.5-flash`, `gemini-3.5-flash-lite` hoặc
  `gemini-3.1-flash-lite`.
- Đọc nội dung theo đúng thứ tự thị giác đã xác định.
- Nhận diện văn bản tiếng Việt và ký hiệu Toán THCS.
- Chuyển công thức sang LaTeX nhưng vẫn giữ nội dung gốc để đối chiếu.
- Phát hiện hình học, đồ thị, bảng, biểu đồ và hình minh họa.
- Trả về tọa độ vùng ảnh theo từng trang và liên kết vùng ảnh với câu hỏi.
- Không tự sửa, suy diễn hoặc bổ sung dữ kiện không có trong đề.

### 3.3. Kiểm tra vùng ảnh bắt buộc

- Hiển thị vùng AI đã khoanh trên bản xem trước.
- Cho phép kéo trực tiếp để di chuyển vùng, dùng tám tay nắm để thay đổi kích
  thước và nhập tọa độ phần trăm để chỉnh chính xác.
- Tự chuyển bản xem trước đến đúng trang của vùng đang chọn.
- Cho phép người dùng thêm hoặc xóa vùng.
- Cho phép sửa loại vùng và câu hỏi được liên kết.
- Chỉ chuyển sang bước tiếp theo khi người dùng xác nhận vùng ảnh.
- Lưu ảnh cắt sau xác nhận dưới dạng tài sản độc lập.

### 3.4. Tách và chuẩn hóa câu hỏi

- Tách đề thành từng câu hỏi độc lập.
- Giữ nguyên số thứ tự, nội dung, công thức và vị trí hình ảnh.
- Nhận diện dạng câu hỏi: trắc nghiệm, đúng/sai, trả lời ngắn hoặc tự luận.
- Không đưa câu chưa duyệt vào thư viện.

### 3.5. Phân loại câu hỏi

- Xác định lớp 6, 7, 8 hoặc 9.
- Phân loại theo mảng kiến thức và chủ đề Toán THCS.
- Phân loại độ khó theo bốn mức:
  - Biết
  - Hiểu
  - Vận dụng
  - Vận dụng cao
- Lưu độ tin cậy và cho phép người dùng chỉnh sửa toàn bộ nhãn AI.

### 3.6. Duyệt câu hỏi

- Hiển thị đồng thời ảnh nguồn, nội dung nhận diện và công thức LaTeX.
- Cho phép sửa nội dung, công thức, đáp án, lớp, chủ đề và độ khó.
- Yêu cầu xác nhận thủ công.
- Chỉ câu có trạng thái `REVIEWED` mới được đưa vào thư viện và tạo đề.

### 3.7. Đưa vào thư viện

- Lưu mỗi câu hỏi thành một bản ghi độc lập.
- Giữ liên kết với tài liệu nguồn và các vùng ảnh đã xác nhận.
- Hỗ trợ tìm kiếm, lọc, chỉnh sửa, gắn thẻ và phát hiện câu trùng lặp.
- Có lịch sử thay đổi và khả năng mở lại phiên duyệt.

## 4. Thư viện câu hỏi và tạo đề

### 4.1. Tạo đề theo yêu cầu

Người dùng lựa chọn:

- khối lớp;
- chủ đề hoặc phạm vi kiến thức;
- tổng số câu;
- số lượng câu theo từng mức độ khó;
- dạng câu hỏi;
- thời gian làm bài.

Hệ thống chỉ lấy câu đã duyệt, tránh trùng lặp và cảnh báo nếu thư viện không đủ
câu theo ma trận.

### 4.2. Tổng hợp đề

- Giữ công thức ở đúng vị trí.
- Chèn lại ảnh đúng câu hỏi và đúng thứ tự.
- Tạo bản xem trước để người dùng sắp xếp hoặc thay câu.
- Lưu snapshot của đề đã tạo.
- Xuất DOCX và PDF sau khi người dùng xác nhận.

## 5. Công cụ độc lập: Làm nét ảnh

Phân hệ này **không nằm trong combo OCR**.

### Chức năng

- Nhận một ảnh do người dùng chọn.
- Cung cấp các mức làm nét và khử nhiễu.
- Hiển thị so sánh trước/sau.
- Cho phép tải ảnh kết quả về máy.
- Chỉ gửi ảnh đã làm nét sang OCR khi người dùng bấm lệnh rõ ràng.

### Nguyên tắc

- Không tự động thay thế ảnh gốc.
- Không tự động chạy khi người dùng tải đề lên OCR.
- Không làm thay đổi dữ kiện, ký hiệu hoặc nét hình học.
- Giữ bản gốc để hoàn tác và đối chiếu.

## 6. Công cụ độc lập: Vẽ hình minh họa

Phân hệ này **không nằm trong combo OCR**.

### Chức năng

- Nhận nội dung một bài toán thực tế do người dùng nhập hoặc chủ động chọn từ
  thư viện.
- Dùng AI để hiểu bối cảnh, đối tượng, quan hệ hình học và dữ kiện.
- Sinh hình 2D rõ ràng theo phong cách sách giáo khoa THCS.
- Đặt các số liệu, ký hiệu, góc, độ dài và chú thích cần thiết lên hình.
- Cho phép người dùng duyệt, sửa và xuất hình.
- Chỉ đính kèm hình vào câu hỏi khi người dùng xác nhận.

### Nguyên tắc

- Mọi dữ kiện xuất hiện trên hình phải truy vết được về đề bài.
- Không tự bổ sung số liệu hoặc giả thiết.
- Phân biệt dữ kiện đã cho, đại lượng cần tìm và yếu tố minh họa.
- Ưu tiên hình đơn giản, đúng tỷ lệ tương đối và dễ in đen trắng.

## 7. Quản lý Gemini API key

- Lưu nhiều API key đã mã hóa.
- Không yêu cầu người dùng nhập tên Google Cloud project.
- Cho phép chọn model nhận diện riêng khi thêm từng key.
- Kiểm tra key bằng một request `generateContent` tối thiểu.
- Gửi key qua header `x-goog-api-key`, không đưa key vào URL.
- Xoay vòng theo độ ưu tiên, lượt sử dụng và tình trạng quota.
- Tạm cooldown key khi gặp lỗi 429.
- Chỉ đánh dấu key không hợp lệ với lỗi xác thực hoặc phân quyền rõ ràng.
- Hiển thị thông báo lỗi đã làm sạch từ Google và không làm lộ secret.
- Khi triển khai production, kiểm tra API từ chính IP đầu ra của backend.

## 8. Kiến trúc dự kiến

### Giao diện

- React 19 + TypeScript trên nền Vinext/Next-compatible.
- PDF.js chạy phía trình duyệt để tách PDF thành ảnh PNG từng trang trước OCR.
- Các workspace tách biệt cho OCR, thư viện, tạo đề, làm nét ảnh, vẽ minh họa
  và quản lý key.

### Backend

- API upload, OCR, duyệt, thư viện, tạo đề, minh họa và quản lý key.
- Gemini REST API cho nhận diện và phân loại.
- D1 lưu dữ liệu có cấu trúc.
- R2 lưu tài liệu nguồn, ảnh cắt và tài sản xuất bản.

### Dữ liệu chính

- `documents`
- `questions`
- `image_regions`
- `api_keys`
- `processing_jobs`
- `exams`
- `illustrations`

## 9. Bảo mật và vận hành

- Không ghi API key vào mã nguồn, Git, log hoặc file ngữ cảnh.
- Mã hóa key khi lưu và chỉ giải mã tại backend lúc gọi Gemini.
- Giới hạn loại tệp, dung lượng, thời gian xử lý và số lần gọi.
- Ghi log mã lỗi và request ID nhưng không ghi nội dung secret.
- Sao lưu dữ liệu thư viện và tài sản R2.
- Theo dõi quota, lỗi theo key/model và trạng thái deployment.

## 10. Lộ trình

### Giai đoạn 1 — Nền tảng hiện tại

- Hoàn thiện giao diện làm việc chính.
- Upload, tách PDF theo trang và lưu từng ảnh trang.
- Phân tích Layout Map trước, sau đó OCR bằng model người dùng chọn.
- Phân loại lớp, chủ đề và độ khó.
- Duyệt vùng ảnh và câu hỏi.
- Thư viện câu hỏi và bản xem trước tạo đề.
- Xoay vòng API key.
- Hai công cụ độc lập: làm nét ảnh và vẽ hình minh họa.

### Giai đoạn 2 — Hoàn thiện OCR

- Trích xuất ảnh cắt thực từ vùng đã xác nhận.
- Chèn ảnh lại đúng vị trí trong câu hỏi.
- Thêm preview công thức đã typeset.
- Gắn trạng thái duyệt riêng cho từng công thức.
- Khôi phục phiên OCR và lịch sử tài liệu.
- Phát hiện câu hỏi trùng lặp.

### Giai đoạn 3 — Xuất bản đề thi

- Trình biên tập đề kéo thả.
- Xuất DOCX và PDF.
- Bảo toàn công thức, ảnh, bảng và ngắt trang.
- Tạo đáp án và ma trận đề.
- Lưu phiên bản và lịch sử đề.

### Giai đoạn 4 — Chất lượng và vận hành

- Kiểm thử API, tích hợp và end-to-end.
- Hàng đợi cho tài liệu lớn.
- Theo dõi chi phí và quota Gemini.
- Sao lưu và khôi phục dữ liệu.
- Phân quyền người dùng và nhật ký thay đổi.

## 11. Tiêu chí hoàn thành

Một luồng OCR được coi là hoàn thành khi:

1. Tệp nguồn được lưu và xử lý thành công.
2. Công thức được bảo toàn và có thể chỉnh sửa.
3. Tất cả vùng ảnh đã được người dùng xác nhận.
4. Câu hỏi được tách đúng thứ tự.
5. Nhãn lớp, chủ đề và độ khó đã được duyệt.
6. Câu hỏi được đưa vào thư viện với đầy đủ hình ảnh liên kết.
7. Có thể chọn câu đã duyệt để tạo và xuất đề.

Việc làm nét ảnh hoặc vẽ hình minh họa không phải điều kiện bắt buộc để hoàn
thành luồng OCR.
