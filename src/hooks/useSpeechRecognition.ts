import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ditado por voz via Web Speech API (Chrome/Edge). Transcreve fala → texto.
 * A API da Anthropic (Claude) não aceita áudio, então transcrevemos no
 * navegador e mandamos o texto como prompt para o Humberto. pt-BR por padrão.
 */

type SpeechState = 'idle' | 'listening';

interface UseSpeechRecognitionOptions {
  lang?: string;
  /** transcrição parcial enquanto fala (para mostrar ao vivo no input) */
  onInterim?: (text: string) => void;
  /** transcrição final ao parar (para enviar) */
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}

// Tipos mínimos da Web Speech API (não vêm no lib.dom padrão do TS).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = 'pt-BR' } = options;
  const [state, setState] = useState<SpeechState>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');

  // callbacks em refs → os handlers (criados uma vez) sempre chamam a versão atual
  const cbRef = useRef(options);
  cbRef.current = options;

  const supported = useRef<boolean>(Boolean(getRecognitionCtor())).current;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      cbRef.current.onError?.('unsupported');
      return;
    }
    // já gravando → ignora
    if (recognitionRef.current) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false; // para sozinho após uma pausa → bom p/ comandos
    finalRef.current = '';

    rec.onresult = (event: any) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (finalChunk) finalRef.current += finalChunk;
      cbRef.current.onInterim?.((finalRef.current + interim).trim());
    };

    rec.onerror = (event: any) => {
      cbRef.current.onError?.(event?.error ?? 'error');
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setState('idle');
      const text = finalRef.current.trim();
      finalRef.current = '';
      if (text) cbRef.current.onFinal?.(text);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setState('listening');
    } catch {
      recognitionRef.current = null;
      setState('idle');
      cbRef.current.onError?.('start_failed');
    }
  }, [lang]);

  // limpa ao desmontar
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, state, start, stop };
}
