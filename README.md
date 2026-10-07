# 👁️‍🗨️ QR-Shroud

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependency](https://img.shields.io/badge/Dependencies-Zero%20Build-success.svg)](#)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacy-100%25%20Offline-brightgreen.svg)](#)
[![Cryptography](https://img.shields.io/badge/Crypto-Visual%20Secret%20Sharing-orange.svg)](#)

> **Système de stéganographie et cryptographie visuelle : dissimulez des images et messages secrets dans deux QR codes superposables.**

---

## 💡 Le Concept

**QR-Shroud** transforme n'importe quelle image ou message texte en 2 QR codes complémentaires :

* **Pris individuellement** : Chaque QR code possède des mires d'alignement officielles (Finder 7×7) et une texture de grain uniforme à 50% qui masque 100% du secret. Il est rigoureusement impossible de deviner le contenu secret en observant une seule part.
* **Superposés ensemble** : Dès que vous empilez les 2 QR codes (dans le simulateur interactif, ou dans la vraie vie sur du papier calque / transparents face à la lumière), le secret réapparaît immédiatement par contraste optique !
* **Pourquoi ce n'est pas un lien web ?** : Ce sont des clés cryptographiques optiques matérielles (chiffrement visuel de Naor-Shamir). Le secret est codé directement dans les pixels de la matière, sans passer par un serveur ou une redirection d'URL.

---

## ⚡ Parcours en 3 Étapes Simples

1. **Étape 1 : Choisissez votre secret**
   * Glissez une image (PNG, JPG, WebP, SVG, GIF, BMP, etc.), collez avec `Ctrl + V`, ou saisissez un texte libre (avec choix de police et centrage).
   * Ou testez en 1 clic un exemple prédéfini (Cadenas 🔒, TOP SECRET 📁, Smiley 😎, Cœur ❤️, Crâne ☠️).

2. **Étape 2 : Réglage du rendu**
   * Curseur de résolution / niveau de détails (de 25×25 à 65×65).
   * Curseur de densité (plus clair / plus foncé) et inversion Noir ↔ Blanc.
   * Tramage d'erreur Floyd-Steinberg appliqué automatiquement pour garantir un contraste optimal.

3. **Étape 3 : Résultat, Simulateur & Export**
   * **Simulateur interactif en direct** : glissez le QR à la souris ou au doigt pour tester l'alignement manuel, avec boutons *Alignement parfait* et *Animer la révélation ✨*.
   * **Choix du mode de rendu** :
     * *Révélation Nette (100% contraste)* : idéal sur écran pour lire sans aucun voile.
     * *Rendu Physique (Transparence)* : simule l'encre réelle sur papier calque.
   * **Téléchargement** : PNG HD individuels ou Pack ZIP complet.
   * **Impression immédiate** : sur feuilles séparées avec croix de repérage (+) pour calques, ou planche avec lignes de découpe.

---

## 🚀 Utilisation (Zéro installation)

1. Double-cliquez simplement sur `index.html`.
2. L'application tourne immédiatement dans n'importe quel navigateur moderne (Chrome, Edge, Firefox, Safari, Brave...).
3. 100% local et sécurisé : aucune donnée ne quitte votre ordinateur.

---

## 💡 Comment tester dans le monde réel (Physique)

1. **Option 1 (Idéale) : Papier Calque ou Feuilles Transparentes (Rhodoïd)**
   * Imprimez la Part #1 et la Part #2 sur du papier calque d'architecte ou du plastique transparent.
   * Superposez les deux feuilles en alignant les 3 carrés de coin : l'image apparaît par transparence face à la lumière !
2. **Option 2 : Papier ordinaire 80g + Rétro-éclairage**
   * Imprimez sur du papier standard, découpez les 2 carrés et tenez-les superposés devant la lampe torche d'un smartphone ou contre une vitre.
3. **Option 3 : Écran + Papier**
   * Affichez la Part #1 en grand sur l'écran d'un smartphone et posez la Part #2 imprimée par-dessus.

---

## 📄 Licence

Distribué sous la licence MIT. Voir [`LICENSE`](LICENSE) pour plus d'informations.
