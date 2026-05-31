import { useEffect, useRef, useState } from 'react';
import './emoji-picker.css';

const EMOJIS = [
  // Rostos
  '😀','😁','😂','🤣','😊','😇','🙂','😉','😍','🤩','😘','😗','😚','😙',
  '😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','😐','😑','😶',
  '😏','😒','🙄','😬','😮','🤯','😳','😱','😨','😰','😥','😓','🤧','😷',
  '🥴','😵','🤠','🥳','😎','🤓','🧐','😭','😢','😟','😔','😕','🙁','☹️',
  '😣','😖','😫','😩','🥺','😤','😠','😡','🤬','😈','👿','💀','☠️','💩',
  // Gestos
  '👍','👎','👋','🤚','✋','🖐','👌','🤌','✌️','🤞','🤟','🤙','👈','👉',
  '👆','👇','☝️','👏','🙌','🤲','💪','🦾','🫶','❤️','🧡','💛','💚','💙',
  // Objetos
  '🎉','🎊','🎈','🎁','🎂','🍕','🍔','🍟','🌮','🍜','☕','🍺','🥂','🍾',
  '⚽','🏀','🎮','🎸','🎵','🎶','🌍','🌙','⭐','🌈','⚡','🔥','💧','🌊',
];

const ROWS = 8;

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref} role="dialog" aria-label="Escolha um emoji">
      <div className="emoji-picker__grid">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-picker__btn"
            onClick={() => onSelect(emoji)}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
