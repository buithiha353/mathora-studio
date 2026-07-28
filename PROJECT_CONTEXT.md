# Mathora Studio — Project Context

Last updated: 2026-07-29 (Asia/Saigon)

## Project

Mathora Studio is a Vietnamese web application for OCR and managing lower-secondary mathematics exams (THCS, grades 6–9). It preserves formulas and visual regions, requires human review before questions enter the library, generates exams from a difficulty matrix, manages rotating Gemini API keys, sharpens images in a separate tool, and creates 2D textbook-style illustrations.

Primary production: https://minhkhue.one/thuviendethi/
Sites production: https://mathora-studio.nhatha-drive10.chatgpt.site
GitHub: https://github.com/buithiha353/mathora-studio (private)

- Current deployed version: 14
- Current code version: 15 (not yet deployed)
- Sites deployed source: `88ddb0c7af02df22dec88cdfd3e2d18ff1b95acf`
- Sites saved version: 10

## Product rules

- Every completed application version must be deployed after validation unless
  the user explicitly requests a local-only or not-yet-deployed version.
- Mathematics scope is THCS only: grades 6, 7, 8, and 9.
- OCR must preserve formulas, image regions, and question order.
- Document processing first creates a page-level Layout Map without OCR:
  exhaustive typed regions, pixel bounding boxes, reading order, confidence,
  and `need_review`; content OCR runs only after this layout pass.
- Image-region confirmation is mandatory before library import.
- Questions must be reviewed and confirmed before they can be used to generate exams.
- Image sharpening is an independent tool, not an OCR pipeline step.
- Illustration generation must keep every displayed datum traceable to the problem statement.
- Illustration generation uses the authoritative Vietnamese THCS textbook
  prompt in `lib/illustration-prompt.ts`: clean 2D technical drawing, white
  background, restrained colors, exact geometric notation, minimal real-world
  objects, no unrelated decorative scene, and no text beyond mathematical
  labels/data or essential short context labels. Related visual accents such as
  light water color, sparse waves, and a simple boat are allowed when they
  improve recognition without competing with the geometry.
- Each stored API key selects one supported recognition model:
  `gemini-2.5-flash`, `gemini-3.5-flash-lite`, or
  `gemini-3.1-flash-lite`. Google does not expose a general
  `generateContent` endpoint named `gemini-3.1-flash`; the supported
  Flash-Lite model is used instead.
- Adding an API key requires a friendly label, key, model, and priority; users
  do not enter a Google Cloud project name.

## Architecture

- App: Vinext/Next-compatible React 19 + TypeScript.
- Main client workspace: `app/MathOcrStudio.tsx`.
- Client-side PDF rasterization: PDF.js renders each PDF page to a high-resolution
  PNG before upload to `app/api/upload/page/route.ts`.
- Styling: `app/globals.css`.
- Authoritative product plan: `PLAN.md`.
- API routes: upload, process, review, overview, exams, illustrations, and keys under `app/api/`.
- Structured data: Cloudflare D1, declared as `DB`.
- Uploaded files: Cloudflare R2, declared as `FILES`.
- Schema: `db/schema.ts`; generated migrations are in `drizzle/`.
- Hosting configuration: `.openai/hosting.json`.
- Self-hosted mode: Vinext standalone on Node.js 24 with base path
  `/thuviendethi`, built by `npm run build:self-hosted`.
- Self-hosted persistence: Node built-in SQLite under `MATHORA_DATA_DIR`
  and uploaded files under `MATHORA_UPLOAD_DIR`.
- Gemini integration: REST `generateContent` through `lib/server/gemini.ts`, authenticated with the `x-goog-api-key` header.
- Gemini model constants: `lib/gemini-models.ts`.
- Authoritative layout-only system prompt: `lib/layout-prompt.ts`.
- Stored Gemini keys are encrypted; hosted secret values must never be written to this file.

## Implemented capabilities

1. Upload PDF, PNG, JPG, JPEG, or WebP source documents to R2; PDF files are
   rendered client-side into numbered PNG pages and stored separately.
2. Process every numbered page image sequentially, build a pixel-coordinate
   Layout Map first, normalize its reading order and
   review flags, then recognize THCS question content, LaTeX, knowledge topics,
   grades, and difficulty in a separate second Gemini pass.
