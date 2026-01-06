import type { Metadata } from 'next';
import Link from 'next/link';
import { Adsense } from '../../components/Adsense';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';

export const metadata: Metadata = {
  title: 'Guide du Streamer — Conseils & Tutoriels | Statisfaction',
  description: 'Guide complet pour les streamers Twitch : conseils pour débuter, optimiser son audience, analyser ses stats et utiliser Statisfaction efficacement.',
  alternates: { canonical: `${SITE_URL}/guide` },
  openGraph: {
    title: 'Guide du Streamer · Statisfaction',
    description: 'Conseils et tutoriels pour les streamers Twitch. Apprenez à analyser vos stats et optimiser vos streams.',
    type: 'article',
  },
};

export default function GuidePage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-16 px-8 text-center" style={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--brand) 12%, var(--bg)) 0%, var(--bg) 100%)' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">📖 Guide du Streamer</h1>
          <p className="text-xl text-muted max-w-2xl mx-auto">
            Conseils, astuces et tutoriels pour optimiser vos streams Twitch et tirer le meilleur parti de Statisfaction.
          </p>
        </div>
      </section>

      {/* Table of contents */}
      <section className="py-8 px-8 max-w-4xl mx-auto">
        <nav className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Sommaire</h2>
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            <li><a href="#debuter" className="hover:underline" style={{ color: 'var(--brand)' }}>1. Débuter sur Twitch</a></li>
            <li><a href="#analytics" className="hover:underline" style={{ color: 'var(--brand)' }}>2. Comprendre ses analytics</a></li>
            <li><a href="#audience" className="hover:underline" style={{ color: 'var(--brand)' }}>3. Développer son audience</a></li>
            <li><a href="#engagement" className="hover:underline" style={{ color: 'var(--brand)' }}>4. Améliorer l&apos;engagement</a></li>
            <li><a href="#statisfaction" className="hover:underline" style={{ color: 'var(--brand)' }}>5. Utiliser Statisfaction</a></li>
            <li><a href="#conseils" className="hover:underline" style={{ color: 'var(--brand)' }}>6. Conseils avancés</a></li>
          </ul>
        </nav>
      </section>

      {/* Section 1: Débuter */}
      <section id="debuter" className="py-12 px-8 max-w-4xl mx-auto scroll-mt-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="text-3xl">🎮</span> 1. Débuter sur Twitch
        </h2>
        <article className="prose prose-invert max-w-none space-y-4 text-muted">
          <p>
            Se lancer sur Twitch peut sembler intimidant, mais avec les bonnes bases, vous pouvez rapidement 
            construire une communauté. Voici les étapes essentielles pour bien démarrer.
          </p>
          
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Configuration technique</h3>
          <p>
            Avant de penser au contenu, assurez-vous d&apos;avoir une configuration technique solide :
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li><strong>Logiciel de streaming</strong> : OBS Studio (gratuit) ou Streamlabs sont les plus populaires. Configurez vos scenes, sources audio/vidéo et vos raccourcis.</li>
            <li><strong>Connexion internet</strong> : Visez au minimum 10 Mbps en upload pour du 720p60fps. Utilisez si possible une connexion filaire plutôt que WiFi.</li>
            <li><strong>Audio</strong> : L&apos;audio est plus important que la vidéo. Un bon micro USB (Blue Yeti, Rode NT-USB) fait toute la différence.</li>
            <li><strong>Webcam</strong> : Optionnelle mais recommandée. Une Logitech C920 ou C922 offre un bon rapport qualité/prix.</li>
          </ul>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Choisir sa niche</h3>
          <p>
            Streamez ce qui vous passionne, mais soyez stratégique. Les catégories très populaires (Fortnite, LoL) 
            sont saturées. Envisagez des niches plus accessibles où vous pouvez vous démarquer :
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Jeux rétro ou indépendants avec une communauté active</li>
            <li>Catégories créatives : art, musique, programmation</li>
            <li>Just Chatting avec un angle unique (discussions thématiques, débats)</li>
            <li>Speedruns ou challenges de jeux</li>
          </ul>
        </article>
      </section>

      {/* Ad */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Section 2: Analytics */}
      <section id="analytics" className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto scroll-mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="text-3xl">📊</span> 2. Comprendre ses analytics
          </h2>
          <article className="prose prose-invert max-w-none space-y-4 text-muted">
            <p>
              Les analytics sont votre boussole en tant que streamer. Comprendre vos métriques vous permet de 
              prendre des décisions éclairées pour améliorer vos streams.
            </p>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Les métriques essentielles</h3>
            
            <div className="grid md:grid-cols-2 gap-4 not-prose">
              <MetricCard 
                title="Average Viewers (AVG)" 
                desc="Le nombre moyen de viewers sur la durée du stream. C'est LA métrique clé pour Twitch Partner et les sponsors."
                tip="Visez une croissance constante plutôt que des pics isolés."
              />
              <MetricCard 
                title="Peak Viewers" 
                desc="Le pic maximum de viewers atteint pendant le stream. Utile pour identifier vos moments forts."
                tip="Analysez ce qui s'est passé pendant vos pics : raid, moment viral ?"
              />
              <MetricCard 
                title="Followers" 
                desc="Les nouveaux abonnés gagnés pendant le stream. Indicateur de découvrabilité."
                tip="Le ratio followers/viewers moyen indique votre capacité de conversion."
              />
              <MetricCard 
                title="Chat Messages" 
                desc="L'activité de votre chat. Un indicateur d'engagement de votre communauté."
                tip="Plus de messages ≠ toujours mieux. La qualité des échanges compte."
              />
            </div>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Interpréter les tendances</h3>
            <p>
              Ne vous focalisez pas sur un seul stream. Les tendances sur plusieurs semaines sont plus significatives :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong>Tendance haussière</strong> : Votre stratégie fonctionne, continuez.</li>
              <li><strong>Plateau</strong> : Temps d&apos;expérimenter quelque chose de nouveau.</li>
              <li><strong>Tendance baissière</strong> : Identifiez ce qui a changé (horaires, contenu, régularité).</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Section 3: Audience */}
      <section id="audience" className="py-12 px-8 max-w-4xl mx-auto scroll-mt-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="text-3xl">👥</span> 3. Développer son audience
        </h2>
        <article className="prose prose-invert max-w-none space-y-4 text-muted">
          <p>
            La croissance sur Twitch demande du temps et de la constance. Voici les leviers principaux 
            pour développer votre audience.
          </p>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>La régularité avant tout</h3>
          <p>
            Un planning régulier est votre meilleur allié. Streamez aux mêmes jours et heures pour que 
            votre audience sache quand vous retrouver. Utilisez Statisfaction pour identifier vos 
            créneaux les plus performants via les heatmaps.
          </p>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Optimiser sa découvrabilité</h3>
          <ul className="list-disc ml-6 space-y-2">
            <li><strong>Titre accrocheur</strong> : Clair, avec des mots-clés pertinents et un appel à l&apos;action.</li>
            <li><strong>Tags pertinents</strong> : Utilisez tous les tags disponibles pour apparaître dans les recherches.</li>
            <li><strong>Vignette personnalisée</strong> : Une miniature attrayante augmente les clics.</li>
            <li><strong>Networking</strong> : Participez à d&apos;autres streams, faites des raids, collaborez.</li>
          </ul>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Le multi-plateforme</h3>
          <p>
            Twitch seul ne suffit plus. Créez du contenu sur d&apos;autres plateformes pour ramener de l&apos;audience :
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li><strong>TikTok/Shorts/Reels</strong> : Clips courts et viraux de vos meilleurs moments.</li>
            <li><strong>YouTube</strong> : VODs éditées, compilations, contenu evergreen.</li>
            <li><strong>Twitter/X</strong> : Annonces de lives, interaction avec la communauté.</li>
            <li><strong>Discord</strong> : Communauté engagée entre les streams.</li>
          </ul>
        </article>
      </section>

      {/* Ad */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Section 4: Engagement */}
      <section id="engagement" className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto scroll-mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="text-3xl">💬</span> 4. Améliorer l&apos;engagement
          </h2>
          <article className="prose prose-invert max-w-none space-y-4 text-muted">
            <p>
              L&apos;engagement est ce qui transforme des viewers passifs en communauté fidèle. Un chat actif 
              attire plus de viewers et améliore votre référencement Twitch.
            </p>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Interagir avec le chat</h3>
            <ul className="list-disc ml-6 space-y-2">
              <li>Saluez chaque nouveau viewer par son pseudo.</li>
              <li>Posez des questions ouvertes régulièrement.</li>
              <li>Répondez aux messages, même pendant le gameplay.</li>
              <li>Créez des inside jokes et références communautaires.</li>
              <li>Utilisez des sondages et prédictions Twitch.</li>
            </ul>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Gamification</h3>
            <p>
              Ajoutez des éléments ludiques pour encourager la participation :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong>Points de chaîne</strong> : Récompenses personnalisées.</li>
              <li><strong>Leaderboards</strong> : Classement des viewers les plus actifs.</li>
              <li><strong>Giveaways</strong> : Organisez des concours (Statisfaction inclut un gestionnaire de giveaways !).</li>
              <li><strong>Challenges</strong> : Défis chat vs streamer.</li>
            </ul>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Créer des moments mémorables</h3>
            <p>
              Les viewers reviennent pour les moments uniques. Créez des rituels et traditions :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Intro/outro signature</li>
              <li>Segments récurrents (rubrique du jour, défi hebdo)</li>
              <li>Réactions aux clips et raids</li>
              <li>Events spéciaux (anniversaire de chaîne, marathons)</li>
            </ul>
          </article>
        </div>
      </section>

      {/* Section 5: Statisfaction */}
      <section id="statisfaction" className="py-12 px-8 max-w-4xl mx-auto scroll-mt-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="text-3xl">📈</span> 5. Utiliser Statisfaction
        </h2>
        <article className="prose prose-invert max-w-none space-y-4 text-muted">
          <p>
            Voici comment tirer le meilleur parti de Statisfaction pour améliorer vos streams.
          </p>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Premier démarrage</h3>
          <ol className="list-decimal ml-6 space-y-2">
            <li>Connectez-vous avec votre compte Twitch (authentification sécurisée OAuth).</li>
            <li>Statisfaction synchronise automatiquement vos données.</li>
            <li>Explorez le dashboard pour voir vos stats en temps réel.</li>
            <li>Configurez les récaps email dans les paramètres.</li>
          </ol>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Pendant le stream</h3>
          <p>
            Gardez le dashboard ouvert sur un second écran ou appareil :
          </p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Suivez vos viewers en temps réel.</li>
            <li>Repérez les pics pour identifier les moments forts à clipper.</li>
            <li>Surveillez l&apos;activité chat pour ajuster votre rythme.</li>
          </ul>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Après le stream</h3>
          <ul className="list-disc ml-6 space-y-2">
            <li>Consultez le récap email pour un résumé rapide.</li>
            <li>Analysez l&apos;historique pour voir les tendances.</li>
            <li>Comparez avec vos streams précédents.</li>
            <li>Ajustez vos objectifs en fonction des résultats.</li>
          </ul>

          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Fonctionnalités avancées</h3>
          <ul className="list-disc ml-6 space-y-2">
            <li><strong>Objectifs</strong> : Créez des objectifs (ex: atteindre 50 AVG) et suivez votre progression.</li>
            <li><strong>Webhooks Discord</strong> : Recevez des alertes automatiques quand vous passez en live.</li>
            <li><strong>Heatmaps</strong> : Identifiez vos meilleurs créneaux horaires.</li>
            <li><strong>Giveaways</strong> : Gérez vos concours directement dans l&apos;app.</li>
          </ul>
        </article>
      </section>

      {/* Ad */}
      <section className="py-6 px-8 max-w-4xl mx-auto">
        <Adsense format="auto" />
      </section>

      {/* Section 6: Advanced */}
      <section id="conseils" className="py-12 px-8" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 50%, var(--bg))' }}>
        <div className="max-w-4xl mx-auto scroll-mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="text-3xl">🚀</span> 6. Conseils avancés
          </h2>
          <article className="prose prose-invert max-w-none space-y-4 text-muted">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Éviter le burnout</h3>
            <p>
              Le streaming peut être épuisant. Protégez-vous :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Fixez des limites claires (durée max, jours off).</li>
              <li>Ne sacrifiez pas votre sommeil pour les viewers.</li>
              <li>Déconnectez complètement certains jours.</li>
              <li>Rappelez-vous pourquoi vous avez commencé.</li>
            </ul>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Monétisation</h3>
            <p>
              Une fois Affilié ou Partner, diversifiez vos revenus :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong>Subs & Bits</strong> : Votre base sur Twitch.</li>
              <li><strong>Sponsors</strong> : Partenariats avec des marques (à partir de ~100 AVG).</li>
              <li><strong>Merch</strong> : Produits dérivés pour votre communauté.</li>
              <li><strong>YouTube</strong> : Revenus publicitaires sur les VODs.</li>
              <li><strong>Coaching</strong> : Partager votre expertise gaming.</li>
            </ul>

            <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Se former en continu</h3>
            <p>
              Le streaming évolue constamment. Restez à jour :
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Suivez des streamers qui réussissent dans votre niche.</li>
              <li>Testez régulièrement de nouvelles fonctionnalités Twitch.</li>
              <li>Analysez vos stats pour comprendre ce qui fonctionne.</li>
              <li>Acceptez les feedbacks de votre communauté.</li>
            </ul>
          </article>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-8 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold">Prêt à appliquer ces conseils ?</h2>
          <p className="text-muted">
            Commencez à analyser vos streams avec Statisfaction et mesurez votre progression.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/" className="btn btn-brand">Commencer gratuitement</Link>
            <Link href="/features" className="btn btn-muted">Voir les fonctionnalités</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ title, desc, tip }: { title: string; desc: string; tip: string }) {
  return (
    <div className="card p-4">
      <h4 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>{title}</h4>
      <p className="text-sm mb-2">{desc}</p>
      <p className="text-xs" style={{ color: 'var(--brand)' }}>💡 {tip}</p>
    </div>
  );
}
