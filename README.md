# 👁️‍🗨️ QR-Shroud

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependency](https://img.shields.io/badge/Dependencies-Zero%20Build-success.svg)](#)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Offline-brightgreen.svg)](#)
[![Cryptography](https://img.shields.io/badge/Crypto-One--Time%20Pad%20%26%20Visual-orange.svg)](#)

> **Système de stéganographie & cryptographie par QR Codes : dissimulez des images ou des messages secrets dans plusieurs QR codes complémentaires (2 à 4 clés).**

---

## 💡 Fonctionnalités & Innovations

* **🌐 Affichage Direct sur Page HTML (Évite la recherche Google iPhone/Android)** :
  Au lieu de scanner du texte brut que les smartphones interprètent souvent comme une recherche web dans Safari ou Chrome, le QR code ouvre directement une page HTML sécurisée (`reveal.html`) affichant votre texte en grand, net, avec bouton de copie !
  * *100% Privé & Client-Side* : Le secret est encodé dans le fragment `#msg=` de l'URL, qui n'est jamais transmis au serveur.
  * *Mode Texte Brut également disponible* pour les usages 100% hors-ligne.

* **📱 Clés Intermédiaires 100% Scannables par Smartphone** :
  Chaque QR code individuel est un **véritable QR code normalisé ISO** !
  * Votre appareil photo le détecte et le scanne immédiatement (il ne l'ignore pas).
  * Au scan seul, il renvoie un statut de clé partielle (*"Clé 1/4 - Incomplète : À superposer"*) ou du vide selon votre choix.

* **✨ Superposition Reconstituant le Vrai QR Code** :
  Dès que les parts sont alignées dans le simulateur interactif ou combinées, elles reforment le **VRAI QR code cible officiel**. Flashez simplement votre écran avec votre téléphone pour déverrouiller le message secret !

---

## ⚡ Parcours en 3 Étapes

1. **Étape 1 : Saisissez votre texte secret & Destination**
   * Tapez votre texte secret, mot de passe ou coordonnées.
   * Choisissez le format : **Page Web Confidentielle** (recommandé mobile) ou **Texte Brut**.
   * Visualisez en temps réel l'aperçu du vrai QR code cible.
   * Choisissez le nombre de clés requises (2, 3 ou 4 QR codes).

2. **Étape 2 : Mode de découpage & Comportement des clés**
   * **Clés 100% Scannables** : Chaque part est un vrai QR code autonome lisible par smartphone.
   * **Calques Physiques purs** : Répartition pour papier transparent et superposition par rétroéclairage.

3. **Étape 3 : Simulateur Interactif & Export**
   * **Simulateur en direct** : Faites glisser les calques avec la souris ou le doigt. Cliquez sur *"Alignement parfait"* et scannez votre écran avec votre smartphone !
   * **Téléchargement** : PNG HD individuels de chaque part, QR code cible et Pack ZIP complet.
   * **Impression** : Planche prête à imprimer avec croix de repérage (+) pour calage optique précis.

---

## 🚀 Utilisation (Zéro installation)

1. Double-cliquez simplement sur `index.html`.
2. L'application tourne immédiatement dans n'importe quel navigateur moderne (Chrome, Edge, Firefox, Safari, Brave...).
3. 100% local, autonome et sécurisé : aucune donnée ne quitte votre machine.

---

## 📄 Licence

Distribué sous la licence MIT. Voir [`LICENSE`](LICENSE) pour plus d'informations.
