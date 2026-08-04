export type DiffType = "add" | "del" | "eq";

export interface DiffLine {
  type: DiffType;
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldNo = 1;
  let newNo = 1;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "eq", oldNo, newNo, text: a[i] });
      i++;
      j++;
      oldNo++;
      newNo++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", oldNo, newNo: null, text: a[i] });
      i++;
      oldNo++;
    } else {
      out.push({ type: "add", oldNo: null, newNo, text: b[j] });
      j++;
      newNo++;
    }
  }
  while (i < n) {
    out.push({ type: "del", oldNo, newNo: null, text: a[i] });
    i++;
    oldNo++;
  }
  while (j < m) {
    out.push({ type: "add", oldNo: null, newNo, text: b[j] });
    j++;
    newNo++;
  }

  return out;
}

export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "add") added++;
    else if (line.type === "del") removed++;
  }
  return { added, removed };
}
