# Retour atelier, changement de client, recyclage (brief §35, §36)

**Statut : procédure écrite, rien n'est automatisé.** La réinitialisation
d'usine (`FACTORY RESET`) ne doit pas être à portée du client (brief §36) ;
elle n'est pour l'instant à portée de personne : elle se fait en rebranchant la
clé du Factory Installer, qui réinstalle tout et efface le disque.

## Une Box revient

1. Le back-office passe la Box en `restituee` (ou `remplacee` si une autre part
   à sa place) : la plateforme révoque tous ses droits à l'instant
   (`revoquerToutDeLaBox`), et la Box ne reçoit plus ni jeton ni Skill Pack.
2. À l'atelier, **personne ne lit DATA**. On démarre sur la clé du Factory
   Installer : l'autoinstall efface le disque (`wipe: superblock-recursive`) et
   réinstalle. La clé scellée au TPM meurt avec le header LUKS ; l'enveloppe de
   la clé de secours est détruite.
3. La machine ressort avec une **nouvelle identité** (nouvelle paire Ed25519,
   nouveau `device_id`, nouvelle `reference`) : pour la plateforme c'est une
   autre Box. L'ancienne reste dans l'inventaire avec son historique.

## Une Box est remplacée chez le client (brief §35)

La nouvelle Box est qualifiée, attribuée au même client (`/attribuer`),
expédiée, activée à sa première télémétrie. **La restauration** (agents,
configuration, Skill Packs, profils de navigateur « si autorisé/possible ») n'est
pas écrite : il n'y a pas encore de sauvegarde (`iagent-backup` est un service
absent, SERVICES.json). C'est la Phase 1 ; le brief le demande (§34-§35).

## Ce qui est destructeur, et qui en répond

Une réinstallation détruit les secrets et les données du client. Elle ne se
fait qu'avec une Box en `restituee` ou `remplacee` au back-office — un
contrôle à écrire : `iagent-device` devrait refuser l'enrôlement d'une machine
dont la série est déjà celle d'une Box `active`, et la plateforme le fait déjà
pour une série déjà enregistrée (409).
