import { useState, useEffect } from "react";

export function Clock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(var(--primary),0.2)]">
      <span className="font-mono text-lg font-bold tracking-wider">
        {currentTime.toLocaleTimeString("pt-BR")}
      </span>
    </div>
  );
}
