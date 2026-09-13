const sensitiveKey =
  /^(?:authorization|proxy-authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|password|credential|secret)$/i;
const marker = "[REDACTED]";
export function redact<T>(value: T): T {
  const visit = (v: unknown): unknown => {
    if (typeof v === "string")
      return v
        .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${marker}`)
        .replace(
          /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
          marker,
        )
        .replace(
          /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|password)["']?\s*[=:]\s*["']?)([^\s"',;}]+)/gi,
          `$1${marker}`,
        );
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [
          k,
          sensitiveKey.test(k) ? marker : visit(x),
        ]),
      );
    return v;
  };
  return visit(value) as T;
}
