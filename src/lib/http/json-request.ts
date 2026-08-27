import "server-only";

export class JsonRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonRequestError";
  }
}

export async function readLimitedJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentType !== "application/json") {
    throw new JsonRequestError("Expected application/json.");
  }

  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > maxBytes
  ) {
    throw new JsonRequestError("JSON request body is too large.");
  }

  if (!request.body) {
    throw new JsonRequestError("JSON request body is missing.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new JsonRequestError("JSON request body is too large.");
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let body: string;

  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new JsonRequestError("JSON request body is not valid UTF-8.");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new JsonRequestError("JSON request body is invalid.");
  }
}
