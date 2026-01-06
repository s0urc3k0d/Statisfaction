import type { Metadata } from 'next';
import Link from 'next/link';
import { Adsense } from '../../components/Adsense';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';

export const metadata: Metadata = {
  title: 'Fonctionnalités — Analytics & Outils Twitch | Statisfaction',
  description: 'Découvrez toutes les fonctionnalités de Statisfaction : analytics temps réel, heatmaps viewers, récaps email, objectifs, notifications Discord et plus.',
  alternates: { canonical: `${SITE_URL}/features` },
  openGraph: {
    title: 'Fonctionnalités · Statisfaction',
    description: 'Analytics Twitch avancées : heatmaps, comparaisons, récaps automatiques, objectifs et intégrations.',
    type: 'website',
  },
};

export default function FeaturesPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-16 px-8 text-center" style={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--brand) 12%, var(--bg)) 0%, var(--bg) 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Fonctionnalités</h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            Tout ce dont vous avez besoin pour analyser, comprendre et améliorer vos streams Twitch. 
            Gratuit et sans engagement.
          </p>
        </div>
      </section>

      {/* Main features */}
      <section className="py-12 px-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">Analytics & Dashboard</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <FeatureDetail 
            icon="📊" 
            title="Dashboard temps réel"
            features={[
              'Viewers actuels avec graphique en direct',
              'Messages chat par minute',
              'Nouveaux followers en temps réel',
              'Statut de stream (online/offline)',
              'Durée de session actuelle',
            ]}
            desc="Suivez toutes vos métriques clés pendant que vous streamez. Le dashboard se met à jour automatiquement grâce à la technologie Server-Sent Events (SSE), sans avoir à rafraîchir la page."
          />
          <FeatureDetail 
            icon="🗺️" 
            title="Heatmaps d'audience"
            features={[
              'Carte thermique des viewers par heure',
              'Identification des pics d\'audience',
              'Analyse des créneaux optimaux',
              'Vue sur 7, 30 ou 90 jours',
              'Comparaison entre périodes',
            ]}
            desc="Visualisez quand votre audience est la plus engagée. Les heatmaps vous montrent les jours et heures où vous avez le plus de viewers, vous aidant à planifier vos streams au bon moment."
          />
        </div>
      </section>

      {/* Ad */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* History & Comparison */}
      <section className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Historique & Comparaisons</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <FeatureDetail 
              icon="📚" 
              title="Historique complet"
              features={[
                'Liste de tous vos streams passés',
                'Détails par session : durée, viewers, followers',
                'Filtrage par date et catégorie',
                'Recherche par titre de stream',
                'Export des données (CSV)',
              ]}
              desc="Accédez à l'historique détaillé de chaque stream. Revivez vos sessions passées, analysez ce qui a fonctionné et apprenez de chaque expérience pour améliorer les suivantes."
            />
            <FeatureDetail 
              icon="⚖️" 
              title="Comparaisons avancées"
              features={[
                'Comparer deux périodes (semaine vs semaine)',
                'Comparer deux streams spécifiques',
                'Évolution des métriques clés',
                'Tendances de croissance',
                'Graphiques de progression',
              ]}
              desc="Mesurez votre progression réelle. Comparez vos performances entre différentes périodes pour identifier les tendances : gagnez-vous des viewers ? Votre rétention s'améliore-t-elle ?"
            />
          </div>
        </div>
      </section>

      {/* Recap & Notifications */}
      <section className="py-12 px-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">Récaps & Notifications</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <FeatureDetail 
            icon="📧" 
            title="Récapitulatifs email"
            features={[
              'Email automatique après chaque stream',
              'Résumé des stats clés du stream',
              'Badges gagnés et achievements',
              'Comparaison avec la moyenne',
              'Highlights et moments forts',
            ]}
            desc="Recevez un rapport détaillé après chaque session de stream. Le récap inclut vos stats, une comparaison avec vos performances passées, les badges débloqués et une note globale de votre stream."
          />
          <FeatureDetail 
            icon="🔔" 
            title="Webhooks & Intégrations"
            features={[
              'Notifications Discord automatiques',
              'Alerte au passage en live',
              'Notification nouveaux followers',
              'Milestones (ex: 100 viewers atteints)',
              'Support webhooks custom',
            ]}
            desc="Connectez Statisfaction à Discord ou d'autres services. Recevez des notifications automatiques quand vous passez en live, quand vous atteignez des milestones ou quand de nouveaux followers arrivent."
          />
        </div>
      </section>

      {/* Ad */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Goals & Gamification */}
      <section className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Objectifs & Gamification</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <FeatureDetail 
              icon="🎯" 
              title="Système d'objectifs"
              features={[
                'Créer des objectifs personnalisés',
                'Suivre la progression en temps réel',
                'Types : followers, viewers, durée, streams',
                'Deadlines optionnelles',
                'Historique des objectifs complétés',
              ]}
              desc="Fixez-vous des objectifs concrets : atteindre 1000 followers, maintenir 50 viewers de moyenne, streamer 20 heures ce mois-ci. Suivez votre progression et restez motivé."
            />
            <FeatureDetail 
              icon="🏆" 
              title="Badges & Achievements"
              features={[
                'Badges automatiques (streaks, milestones)',
                'Achievements débloqués après chaque stream',
                'Collection de badges à compléter',
                'Badges rares et épiques',
                'Partage sur les réseaux sociaux',
              ]}
              desc="Débloquez des badges en progressant : « Première semaine de streak », « 100 viewers atteints », « Marathon 8h ». Gamifiez votre parcours de streamer et collectionnez les achievements !"
            />
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="py-12 px-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">Outils additionnels</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <ToolCard 
            icon="🗓️" 
            title="Calendrier de live"
            desc="Planifiez vos streams et synchronisez avec votre planning Twitch. Exportez vers Google Calendar, Apple Calendar ou tout autre service compatible ICS."
          />
          <ToolCard 
            icon="🎬" 
            title="Détection de clips"
            desc="Identifiez automatiquement les moments forts de vos streams grâce à l'analyse combinée du chat et des viewers. Ne manquez plus aucun moment à clipper."
          />
          <ToolCard 
            icon="🚀" 
            title="Raid planner"
            desc="Trouvez des streamers à raider à la fin de vos sessions. Suggestions basées sur la catégorie, la taille d'audience et les préférences."
          />
          <ToolCard 
            icon="🎁" 
            title="Giveaways"
            desc="Organisez des giveaways pendant vos streams. Gérez les inscriptions, tirez les gagnants équitablement et suivez les réclamations."
          />
          <ToolCard 
            icon="📱" 
            title="Interface responsive"
            desc="Utilisez Statisfaction sur mobile, tablette ou desktop. L'interface s'adapte à tous les écrans pour un accès où que vous soyez."
          />
          <ToolCard 
            icon="🌙" 
            title="Mode sombre natif"
            desc="Interface pensée pour le mode sombre, avec un design moderne et agréable pour les yeux. Parfait pour les longues sessions de stream."
          />
        </div>
      </section>

      {/* Coming soon */}
      <section className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--brand) 8%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Et ce n&apos;est que le début...</h2>
          <p className="text-muted mb-6">
            Statisfaction est en développement actif. De nouvelles fonctionnalités arrivent régulièrement : 
            analyses de chat avancées, prédictions d&apos;audience, intégrations supplémentaires et plus encore.
          </p>
          <p className="text-sm text-muted">
            Des idées de fonctionnalités ? <a href="https://twitter.com/lantredesilver" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>Partagez-les sur Twitter</a> !
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-8 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Prêt à améliorer vos streams ?</h2>
          <p className="text-muted">
            Toutes ces fonctionnalités sont gratuites. Connectez-vous avec Twitch pour commencer.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/" className="btn btn-brand">Commencer gratuitement</Link>
            <Link href="/guide" className="btn btn-muted">Lire le guide</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureDetail({ icon, title, features, desc }: { icon: string; title: string; features: string[]; desc: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{icon}</span>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2 mb-4">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span style={{ color: 'var(--brand)' }}>✓</span>
            <span className="text-muted">{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted border-t pt-4" style={{ borderColor: 'var(--border)' }}>{desc}</p>
    </div>
  );
}

function ToolCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="card p-5">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted">{desc}</p>
    </div>
  );
}
