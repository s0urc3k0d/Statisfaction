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
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(34,211,238,0.5), transparent 50%), radial-gradient(circle at 70% 70%, rgba(99,102,241,0.5), transparent 50%)',
          borderRadius: 4,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#e5e7eb',
          }}
        >
          S
        </div>
      </div>
    ),
    { width: 32, height: 32 }
  );
}
