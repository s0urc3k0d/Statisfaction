import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#0b0f14',
          color: '#e5e7eb',
          padding: '64px',
          backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(34,211,238,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.25), transparent 40%)',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 800, marginBottom: 16 }}>Statisfaction</div>
        <div style={{ fontSize: 28, color: '#9ca3af', maxWidth: 900 }}>
          Stats & Outils avancés Twitch: calendrier de live, clips, analytics détaillées.
        </div>
        <div style={{ marginTop: 32, fontSize: 22, color: '#a78bfa' }}>twitch.tv/lantredesilver · github.com/S0URC3K0D</div>
      </div>
    ),
    { ...size }
  );
}
