export function buildMultipart(parts: Record<string, any>) {
  const boundary = "----cf-" + crypto.randomUUID();
  const chunks = [];

  for (const [name, value] of Object.entries(parts)) {
    chunks.push(`--${boundary}`);

    if (value instanceof File) {
      chunks.push(
        `Content-Disposition: form-data; name="${name}"; filename="${value.name}"`,
        `Content-Type: ${value.type || "application/octet-stream"}`,
        "",
        value
      );
    } else {
      chunks.push(
        `Content-Disposition: form-data; name="${name}"`,
        "",
        typeof value === "string" ? value : JSON.stringify(value)
      );
    }
  }

  chunks.push(`--${boundary}--`, "");

  return {
    body: new Blob(chunks),
    boundary
  };
}

