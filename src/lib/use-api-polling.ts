import { useEffect, useState } from "react";

const alwaysPoll = () => true;

/** Una consulta por ciclo; efectos antiguos nunca reemplazan datos actuales. */
export function useApiPolling<T>(load: () => Promise<T>, intervalMs = 0, shouldPoll: (result: T) => boolean = alwaysPoll) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true); setError("");
    const poll = async () => {
      let repeat = true;
      try { const result = await load(); repeat = shouldPoll(result); if (alive) { setData(result); setError(""); } }
      catch { if (alive) setError("No pudimos cargar la información. Inténtalo nuevamente."); }
      finally {
        if (alive) { setLoading(false); if (intervalMs > 0 && repeat) timer = setTimeout(poll, intervalMs); }
      }
    };
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [load, intervalMs, shouldPoll, version]);
  return { data, loading, error, retry: () => setVersion((value) => value + 1) };
}
