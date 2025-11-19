export function buildMultipart(parts: Record<string, any>) {
  const boundary = "----cf-" + crypto.randomUUID();
  const chunks: (string | Blob | Uint8Array)[] = [];

  for (const [name, value] of Object.entries(parts)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        appendPart(chunks, boundary, name, item);
      }
    } else {
      appendPart(chunks, boundary, name, value);
    }
  }

  chunks.push(`--${boundary}--\r\n`);

  return {
    body: new Blob(chunks),
    boundary
  };
}

function appendPart(chunks: (string | Blob | Uint8Array)[], boundary: string, name: string, value: any) {
  chunks.push(`--${boundary}\r\n`);

  if (value instanceof File) {
    chunks.push(
      `Content-Disposition: form-data; name="${name}"; filename="${value.name}"\r\n`,
      `Content-Type: ${value.type || "application/octet-stream"}\r\n`,
      "\r\n",
      value,
      "\r\n"
    );
  } else {
    chunks.push(
      `Content-Disposition: form-data; name="${name}"\r\n`,
      "\r\n",
      typeof value === "string" ? value : JSON.stringify(value),
      "\r\n"
    );
  }
}
