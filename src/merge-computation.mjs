import { MyersDiffAlgorithm } from "monaco-editor/esm/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/myersDiffAlgorithm.js";
import { DateTimeout } from "monaco-editor/esm/vs/editor/common/diff/defaultLinesDiffComputer/algorithms/diffAlgorithm.js";
import mergeModel from "./merge-model.js";
const { normalize, buildMergePlan } = mergeModel;

export function computeMerge(baseText, localText, diskText) {
  const values = [baseText, localText, diskText].map(normalize);
  // Bound worst-case Myers memory/time; failure never becomes a guessed merge.
  if (values.some(text => text.length > 5_000_000)) throw new Error("tooLarge");
  const [base, local, disk] = values.map(text => text.split("\n"));
  if ([base, local, disk].some(lines => lines.length > 100_000)) throw new Error("tooLarge");
  const changes = target => {
    // Trim the unchanged prefix/suffix before allocating a quadratic search.
    let start = 0, endBase = base.length, endTarget = target.length;
    while (start < endBase && start < endTarget && base[start] === target[start]) start++;
    while (endBase > start && endTarget > start && base[endBase - 1] === target[endTarget - 1]) { endBase--; endTarget--; }
    if (endBase - start + endTarget - start > 20_000) throw new Error("tooLarge");
    if (start === endBase && start === endTarget) return [];
    const sequence = (lines, end) => ({ length: end - start, getElement: i => lines[start + i] });
    const result = new MyersDiffAlgorithm().compute(sequence(base, endBase), sequence(target, endTarget), new DateTimeout(1000));
    if (result.hitTimeout) throw new Error("tooLarge");
    return result.diffs.map(change => ({
      start: start + change.seq1Range.start, end: start + change.seq1Range.endExclusive,
      lines: target.slice(start + change.seq2Range.start, start + change.seq2Range.endExclusive),
    }));
  };
  return buildMergePlan(base, changes(local), changes(disk));
}
