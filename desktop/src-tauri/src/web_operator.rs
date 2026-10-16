//! Contrat de securite du futur Web Operator iAgent (phase C).
//!
//! Ce module ne pilote PAS encore le navigateur. Il fixe les decisions qu'un
//! pilote DOM / WebView devra respecter avant toute action. Les pages visitees
//! ne recoivent aucune commande Tauri et ne peuvent pas accorder leurs propres
//! permissions. Les regles et validations doivent provenir du code de confiance,
//! jamais du modele ou d'un document lu sur Internet.
//!
//! Voir docs/web-operator-phase-c.md pour l'integration prevue.

use serde::{Deserialize, Serialize};
use tauri::Url;

/// L'intention declaree de l'action ; aucun code JavaScript libre n'est admis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Geste {
    Observer,
    Cliquer,
    Renseigner,
    Televerser,
    Soumettre,
    Publier,
    Supprimer,
}

impl Geste {
    /// Une publication, un envoi ou une suppression a besoin d'un accord cible.
    /// Un clic ne doit pas masquer un envoi : le futur adaptateur doit classer
    /// les boutons submit/delete/publish dans ces categories, pas "Cliquer".
    fn engage(self) -> bool {
        matches!(self, Self::Soumettre | Self::Publier | Self::Supprimer)
    }
}

/// Permission mise en place par le client dans la configuration de confiance.
/// L'origine est exacte (schema + hote + port), pas un suffixe de domaine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegleSite {
    pub origine: String,
    pub gestes_permis: Vec<Geste>,
}

/// Demande proposee par l'agent, jamais un ordre directement executable.
/// L'empreinte est celle des donnees effectivement presentees au client.
/// Ni mot de passe, ni cookie, ni texte sensible ne doit figurer au journal.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Demande {
    pub operation_id: String,
    pub adresse: String,
    pub geste: Geste,
    pub empreinte_contenu: Option<String>,
}

/// Autorisation issue exclusivement du gestionnaire de validations de
/// confiance. Un agent ne peut pas fabriquer ou soumettre lui-meme cet objet.
/// L'accord porte sur UNE operation, UNE origine, UN geste et UN contenu.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccordHumain {
    pub operation_id: String,
    pub origine: String,
    pub geste: Geste,
    pub empreinte_contenu: String,
    pub expire_le: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Refus {
    AdresseInvalide,
    AdresseNonSecurisee,
    OrigineNonAutorisee,
    ActionNonAutorisee,
    OperationInvalide,
    ContenuNonVerifiable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    /// Le pilote peut tenter l'action. Il devra encore verifier son resultat.
    Autorisee,
    /// Remonter ce point d'attente a l'orchestrateur proactif EXISTANT.
    /// La tache n'est ni terminee, ni mise en attente active dans ce module.
    AttenteHumaine { operation_id: String },
    Refusee(Refus),
}

fn empreinte_recevable(empreinte: &str) -> bool {
    // SHA-256 hex encode, sans conserver le texte dans ce contrat.
    empreinte.len() == 64 && empreinte.bytes().all(|c| c.is_ascii_hexdigit())
}

