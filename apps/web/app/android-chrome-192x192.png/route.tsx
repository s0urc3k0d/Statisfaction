import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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
          borderRadius: 38,
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: '#e5e7eb',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          S
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
