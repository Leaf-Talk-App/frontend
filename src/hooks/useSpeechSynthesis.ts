import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Leitura em voz alta via Web Speech API (speechSynthesis). Complementa o
 * ditado: o Humberto fala as respostas — acessibilidade para quem prefere
 * ouvir em vez de ler. pt-BR por padrão. Suportado na maioria dos navegadores
 * modernos (Chrome/Edge/Safari).
 */

interface UseSpeechSynthesisOptions {
  lang?: string;
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (!voices.length) return null;
  const prefix = lang.split('-')[0].toLowerCase();
  // 1ª escolha: idioma+região exato; 2ª: mesmo idioma; senão deixa o default.
  return (
    voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}) {
  const { lang = 'pt-BR' } = options;
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const speakingIdRef = useRef<string | null>(null);
  speakingIdRef.current = speakingId;

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  /**
   * Fala o texto. Se já estiver falando o mesmo id → para (toggle).
   * `id` identifica a mensagem para o botão refletir qual está tocando.
   */
  const speak = useCallback(
    (text: string, id: string) => {
      if (!supported || !text.trim()) return;
      // toggle: clicar de novo na mesma mensagem interrompe
      if (speakingIdRef.current === id) {
        cancel();
        return;
      }
      window.speechSynthesis.cancel(); // interrompe qualquer fala anterior
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      const voice = pickVoice(lang);
      if (voice) utter.voice = voice;
      utter.onend = () => {
        if (speakingIdRef.current === id) setSpeakingId(null);
      };
      utter.onerror = () => {
        if (speakingIdRef.current === id) setSpeakingId(null);
      };
      setSpeakingId(id);
      window.speechSynthesis.speak(utter);
    },
    [supported, lang, cancel],
  );

  // limpa ao desmontar — senão a fala continua após sair da tela
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { supported, speak, cancel, speakingId };
}