3. Validate keys with a minimal real `generateContent` request, expose sanitized Google errors, rotate healthy keys by priority and usage, and preserve temporarily rate-limited keys for later rotation.
4. Persist extracted questions and image regions as awaiting review.
5. Let users move and resize detected regions directly with eight handles,
   edit exact coordinates, switch to the region's source page, review region
   labels/types/question links, and edit question content, LaTeX, grade, topic,
   difficulty, and answer.
   Region overlays use the source image's natural aspect ratio, and the side
   preview crops the currently selected region from its real source page.
6. Admit only confirmed questions to the library and only reviewed questions to exam generation.
7. Browse reviewed questions with grade/difficulty filters and a full
   per-question detail view; generate or regenerate a randomized exam preview
   from a requested grade and difficulty matrix.
   Confirmed image regions are attached to each library/exam question and
   rendered as real source crops in both detail and exam preview views.
8. Export generated exams as A4 DOCX files with Times New Roman body text,
   Cambria Math formula lines, and inline cropped source images attached to
   their questions.
9. Sharpen an image locally as a separate before/after tool, then download it or explicitly send it to OCR.
10. Generate structured 2D real-world math illustrations with verified data labels.
11. Provide a safe demo result when no active Gemini key exists.
12. Keep the persistent question library free of built-in sample records; only
    reviewed OCR questions are stored as library data.

## Data model

Main D1 tables:

- `documents`
- `questions`
- `image_regions`
- `api_keys`
- `processing_jobs`
- `exams`
- `illustrations`

Question status flow: `AWAITING_REVIEW` → `REVIEWED`.  
Document status flow: `UPLOADED` → `REGION_REVIEW` → `COMPLETED`.

## Current constraints and gaps

- Direct Gemini processing is limited to 18 MB per image page; source PDF upload
  remains limited to 50 MB and 200 rendered pages.
- Region coordinates and the original source are preserved and cropped on
  demand; materializing every crop as an independent stored asset remains
  future work.
- Exam generation produces an in-app preview, stored snapshot, and DOCX export;
  final PDF export is not complete.
- Formula review uses editable LaTeX text; dedicated typeset rendering is not yet integrated.
- A review session is primarily held in the active client workflow; full recovery and document-history reopening need expansion.
- Illustration output is a structured renderer rather than a downloadable production SVG/PDF workflow.

## Validation

Latest version passed:

- production build;
- self-hosted standalone build and local smoke test;
- public cPanel deployment smoke test for the page and overview API;
- all six production CSS/JavaScript assets returning HTTP 200 with correct
  content types under `/thuviendethi/assets/`;
- production browser visual check and hydrated navigation check with no console
  errors;
- TypeScript check;
- ESLint;
- twelve application tests, including the human-review gate, selectable Gemini
  model whitelist, layout-before-OCR enforcement, PDF page splitting, editable
  regions, real crop previews, grade filtering, question details, exam
  regeneration, source-image attachment, DOCX export, and the THCS
  illustration prompt.
- A generated DOCX fixture passed structural inspection with A4 geometry,
  Vietnamese text/formula content, and an inline PNG media relationship.
  LibreOffice is not installed in the local workspace, so automated PNG render
  inspection was unavailable for this version.

The new self-hosted database has no active Gemini key yet. A key must be added
again through Settings before a real Gemini request can be verified from the
Vietnam-hosted backend.

## Next work

1. Materialize confirmed source crops as independent stored assets.
2. Export generated exams to PDF with preserved formulas and images.
3. Add native Word equation objects and typeset formula preview.
4. Add resumable document/review history.
5. Expand API and end-to-end tests for real OCR/review/export workflows.

## Version log

