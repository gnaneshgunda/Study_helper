export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: Course;
        Insert: Omit<Course, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Course, "id">>;
      };
      lectures: {
        Row: Lecture;
        Insert: Omit<Lecture, "id" | "created_at">;
        Update: Partial<Omit<Lecture, "id">>;
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, "id" | "created_at">;
        Update: Partial<Omit<Document, "id">>;
      };
      pages: {
        Row: Page;
        Insert: Omit<Page, "id">;
        Update: Partial<Omit<Page, "id">>;
      };
      notes: {
        Row: Note;
        Insert: Omit<Note, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Note, "id" | "created_at">>;
      };
      highlights: {
        Row: Highlight;
        Insert: Omit<Highlight, "id" | "created_at">;
        Update: Partial<Omit<Highlight, "id">>;
      };
      doubts: {
        Row: Doubt;
        Insert: Omit<Doubt, "id" | "created_at">;
        Update: Partial<Omit<Doubt, "id">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at">;
        Update: Partial<Omit<Message, "id">>;
      };
      flashcards: {
        Row: Flashcard;
        Insert: Omit<Flashcard, "id" | "created_at">;
        Update: Partial<Omit<Flashcard, "id">>;
      };
      ai_cache: {
        Row: AiCache;
        Insert: Omit<AiCache, "id" | "created_at">;
        Update: Partial<Omit<AiCache, "id">>;
      };
    };
  };
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  semester: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Lecture {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
}

export interface Document {
  id: string;
  lecture_id: string;
  storage_path: string;
  title: string;
  page_count: number;
  created_at: string;
}

export interface Page {
  id: string;
  document_id: string;
  page_number: number;
  text: string;
  embedding: number[] | null;
}

export interface Note {
  id: string;
  user_id: string;
  course_id: string;
  document_id: string;
  page_number: number;
  anchor: { x: number; y: number } | null;
  content_md: string;
  source: "manual" | "ai" | "doubt";
  tags: string[];
  topic: string | null;
  created_at: string;
  updated_at: string;
}

export interface Highlight {
  id: string;
  document_id: string;
  page_number: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  color: string;
  kind: "important" | "confused" | "exam";
  created_at: string;
}

export type DoubtStatus = "open" | "resolved";

export interface Doubt {
  id: string;
  document_id: string;
  page_number: number;
  anchor: { x: number; y: number } | null;
  title: string;
  status: DoubtStatus;
  created_at: string;
}

export interface Message {
  id: string;
  doubt_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Flashcard {
  id: string;
  course_id: string;
  note_id: string | null;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  due_at: string;
  created_at: string;
}

export interface AiCache {
  id: string;
  input_hash: string;
  task: string;
  result: string;
  created_at: string;
}
