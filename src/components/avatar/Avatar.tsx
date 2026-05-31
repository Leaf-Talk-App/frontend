import './avatar.css';

interface AvatarProps {
  src?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
  alt?: string;
}

export function Avatar({
  src,
  initials,
  size = 'md',
  online,
  alt = 'Avatar',
}: AvatarProps) {
  return (
    <div className={`avatar avatar--${size} ${online ? 'avatar--online' : ''}`}>
      {src ? (
        <img src={src} alt={alt} className="avatar__image" />
      ) : (
        <span className="avatar__initials">{initials}</span>
      )}
      {online && <span className="avatar__status" aria-label="Online" />}
    </div>
  );
}
