import { describe, it, expect } from "vitest";
import { applyWikilinkReplacement } from "./Editor";

describe("applyWikilinkReplacement", () => {
  it("inserts wikilink at cursor immediately after [[ prefix", () => {
    // cursorPos = right after the two opening brackets
    const content = "Merhaba [["; // length 10
    const cursorPos = content.length;
    const result = applyWikilinkReplacement(content, cursorPos, "diğer-not");

    expect(result).toEqual({
      newContent: "Merhaba [[diğer-not]]",
      insertPos: 21, // lastOpeningBracket(8) + replacement length("[["=2 + "diğer-not"=9 + "]]"=2 = 13) = 21
    });
  });

  it("returns null when no [[ found before cursor position", () => {
    const content = "Başka metin";
    const cursorPos = 5;
    const result = applyWikilinkReplacement(content, cursorPos, "not");
    expect(result).toBeNull();
  });

  it("inserts wikilink into text that ends with [[", () => {
    const content = "Başlangıç [["; // length 12
    const cursorPos = content.length;
    const result = applyWikilinkReplacement(content, cursorPos, "hedef");

    expect(result?.newContent).toBe("Başlangıç [[hedef]]");
    // lastOpeningBracket = 10 ("Başlangıç " = 9 chars + "[" = 10th index)
    // replacement = "[[" + "hedef" + "]]" = 2 + 5 + 2 = 9
    // insertPos = 10 + 9 = 19
    expect(result?.insertPos).toBe(19);
  });

  it("returns null when [[ exists before cursor but no open [[ at cursor position", () => {
    // cursor placed in the middle of text; the [[ appears later in the string
    const content = "Başlangıç metin [[";
    const cursorPos = 10; // right after "Başlangıç m"
    const result = applyWikilinkReplacement(content, cursorPos, "hedef");

    // textBeforeCursor = "Başlangıç m" (10 chars), no "[" in it
    expect(result).toBeNull();
  });
});
