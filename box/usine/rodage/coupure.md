# Test de coupure de courant (brief §48) — obligatoire avant expédition

**Statut : procédure, pas encore de script.** Elle demande quelqu'un pour tirer
la prise ; elle entrera dans le rapport d'usine comme un test `coupure` quand
l'atelier aura une prise commandée (relais USB) pour la jouer sans main.

## Déroulé

1. Box qualifiée, allumée, `iagent-commander` à l'écran, télémétrie reçue depuis
   moins de cinq minutes (`sante.vu_le` dans le back-office).
2. **Couper l'alimentation** (la prise, pas le bouton).
3. Attendre 30 secondes. **Rebrancher.**
4. Constater, sans toucher au clavier :
   - la Box redémarre seule (BIOS : *Restore on AC Power Loss = Power On* ;
     à régler sur chaque modèle, à noter dans le profil matériel quand c'est fait) ;
   - DATA s'ouvre seule (TPM) : aucune demande de clé sur la console ;
   - `systemctl is-system-running` rend `running` ;
   - les services réels du profil sont `active` (`50_services.py` le dit) ;
   - l'écran montre Desktop Commander ;
   - une nouvelle télémétrie arrive au Control Plane (`sante.vu_le` avance).
5. Trois coupures de suite. Une seule Box qui ne revient pas = FAIL.

## Ce que ça éprouve que rien d'autre n'éprouve

Le scellement TPM au vrai démarrage (pas en session), l'ordre des unités
(`iagent-device` avant `iagent-commander`), le journal persistant sur DATA, et
le réglage BIOS de reprise — quatre choses qu'un test en session ne voit pas.
