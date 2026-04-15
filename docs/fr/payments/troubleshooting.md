# Guide de depannage des paiements

Problemes courants et solutions pour l'integration Stripe de WhyNot QA.

## Problemes de webhooks

### Les webhooks ne se declenchent pas

**Symptomes** : Le statut de l'abonnement ne se met pas a jour apres le paiement, les factures ne sont pas enregistrees.

**Solutions** :
1. Verifiez que `stripe listen` est en cours d'execution (developpement local) :
   ```bash
   stripe listen --forward-to localhost:3010/api/webhooks/stripe
   ```
2. Consultez le tableau de bord Stripe dans **Developers > Webhooks** pour les livraisons echouees.
3. Verifiez que `STRIPE_WEBHOOK_SECRET` correspond au secret de signature de `stripe listen` ou du tableau de bord.
4. Assurez-vous que le conteneur gateway est en cours d'execution : `docker ps | grep gateway`.

### Echec de la verification de signature (400)

**Symptomes** : Le webhook retourne `400 Signature verification failed`.

**Causes** :
- `STRIPE_WEBHOOK_SECRET` est incorrect ou provient d'un endpoint different.
- Le corps brut de la requete a ete analyse avant d'atteindre le handler du webhook (le corps doit arriver sous forme de buffer brut).
- Decalage d'horloge entre votre serveur et Stripe (la signature a une tolerance d'environ 5 minutes).

**Solutions** :
1. Regenerez le secret de signature du webhook dans le tableau de bord Stripe.
2. En developpement local, redemarrez `stripe listen` et copiez le nouveau secret.
3. Verifiez que votre reverse proxy ne modifie pas le corps de la requete.

### Livraisons de webhooks en double

**Symptomes** : Stripe retente les webhooks plusieurs fois.

**Explication** : Stripe retente l'envoi si aucune reponse `2xx` n'est recue dans les 20 secondes. La table d'idempotence (`payment_webhooks_idempotency`) empeche le traitement en double. Si vous voyez des tentatives repetees dans le tableau de bord Stripe, verifiez :
1. Les logs de la passerelle pour les erreurs lors du traitement du webhook.
2. La connectivite a la base de donnees (l'INSERT d'idempotence doit reussir).
3. Le temps de reponse (le handler doit repondre en moins de 20 secondes).

## Refus de carte

### Refus generique de carte

**Erreur** : `billing.cardDeclined`

La carte a ete refusee par la banque emettrice. Demandez au client de :
- Essayer une autre carte.
- Contacter sa banque pour autoriser le debit.
- Verifier s'il y a des blocages de prevention de fraude.

### Fonds insuffisants

**Erreur** : `billing.insufficientFunds`

La carte n'a pas un solde suffisant. Demandez au client d'utiliser une autre carte ou d'approvisionner son compte.

### Carte expiree

**Erreur** : `billing.expiredCard`

La date d'expiration de la carte est depassee. Demandez au client de mettre a jour son moyen de paiement.

### Authentification 3D Secure requise

**Erreur** : `billing.authenticationRequired`

La carte necessite une authentification supplementaire (3DS/SCA). Le client doit completer le flux d'authentification dans son navigateur. Cela est courant pour les cartes europeennes soumises aux reglementations PSD2/SCA.

## Problemes d'abonnement

### Abonnement introuvable apres le paiement

**Cause** : Le webhook `checkout.session.completed` n'a pas encore ete traite.

**Solutions** :
1. Verifiez si le webhook a ete recu (tableau de bord Stripe > Webhooks > Evenements recents).
2. Verifiez que la table d'idempotence contient l'identifiant de l'evenement.
3. Consultez les logs de la passerelle pour les erreurs lors de `handleCheckoutCompleted`.

### L'essai gratuit ne demarre pas

**Cause** : La methode `provisionNewWorkspace` n'a pas ete appelee ou la valeur `trial_days` dans la configuration de facturation est a 0.

