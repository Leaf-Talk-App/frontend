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
  const holdRef = useRef(false);     // modo "segurar para falar" (push-to-talk)
  const stoppingRef = useRef(false); // usuário soltou → não reinicia

  // callbacks em refs → os handlers (criados uma vez) sempre chamam a versão atual
  const cbRef = useRef(options);
  cbRef.current = options;

  const supported = useRef<boolean>(Boolean(getRecognitionCtor())).current;

  const spawn = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      cbRef.current.onError?.('unsupported');
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    // em hold (push-to-talk) fica contínuo e NÃO encerra na pausa
    rec.continuous = holdRef.current;

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
      const err = event?.error ?? 'error';
      // segurando o botão: silêncio/abort não são erro — o onend reinicia
      if (holdRef.current && (err === 'no-speech' || err === 'aborted')) return;
      cbRef.current.onError?.(err);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      // ainda segurando → reinicia para continuar ouvindo (Chrome encerra na pausa)
      if (holdRef.current && !stoppingRef.current) {
        spawn();
        return;
      }
      setState('idle');
      const text = finalRef.current.trim();
      finalRef.current = '';
      holdRef.current = false;
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

  const start = useCallback(
    (opts?: { hold?: boolean }) => {
      if (recognitionRef.current) return; // já gravando
      finalRef.current = '';
      stoppingRef.current = false;
      holdRef.current = Boolean(opts?.hold);
      spawn();
    },
    [spawn],
  );

  const stop = useCallback(() => {
    stoppingRef.current = true; // evita o auto-restart do hold
    recognitionRef.current?.stop();
  }, []);

  // limpa ao desmontar
  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, state, start, stop };
}
