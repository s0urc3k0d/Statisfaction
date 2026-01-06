import type { Metadata } from 'next';
import Link from 'next/link';
import { Adsense } from '../../components/Adsense';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';

export const metadata: Metadata = {
  title: 'À propos de Statisfaction — Analytics Twitch',
  description: 'Découvrez l\'histoire de Statisfaction, la plateforme d\'analytics Twitch gratuite créée par un streamer pour les streamers francophones.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'À propos · Statisfaction',
    description: 'L\'histoire et la mission de Statisfaction, plateforme d\'analytics Twitch gratuite.',
    type: 'article',
  },
};

const socials = [
  { label: 'Twitch', href: 'https://twitch.tv/LANTREDESILVER', icon: '🎮' },
  { label: 'Twitter', href: 'https://twitter.com/lantredesilver', icon: '🐦' },
  { label: 'Instagram', href: 'https://instagram.com/lantredesilver', icon: '📷' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@lantredesilver', icon: '🎵' },
  { label: 'YouTube', href: 'https://youtube.com/@lantredesilver', icon: '📺' },
  { label: 'GitHub', href: 'https://github.com/S0URC3K0D', icon: '💻' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-16 px-8 text-center" style={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--brand) 12%, var(--bg)) 0%, var(--bg) 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">À propos de Statisfaction</h1>
          <p className="text-xl text-muted">
            Une plateforme d&apos;analytics Twitch créée par un streamer, pour les streamers.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="py-12 px-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">L&apos;origine du projet</h2>
        <div className="prose prose-invert max-w-none space-y-4 text-muted">
          <p>
            Statisfaction est né d&apos;une frustration simple : en tant que streamer sur Twitch, il est difficile d&apos;avoir 
            une vue claire et actionnable de ses performances. Les statistiques natives de Twitch sont limitées, et les 
            outils tiers existants sont souvent payants, complexes ou inadaptés aux besoins des streamers francophones.
          </p>
          <p>
            Le projet a été lancé par <strong>LANTREDESILVER</strong> (alias S0URC3K0D), développeur et streamer passionné. 
            L&apos;objectif était de créer un outil simple, gratuit et efficace pour aider les créateurs de contenu Twitch 
            à comprendre leur audience et à améliorer leurs streams.
          </p>
          <p>
            Aujourd&apos;hui, Statisfaction offre un tableau de bord complet avec des analytics en temps réel, un historique 
            de streams, des heatmaps d&apos;audience, un système de récapitulatifs automatiques par email, et bien plus encore.
          </p>
        </div>
      </section>

      {/* Ad placement */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Mission */}
      <section className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Notre mission</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <MissionCard 
              icon="🎯" 
              title="Simplicité" 
              desc="Offrir des analytics claires et compréhensibles, sans jargon technique. Chaque fonctionnalité doit être intuitive."
            />
            <MissionCard 
              icon="💰" 
              title="Accessibilité" 
              desc="Rester 100% gratuit pour les fonctionnalités essentielles. Les petits streamers méritent aussi de bons outils."
            />
            <MissionCard 
              icon="🔒" 
              title="Respect des données" 
              desc="Vos données vous appartiennent. Nous ne vendons jamais vos informations et vous pouvez les supprimer à tout moment."
            />
          </div>
        </div>
      </section>

      {/* Features summary */}
      <section className="py-12 px-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Ce que propose Statisfaction</h2>
        <div className="space-y-4 text-muted">
          <p>
            <strong>Dashboard en temps réel</strong> : Suivez vos viewers, followers et messages chat en direct pendant vos streams. 
            Identifiez instantanément quand votre audience réagit le plus.
          </p>
          <p>
            <strong>Historique et analytics</strong> : Accédez à l&apos;historique complet de vos streams passés. Consultez les 
            statistiques détaillées : durée, pic de viewers, moyenne, nouveaux followers, taux de conversion.
          </p>
          <p>
            <strong>Heatmaps d&apos;audience</strong> : Visualisez sur une carte thermique les moments où votre audience est la plus 
            engagée. Identifiez les créneaux horaires idéaux pour streamer.
          </p>
          <p>
            <strong>Comparaisons</strong> : Comparez vos performances entre différentes périodes ou streams. Mesurez votre 
            progression et identifiez les tendances.
          </p>
          <p>
            <strong>Récaps automatiques</strong> : Recevez un email de récapitulatif après chaque stream avec vos stats clés, 
            les moments forts, et une comparaison avec vos performances passées.
          </p>
          <p>
            <strong>Objectifs et badges</strong> : Fixez-vous des objectifs (followers, viewers, durée de stream) et débloquez 
            des badges en progressant. Gamifiez votre parcours de streamer !
          </p>
          <p>
            <strong>Intégrations</strong> : Connectez Statisfaction à Discord pour recevoir des notifications quand vous 
            passez en live ou atteignez des milestones.
          </p>
        </div>
      </section>

      {/* Ad placement */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Tech stack */}
      <section className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Technologies utilisées</h2>
          <p className="text-muted mb-4">
            Statisfaction est construit avec des technologies modernes et fiables :
          </p>
          <ul className="grid md:grid-cols-2 gap-2 text-muted">
            <li>• <strong>Next.js 15</strong> — Framework React pour le frontend</li>
            <li>• <strong>Express.js</strong> — Serveur backend Node.js</li>
            <li>• <strong>Prisma</strong> — ORM pour la base de données</li>
            <li>• <strong>Twitch API</strong> — Intégration officielle EventSub</li>
            <li>• <strong>Tailwind CSS</strong> — Design system responsive</li>
            <li>• <strong>Server-Sent Events</strong> — Données temps réel</li>
          </ul>
          <p className="text-muted mt-4">
            Le projet est open source et disponible sur <a href="https://github.com/S0URC3K0D" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>GitHub</a>.
          </p>
        </div>
      </section>

      {/* Contact / Social */}
      <section className="py-12 px-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Retrouvez-nous</h2>
        <p className="text-muted mb-6">
          Pour des questions, suggestions ou simplement pour discuter streaming, retrouvez LANTREDESILVER sur ces plateformes :
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {socials.map(s => (
            <a 
              key={s.label} 
              href={s.href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="card p-4 flex items-center gap-3 hover:scale-105 transition"
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="font-medium">{s.label}</span>
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-8 text-center" style={{ backgroundColor: 'color-mix(in oklab, var(--brand) 10%, var(--bg))' }}>
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Prêt à essayer ?</h2>
          <p className="text-muted">
            Statisfaction est gratuit et ne prend que quelques secondes à configurer.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/" className="btn btn-brand">Retour à l&apos;accueil</Link>
            <Link href="/guide" className="btn btn-muted">Lire le guide</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MissionCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card p-6 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted">{desc}</p>
    </div>
  );
}
