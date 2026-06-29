# AOI

Outil AOI construit en React, TypeScript et Vite.

## Design system

Le projet est préparé pour hériter d'ASDS/SDS tout en surchargeant les tokens pour la marque OUI.

- `src/design-system/tokens.css` contient la couche `asds-tokens`, puis la couche `aoi-overrides`.
- Les composants applicatifs consomment uniquement les tokens sémantiques `--color-*`, `--radius-*`, `--font-*`.
- Les valeurs `--aoi-*` viennent du frame Figma `AOI-UI-Kit / Colors` (`2:100`).
- `src/design-system/components.css` contient les premiers primitives locaux: boutons, boutons icône, statuts.

La documentation ASDS référencée est protégée par mot de passe sur Vercel au moment du scaffold. Dès que le package ASDS ou les extraits officiels sont disponibles, la couche `asds-tokens` pourra être remplacée par les imports officiels sans toucher aux tokens AOI.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Mapbox

La vue SAFIR branche Mapbox si `VITE_MAPBOX_TOKEN` est defini. Sans token, l'ecran utilise un fallback local issu du frame Figma pour conserver le rendu attendu pendant le developpement.
