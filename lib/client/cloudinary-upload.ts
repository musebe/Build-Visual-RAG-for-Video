export const CLIENT_MAX_VIDEO_BYTES = 104_857_600;

const SUPPORTED_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

type UploadSignature = {
  apiKey: string;
  uploadUrl: string;
  signature: string;
  signedParams: Record<string, string | number | boolean | string[]>;
};

export type CloudinaryUploadResult = {
  asset_id: string;
  public_id: string;
};

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

export async function validateVideoFile(file: File) {
  if (!SUPPORTED_MIME_TYPES.has(file.type)) {
    throw new Error("Choose an MP4, MOV, or WebM video.");
  }
  if (file.size === 0 || file.size > CLIENT_MAX_VIDEO_BYTES) {
    throw new Error("Choose a video between 1 byte and 100 MB.");
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isIsoMedia = hasBytes(header, 4, [0x66, 0x74, 0x79, 0x70]);
  const isWebM = hasBytes(header, 0, [0x1a, 0x45, 0xdf, 0xa3]);
  if (!isIsoMedia && !isWebM) {
    throw new Error("The file contents do not match an MP4, MOV, or WebM video.");
  }
}

export async function requestUploadSignature(file: File, signal: AbortSignal) {
  return requestJson<UploadSignature>(
    "/api/uploads/sign",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, bytes: file.size }),
      signal,
    },
  );
}

export function uploadVideoToCloudinary(
  file: File,
  upload: UploadSignature,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) {
  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", file);
    formData.append("api_key", upload.apiKey);
    formData.append("signature", upload.signature);
    for (const [key, value] of Object.entries(upload.signedParams)) {
      formData.append(key, Array.isArray(value) ? value.join(",") : String(value));
    }

    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("Cloudinary upload failed.")));
    request.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    request.addEventListener("load", () => {
      signal.removeEventListener("abort", abort);
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("Cloudinary rejected the video upload."));
        return;
      }

      try {
        const result: unknown = JSON.parse(request.responseText);
        if (
          !result ||
          typeof result !== "object" ||
          !("asset_id" in result) ||
          !("public_id" in result) ||
          typeof result.asset_id !== "string" ||
          typeof result.public_id !== "string"
        ) {
          throw new Error("Cloudinary returned an invalid upload response.");
        }
        resolve({ asset_id: result.asset_id, public_id: result.public_id });
      } catch (error) {
        reject(error);
      }
    });

    request.open("POST", upload.uploadUrl);
    request.send(formData);
  });
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "The request could not be completed.";
    throw new Error(message);
  }

  return payload as T;
}

