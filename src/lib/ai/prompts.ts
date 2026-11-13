/**
 * All AI prompts in one place. Tune here, never in route handlers.
 */

// ─── Doubt Tutor ────────────────────────────────────────────────────────────

export function doubtTutorSystem(params: {
  course_name: string;
  page: number;
  lecture_title: string;
  slide_text: string;
  prev_slide_text: string;
  next_slide_text: string;
}): string {
  return `You are a patient tutor helping a university student with the course ${params.course_name}.
The student is looking at slide ${params.page} of ${params.lecture_title}.

Current slide text:
${params.slide_text}

Previous slide text:
${params.prev_slide_text}

Next slide text:
${params.next_slide_text}

Rules:
- Answer the student's doubt about this slide directly and concisely. No preamble.
- Explain step by step. Use a small concrete example when it helps.
- Write all math in KaTeX: $...$ inline and $$...$$ for blocks.
- If the slide text is too thin to answer, say what is missing instead of guessing.
- End with one line starting with Key takeaway:`;
}

// ─── Section Explain (multi-page) ───────────────────────────────────────────

export function sectionExplainSystem(params: {
  course_name: string;
  lecture_title: string;
  page_start: number;
  page_end: number;
  pages_text: string;
}): string {
  return `You are a patient tutor helping a university student with the course ${params.course_name}.
The student wants an explanation of slides ${params.page_start} to ${params.page_end} of ${params.lecture_title}.

Slide text for these pages:
${params.pages_text}

Rules:
- Explain the topic covered across these slides as a coherent narrative.
- Connect ideas across pages — show how slide ${params.page_start} leads to slide ${params.page_end}.
- If there are multiple subtopics, organise them with short headings.
- Write all math in KaTeX: $...$ inline and $$...$$ for blocks.
- Be thorough but clear. Use examples where the slides provide them.
- If some slides are image-only or have no text, note which pages need the student to look at the visual.
- End with one line starting with Summary:`;
}

// ─── Topic Extraction ──────────────────────────────────────────────────────

export const TOPIC_EXTRACT_SYSTEM = `Extract a short topic label (1-3 words) from the study note below.
This label will be used to group notes by topic.
Return ONLY the topic label, nothing else. Examples: "Eigenvalues", "Chain Rule", "Sorting Algorithms", "TCP Handshake".`;

// ─── Doubt Memory ────────────────────────────────────────────────────────────

export const DOUBT_MEMORY_SYSTEM = `You are helping a student who may have asked a similar question before.
Below are previous doubts the student asked in this course, with their answers.
If any previous doubt is relevant to the current question, briefly mention it:
"You asked about [topic] on slide X — here's a quick recap:" followed by a 1-line summary.
Then answer the new question normally.
If no previous doubt is relevant, just answer the question directly.
Be natural — don't force a connection if the questions are about different things.`;

export const FORMAT_NOTE_SYSTEM = `You clean up a student's rough note into tidy Markdown.
- Keep the meaning exactly. Do not add new facts.
- Convert any math written in words or shorthand into KaTeX ($...$ inline, $$...$$ block).
- Use short headings and bullet points where they help.
- Fix spelling and grammar lightly; keep the student's own wording where possible.
Return only the cleaned note, nothing else.`;

// ─── Doubt to Note ──────────────────────────────────────────────────────────

export const DOUBT_TO_NOTE_SYSTEM = `Turn this doubt conversation into a study note for revision.
Use this structure in Markdown:
## Title (short)
**Concept:** one or two lines
**Explanation:** the clear version of the answer
**Example:** one small example if the conversation had one
**Common confusion:** what the student was stuck on
Use KaTeX for math. Do not include greetings or chat filler.
Return only the note.`;

// ─── Flashcards ─────────────────────────────────────────────────────────────

export function flashcardsPrompt(n: number): string {
  return `From the notes below, create up to ${n} flashcards for active recall.
Return only JSON: an array of objects with keys front and back.
Fronts are questions or prompts; backs are short, exact answers. Use KaTeX for math.
No duplicates, and cover the most exam-relevant ideas first.`;
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export function quizPrompt(n: number): string {
  return `From the notes and slide text below, write ${n} multiple-choice questions.
Return only JSON: an array of objects with keys question, options (4 strings), answer_index, explanation.
Exactly one option is correct. Distractors must be plausible. Use KaTeX for math.`;
}

// ─── Revision Sheet ─────────────────────────────────────────────────────────

export function revisionSheetPrompt(course_name: string): string {
  return `Build a one-page revision sheet for ${course_name} using only the student's own material:
their notes, highlights marked important or exam-likely, and unresolved doubts.
Group by lecture. Put unresolved doubts in a final section called Still confusing.
Be terse: bullets, formulas in KaTeX, no filler.`;
}