- 2026-07-27 — v1: Initial Mathora Studio MVP with OCR, library, exam builder, illustrations, key rotation, D1, and R2.
- 2026-07-27 — v2: Refocused content on THCS grades 6–9 and separated image sharpening from the OCR pipeline.
- 2026-07-28 — v3: Added persistent image-region and question review gates before library/exam use.
- 2026-07-28 — v4: Pinned OCR recognition to stable `gemini-3.6-flash`, upgraded key validation/defaults, and removed deprecated sampling parameters.
- 2026-07-28 — Context workflow: Deployed v4 to production and added the authoritative `PROJECT_CONTEXT.md` workflow; no application behavior changed.
- 2026-07-28 — v5: Changed OCR recognition and stored API-key model metadata to stable `gemini-3.5-flash`; deployed to production.
- 2026-07-28 — v6: Replaced metadata-only API-key validation with real generation validation, moved secrets from URL queries to headers, and added sanitized Gemini error details; deployed to production.
- 2026-07-28 — GitHub publication: Published the complete tracked source and history to the private `buithiha353/mathora-studio` repository; generated ZIP exports remain local only.
- 2026-07-28 — Plan rewrite: Added the authoritative Vietnamese product plan and explicitly separated image sharpening and illustration generation from the OCR workflow.
- 2026-07-28 — v7: Added a Node.js self-hosted target with `/thuviendethi` base path, SQLite/local-file adapters, a 50 MB request limit, and deployed it to `minhkhue.one` on cPanel Node.js 24.
- 2026-07-28 — v8: Fixed Vinext App Router standalone asset routing under the cPanel `/thuviendethi` mount, normalized packaged static-cache paths across Windows/Linux, and redeployed the fully styled interface.
- 2026-07-28 — v9 (not deployed): Added the authoritative THCS textbook illustration prompt, including strict 2D style, geometry, notation, color, layout, real-world simplification, print-quality, source-verification, and answer-hiding rules.
- 2026-07-28 — v10 (not deployed): Added a corrected river-crossing few-shot example from the supplied reference, allowing restrained contextual aesthetics while explicitly keeping AC as the unknown boat path and preventing blind copying of AB's misplaced question mark.
- 2026-07-28 — v10 deployment: Deployed the authoritative THCS illustration prompt and corrected river-crossing few-shot to the cPanel Node.js production app at `minhkhue.one/thuviendethi`; page, overview API, all six static assets, illustration workspace, and browser console checks passed.
- 2026-07-28 — v11 (not deployed): Added a strict layout-only Document Layout AI pass with pixel bounding boxes before content OCR, selectable Gemini 2.5/3.5 Flash-Lite/3.1 Flash-Lite models per key, and removed the user-facing Google Cloud project requirement.
- 2026-07-28 — v11 cPanel deployment: Deployed the layout-first OCR workflow and per-key model selection to `minhkhue.one/thuviendethi`, preserved the existing key store and application data, removed the remaining user-facing project wording, and verified the page, overview API, all six static assets, model selector, and browser console.
- 2026-07-28 — v11 Sites deployment: Published saved Sites version 7 from source `4365763176ef5ccfcad1d56b8d9a81cfa4f8e68c` to `mathora-studio.nhatha-drive10.chatgpt.site`.
- 2026-07-28 — v12 (not deployed): Added client-side PDF-to-PNG page splitting with per-page Gemini layout/content processing, page-aware region persistence, and an interactive region editor with drag, eight resize handles, page navigation, and exact coordinate inputs.
- 2026-07-28 — v12 deployment: Deployed the PDF page-splitting and
  interactive region-editor release to both production targets, preserved
  cPanel application data/uploads, and verified the primary page, overview API,
  application bundle, PDF worker, page-upload route reference, and resize
  controls.
- 2026-07-28 — v13 (not deployed): Replaced the static OCR crop with the real
  selected source region, aligned overlays to natural image dimensions, passed
  exact pixel dimensions to stricter Gemini layout mapping, added question
  details and grade filtering, and added randomized exam regeneration.
- 2026-07-28 — v13 deployment: Deployed the OCR alignment, real crop preview,
  question-library details/grade filters, and exam regeneration release to both
  production targets; preserved cPanel data/uploads and verified the primary
  page, overview API, production bundle, and all five requested UI behaviors.
- 2026-07-29 — v14 (pre-deployment): Attached confirmed source regions to
  library/exam questions, displayed real image crops in question details and
  exam previews, and added A4 DOCX download with formulas and inline images.
- 2026-07-29 — v14 deployment: Deployed question-linked image previews and
  A4 DOCX export to both production targets; preserved cPanel data/uploads and
  verified the primary page, overview API, region-image route, production
  bundle, and Sites production deployment.
- 2026-07-29 — v15 (not deployed): Removed automatic insertion and client-side
  fallback display of the six initial `q-demo-*` questions, and added a targeted
  cleanup for those records and exam snapshots that reference them while
  preserving all OCR-derived questions.
