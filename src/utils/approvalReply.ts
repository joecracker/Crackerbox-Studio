import type { PendingApproval } from "../hooks/useChatStream";

export type ApprovalActionName = Exclude<PendingApproval["name"], "preview_start">;

export type ApprovalReplyDecision =
  | { kind: "approve" }
  | { kind: "reject" }
  | { kind: "approveAll" }
  | { kind: "rejectAll" }
  | { kind: "perAction"; actions: Record<ApprovalActionName, boolean>; defaultForOthers: boolean }
  | { kind: "unknown" };

const NEGATORS =
  /\b(no|nope|nah|not|don'?t|do not|skip|cancel|reject|decline|avoid|except|without|hold off|never|nix|stop|ignore)\b/i;

const POSITIVES =
  /\b(yes|yep|yeah|sure|okay|ok|go ahead|do it|do them|proceed|approve|agreed|fine|definitely|absolutely|go for it|please do|sounds good|good)\b/i;

const ALL_WORDS =
  /\b(all|everything|every change|whole batch|all of them|all of it|every one|each one|all changes|both|all of those|each of them)\b/i;

const NOTHING_WORDS =
  /\b(nothing|none|none of them|none of it|not any|don'?t do any|not all|no changes)\b/i;

const ACTION_WORDS: Record<ApprovalActionName, RegExp> = {
  delete_file:
    /\b(delete|deletions?|deletes?|remov(e|ing|al|als)|erase|trash|drop|get rid of)\b/i,
  install_package:
    /\b(install(ing|ation|s)?|npm|package(s)?|dependenc(ies|y)|deps?|add package|uninstall)\b/i,
  run_command:
    /\b(run(ning)?|command(s)?|execut(e|ion|ing)|terminal|shell|build(ing)?|dev server|start the server|start it|run it)\b/i,
  write_file:
    /\b(writ(e|ing|es|ten)?|edit(ing|s)?|creat(e|ing|es|ion)?|new file|file change(s)?|touch|save file)\b/i,
};

const SAFE_ONLY = /\b(only the safe|safe (ones|changes|files|edits)|just the file edits|file edits only)\b/i;

const CLAUSE_SPLIT = /,|\b(?:but|and|then|as well as|also)\b/i;

export function interpretApprovalReply(raw: string): ApprovalReplyDecision {
  const text = raw.trim();
  if (!text) return { kind: "unknown" };
  const lower = text.toLowerCase();

  if (SAFE_ONLY.test(lower)) {
    return {
      kind: "perAction",
      actions: { write_file: true, delete_file: false, run_command: false, install_package: false },
      defaultForOthers: false,
    };
  }

  const clauses = lower
    .split(CLAUSE_SPLIT)
    .map((c) => c.trim())
    .filter(Boolean);

  const actionSentiment: Partial<Record<ApprovalActionName, boolean>> = {};
  let globalPositive = false;
  let globalNegative = false;
  let hasAll = false;
  let hasNothing = false;
  let hasNegatedAction = false;

  for (const clause of clauses) {
    const neg = NEGATORS.test(clause);
    const pos = POSITIVES.test(clause);
    const mentionsAll = ALL_WORDS.test(clause);
    const mentionsNothing = NOTHING_WORDS.test(clause);

    if (mentionsNothing) {
      hasNothing = true;
      globalNegative = true;
      continue;
    }
    if (mentionsAll) {
      hasAll = true;
      if (neg) globalNegative = true;
      else globalPositive = true;
    }

    const mentioned = (Object.keys(ACTION_WORDS) as ApprovalActionName[]).filter((a) =>
      ACTION_WORDS[a].test(clause)
    );

    if (mentioned.length > 0) {
      const sentiment = neg ? false : true;
      if (neg) hasNegatedAction = true;
      for (const a of mentioned) actionSentiment[a] = sentiment;
      continue;
    }

    if (neg) globalNegative = true;
    else if (pos) globalPositive = true;
  }

  const mentionedActions = Object.keys(actionSentiment) as ApprovalActionName[];
  if (mentionedActions.length > 0) {
    const actions: Record<ApprovalActionName, boolean> = {
      write_file: true,
      delete_file: true,
      run_command: true,
      install_package: true,
    };
    for (const a of mentionedActions) actions[a] = actionSentiment[a] ?? true;
    return {
      kind: "perAction",
      actions,
      defaultForOthers: hasNegatedAction ? true : false,
    };
  }

  if (hasNothing) return { kind: "rejectAll" };
  if (hasAll && globalNegative) return { kind: "rejectAll" };
  if (hasAll && globalPositive) return { kind: "approveAll" };
  if (globalNegative) return { kind: "reject" };
  if (globalPositive) return { kind: "approve" };
  return { kind: "unknown" };
}