import { useCallback, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopped';

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const start = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(200); // chunk a cada 200ms
      mediaRecorderRef.current = recorder;
      setDuration(0);
      setState('recording');

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) { resolve(null); return; }

      clearInterval(timerRef.current);

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        // Para todas as tracks do microfone
        recorder.stream.getTracks().forEach((t) => t.stop());
        setState('idle');
        setDuration(0);
        resolve(blob);
      };

      recorder.stop();
      setState('stopped');
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    clearInterval(timerRef.current);
    if (recorder && recorder.state !== 'inactive') {
      recorder.stream.getTracks().forEach((t) => t.stop());
      recorder.stop();
    }
    chunksRef.current = [];
    setState('idle');
    setDuration(0);
  }, []);

  return { state, duration, start, stop, cancel };
}
