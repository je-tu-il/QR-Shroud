# 👁️‍🗨️ QR-Shroud

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependency](https://img.shields.io/badge/Dependencies-Zero%20Build-success.svg)](#)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Offline-brightgreen.svg)](#)
[![Cryptography](https://img.shields.io/badge/Crypto-One--Time%20Pad%20%26%20Visual-orange.svg)](#)

> **Système de stéganographie & cryptographie par QR Codes : dissimulez des images ou des messages secrets dans plusieurs QR codes complémentaires (2 à 4 clés).**

---

## 💡 Deux Modes de Secret

### 1. 🗝️ Mode Coffre-fort Web (Recommandé pour du texte / mots de passe / énigmes)
* **Redirection mobile scannable (4 QR Codes)** : Le texte secret est découpé mathématiquement en 4 fragments chiffrés (Masque jetable de Shannon / XOR One-Time Pad).
* **100% Scannable sur iPhone & Android** : Chaque QR code redirige vers la page de déverrouillage [`reveal.html`](https://je-tu-il.github.io/QR-Shroud/reveal.html).
* **Déverrouillage par combinaison** : Dès que les 4 clés sont scannées avec un smartphone ou combinées dans le simulateur, le message secret s'affiche en clair, net et lisible !
* **Sécurité absolue** : Avec 1, 2 ou 3 clés, il est mathématiquement impossible de deviner le moindre mot du secret.

### 2. 👁️ Mode Pochoir Visuel (Pour images / silhouettes / calques transparents)
* **Superposition physique de calques** : Chaque QR code possède une texture de grain uniforme.
* **Révélation optique** : Dès que vous empilez les QR codes (dans le simulateur interactif ou sur du papier calque / transparent face à la lumière), l'image apparaît par contraste !

---

## ⚡ Parcours en 3 Étapes

1. **Étape 1 : Choisissez votre secret**
   * **Texte Secret (Coffre-fort)** : Saisissez n'importe quel mot de passe, message secret ou coordonnées GPS. Choisissez le nombre de QR codes (4 recommandés, ou 2, 3).
   * **Image (Pochoir visuel)** : Glissez une image (PNG, JPG, WebP, SVG, etc.) ou choisissez un symbole prédéfini (Cadenas 🔒, Smiley 😎, Cœur ❤️, etc.).

2. **Étape 2 : Vérification & Paramètres**
   * Récapitulatif du coffre-fort ou réglage de la résolution et du contraste du pochoir.

3. **Étape 3 : Résultat, Simulateur & Export**
   * **Simulateur interactif** : Testez la combinaison des 4 clés ou l'alignement des calques.
   * **Téléchargement** : PNG HD individuels ou Pack ZIP complet (inclut `reveal.html` et guide).
   * **Impression** : Planche prête à imprimer avec repères de découpe et croix de calage (+).

---

## 🚀 Utilisation (Zéro installation)

1. Double-cliquez simplement sur `index.html`.
2. L'application tourne immédiatement dans n'importe quel navigateur moderne (Chrome, Edge, Firefox, Safari, Brave...).
3. 100% local et sécurisé : aucune donnée ne quitte votre ordinateur.

---

## 📄 Licence

Distribué sous la licence MIT. Voir [`LICENSE`](LICENSE) pour plus d'informations.
