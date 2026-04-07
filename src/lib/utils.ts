export function isValidFilename(name: string): boolean {
  // Only forbid '/' which is the path separator on Linux/Unix.
  // Also forbid '..' and '.' to prevent path traversal.
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  if (trimmed === "." || trimmed === "..") return false;
  
  const invalidChars = /[/]/;
  return !invalidChars.test(name);
}

export function getInvalidChars(name: string): string[] {
  const invalidChars = /[/]/g;
  const matches = name.match(invalidChars);
  const result = matches ? Array.from(new Set(matches)) : [];
  if (name.trim() === "." || name.trim() === "..") {
    result.push(name.trim());
  }
  return result;
}
