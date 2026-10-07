# 👁️‍🗨️ QR-Shroud

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependency](https://img.shields.io/badge/Dependencies-Zero%20Build-success.svg)](#)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Offline-brightgreen.svg)](#)
[![Cryptography](https://img.shields.io/badge/Crypto-Naor--Shamir%20%7C%20XOR-orange.svg)](#)

> **Système de stéganographie et cryptographie visuelle : dissimulez des images et messages secrets dans plusieurs QR codes superposables sans redirection.**

---

## 💡 Le Concept

**QR-Shroud** transforme n'importe quelle image ou message texte en plusieurs QR codes ($X$ parts).

* **Isolé** : Chaque QR code présente une texture de grain uniforme (50% de densité) et possède des mires d'alignement officielles. Il ressemble à un QR code standard scannable mais ne dévoile **strictement aucun indice** sur le secret (sécurité inconditionnelle de Shannon).
* **Superposé** : En alignant précisément les $X$ QR codes (sur écran avec le simulateur ou dans le monde réel sur papier calque / transparents de rétroprojecteur), le message ou l'image secrète réapparaît instantanément par contraste optique direct !
* **Aucun serveur, aucune URL** : Ces QR codes ne redirigent nulle part, ce sont des clés cryptographiques matérielles physiques.

---

## ⚡ Fonctionnalités

- **📥 Entrée universelle** :
  - Tous formats d'image : PNG, JPG, WebP, GIF, SVG, BMP, AVIF, TIFF, ICO...
  - Glisser-déposer (Drag & Drop) & Sélection de fichier.
  - Collage direct depuis le presse-papier (`Ctrl + V`).
  - Générateur de texte secret (polices lisibles, gras, Impact, centrage automatique).
  - Presets prêts à l'emploi (Cadenas, Crâne, Smiley, Cœur, Tampon TOP SECRET).

- **🎛️ Conversion Noir & Blanc & Pixellisation** :
  - Curseur de résolution / taille de grille QR (de 21×21 jusqu'à 89×89).
  - Algorithme de **tramage Floyd-Steinberg** (diffusion d'erreur, optimal pour les dégradés photo).
  - **Seuil direct net** (idéal pour logos et textes) et **tramage ordonné Bayer**.
  - Curseurs de seuil, contraste, luminosité et inversion des couleurs.
  - Statistiques de densité de pixels en temps réel.

- **🔒 Moteur Cryptographique & Camouflage** :
  - **Superposition Physique / Transparence (Naor-Shamir 2×2 subpixels)** : conçu pour l'impression physique. Les blancs laissent passer 50% de lumière, les noirs deviennent 100% opaques. Révélation directe à l'œil nu sans ordinateur.
  - **Superposition Numérique XOR (1 module = 1 pixel)** : 100% de netteté pour décodage sur écran.
  - Mires de détection QR officielles 7×7 (Finder Patterns) et lignes de synchronisation (Timing Patterns).
  - Grain de fond équilibré (50% de densité) pour éviter tout QR code vide.
  - Croix de calage et de repérage (+) aux 4 coins.

- **🕹️ Simulateur interactif de superposition** :
  - Glisser-déposer tactile / souris pour tester l'alignement manuel.
  - Aimantation d'alignement parfait (Snap 100%).
  - Bouton d'animation de révélation fluide ✨.
  - Curseurs d'opacité indépendants par couche.

- **📦 Export & Impression** :
  - **Pack ZIP complet** (avec `jszip.min.js` inclus en local) : PNGs individuels HD + image révélée + guide d'alignement.
  - Téléchargement individuel de chaque part en PNG HD.
  - Module d'impression dédié (`Ctrl + P`) :
    - *1 QR par page A4* (idéal calques / transparents).
    - *Planche de découpe A4* (avec pointillés de découpe aux ciseaux).
    - Tailles d'impression réglables (9 cm, 12 cm, 15 cm).

---

## 🚀 Utilisation immédiate (Zéro installation)

Aucun terminal, aucun serveur, aucune compilation (`npm`, `python`, etc.) n'est requis.

1. Téléchargez ou clonez le dépôt :
   ```bash
   git clone https://github.com/VOTRE_PSEUDO/QR-Shroud.git
   ```
2. Double-cliquez sur `index.html`.
3. L'application tourne immédiatement dans n'importe quel navigateur (Chrome, Firefox, Edge, Safari, Brave...).

---

## 🔬 Les Secrets de la Cryptographie Visuelle

Le projet s'appuie sur la théorie de la **Cryptographie Visuelle** initiée par **Moni Naor** et **Adi Shamir** (Eurocrypt 1994) :

Dans un schéma 2-parmi-2 :
1. Chaque pixel du secret est décomposé en 4 sous-pixels ($2 \times 2$).
2. Chaque part reçoit aléatoirement 2 sous-pixels noirs et 2 sous-pixels blancs parmi les $\binom{4}{2} = 6$ permutations possibles.
3. **Pixel blanc** : Les deux parts reçoivent la **même** permutation. Lors de la superposition (opération logique OU optique), la densité reste de 50% (gris translucide).
4. **Pixel noir** : Les deux parts reçoivent des permutations **complémentaires**. Lors de la superposition, tous les sous-pixels deviennent noirs (100% d'opacité).

L'œil humain perçoit immédiatement le contraste entre le fond gris à 50% et les motifs noirs à 100% !

---

## 📄 Licence

Distribué sous la licence MIT. Voir [`LICENSE`](LICENSE) pour plus d'informations.
