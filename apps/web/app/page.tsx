import Link from 'next/link';
import type { Metadata } from 'next';
import { Adsense } from '../components/Adsense';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4100';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';

export const metadata: Metadata = {
  title: 'Statisfaction — Analytics & Outils Twitch pour Streamers',
  description: 'Statisfaction est la plateforme d\'analytics Twitch gratuite pour les streamers francophones. Suivez vos viewers, followers, clips et optimisez vos streams avec des outils puissants.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Statisfaction — Analytics Twitch pour Streamers',
    description: 'Plateforme gratuite d\'analytics et outils Twitch. Heatmaps, statistiques, récaps automatiques.',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-16 px-8 text-center" style={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--brand) 15%, var(--bg)) 0%, var(--bg) 100%)' }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            📊 Statisfaction
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            La plateforme d&apos;analytics Twitch <strong>gratuite</strong> pour les streamers francophones. 
            Suivez vos performances, analysez votre audience et optimisez vos streams.
          </p>
          <div className="pt-4">
            <a href={`${API_BASE}/auth/twitch`} className="btn btn-brand text-lg px-8 py-3 transition hover:scale-105">
              🎮 Se connecter avec Twitch
            </a>
          </div>
          <p className="text-sm text-muted">
            Connexion sécurisée via Twitch. Aucun mot de passe requis.
          </p>
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-16 px-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          Pourquoi choisir Statisfaction ?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureBlock 
            icon="📈" 
            title="Analytics en temps réel" 
            desc="Suivez vos viewers, messages chat et followers en direct. Visualisez les pics d'audience et identifiez vos meilleurs moments de stream."
          />
          <FeatureBlock 
            icon="🗓️" 
            title="Calendrier de live" 
            desc="Planifiez vos streams et synchronisez automatiquement avec votre planning Twitch. Exportez vers Google Calendar ou Apple Calendar."
          />
          <FeatureBlock 
            icon="🎬" 
            title="Gestion des clips" 
            desc="Détectez les moments forts de vos streams grâce à l'analyse chat+viewers. Créez et organisez vos clips facilement."
          />
          <FeatureBlock 
            icon="📧" 
            title="Récaps automatiques" 
            desc="Recevez un email de récapitulatif après chaque stream avec vos stats clés, badges gagnés et comparaison avec vos performances passées."
          />
          <FeatureBlock 
            icon="🎯" 
            title="Objectifs & Succès" 
            desc="Fixez des objectifs (followers, viewers, durée) et débloquez des badges. Gamifiez votre progression de streamer !"
          />
          <FeatureBlock 
            icon="🔔" 
            title="Notifications Discord" 
            desc="Configurez des webhooks pour recevoir des alertes sur Discord quand vous passez en live ou atteignez des milestones."
          />
        </div>
      </section>

      {/* Ad placement */}
      <section className="py-8 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* How it works */}
      <section className="py-16 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Comment ça marche ?
          </h2>
          <div className="space-y-8">
            <Step number={1} title="Connectez-vous avec Twitch" desc="Authentification sécurisée OAuth. Nous n'avons jamais accès à votre mot de passe Twitch. Vous gardez le contrôle total de vos données." />
            <Step number={2} title="Explorez votre dashboard" desc="Accédez à vos statistiques en temps réel : viewers actuels, followers du jour, messages chat par minute. Tout est automatiquement synchronisé avec votre chaîne." />
            <Step number={3} title="Analysez vos performances" desc="Consultez les heatmaps horaires pour identifier vos meilleurs créneaux. Comparez vos streams entre eux et suivez votre progression sur le long terme." />
            <Step number={4} title="Optimisez vos streams" desc="Utilisez nos outils pour planifier vos lives, détecter les moments à clipper, et recevoir des récaps détaillés après chaque session." />
          </div>
        </div>
      </section>

      {/* Stats showcase */}
      <section className="py-16 px-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Des analytics pensées pour les streamers
        </h2>
        <p className="text-center text-muted mb-12 max-w-2xl mx-auto">
          Statisfaction collecte et analyse vos données Twitch pour vous offrir des insights actionnables. 
          Comprenez votre audience, identifiez les tendances et prenez des décisions éclairées.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <StatCard title="Heatmaps horaires" desc="Visualisez quand votre audience est la plus active. Identifiez les créneaux idéaux pour maximiser vos viewers." />
          <StatCard title="Comparaisons de périodes" desc="Comparez vos performances semaine après semaine, mois après mois. Mesurez votre croissance réelle." />
          <StatCard title="Taux de conversion" desc="Analysez combien de viewers deviennent followers. Optimisez votre contenu pour améliorer ce ratio." />
          <StatCard title="Historique complet" desc="Accédez à l'historique de tous vos streams passés. Revivez vos meilleurs moments et apprenez de chaque session." />
        </div>
      </section>

      {/* Testimonial / Social proof */}
      <section className="py-16 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--brand) 8%, var(--bg))' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Conçu par un streamer, pour les streamers
          </h2>
          <p className="text-lg text-muted mb-8">
            Statisfaction est né d&apos;un besoin simple : avoir des statistiques Twitch claires et actionnables, 
            sans complexité inutile. Le projet est développé par <a href="https://twitch.tv/lantredesilver" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>LANTREDESILVER</a>, 
            streamer et développeur passionné.
          </p>
          <p className="text-muted">
            L&apos;outil est 100% gratuit et open source. Vos données vous appartiennent.
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-8 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold">
            Prêt à optimiser vos streams ?
          </h2>
          <p className="text-muted">
            Rejoignez Statisfaction gratuitement et découvrez une nouvelle façon d&apos;analyser vos performances Twitch.
          </p>
          <a href={`${API_BASE}/auth/twitch`} className="btn btn-brand text-lg px-8 py-3 inline-block transition hover:scale-105">
            🚀 Commencer maintenant
          </a>
        </div>
      </section>

      {/* Bottom ad */}
      <section className="py-8 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Links */}
      <section className="py-8 px-8 max-w-4xl mx-auto text-center text-sm text-muted">
        <p>
          En vous connectant, vous acceptez notre <Link href="/privacy" className="hover:underline" style={{ color: 'var(--brand)' }}>politique de confidentialité</Link>.
        </p>
        <p className="mt-2">
          Découvrez toutes les <Link href="/features" className="hover:underline" style={{ color: 'var(--brand)' }}>fonctionnalités</Link> ou 
          lisez notre <Link href="/guide" className="hover:underline" style={{ color: 'var(--brand)' }}>guide du streamer</Link>.
        </p>
      </section>
    </main>
  );
}

function FeatureBlock({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card p-6 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted">{desc}</p>
    </div>
  );
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold" style={{ backgroundColor: 'var(--brand)', color: 'var(--bg)' }}>
        {number}
      </div>
      <div>
        <h3 className="text-xl font-semibold mb-1">{title}</h3>
        <p className="text-muted">{desc}</p>
      </div>
    </div>
  );
}

function StatCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted">{desc}</p>
    </div>
  );
}
