// The e-mail studio's mailbox, as the screen sees it (OVH SMTP, admin/src/courriel.rs).
//
//   courriel = {
//     reglages(): Promise<{hote,port,securite,utilisateur,expediteur_nom,expediteur_adresse,mot_de_passe_present}>,
//     poserReglages(r), poserMotDePasse(m), oublierMotDePasse(),
//     envoyer(envoi): Promise<Trace>, journal(): Promise<Trace[]>
//   }
//
// Kept apart from the platform Client on purpose: only the back-office app
// registers these commands (admin crate, feature `courriel`), so only it adds
// `client.courriel`; the Desktop Commander mounts the same screens without it
// and the studio is simply not listed there.

/** Mailbox settings exist only in the desktop app; in a browser nothing is ever sent. */
export const REGLAGES_SMTP_OVH = { hote: 'ssl0.ovh.net', port: 465, securite: 'ssl', utilisateur: 'contact@iagent.agency', expediteur_nom: 'iAgent', expediteur_adresse: 'contact@iagent.agency', mot_de_passe_present: false };
export function courrielWeb() {
  let reglages = { ...REGLAGES_SMTP_OVH };
  const refus = "Dans le navigateur, rien ne part : l'envoi passe par l'application Windows, qui tient le mot de passe dans le coffre du système.";
  return {
    reglages: async () => ({ ...reglages }),
    poserReglages: async (r) => { reglages = { ...reglages, ...r, mot_de_passe_present: false }; return 'Réglages gardés pour cette page seulement.'; },
    poserMotDePasse: async () => { throw new Error(refus); },
    oublierMotDePasse: async () => 'Aucun mot de passe n’est rangé dans le navigateur.',
    envoyer: async () => { throw new Error(refus); },
    journal: async () => [],
  };
}


/** Desktop: every call goes through Rust; the password never comes back to JavaScript. */
export function creerCourrielTauri(invoke) {
  const appel = async (commande, args) => {
    try { return await invoke(commande, args); } catch (e) { throw new Error(typeof e === 'string' ? e : (e && e.message) || 'La commande a échoué sans message.'); }
  };
  return {
    reglages: () => appel('smtp_reglages'),
    poserReglages: (r) => appel('smtp_poser_reglages', { reglages: r }),
    poserMotDePasse: (m) => appel('smtp_poser_mot_de_passe', { motDePasse: String(m ?? '') }),
    oublierMotDePasse: () => appel('smtp_oublier_mot_de_passe'),
    envoyer: (envoi) => appel('courriel_envoyer', { envoi }),
    journal: () => appel('courriel_journal'),
  };
}
