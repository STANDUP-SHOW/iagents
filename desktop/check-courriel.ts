/**
 * Les deux implémentations de l'empreinte de courriel doivent rendre la même
 * valeur : celle de l'interface (`desktop/src/agents/courriel.ts`) et celle de
 * l'application (`desktop/src-tauri/src/courriel.rs`). Si elles divergent,
 * l'envoi est refusé systématiquement — ou, pire, une divergence silencieuse
 * ferait passer pour relu un message qui ne l'a pas été.
 *
 * Les valeurs ci-dessous sortent de l'implémentation Rust. Les changer sans
 * changer les deux côtés casse ce banc, et c'est voulu.
 */
import { empreinte, type Brouillon } from './src/agents/courriel.ts';

const CAS: { brouillon: Brouillon; attendu: string; quoi: string }[] = [
  {
    quoi: 'un message ordinaire avec un accent',
    brouillon: {
      destinataires: ['client@exemple.fr'],
      objet: 'Votre devis',
      corps: 'Bonjour,\nCi-joint le devis demandé.',
    },
    attendu: 'c23d62cf7c9da58d',
  },
  {
    quoi: 'deux destinataires, un tiret cadratin et une apostrophe',
    brouillon: {
      destinataires: ['a@exemple.fr', 'b@exemple.fr'],
      objet: 'Réunion de jeudi',
      corps: "À 14 h, salle du fond. — l'équipe",
    },
    attendu: '8d8fd3018b5927e9',
  },
  {
    quoi: 'un brouillon entièrement vide',
    brouillon: { destinataires: [''], objet: '', corps: '' },
    attendu: 'f998341be47bae14',
  },
];

let fautes = 0;
for (const cas of CAS) {
  const obtenu = empreinte(cas.brouillon);
  if (obtenu === cas.attendu) {
    console.log(`  ok  ${cas.quoi}`);
  } else {
    console.log(`  ✗   ${cas.quoi} : attendu ${cas.attendu}, obtenu ${obtenu}`);
    fautes++;
  }
}

// Le message relu et le message réécrit ne doivent jamais partager une empreinte.
const relu: Brouillon = {
  destinataires: ['client@exemple.fr'],
  objet: 'Votre devis',
  corps: 'Le montant est de 1 200 euros.',
};
const reecrits: { quoi: string; brouillon: Brouillon }[] = [
  { quoi: 'le montant a changé', brouillon: { ...relu, corps: 'Le montant est de 2 100 euros.' } },
  { quoi: "l'objet a changé", brouillon: { ...relu, objet: 'Votre facture' } },
  { quoi: 'le destinataire a changé', brouillon: { ...relu, destinataires: ['autre@exemple.fr'] } },
  {
    quoi: 'une copie a été ajoutée',
    brouillon: { ...relu, destinataires: ['client@exemple.fr', 'copie@exemple.fr'] },
  },
];
for (const r of reecrits) {
  if (empreinte(relu) === empreinte(r.brouillon)) {
    console.log(`  ✗   ${r.quoi} sans changer l'empreinte`);
    fautes++;
  } else {
    console.log(`  ok  ${r.quoi} : l'envoi sera refusé`);
  }
}

if (fautes > 0) {
  console.error(`\n${fautes} divergence(s) : l'envoi de courriel n'est pas sûr en l'état.`);
  process.exit(1);
}
console.log("\nempreinte de courriel : l'interface et l'application disent la même chose");
