# Guide de configuration Stripe

Guide complet pour configurer les paiements Stripe dans WhyNot QA.

## Prerequis

- Un compte Stripe ([stripe.com](https://stripe.com))
- Stripe CLI installe ([stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli))
- La plateforme WhyNot en cours d'execution via Docker (`make start`)

## 1. Configuration du tableau de bord Stripe

### Activer le mode test

1. Connectez-vous au tableau de bord Stripe.
2. Activez le **mode test** dans le coin superieur droit.
3. Toutes les etapes suivantes utilisent les donnees du mode test.

### Creer les produits

Creez les produits suivants dans **Produits > + Ajouter un produit** :

| Nom du produit | Modele de tarification |
|---|---|
| WhyNot Starter | Recurrent (mensuel + annuel) |
| WhyNot Pro | Recurrent (mensuel + annuel) |
| WhyNot Business | Recurrent (mensuel + annuel) |
| WhyNot Enterprise | Recurrent (mensuel + annuel) |
| PAYG | Usage facture a la consommation |

Pour chaque produit recurrent, creez deux prix (mensuel et annuel). Pour PAYG, creez un seul prix a la consommation.

### Copier les IDs de prix

Apres avoir cree les produits, copiez chaque identifiant `price_...` dans votre fichier `.env` :

```bash
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
STRIPE_PRICE_PAYG_METERED=price_...
```

## 2. Cles API

1. Allez dans **Developers > API keys**.
2. Copiez la **cle secrete** (`sk_test_...`) dans `STRIPE_SECRET_KEY`.
3. Copiez la **cle publiable** (`pk_test_...`) dans `STRIPE_PUBLISHABLE_KEY`.

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 3. Configuration des webhooks

### Production / Staging

1. Allez dans **Developers > Webhooks > + Add endpoint**.
2. Definissez l'URL sur : `https://superadmin.whynot.skrum.io/api/webhooks/stripe`
3. Selectionnez les evenements a ecouter :
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
4. Copiez le **secret de signature** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.

### Developpement local

Utilisez la CLI Stripe pour rediriger les webhooks vers votre passerelle locale :

```bash
stripe listen --forward-to localhost:3010/api/webhooks/stripe
```

La CLI affiche un secret de signature au demarrage. Copiez-le :

```bash
STRIPE_WEBHOOK_SECRET=whsec_...  # from stripe listen output
```

Gardez `stripe listen` en cours d'execution dans un terminal separe pendant le developpement.

## 4. Resume des variables d'environnement

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_...
STRIPE_PRICE_ENTERPRISE_YEARLY=price_...
STRIPE_PRICE_PAYG_METERED=price_...

STRIPE_SUCCESS_URL=http://localhost:5183/billing?success=true
STRIPE_CANCEL_URL=http://localhost:5183/billing?canceled=true
```

## 5. Numeros de cartes de test

| Numero de carte | Scenario |
|---|---|
| `4242 4242 4242 4242` | Paiement reussi |
| `4000 0000 0000 3220` | Authentification 3D Secure requise |
| `4000 0000 0000 0341` | S'attache avec succes, echoue lors du debit |
| `4000 0000 0000 9995` | Refus pour fonds insuffisants |
| `4000 0000 0000 0069` | Refus pour carte expiree |
| `4000 0000 0000 0127` | Refus pour CVC incorrect |
| `4000 0000 0000 0002` | Refus generique |

Utilisez n'importe quelle date d'expiration future (par ex. `12/34`), n'importe quel CVC a 3 chiffres et n'importe quel code postal.

## 6. Test du flux complet

1. **Demarrer la plateforme** : `make start`
2. **Demarrer le listener Stripe** : `stripe listen --forward-to localhost:3010/api/webhooks/stripe`
3. **S'inscrire** en tant que nouvel utilisateur sur `http://localhost:5183`
4. **Demarrer l'essai** : Le systeme provisionne automatiquement un abonnement d'essai.
5. **Mettre a niveau** : Cliquez sur "Upgrade" et utilisez la carte de test `4242 4242 4242 4242`.
6. **Verifier** : Consultez la ligne d'abonnement dans la base de donnees et le tableau de bord Stripe.
7. **Annuler** : Annulez depuis la page de facturation. Verifiez `cancel_at_period_end`.
8. **Reactiver** : Reactivez avant la fin de la periode.
9. **Tester un echec** : Utilisez la carte `4000 0000 0000 0341` pour declencher `invoice.payment_failed`.
10. **Rembourser** : Emettez un remboursement depuis l'interface d'administration.

## 7. Mise en production

1. Completez la checklist d'activation de Stripe dans le tableau de bord.
2. Desactivez le mode test.
3. Creez les produits et prix de production (meme structure qu'en test).
4. Mettez a jour le fichier `.env` avec les cles de production (`sk_live_...`, `pk_live_...`).
5. Creez un endpoint webhook de production avec les memes evenements.
6. Mettez a jour `STRIPE_WEBHOOK_SECRET` avec le secret de signature de production.
7. Mettez a jour `STRIPE_SUCCESS_URL` et `STRIPE_CANCEL_URL` avec les URLs de production.

**Ne commitez jamais les cles Stripe de production dans le controle de version.**

## 8. Pages d'administration de la facturation

Le panneau d'administration accessible sur `http://localhost:5184` offre :

- **Plans** : Creer, modifier, archiver et synchroniser les plans avec Stripe.
- **Abonnements** : Voir tous les abonnements des espaces de travail avec filtres par statut.
- **Credits** : Accorder des credits manuellement et exporter les donnees de credits.
- **Configuration de facturation** : Configurer les jours d'essai, la periode de grace et les tarifs PAYG.

La modification d'un plan dans l'interface d'administration cree ou met a jour automatiquement le produit et le prix Stripe correspondants via l'API.
