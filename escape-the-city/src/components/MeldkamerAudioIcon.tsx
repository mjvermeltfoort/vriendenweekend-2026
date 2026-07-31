interface MeldkamerAudioIconProps {
  className?: string;
}

export function MeldkamerAudioIcon({ className }: MeldkamerAudioIconProps) {
  const iconRoot = `${import.meta.env.BASE_URL}assets/icons/meldkamer-audio-64`;

  return (
    <picture className={className} aria-hidden="true">
      <source srcSet={`${iconRoot}.webp`} type="image/webp" />
      <img src={`${iconRoot}.png`} alt="" width="64" height="64" decoding="async" />
    </picture>
  );
}
