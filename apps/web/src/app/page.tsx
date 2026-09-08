"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  sessionCreatedResponseSchema,
  sessionEventMessageSchema,
  textUpdatePayloadSchema,
} from "@web-drop/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const MAX_FILE_SIZE_MB = 2048;
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5 MB

type SessionState = "idle" | "creating" | "ready" | "connected";

interface UploadResult {
  code: string;
  url: string;
  expiresAt: string;
}

export default function Home() {
  const [state, setState] = useState<SessionState>("idle");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");

  const sessionUrl = useMemo(() => `${API_BASE}/ws/session/${code}`, [code]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const createSession = async () => {
    setState("creating");
    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = sessionCreatedResponseSchema.parse(await response.json());
      setCode(data.code);
      setState("ready");
      setMessage(`Session created: ${data.code}`);
    } catch (error) {
      setState("idle");
      setMessage("Failed to create session");
    }
  };

  const connectSession = async () => {
    if (!code) return;
    setMessage("Connecting...");
    setState("connected");

    const socket = new WebSocket(sessionUrl);
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      setMessage("Connected to session");
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const message = sessionEventMessageSchema.safeParse(parsed);

        if (message.success && message.data.event.type === "text.update") {
          const nextText = typeof message.data.event.data === "string" ? message.data.event.data : "";
          setText(nextText);
          setEvents((prev) => [`${new Date().toLocaleTimeString()}: ${nextText}`, ...prev]);
        }
      } catch {
        // ignore invalid payloads
      }
    });

    socket.addEventListener("close", () => {
      setMessage("Disconnected");
      setState("ready");
    });

    socket.addEventListener("error", () => {
      setMessage("WebSocket error");
      setState("ready");
    });
  };

  const sendText = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const payload = textUpdatePayloadSchema.parse({ type: "session.text.update", data: text });
    wsRef.current.send(JSON.stringify(payload));
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    setUploadError("");

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(`File exceeds maximum size of ${MAX_FILE_SIZE_MB} MB`);
      setUploading(false);
      return;
    }

    try {
      let result: UploadResult;

      if (file.size <= MULTIPART_THRESHOLD) {
        // Small file — upload via base64
        const buffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""));

        const response = await fetch(`${API_BASE}/api/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content: base64, ttlSeconds: 3600 }),
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        result = await response.json();
      } else {
        // Large file — upload via multipart
        const formData = new FormData();
        formData.append("file", file);
        formData.append("ttlSeconds", "3600");

        const response = await fetch(`${API_BASE}/api/files/multipart`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        result = await response.json();
      }

      setUploadResult(result);
      setMessage(`File uploaded: ${file.name}`);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const qrSrc = useMemo(() => {
    if (!code) return "";
    return `${API_BASE}/api/qr?kind=session&code=${code}`;
  }, [code]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-semibold">WebDrop</h1>
          <p className="mt-2 text-sm text-slate-300">
            Создайте сессию, подключитесь с другого устройства и синхронизируйте текст в реальном времени.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <button
            className="rounded-xl bg-lime-500 px-4 py-3 font-semibold text-black hover:bg-lime-400 disabled:opacity-50"
            onClick={createSession}
            disabled={state === "creating"}
          >
            {state === "creating" ? "Создаём..." : "Создать сессию"}
          </button>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
            onClick={connectSession}
            disabled={!code || state === "creating"}
          >
            Подключиться к сессии
          </button>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Session code</p>
            <div className="mt-2 break-all text-lg font-medium">{code || "—"}</div>
            {code && (
              <div className="mt-3">
                <p className="mb-1 text-sm text-slate-400">QR-код</p>
                <img
                  src={qrSrc}
                  alt={`QR for session ${code}`}
                  className="h-32 w-32 rounded-lg border border-white/10 bg-white"
                />
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Status</p>
            <div className="mt-2 text-lg font-medium">{state}</div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <textarea
            className="h-40 w-full rounded-xl border border-white/10 bg-black/70 p-4 text-white outline-none"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Введите текст для синхронизации"
          />
          <button
            className="mt-4 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
            onClick={sendText}
            disabled={state !== "connected"}
          >
            Отправить текст
          </button>
          <p className="mt-3 text-sm text-slate-400">{message}</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Загрузить файл</h2>
          <p className="mt-1 text-sm text-slate-400">
            До {MAX_FILE_SIZE_MB} МБ. Файлы до 5 МБ — base64, больше — multipart.
          </p>
          <input
            type="file"
            onChange={onFileSelected}
            disabled={uploading}
            className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black hover:file:bg-cyan-400 disabled:opacity-50"
          />
          {uploading && <p className="mt-2 text-sm text-cyan-400">Загрузка...</p>}
          {uploadError && <p className="mt-2 text-sm text-red-400">{uploadError}</p>}
          {uploadResult && (
            <div className="mt-2 rounded-xl bg-white/5 p-3 text-sm">
              <p>
                <span className="text-slate-400">Скачать: </span>
                <a
                  href={`${API_BASE}${uploadResult.url}`}
                  className="text-cyan-400 underline hover:text-cyan-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {uploadResult.url}
                </a>
              </p>
              <p className="mt-1 text-slate-500">Expires: {new Date(uploadResult.expiresAt).toLocaleString()}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Events</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {events.length === 0 ? (
              <p>События появятся здесь после синхронизации.</p>
            ) : (
              events.map((event, index) => (
                <div key={index} className="rounded-xl bg-white/5 p-3">
                  {event}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}