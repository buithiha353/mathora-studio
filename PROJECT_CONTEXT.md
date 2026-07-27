# Mathora Studio — Project Context

Last updated: 2026-07-28 (Asia/Saigon)

## Project

Mathora Studio is a Vietnamese web application for OCR and managing lower-secondary mathematics exams (THCS, grades 6–9). It preserves formulas and visual regions, requires human review before questions enter the library, generates exams from a difficulty matrix, manages rotating Gemini API keys, sharpens images in a separate tool, and creates 2D textbook-style illustrations.

Production: https://mathora-studio.nhatha-drive10.chatgpt.site
GitHub: https://github.com/buithiha353/mathora-studio (private)

- Current deployed version: 6
- Current deployed source: `bce0439a3b6fe5710c3f0d08db4cab09fa540c81`

## Product rules

- Mathematics scope is THCS only: grades 6, 7, 8, and 9.
- OCR must preserve formulas, image regions, and question order.
- Image-region confirmation is mandatory before library import.
- Questions must be reviewed and confirmed before they can be used to generate exams.
- Image sharpening is an independent tool, not an OCR pipeline step.
- Illustration generation must keep every displayed datum traceable to the problem statement.
- OCR recognition is pinned to the stable model `gemini-3.5-flash`.

## Architecture

- App: Vinext/Next-compatible React 19 + TypeScript.
- Main client workspace: `app/MathOcrStudio.tsx`.
- Styling: `app/globals.css`.
- API routes: upload, process, review, overview, exams, illustrations, and keys under `app/api/`.
- Structured data: Cloudflare D1, declared as `DB`.
- Uploaded files: Cloudflare R2, declared as `FILES`.
- Schema: `db/schema.ts`; generated migrations are in `drizzle/`.
- Hosting configuration: `.openai/hosting.json`.
- Gemini integration: REST `generateContent` through `lib/server/gemini.ts`, authenticated with the `x-goog-api-key` header.
- Gemini model constants: `lib/gemini-models.ts`.
- Stored Gemini keys are encrypted; hosted secret values must never be written to this file.

## Implemented capabilities

1. Upload PDF, PNG, JPG, JPEG, or WebP source documents to R2.
2. Recognize document metadata, THCS questions, LaTeX, knowledge topics, grades, difficulty, and normalized visual-region boxes with Gemini 3.5 Flash.
3. Validate keys with a minimal real `generateContent` request, expose sanitized Google errors, rotate healthy keys by priority and usage, and preserve temporarily rate-limited keys for later rotation.
4. Persist extracted questions and image regions as awaiting review.
5. Let users review region labels/types/question links and edit question content, LaTeX, grade, topic, difficulty, and answer.
6. Admit only confirmed questions to the library and only reviewed questions to exam generation.
7. Generate an exam preview from a requested grade and difficulty matrix.
8. Sharpen an image locally as a separate before/after tool, then download it or explicitly send it to OCR.
9. Generate structured 2D real-world math illustrations with verified data labels.
10. Provide a safe demo result when no active Gemini key exists.

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

- Direct OCR processing is limited to 18 MB per source file.
- Region coordinates and the original source are preserved, but real crop extraction and reinsertion into exported exam files are not complete.
- Exam generation currently produces an in-app preview and stored snapshot, not a final DOCX/PDF export.
- Formula review uses editable LaTeX text; dedicated typeset rendering is not yet integrated.
- A review session is primarily held in the active client workflow; full recovery and document-history reopening need expansion.
- Illustration output is a structured renderer rather than a downloadable production SVG/PDF workflow.

## Validation

Latest version passed:

- production build;
- TypeScript check;
- ESLint;
- four application tests, including the human-review gate and Gemini 3.5 Flash pin.

## Next work

1. Extract confirmed regions into durable crop assets and reinsert them at the correct question position.
2. Export generated exams to DOCX and PDF with preserved formulas and images.
3. Add typeset formula preview and formula-level review status.
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
