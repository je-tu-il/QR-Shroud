# 👁️‍🗨️ QR-Shroud

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Demo: GitHub Pages](https://img.shields.io/badge/Demo-Live%20on%20GitHub%20Pages-brightgreen?logo=github)](https://je-tu-il.github.io/QR-Shroud/)
[![Zero Dependency](https://img.shields.io/badge/Dependencies-Zero%20Build-success.svg)](#)
[![Privacy: 100% Client-Side](https://img.shields.io/badge/Privacy-100%25%20Client--Side-blueviolet.svg)](#)
[![Crypto: One-Time Pad](https://img.shields.io/badge/Crypto-XOR%20%2F%20Visual%20Sharing-orange.svg)](#)

> **Système moderne de cryptographie et de stéganographie par QR Codes : divisez un message secret en 2, 3, 4 ou un nombre personnalisé de QR codes complémentaires (jusqu'à 20 clés).**
>
> 🚀 **Tester directement en ligne : [https://je-tu-il.github.io/QR-Shroud/](https://je-tu-il.github.io/QR-Shroud/)**

---

## 🌟 Deux Méthodes de Découpage au Choix

| Caractéristique | 📱 Mode Clés Scannables (Recommandé Mobile) | ⬛ Mode Calques Physiques (Papier / Écran) |
|---|---|---|
| **Principe** | Découpage cryptographique XOR en clés autonomes | Cryptographie visuelle par superposition optique |
| **Lecture** | Chaque QR code est scannable individuellement par smartphone | Superposition physique sur transparents face à la lumière |
| **Déchiffrement** | Coffre-fort web local (`reveal.html`) via caméra native | Reconstitution visuelle instantanée du QR cible |
| **Simulateur** | Non requis (lecture directe caméra) | Simulateur interactif multi-calques dynamique |
| **Cas d'usage** | Chasse au trésor, escape games, authentification 2FA physique | Rétroéclairage, transparents, présentations ludiques |

---

## 💡 Fonctionnalités Principales

### 📱 1. Mode Clés Scannables (Vrais QR Codes ISO)
* Chaque QR code généré est un **véritable QR code normalisé** immédiatement reconnu par l'appareil photo (iPhone iOS & Android).
* Aucun QR code individuel ne révèle le secret à lui seul : chaque part contient un fragment chiffré (clé XOR).
* En scannant les parts successives, le coffre-fort numérique embarqué (`reveal.html`) enregistre la progression (`1/4`, `2/4`...) et déverrouille le texte secret une fois toutes les clés réunies.

### ⬛ 2. Mode Calques Physiques (Transparents & Rétroéclairage)
* Les modules noirs du QR code cible sont mathématiquement distribués sur plusieurs calques.
* En superposant les feuilles imprimées sur papier calque face à une source de lumière (lampe torche, fenêtre), le **vrai QR code cible apparaît au pixel près** et peut être scanné directement.
* Fourni avec un **simulateur interactif** permettant de faire glisser les calques à la souris ou au doigt pour tester la révélation avant impression.

### 🔒 3. Confidentialité 100% Client-Side & Zéro Fuite
* **Aucun serveur de stockage** : le traitement cryptographique s'effectue intégralement dans votre navigateur (Web Crypto API).
* Dans le mode web, le secret transite uniquement dans l'ancre d'URL (`#msg=...` ou `#v=...`) : selon la norme RFC 3986, **les fragments ne sont jamais transmis aux serveurs HTTP**.

### 🖨️ 4. Export & Impression Haute Définition
* **Export individuel** : Téléchargement direct de chaque QR code au format PNG HD pixel-perfect.
* **Pack ZIP complet** : Téléchargement en 1 clic de l'ensemble des clés + QR cible révélé + guide d'utilisation (`GUIDE_UTILISATION.txt`).
* **Boîte de dialogue d'impression** :
  * Mode *1 QR Code par page A4* (pour papier calque avec croix de repérage `+` aux 4 coins).
  * Mode *Planche de découpe* (toutes les parts sur 1 feuille avec pointillés).

---

## ⚡ Parcours Utilisateur en 3 Étapes

```
 [1. Saisie du Secret] ──► [2. Choix du Mode] ──► [3. Téléchargement & Test]
  • Texte / Mot de passe   • 📱 Clés Scannables     • PNG HD individuels
  • 2 à 20 QR codes        • ⬛ Calques Physiques   • Pack ZIP & Impression
```

1. **Étape 1 : Secret & Aperçu Cible**
   * Saisissez votre message, coordonnées GPS ou mot de passe.
   * Choisissez le nombre de parts désiré (2, 3, 4 ou personnalisé de 2 à 20).
   * Visualisez en temps réel l'aperçu du QR code cible.

2. **Étape 2 : Type de Chiffrage**
   * Sélectionnez **📱 Clés scannables** (smartphone) ou **⬛ Calques physiques** (papier transparent).

3. **Étape 3 : Export & Vérification**
   * Récupérez vos QR codes HD découpés.
   * Testez la superposition (pour les calques) ou lancez l'impression.

---

## 📁 Architecture du Projet

```
QR-Shroud/
├── index.html       # Application web principale (générateur & export)
├── app.js           # Moteur cryptographique, rendu canvas & simulateur
├── reveal.html      # Coffre-fort numérique mobile avec scanner caméra intégré
├── style.css        # Feuille de style moderne (Dark theme, responsive)
├── server.js        # Serveur Node.js local optionnel pour test Wi-Fi direct
├── qrcode.min.js    # Librairie ISO de génération QR Code (locale)
├── jszip.min.js     # Librairie d'export ZIP client-side (locale)
├── LICENSE          # Licence MIT
└── README.md        # Documentation du dépôt
```

---

## 🚀 Utilisation Locale (Sans Connexion)

Le projet ne nécessite **aucun bundler, aucune compilation ni aucun `npm install`**.

### Méthode 1 : Ouverture directe
Double-cliquez simplement sur `index.html` dans votre explorateur de fichiers.

### Méthode 2 : Test Wi-Fi local multi-appareils
Si vous souhaitez tester la communication entre votre PC et votre iPhone/Android sur votre réseau local :
```bash
node server.js
```
Puis ouvrez l'adresse indiquée (ex: `http://192.168.x.x:8080/`) sur le navigateur de votre smartphone.

---

## 🔐 Détails Cryptographiques

Le partage de secret s'appuie sur le principe du **One-Time Pad (XOR)** :
Pour un message secret $S$ encodé en octets et $N$ clés :
1. $N - 1$ clés aléatoires $K_1, K_2, \dots, K_{N-1}$ sont générées via `window.crypto.getRandomValues()`.
2. La dernière clé est calculée par :
   $$K_N = S \oplus K_1 \oplus K_2 \oplus \dots \oplus K_{N-1}$$
3. La connaissance de $N - 1$ clés ne donne **strictement aucune information** sur le message original (sécurité théorique de l'information parfaite).
4. La combinaison des $N$ clés restitue exactement le secret :
   $$S = K_1 \oplus K_2 \oplus \dots \oplus K_N$$

---

## 📄 Licence

Distribué sous la licence **MIT**. Voir le fichier [`LICENSE`](LICENSE) pour plus de détails.
