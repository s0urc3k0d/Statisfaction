import { ImageResponse } from 'next/og';

// Icon sizes for PWA
export function generateImageMetadata() {
  return [
    { id: 'small', size: { width: 48, height: 48 }, contentType: 'image/png' },
    { id: 'medium', size: { width: 72, height: 72 }, contentType: 'image/png' },
    { id: 'large', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: 'xlarge', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ];
}

export default function Icon({ id }: { id: string }) {
  const sizes: Record<string, { width: number; height: number }> = {
    small: { width: 48, height: 48 },
    medium: { width: 72, height: 72 },
    large: { width: 192, height: 192 },
    xlarge: { width: 512, height: 512 },
  };
  
  const size = sizes[id] || sizes.large;
  const fontSize = Math.floor(size.width * 0.5);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0f14',
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.4), transparent 50%), radial-gradient(circle at 70% 70%, rgba(99,102,241,0.4), transparent 50%)',
          borderRadius: size.width * 0.2,
        }}
      >
        <div
          style={{
            fontSize,
            fontWeight: 800,
            color: '#e5e7eb',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size }
  );
}