/// Preflight d'une action web. Aucune action n'est produite par cette fonction.
/// Le `RegleSite` et l'`AccordHumain` proviennent du backend de confiance.
pub fn evaluer(
    regle: &RegleSite,
    demande: &Demande,
    accord: Option<&AccordHumain>,
    maintenant: u64,
) -> Decision {
    if demande.operation_id.trim().is_empty() {
        return Decision::Refusee(Refus::OperationInvalide);
    }
    let Ok(url) = Url::parse(demande.adresse.trim()) else {
        return Decision::Refusee(Refus::AdresseInvalide);
    };
    if url.scheme() != "https" || url.host_str().is_none()
        || !url.username().is_empty() || url.password().is_some()
    {
        return Decision::Refusee(Refus::AdresseNonSecurisee);
    }
    // Pas de sous-domaine implicite, pas de comparaison "ends_with".
    // https://linkedin.com.attacker.tld et https://linkedin.com:8443
    // doivent etre refuses lorsque l'origine permise est linkedin.com.
    let origine = url.origin().ascii_serialization();
    if origine != regle.origine {
        return Decision::Refusee(Refus::OrigineNonAutorisee);
    }
    if !regle.gestes_permis.contains(&demande.geste) {
        return Decision::Refusee(Refus::ActionNonAutorisee);
    }
    if !demande.geste.engage() {
        return Decision::Autorisee;
    }

    let Some(empreinte) = demande.empreinte_contenu.as_deref() else {
        return Decision::Refusee(Refus::ContenuNonVerifiable);
    };
    if !empreinte_recevable(empreinte) {
        return Decision::Refusee(Refus::ContenuNonVerifiable);
    }
    let valide = accord.is_some_and(|a| {
        a.operation_id == demande.operation_id
            && a.origine == origine
            && a.geste == demande.geste
            && a.empreinte_contenu.eq_ignore_ascii_case(empreinte)
            && maintenant <= a.expire_le
    });
    if valide {
        Decision::Autorisee
    } else {
        Decision::AttenteHumaine {
            operation_id: demande.operation_id.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn regle() -> RegleSite {
        RegleSite {
            origine: "https://www.exemple.fr".into(),
            gestes_permis: vec![
                Geste::Observer,
                Geste::Cliquer,
                Geste::Renseigner,
                Geste::Televerser,
                Geste::Soumettre,
                Geste::Publier,
            ],
        }
    }

    fn demande(geste: Geste) -> Demande {
        Demande {
            operation_id: "mission-42-etape-3".into(),
            adresse: "https://www.exemple.fr/compte/profil".into(),
            geste,
            empreinte_contenu: Some("a".repeat(64)),
        }
    }

    fn accord(geste: Geste) -> AccordHumain {
        AccordHumain {
            operation_id: "mission-42-etape-3".into(),
            origine: "https://www.exemple.fr".into(),
            geste,
            empreinte_contenu: "a".repeat(64),
            expire_le: 200,
        }
    }

    #[test]
    fn observer_sur_origine_permisse() {
        assert_eq!(evaluer(&regle(), &demande(Geste::Observer), None, 100), Decision::Autorisee);
    }

    #[test]
    fn site_voisin_ou_port_different_refuse() {
        for adresse in [
            "https://www.exemple.fr.attacker.test/form",
            "https://exemple.fr/form",
            "https://www.exemple.fr:8443/form",
            "https://autre.exemple.fr/form",
        ] {
            let mut d = demande(Geste::Observer);
            d.adresse = adresse.into();
            assert_eq!(evaluer(&regle(), &d, None, 100), Decision::Refusee(Refus::OrigineNonAutorisee));
        }
    }

    #[test]
    fn schemas_dangereux_et_identifiants_dans_url_refuses() {
        for adresse in [
            "file:///C:/secret.txt",
            "javascript:alert(1)",
            "http://www.exemple.fr/form",
            "https://login:secret@www.exemple.fr/form",
        ] {
            let mut d = demande(Geste::Observer);
            d.adresse = adresse.into();
            assert_ne!(evaluer(&regle(), &d, None, 100), Decision::Autorisee);
        }
    }

    #[test]
    fn action_absente_de_la_liste_blanche_refusee() {
        assert_eq!(
            evaluer(&regle(), &demande(Geste::Supprimer), None, 100),
            Decision::Refusee(Refus::ActionNonAutorisee)
        );
    }

    #[test]
    fn publication_sans_accord_est_remise_a_l_orchestrateur() {
        assert_eq!(
            evaluer(&regle(), &demande(Geste::Publier), None, 100),
            Decision::AttenteHumaine { operation_id: "mission-42-etape-3".into() }
        );
    }

    #[test]
    fn accord_identique_et_valide_autorise_une_publication() {
        assert_eq!(
            evaluer(&regle(), &demande(Geste::Publier), Some(&accord(Geste::Publier)), 150),
            Decision::Autorisee
        );
    }

    #[test]
    fn accord_expires_ou_pour_autre_geste_refuse() {
        assert!(matches!(
            evaluer(&regle(), &demande(Geste::Publier), Some(&accord(Geste::Publier)), 201),
            Decision::AttenteHumaine { .. }
        ));
        assert!(matches!(
            evaluer(&regle(), &demande(Geste::Publier), Some(&accord(Geste::Soumettre)), 100),
            Decision::AttenteHumaine { .. }
        ));
    }

    #[test]
    fn accord_pour_un_autre_contenu_ou_operation_refuse() {
        let mut d = demande(Geste::Publier);
        d.empreinte_contenu = Some("b".repeat(64));
        assert!(matches!(
            evaluer(&regle(), &d, Some(&accord(Geste::Publier)), 100),
            Decision::AttenteHumaine { .. }
        ));
        d.empreinte_contenu = Some("a".repeat(64));
        d.operation_id = "mission-voisine".into();
        assert!(matches!(
            evaluer(&regle(), &d, Some(&accord(Geste::Publier)), 100),
            Decision::AttenteHumaine { .. }
        ));
    }

    #[test]
    fn soumission_sans_empreinte_ne_se_fait_pas() {
        let mut d = demande(Geste::Soumettre);
        d.empreinte_contenu = None;
        assert_eq!(
            evaluer(&regle(), &d, Some(&accord(Geste::Soumettre)), 100),
            Decision::Refusee(Refus::ContenuNonVerifiable)
        );
    }

    #[test]
    fn action_sans_identifiant_ne_part_pas() {
        let mut d = demande(Geste::Observer);
        d.operation_id = " ".into();
        assert_eq!(
            evaluer(&regle(), &d, None, 100),
            Decision::Refusee(Refus::OperationInvalide)
        );
    }
}
