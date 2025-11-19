export function buildMultipart(parts: Record<string, any>) {
  const boundary = "----cf-" + crypto.randomUUID();
  const chunks: (string | Blob | Uint8Array)[] = [];

  for (const [name, value] of Object.entries(parts)) {
    if (Array.isArray(value)) {
      // Handle arrays (e.g. multiple files)
      for (const item of value) {
        appendPart(chunks, boundary, name, item);
      }
    } else {
      appendPart(chunks, boundary, name, value);
    }
  }

  chunks.push(`--${boundary}--`, "");

  return {
    body: new Blob(chunks),
    boundary
  };
}

function appendPart(chunks: (string | Blob | Uint8Array)[], boundary: string, name: string, value: any) {
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
