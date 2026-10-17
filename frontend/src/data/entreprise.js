// Who publishes the site, written once: the legal notice, the footers and the
// structured data the home page gives search engines all read it here.
// Given by max on 10/10/2026 (identity, then legal form, capital and e-mail). A field left null is one he has not given yet;
// the pages leave it out rather than print a guess.
export const ENTREPRISE = {
  nom: 'iAgent Tech',
  marque: 'iAgent',
  formeJuridique: 'SASU',
  capital: '10 000 €',
  // Registration under way (max, 10/10/2026): the notice says so until the number exists.
  siret: null,
  immatriculation: 'en cours',
  rcs: null,
  tva: null,
  dirigeant: { prenom: 'Maxime', nom: 'Martinel', fonction: 'CEO' },
  adresse: { rue: '2 rue Julien Imbert', codePostal: '34500', ville: 'Béziers', pays: 'France', codePays: 'FR' },
  telephone: '07 46 47 69 68',
  telephoneInternational: '+33746476968',
  email: 'contact@iagent.agency',
  site: 'https://iagent.agency/',
};

export const CONTACT = ENTREPRISE.email;

// The site is served by Vercel (vercel.json). Address read on
// https://vercel.com/legal/privacy-policy on 10/10/2026.
export const HEBERGEUR = {
  nom: 'Vercel Inc.',
  adresse: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
  site: 'https://vercel.com',
};

export const adresseEnUneLigne = (a = ENTREPRISE.adresse) => `${a.rue}, ${a.codePostal} ${a.ville}, ${a.pays}`;
export const dirigeantEnClair = (d = ENTREPRISE.dirigeant) => `${d.prenom} ${d.nom}`;

/** schema.org Organization for the home page, built from the same fields. */
export const organisationSchema = () => {
  const e = ENTREPRISE;
  const o = {
    '@type': 'Organization',
    '@id': 'https://iagent.agency/#organisation',
    name: e.marque,
    legalName: e.nom,
    url: e.site,
    logo: 'https://iagent.agency/accueil/logo-iagent.png',
    slogan: 'Human ambition. Agentic execution.',
    telephone: e.telephoneInternational,
    address: { '@type': 'PostalAddress', streetAddress: e.adresse.rue, postalCode: e.adresse.codePostal, addressLocality: e.adresse.ville, addressCountry: e.adresse.codePays },
    founder: { '@type': 'Person', name: dirigeantEnClair(), jobTitle: e.dirigeant.fonction },
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: e.telephoneInternational, areaServed: 'FR', availableLanguage: 'French' },
  };
  if (e.email) { o.email = e.email; o.contactPoint.email = e.email; }
  if (e.siret) o.identifier = { '@type': 'PropertyValue', propertyID: 'SIRET', value: e.siret };
  if (e.tva) o.vatID = e.tva;
  return o;
};
