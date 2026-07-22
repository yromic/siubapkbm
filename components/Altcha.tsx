"use client";

import React, { useEffect, useState } from "react";
import { Loader2, ShieldAlert, Check, RefreshCw } from "lucide-react";

interface AltchaProps {
  challenge: {
    algorithm: string;
    challenge: string;
    salt: string;
    signature: string;
    maxnumber: number;
  };
  onVerify: (payload: string) => void;
}

export function Altcha({ challenge, onVerify }: AltchaProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Menyiapkan verifikasi keamanan...");
  const [isSolved, setIsSolved] = useState(false);
  const [isError, setIsError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setIsSolved(false);
    setIsError(false);
    setProgress(0);
    setStatus("Menyiapkan verifikasi keamanan...");
    
    const MIN_ANIMATION_MS = 1200; // Minimal visual animation duration (1.2s)
    const startTime = Date.now();

    const solve = async () => {
      try {
        const { challenge: targetChallenge, salt, maxnumber } = challenge;
        const target = targetChallenge.toLowerCase();
        const encoder = new TextEncoder();
        
        // Solve in responsive chunks to prevent browser UI freezing
        const chunkSize = 3000;
        
        for (let start = 0; start < maxnumber; start += chunkSize) {
          if (!active) return;
          
          const currentProgress = Math.min(90, Math.floor((start / maxnumber) * 100));
          setProgress(currentProgress);

          // Friendly changing status messages based on progress
          if (currentProgress < 20) {
            setStatus("Menyiapkan verifikasi keamanan...");
          } else if (currentProgress < 50) {
            setStatus("Memverifikasi browser...");
          } else if (currentProgress < 80) {
            setStatus("Memproses tantangan keamanan...");
          } else {
            setStatus("Hampir selesai...");
          }
          
          const end = Math.min(start + chunkSize, maxnumber);
          for (let i = start; i < end; i++) {
            const data = encoder.encode(salt + i);
            const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            
            if (hashHex === target) {
              if (!active) return;

              // Ensure smooth minimum animation duration
              const elapsedTime = Date.now() - startTime;
              const remainingTime = Math.max(0, MIN_ANIMATION_MS - elapsedTime);

              if (remainingTime > 0) {
                const stepCount = 10;
                const intervalMs = remainingTime / stepCount;
                const startProgress = currentProgress;
                
                for (let s = 1; s <= stepCount; s++) {
                  if (!active) return;
                  await new Promise((res) => setTimeout(res, intervalMs));
                  const interpolated = Math.min(99, Math.round(startProgress + ((100 - startProgress) * s) / stepCount));
                  setProgress(interpolated);
                  if (interpolated > 40 && interpolated < 80) {
                    setStatus("Memverifikasi browser...");
                  } else if (interpolated >= 80) {
                    setStatus("Hampir selesai...");
                  }
                }
              }

              if (!active) return;
              setProgress(100);
              setIsSolved(true);
              setStatus("Verifikasi keamanan berhasil.");
              
              const solution = {
                challenge: targetChallenge,
                salt,
                signature: challenge.signature,
                number: i
              };
              
              // Base64 encode the solution payload
              const payloadStr = JSON.stringify(solution);
              const base64Payload = btoa(unescape(encodeURIComponent(payloadStr)));
              onVerify(base64Payload);
              return;
            }
          }
          
          // Yield execution back to the browser event loop
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        
        if (active) {
          setIsError(true);
          setStatus("Tantangan gagal diselesaikan.");
        }
      } catch (err) {
        console.error("Altcha solver error:", err);
        if (active) {
          setIsError(true);
          setStatus("Gagal memproses verifikasi keamanan.");
        }
      }
    };

    solve();
    
    return () => {
      active = false;
    };
  }, [challenge, onVerify, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  return (
    <div 
      className="w-full p-4 rounded-xl border bg-white dark:bg-zinc-950 border-zinc-250 dark:border-zinc-800 transition-all duration-300 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          {isSolved ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 transition-all duration-300">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          ) : isError ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-all duration-300">
              <ShieldAlert className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          
          <div className="flex flex-col">
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {isSolved ? "Verifikasi Berhasil" : isError ? "Verifikasi Gagal" : "Verifikasi Keamanan"}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 transition-all duration-200">
              {status}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500">
            ALTCHA POW
          </span>
          {isError && (
            <button
              onClick={handleRetry}
              type="button"
              className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors focus:outline-none"
              aria-label="Coba lagi verifikasi keamanan"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Coba Lagi</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar (Visible when solving) */}
      {!isSolved && !isError && (
        <div className="mt-4 w-full h-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden" aria-hidden="true">
          <div 
            className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
