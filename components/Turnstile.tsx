"use client";

import React, { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
}

export function Turnstile({ siteKey, onVerify }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const callbackName = `onloadTurnstileCallback_${siteKey.replace(/[^a-zA-Z0-9]/g, '')}`;

    (window as any)[callbackName] = () => {
      if (containerRef.current && (window as any).turnstile) {
        // Reset any existing widget
        if (widgetIdRef.current) {
          try {
            (window as any).turnstile.remove(widgetIdRef.current);
          } catch (e) {
            // Ignore reset error
          }
        }
        
        widgetIdRef.current = (window as any).turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerify(token);
          },
        });
      }
    };

    if (!document.getElementById('cloudflare-turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'cloudflare-turnstile-script';
      script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=${callbackName}`;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    } else {
      // If script is already loaded, trigger callback or render directly
      if ((window as any).turnstile) {
        (window as any)[callbackName]();
      } else {
        // Wait for turnstile object to be ready
        const interval = setInterval(() => {
          if ((window as any).turnstile) {
            clearInterval(interval);
            (window as any)[callbackName]();
          }
        }, 100);
      }
    }

    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore cleanup error
        }
      }
      delete (window as any)[callbackName];
    };
  }, [siteKey, onVerify]);

  return <div ref={containerRef} className="cf-turnstile my-4 flex justify-center" />;
}