**Solutions** :
1. Verifiez la valeur de `trial_days` dans la table `billing_config`.
2. Verifiez que la creation de l'espace de travail declenche le provisionnement de l'abonnement.

### Abonnement bloque en `past_due`

**Cause** : Le paiement d'une facture a echoue et n'a pas ete retente avec succes.

**Solutions** :
1. Le client met a jour son moyen de paiement via le portail de facturation.
2. L'administrateur retente manuellement la facture dans le tableau de bord Stripe.
3. Stripe retente automatiquement selon le calendrier de relance (configure dans le tableau de bord Stripe > Settings > Billing > Subscriptions > Retry schedule).

## Problemes PAYG

### Echec de facturation PAYG

**Cause** : Le moyen de paiement enregistre a ete refuse lors du debit automatique d'un solde PAYG negatif.

**Solutions** :
1. Le client ajoute un moyen de paiement valide.
2. L'administrateur recharge manuellement le solde de l'espace de travail via la page Credits.
3. Verifiez la table `payg_credits_ledger` pour l'entree en echec.

### Les credits ne sont pas deduits

**Cause** : Le middleware `credit-gate` n'est peut-etre pas applique a la route, ou `deductCredits` n'est pas appele apres l'operation.

**Solutions** :
1. Verifiez que la route utilise le middleware `requireCredits()`.
2. Verifiez que `deductCredits()` est appele dans le handler de la route apres le succes de l'operation.

## Problemes de remboursement

### Echec du remboursement

**Erreur** : `billing.refundFailed`

**Causes** :
- Le debit est trop ancien (Stripe autorise les remboursements dans les 180 jours).
- Le debit a deja ete integralement rembourse.
- Le solde du compte Stripe est insuffisant pour effectuer le remboursement.

**Solutions** :
1. Verifiez le debit dans le tableau de bord Stripe.
2. Pour les remboursements partiels, verifiez le montant restant remboursable.
3. Contactez le support Stripe si le remboursement est bloque.

## Problemes d'environnement

### Cles Stripe manquantes

**Symptomes** : `Error: Stripe secret key not configured`

**Solution** : Assurez-vous que toutes les variables d'environnement requises sont definies dans `.env` :
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Mauvais environnement (test vs production)

**Symptomes** : Les appels API echouent avec des erreurs d'authentification, ou les debits apparaissent sur de vraies cartes.

**Solution** : Verifiez que vous utilisez le bon prefixe de cle :
- Mode test : `sk_test_...`, `pk_test_...`
- Mode production : `sk_live_...`, `pk_live_...`

Ne melangez jamais les cles de test et de production.

## Problemes de base de donnees

### Table d'idempotence manquante

**Symptomes** : `500 Internal error` sur l'endpoint du webhook.

**Solution** : Executez les migrations de la base de donnees :
```bash
make shell-gateway npm run migrate
```

### Ligne d'abonnement non creee

**Cause** : L'insertion dans la table `workspace_subscriptions` a echoue.

**Solutions** :
1. Consultez les logs de la passerelle pour les erreurs SQL.
2. Verifiez que l'identifiant de l'espace de travail existe dans la table `workspaces`.
3. Verifiez s'il y a des violations de contrainte d'unicite (abonnement en double).

## Conseils de debogage

1. **Tableau de bord Stripe** : Consultez toujours **Developers > Events** pour le journal complet des evenements.
2. **Logs de la passerelle** : `docker logs whynot-gateway-1 --tail 100 -f`
3. **Evenements de la CLI Stripe** : `stripe events list --limit 10`
4. **Tester les webhooks manuellement** : `stripe trigger checkout.session.completed`
5. **Verifier l'idempotence** : Interrogez la table `payment_webhooks_idempotency` pour le statut de traitement des evenements.
6. **Journal d'audit** : Interrogez la table `payment_audit_log` pour l'historique des operations de paiement.
