-- Jalankan script SQL ini di SQL Editor Supabase Anda

-- 1. Aktifkan ekstensi vector untuk pencarian semantik (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Buat tabel episodic_memories jika belum ada
CREATE TABLE IF NOT EXISTS episodic_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  event_text TEXT NOT NULL,
  emotion TEXT,
  importance FLOAT DEFAULT 0.5,
  embedding vector(1024), -- Model mistral-embed memiliki dimensi 1024
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tambahkan indeks untuk mempercepat pencarian vektor
CREATE INDEX ON episodic_memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 4. Buat fungsi pencocokan vektor (Digunakan oleh kode Node.js kita nanti)
CREATE OR REPLACE FUNCTION match_episodic_memories (
  query_embedding vector(1024),
  match_threshold FLOAT,
  match_count INT,
  user_id BIGINT
)
RETURNS TABLE (
  id UUID,
  event_text TEXT,
  emotion TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    episodic_memories.id,
    episodic_memories.event_text,
    episodic_memories.emotion,
    1 - (episodic_memories.embedding <=> query_embedding) AS similarity
  FROM episodic_memories
  WHERE telegram_id = user_id
    AND 1 - (episodic_memories.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
