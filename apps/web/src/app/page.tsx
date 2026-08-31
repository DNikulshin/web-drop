"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  sessionCreatedResponseSchema,
  sessionEventMessageSchema,
  textUpdatePayloadSchema,
} from "@web-drop/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type SessionState = "idle" | "creating" | "ready" | "connected";

export default function Home() {
  const [state, setState] = useState<SessionState>("idle");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [message, setMessage] = useState("");

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
      console.log(error)
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

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-3xl font-semibold">WebDrop Text Sync</h1>
          <p className="mt-2 text-sm text-slate-300">
            Создайте сессию, подключитесь с другого устройства и синхронизируйте текст в реальном времени.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <button
            className="rounded-xl bg-lime-500 px-4 py-3 font-semibold text-black hover:bg-lime-400"
            onClick={createSession}
            disabled={state === "creating"}
          >
            {state === "creating" ? "Создаём..." : "Создать сессию"}
          </button>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10"
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
            className="mt-4 rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black hover:bg-cyan-400"
            onClick={sendText}
            disabled={state !== "connected"}
          >
            Отправить текст
          </button>
          <p className="mt-3 text-sm text-slate-400">{message}</p>
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
