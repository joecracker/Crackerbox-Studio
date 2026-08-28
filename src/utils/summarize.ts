import type { ChatMessage } from "../hooks/useChatHistory";
import type { Model } from "../data/models";

const SUMMARIZE_URL = "https://openrouter.ai/api/v1/chat/completions";

interface SummarizeOptions {
  projectName: string;
  messages: ChatMessage[];
  apiKey: string;
  models: Model[];
  currentModelId: string;
}

function pickSummarizerModel(models: Model[], currentModelId: string): Model | null {
  const current = models.find((m) => m.id === currentModelId);
  const free = models
    .filter((m) => m.isFree && m.contextLength >= 32000)
    .sort((a, b) => a.contextLength - b.contextLength)[0];
  return free ?? current ?? null;
}

function buildPrompt(projectName: string, messages: ChatMessage[]): string {
  const transcript = messages
    .filter((m) => m.role === "user" || (m.role === "assistant" && m.text.trim()))
    .map((m) => {
      const label = m.role === "user" ? "USER" : "ASSISTANT";
      return `--- ${label} ---\n${m.text.trim()}`;
    })
    .join("\n\n");

  return `You are producing a handoff summary for an AI assistant continuing work in the project "${projectName}". A previous chat session has reached a large context size. Your ONLY job is to distill the full conversation below into a detailed, self-sufficient briefing so a NEW blank session can continue without needing the original transcript.

Rules:
- Be VERBOSE and CONCRETE. Prefer preserving exact details, file paths, function names, and numbers over brevity. Long output is correct and expected.
- Cover every section that has content. Only omit a section if it truly has nothing.
- Do not summarize away specifics — the whole point is that the new session has enough to continue.
- Output plain markdown with the exact section headers shown below.

# Project Context
- Project name: ${projectName}
- What the project/app is and does, its stack/language.

# Core Goals & Objectives
- The user's actual end state. Restate their own words where possible.

# Architectural & Technical Decisions
- Every meaningful choice and the REASON it was made.
- Include options that were considered and rejected, and why.

# Current Code State & Files
- Every file created or modified and what it now contains.
- Key functions, components, classes, exported names, data shapes, and storage keys.
- Preserve exact file paths and important code identifiers.

# Open Threads & Unsolved Problems
- Anything mid-flight, unfinished, deferred, or explicitly left for later.

# User Preferences & Constraints
- Tone, tech limits, rejected approaches, and anything the user resisted or forbade.

# Immediate Next Steps
- The concrete actionable continuation, in priority order.

# Where the Last Exchange Left Off
- Exactly where the most recent message and response ended, so work can resume seamlessly.

================================================================
CONVERSATION:
${transcript}
`;
}

export interface SummarizeResult {
  ok: boolean;
  summary: string | null;
  model: string | null;
  error: string | null;
}

export async function summarizeConversation({
  projectName,
  messages,
  apiKey,
  models,
  currentModelId,
}: SummarizeOptions): Promise<SummarizeResult> {
  const model = pickSummarizerModel(models, currentModelId);
  if (!model) return { ok: false, summary: null, model: null, error: "No model available for summarization." };

  try {
    const res = await fetch(SUMMARIZE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: "system", content: "You produce detailed handoff summaries. Output only the summary markdown." },
          { role: "user", content: buildPrompt(projectName, messages) },
        ],
        stream: false,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) {
      let reason = "";
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        reason = j.error?.message ?? "";
      } catch {
        // ignore
      }
      return {
        ok: false,
        summary: null,
        model: model.id,
        error: reason || `Summarization failed (HTTP ${res.status}).`,
      };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const summary = json.choices?.[0]?.message?.content ?? "";
    return {
      ok: summary.trim().length > 0,
      summary: summary.trim() || null,
      model: model.id,
      error: summary.trim() ? null : "Summarization returned empty output.",
    };
  } catch (e) {
    return {
      ok: false,
      summary: null,
      model: model.id,
      error: e instanceof Error ? e.message : "Summarization request failed.",
    };
  }
}