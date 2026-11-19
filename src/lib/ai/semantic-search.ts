/**
 * Semantic Search for Knowledge Base
 *
 * Uses OpenAI embeddings for vector similarity search.
 * Falls back to keyword matching when embeddings are unavailable.
 *
 * Embeddings are stored in the KnowledgeEntry metadata field as JSON.
 * For production with pgvector, store in a dedicated vector column.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getOpenAIApiKey } from "./provider-config";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  categoryColor: string;
  score: number;
}

const stopWords = new Set(
  "about after all also and any are can could did does for from have how into may more much need our please should some than that the their them then there these they this those what when where which who why will with would you your".split(" ")
);

function searchTerms(text: string): Set<string> {
  const words = text.toLowerCase().match(/\p{L}[\p{L}\p{N}]{2,}/gu) ?? [];
  return new Set(words.filter((word) => !stopWords.has(word)).map((word) => {
    if (/^cancell?(?:ations?|ed|ing)$/.test(word)) return "cancel";
    if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
    if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
    return word;
  }));
}

function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every(Number.isFinite);
}

/**
 * Generate embedding for a text using OpenAI.
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      signal: AbortSignal.timeout(3000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000),
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const embedding: unknown = data.data?.[0]?.embedding;
    return isEmbedding(embedding) ? embedding : null;
  } catch (error) {
    logger.error("Failed to generate embedding:", error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Keyword-based search fallback.
 */
function keywordScore(terms: Set<string>, title: string, content: string): number {
  const titleTerms = searchTerms(title);
  const contentTerms = searchTerms(content);
  let score = 0;
  for (const term of terms) {
    if (titleTerms.has(term)) score += 2;
    else if (contentTerms.has(term)) score += 1;
  }
  return score / (2 * terms.size);
}

/**
 * Search the knowledge base semantically.
 * Uses embeddings when available, falls back to keyword matching.
 */
export async function searchKnowledgeBase(
  query: string,
  limit = 5,
  apiKey?: string
): Promise<SearchResult[]> {
  const terms = searchTerms(query);
  if (terms.size === 0) return [];

  const entries = await prisma.knowledgeEntry.findMany({
    where: { isActive: true },
    include: { category: { select: { name: true, color: true } } },
  });

  const documents = entries.map((entry) => ({
    entry,
    embedding: (entry.metadata as Record<string, unknown> | null)?.embedding,
  }));
  let queryEmbedding: number[] | null = null;

  if (documents.some(({ embedding }) => isEmbedding(embedding))) {
    const settings = apiKey === undefined
      ? await prisma.settings.findFirst({ select: { aiApiKey: true, aiProvider: true } })
      : undefined;
    const embeddingApiKey = apiKey ?? getOpenAIApiKey(settings);
    if (embeddingApiKey) {
      const key = `embedding:${createHash("sha256").update(query).digest("hex")}`;
      try {
        const cached = await cacheGet(key);
        const value: unknown = cached ? JSON.parse(cached) : null;
        queryEmbedding = isEmbedding(value) ? value : null;
      } catch (error) {
        logger.warn("Knowledge embedding cache read failed", { error: String(error) });
      }
      if (!queryEmbedding) {
        queryEmbedding = await generateEmbedding(query, embeddingApiKey);
        if (queryEmbedding) {
          try {
            await cacheSet(key, JSON.stringify(queryEmbedding), 3600);
          } catch (error) {
            logger.warn("Knowledge embedding cache write failed", { error: String(error) });
          }
        }
      }
    }
  }

  return documents
    .map(({ entry, embedding }) => {
      const lexicalScore = keywordScore(terms, entry.title, entry.content);
      const similarity = queryEmbedding && isEmbedding(embedding)
        ? cosineSimilarity(queryEmbedding, embedding)
        : 0;
      return {
        id: entry.id,
        title: entry.title,
        content: entry.content,
        category: entry.category.name,
        categoryColor: entry.category.color,
        priority: entry.priority,
        score: Math.max(lexicalScore, similarity >= 0.5 ? similarity : 0),
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map(({ id, title, content, category, categoryColor, score }) => ({ id, title, content, category, categoryColor, score }));
}

/**
 * Generate and store embedding for a knowledge entry.
 */
export async function indexKnowledgeEntry(
  entryId: string,
  apiKey: string
): Promise<boolean> {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) return false;

  const text = `${entry.title}\n${entry.content}`;
  const embedding = await generateEmbedding(text, apiKey);

  if (!embedding) return false;

  const currentMetadata = (entry.metadata as Record<string, unknown>) || {};

  await prisma.knowledgeEntry.update({
    where: { id: entryId },
    data: {
      metadata: { ...currentMetadata, embedding },
    },
  });

  return true;
}
