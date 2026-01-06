import type { Metadata } from 'next';
import Link from 'next/link';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité — Statisfaction',
  description: 'Politique de confidentialité de Statisfaction. Découvrez comment nous collectons, utilisons et protégeons vos données personnelles.',
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: 'Confidentialité · Statisfaction',
    description: 'Comment nous protégeons vos données personnelles sur Statisfaction.',
    type: 'article',
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-12 px-8 text-center" style={{ background: 'linear-gradient(180deg, color-mix(in oklab, var(--panel) 80%, var(--bg)) 0%, var(--bg) 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-4">Politique de Confidentialité</h1>
          <p className="text-muted">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 px-8 max-w-4xl mx-auto">
        <article className="prose prose-invert max-w-none space-y-8">
          
          {/* Introduction */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>1. Introduction</h2>
            <p className="text-muted">
              Statisfaction (« nous », « notre », « le service ») respecte votre vie privée et s&apos;engage à protéger 
              vos données personnelles. Cette politique de confidentialité explique comment nous collectons, utilisons, 
              stockons et protégeons vos informations lorsque vous utilisez notre plateforme d&apos;analytics Twitch.
            </p>
            <p className="text-muted">
              En utilisant Statisfaction, vous acceptez les pratiques décrites dans cette politique. Si vous n&apos;acceptez 
              pas ces conditions, veuillez ne pas utiliser le service.
            </p>
          </div>

          {/* Data collected */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>2. Données collectées</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }}>Données de compte Twitch</h3>
            <p className="text-muted">
              Lors de votre connexion via Twitch OAuth, nous accédons à :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Votre identifiant Twitch (ID unique)</li>
              <li>Votre nom d&apos;utilisateur et nom d&apos;affichage</li>
              <li>Votre adresse email (pour l&apos;envoi des récaps)</li>
              <li>Votre photo de profil</li>
              <li>Vos statistiques de chaîne publiques (followers, streams)</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }}>Données de streaming</h3>
            <p className="text-muted">
              Nous collectons des données sur vos streams via l&apos;API Twitch :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Historique de vos streams (date, durée, titre, catégorie)</li>
              <li>Statistiques d&apos;audience (viewers, pics, moyennes)</li>
              <li>Événements de followers</li>
              <li>Données de chat agrégées (nombre de messages)</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }}>Données techniques</h3>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Adresse IP (pour la sécurité et les logs)</li>
              <li>Type de navigateur et appareil</li>
              <li>Pages visitées et actions effectuées</li>
              <li>Cookies de session et de préférences</li>
            </ul>
          </div>

          {/* How we use data */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>3. Utilisation des données</h2>
            <p className="text-muted">Nous utilisons vos données pour :</p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Fournir le service d&apos;analytics et les fonctionnalités de Statisfaction</li>
              <li>Afficher votre dashboard personnalisé et historique de streams</li>
              <li>Envoyer les récapitulatifs par email (si activé)</li>
              <li>Calculer vos objectifs et attribuer des badges</li>
              <li>Améliorer et optimiser le service</li>
              <li>Assurer la sécurité et prévenir les abus</li>
            </ul>
            <p className="text-muted mt-4">
              <strong>Nous ne vendons jamais vos données à des tiers.</strong> Vos informations ne sont pas partagées 
              à des fins publicitaires ciblées au-delà de ce qui est décrit dans la section « Publicités ».
            </p>
          </div>

          {/* Advertising */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>4. Publicités (Google AdSense)</h2>
            <p className="text-muted">
              Statisfaction affiche des publicités via Google AdSense sur certaines pages publiques afin de financer 
              le service gratuit. Ces publicités peuvent utiliser des cookies pour la personnalisation.
            </p>
            
            <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }}>Consentement</h3>
            <p className="text-muted">
              Lors de votre première visite, une bannière vous propose d&apos;accepter l&apos;utilisation de cookies 
              publicitaires. <strong>Sans votre consentement explicite, aucune bibliothèque publicitaire n&apos;est chargée</strong> 
              et aucun cookie publicitaire n&apos;est déposé.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }}>Gestion des préférences</h3>
            <p className="text-muted">
              Vous pouvez à tout moment :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Refuser le consentement via la bannière de cookies</li>
              <li>Supprimer les cookies de votre navigateur</li>
              <li>Utiliser un bloqueur de publicités</li>
              <li>Configurer vos préférences publicitaires Google : 
                <a href="https://adssettings.google.com" target="_blank" rel="noopener" className="hover:underline ml-1" style={{ color: 'var(--brand)' }}>
                  adssettings.google.com
                </a>
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2" style={{ color: 'var(--text)' }}>Informations Google</h3>
            <p className="text-muted">
              Pour en savoir plus sur l&apos;utilisation des cookies par Google :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>
                <a href="https://policies.google.com/technologies/ads?hl=fr" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>
                  Publicités Google et cookies
                </a>
              </li>
              <li>
                <a href="https://policies.google.com/privacy?hl=fr" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>
                  Règles de confidentialité Google
                </a>
              </li>
            </ul>
          </div>

          {/* Data storage */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>5. Stockage et sécurité</h2>
            <p className="text-muted">
              Vos données sont stockées sur des serveurs sécurisés. Nous mettons en œuvre des mesures techniques 
              et organisationnelles pour protéger vos informations :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Connexions chiffrées (HTTPS)</li>
              <li>Authentification sécurisée via Twitch OAuth</li>
              <li>Accès restreint aux données</li>
              <li>Mises à jour de sécurité régulières</li>
            </ul>
            <p className="text-muted mt-4">
              Les données sont conservées tant que votre compte est actif. Après suppression de votre compte, 
              les données sont effacées dans un délai de 30 jours.
            </p>
          </div>

          {/* Your rights */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>6. Vos droits</h2>
            <p className="text-muted">
              Conformément au RGPD et aux lois applicables, vous disposez des droits suivants :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données personnelles</li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
              <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format standard</li>
              <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement de vos données</li>
              <li><strong>Droit de retrait du consentement</strong> : retirer votre consentement à tout moment</li>
            </ul>
            <p className="text-muted mt-4">
              Pour exercer ces droits, contactez-nous via les moyens indiqués ci-dessous.
            </p>
          </div>

          {/* Third parties */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>7. Services tiers</h2>
            <p className="text-muted">
              Statisfaction utilise les services tiers suivants :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li><strong>Twitch</strong> : Authentification et données de streaming</li>
              <li><strong>Google AdSense</strong> : Affichage de publicités (avec consentement)</li>
              <li><strong>Serveur SMTP</strong> : Envoi des emails de récap</li>
            </ul>
            <p className="text-muted mt-4">
              Ces services ont leurs propres politiques de confidentialité. Nous vous encourageons à les consulter.
            </p>
          </div>

          {/* Changes */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>8. Modifications</h2>
            <p className="text-muted">
              Cette politique peut être mise à jour occasionnellement. En cas de modifications substantielles, 
              nous vous en informerons via le site ou par email. La date de dernière mise à jour est indiquée 
              en haut de cette page.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>9. Contact</h2>
            <p className="text-muted">
              Pour toute question relative à cette politique de confidentialité ou à vos données personnelles, 
              vous pouvez nous contacter via :
            </p>
            <ul className="list-disc ml-6 text-muted space-y-1">
              <li>Twitter : <a href="https://twitter.com/lantredesilver" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>@lantredesilver</a></li>
              <li>Twitch : <a href="https://twitch.tv/lantredesilver" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>LANTREDESILVER</a></li>
              <li>GitHub : <a href="https://github.com/S0URC3K0D" target="_blank" rel="noopener" className="hover:underline" style={{ color: 'var(--brand)' }}>S0URC3K0D</a></li>
            </ul>
          </div>

        </article>
      </section>

      {/* Back link */}
      <section className="py-8 px-8 max-w-4xl mx-auto text-center">
        <Link href="/" className="btn btn-muted">← Retour à l&apos;accueil</Link>
      </section>
    </main>
  );
}
