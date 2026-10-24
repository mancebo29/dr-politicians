// News queries decide which articles mention a politician. The syntax is a
// small subset of the usual search-engine one, so admins can disambiguate
// common names in `politicians.news_query`:
//
//   "Manuel Jiménez" (alcalde OR "Santo Domingo Este") -"Manuel Jiménez Reyes"
//
// - `"..."` is a phrase, a bare word is a one-word phrase. Both match whole
//   words, ignoring case and accents ("jose" matches "José").
// - Terms side by side must all match (AND). `OR` (upper case) separates
//   alternatives and binds looser than AND. Parentheses group.
// - `-term` or `-( ... )` excludes articles that match it.

export type QueryNode =
  | { kind: "phrase"; text: string }
  | { kind: "and"; nodes: QueryNode[] }
  | { kind: "or"; nodes: QueryNode[] }
  | { kind: "not"; node: QueryNode };

export class QuerySyntaxError extends Error {}

// Lowercase, strip accents, and reduce punctuation to single spaces, padded so
// phrase matching on " text " respects word boundaries.
export function normalizeText(text: string): string {
  const words = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return ` ${words} `;
}

type Token = { type: "phrase"; text: string } | { type: "or" | "lparen" | "rparen" | "minus" };

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < query.length) {
    const c = query[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "(" || c === ")") {
      tokens.push({ type: c === "(" ? "lparen" : "rparen" });
      i++;
    } else if (c === "-" && (i === 0 || /[\s(]/.test(query[i - 1]))) {
      tokens.push({ type: "minus" });
      i++;
    } else if (c === '"') {
      const end = query.indexOf('"', i + 1);
      if (end === -1) throw new QuerySyntaxError("Unclosed quote");
      tokens.push({ type: "phrase", text: query.slice(i + 1, end) });
      i = end + 1;
    } else {
      let j = i;
      while (j < query.length && !/[\s()"]/.test(query[j])) j++;
      const word = query.slice(i, j);
      tokens.push(word === "OR" ? { type: "or" } : { type: "phrase", text: word });
      i = j;
    }
  }
  return tokens;
}

export function parseQuery(query: string): QueryNode {
  const tokens = tokenize(query);
  let pos = 0;

  function parseOr(): QueryNode {
    const nodes = [parseAnd()];
    while (tokens[pos]?.type === "or") {
      pos++;
      nodes.push(parseAnd());
    }
    return nodes.length === 1 ? nodes[0] : { kind: "or", nodes };
  }

  function parseAnd(): QueryNode {
    const nodes: QueryNode[] = [];
    while (pos < tokens.length && tokens[pos].type !== "or" && tokens[pos].type !== "rparen") {
      nodes.push(parseUnary());
    }
    if (nodes.length === 0) throw new QuerySyntaxError("Empty expression");
    return nodes.length === 1 ? nodes[0] : { kind: "and", nodes };
  }

  function parseUnary(): QueryNode {
    const token = tokens[pos++];
    if (!token) throw new QuerySyntaxError("Missing term");
    if (token.type === "minus") return { kind: "not", node: parseUnary() };
    if (token.type === "lparen") {
      const node = parseOr();
      if (tokens[pos]?.type !== "rparen") throw new QuerySyntaxError("Missing )");
      pos++;
      return node;
    }
    if (token.type === "phrase") {
      const text = normalizeText(token.text);
      if (!text.trim()) throw new QuerySyntaxError("Empty phrase");
      return { kind: "phrase", text };
    }
    throw new QuerySyntaxError(`Unexpected ${token.type}`);
  }

  const node = parseOr();
  if (pos < tokens.length) throw new QuerySyntaxError("Unexpected )");
  if (!hasPositiveTerm(node)) throw new QuerySyntaxError("A query needs at least one term");
  return node;
}

// A query made only of exclusions would match nearly every article.
function hasPositiveTerm(node: QueryNode): boolean {
  switch (node.kind) {
    case "phrase":
      return true;
    case "not":
      return false;
    case "and":
      return node.nodes.some(hasPositiveTerm);
    case "or":
      return node.nodes.every(hasPositiveTerm);
  }
}

// `text` must come from normalizeText.
export function matchesQuery(node: QueryNode, text: string): boolean {
  switch (node.kind) {
    case "phrase":
      return text.includes(node.text);
    case "not":
      return !matchesQuery(node.node, text);
    case "and":
      return node.nodes.every((n) => matchesQuery(n, text));
    case "or":
      return node.nodes.some((n) => matchesQuery(n, text));
  }
}

// Used when a profile has no news_query: any multi-word name the profile is
// known by. Single words ("Leonel") are skipped because they match too much.
export function defaultNewsQuery(p: {
  fullName: string;
  knownAs: string | null;
  aliases: string[];
}): string | null {
  const names = [p.knownAs, p.fullName, ...p.aliases]
    .map((n) => n?.replaceAll('"', "").trim())
    .filter((n): n is string => !!n && normalizeText(n).trim().split(" ").length >= 2);
  const unique = [...new Map(names.map((n) => [normalizeText(n), n])).values()];
  return unique.length ? unique.map((n) => `"${n}"`).join(" OR ") : null;
}
