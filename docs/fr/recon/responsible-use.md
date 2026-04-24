---
title: "Recon — Autorisation et utilisation responsable"
description: "Autorisation par scan, journal d'audit et obligations légales lors de l'exécution de Recon."
lang: fr
draft: false
---

# Autorisation et utilisation responsable

Recon exécute des sondes actives contre des cibles web. Le sondage non autorisé est illégal dans presque toutes les juridictions, et Recon est conçu autour d'une **barrière d'autorisation par scan** afin que vous — la personne qui lance le scan — assumiez explicitement la responsabilité à chaque fois.

Cette page explique cette barrière, ce que capture le journal d'audit et à quoi ressemblent les lois sous-jacentes.

---

## La barrière d'autorisation par scan

Chaque scan exige un bloc d'autorisation signé avant d'être mis en file d'attente. La passerelle rejette toute demande de scan qui n'en contient pas.

Le lancement d'un scan enregistre :

- L'utilisateur qui l'a lancé.
- L'espace de travail dans lequel le scan a été exécuté.
- L'URL cible exacte (identique octet par octet à ce qui a été soumis).
- Le niveau de portée.
- Trois confirmations explicites du lanceur :
  1. « Je suis autorisé à scanner cette cible. »
  2. « Je comprends que ce scan enverra des sondes actives. »
  3. L'entité juridique que représente le lanceur.
- Une référence facultative à une autorisation écrite (ID de ticket, fil d'e-mails, contrat).
- L'adresse IP du lanceur et l'horodatage.

Cette ligne est **immuable**. Elle ne peut être ni modifiée ni supprimée, et elle est conservée pendant toute la durée de vie de l'espace de travail.

Vous pouvez consulter chaque autorisation jamais enregistrée dans **Paramètres → Recon → Journal d'audit**.

## Pourquoi par scan, pas par espace de travail

L'autorisation « par espace de travail » — cocher une case une fois à la configuration — est courante mais dangereusement faible. Elle signifie qu'un nouveau membre de l'équipe, ou un opérateur des mois plus tard, pourrait lancer un scan contre la mauvaise cible sans nouvelle attestation.

L'autorisation par scan force une action délibérée à chaque fois. La friction est la fonctionnalité.

## La reprise exige une URL identique

Si un scan est mis en pause puis repris — manuellement ou automatiquement après une panne transitoire — Recon compare l'URL cible de la reprise à l'URL initialement autorisée **octet par octet**. Toute différence (hôte différent, chemin différent, schéma différent, même un slash final) entraîne le rejet de la reprise.

Cela empêche deux schémas d'attaque réels :

- **Dérive par redirection.** Le DNS ou la redirection HTTP de la cible change entre la pause et la reprise, dirigeant silencieusement les sondes vers un hôte différent.
- **Dérive par faute de frappe.** Un opérateur édite l'URL pendant le dépannage et élargit accidentellement la portée.

Si une reprise est rejetée pour cause de non-correspondance d'URL, lancez un nouveau scan avec un nouveau bloc d'autorisation.

## Les exploits de classe écriture ne sont jamais réessayés

Recon classe chaque exploit candidat en `read` (non destructif — lit des données, prouve l'existence) ou `write` (destructif — modifie l'état, crée, supprime ou modifie). Un exploit **read** ayant échoué peut être réessayé sous limites de débit et de tentatives. Un exploit **write** ayant échoué est enregistré une fois et n'est plus jamais réessayé pendant le scan, même si l'exécuteur plante et reprend.

C'est une propriété de sûreté délibérée : une charge utile destructive à moitié réussie peut laisser la cible dans un état partiel ou corrompu. Une nouvelle tentative pourrait aggraver les dommages. Si le résultat doit être revérifié, lancez un nouveau scan.

## Ce que Recon ne fait pas

- Recon **n'effectue pas** de tests de déni de service. Les tests de charge, attaques volumétriques et sondes d'épuisement de ressources sont hors périmètre et ne peuvent pas être activés.
- Recon **ne scanne pas** de cibles que vous n'avez pas explicitement autorisées. Il n'y a pas de bouton « scanner toute mon organisation ».
- Recon **ne stocke pas** de charges utiles d'exploit brutes dans les journaux au niveau INFO ou supérieur. Les chaînes en forme de charge utile sont expurgées avant journalisation. Voir la documentation interne pour la liste complète.

## Vos obligations légales — résumé en langage clair

> **Ceci est un résumé en langage clair, pas un avis juridique.** En cas de doute, consultez un avocat spécialisé dans votre juridiction.

### États-Unis — Computer Fraud and Abuse Act (CFAA)

Le CFAA (18 U.S.C. § 1030) érige en infraction fédérale l'accès à un ordinateur « sans autorisation » ou le « dépassement d'accès autorisé ». Dans le contexte de Recon, cela signifie que vous devez avoir une permission explicite — d'une personne légalement habilitée à la donner — pour scanner la cible. Le périmètre d'un programme de bug bounty, une lettre de mission de pentest ou un contrat signé suffisent généralement. Scanner une cible parce qu'elle est « intéressante » ne suffit pas.

### Union européenne — NIS2 et équivalents nationaux

La plupart des États membres de l'UE ont des dispositions pénales reflétant le CFAA (p. ex. § 202c du StGB allemand, loi Godfrain en France, art. 197 du Código Penal espagnol). La directive NIS2 (UE 2022/2555) ajoute des obligations supplémentaires aux entités essentielles et importantes. La version courte est la même que le CFAA : pas d'autorisation, pas de scan.

### Royaume-Uni — Computer Misuse Act 1990

Les sections 1 à 3 criminalisent l'accès non autorisé, l'accès non autorisé avec intention et la modification non autorisée. Les peines incluent l'emprisonnement. La loi s'applique aux scans lancés depuis le Royaume-Uni et aux scans visant des systèmes britanniques.

### Autres juridictions

La plupart des juridictions ont des lois équivalentes. Si vous scannez une cible qui s'étend sur plusieurs juridictions (p. ex. un centre de données européen d'une société américaine), supposez que la loi la plus stricte applicable régit votre conduite.

## Programmes de bug bounty

Si vous exécutez Recon contre une cible de bug bounty :

- Vérifiez que votre activité reste dans le périmètre publié du programme.
- Vérifiez que le sondage actif est autorisé (certains programmes restreignent au test passif).
- Collez l'URL d'autorisation du programme dans le champ référence d'autorisation écrite au lancement du scan.
- Sauvegardez l'entrée du journal d'audit d'autorisation — vous pourriez devoir la présenter si un résultat est contesté.

## Drapeaux rouges — ne scannez pas

**Ne lancez pas** de scan si l'un des points suivants s'applique :

- Vous n'êtes pas certain de qui possède la cible.
- Votre autorisation est orale et non documentée.
- Vous scannez « pour voir ce qu'il se passe ».
- La cible est en production et le propriétaire n'a pas explicitement consenti au sondage actif.
- Vous ne comprenez pas les options de portée et leur impact.

---

Pages liées :

- [Démarrage rapide](quickstart.md) — comment lancer un scan.
- [Comprendre les résultats](understanding-findings.md) — comment lire la gravité et les issues d'exploitation.
- [Dépannage](troubleshooting.md) — erreurs d'autorisation et leur signification.
