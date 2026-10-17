import { ScrollProgress } from './composants.jsx';
import GlobalNav from './scenes/GlobalNav.jsx';
import HeroAccomplish from './scenes/HeroAccomplish.jsx';
import IntentToTeam from './scenes/IntentToTeam.jsx';
import NoJargon from './scenes/NoJargon.jsx';
import ConversationalRecruitment from './scenes/ConversationalRecruitment.jsx';
import ProfessionIntelligence from './scenes/ProfessionIntelligence.jsx';
import EntrerParActivite from './scenes/EntrerParActivite.jsx';
import SoftwareEcosystem from './scenes/SoftwareEcosystem.jsx';
import AgentInAction from './scenes/AgentInAction.jsx';
import Proactivity from './scenes/Proactivity.jsx';
import TaskCommander from './scenes/TaskCommander.jsx';
import DesktopCommanderReveal from './scenes/DesktopCommanderReveal.jsx';
import IAgentBox from './scenes/IAgentBox.jsx';
import TrustInfrastructure from './scenes/TrustInfrastructure.jsx';
import Tarifs from './scenes/Tarifs.jsx';
import CreateYourCompany from './scenes/CreateYourCompany.jsx';
import HumanAgentManifesto from './scenes/HumanAgentManifesto.jsx';
import FinalAccomplishCTA from './scenes/FinalAccomplishCTA.jsx';
import Footer from './scenes/Footer.jsx';

/**
 * The home page: one film of seventeen screens, one idea each, in the order
 * of max's art-direction audit (08/10): the brochures' universe, not a SaaS
 * page. Depth behind the scenes, smoked glass, the charte gradient.
 */
export default function Accueil() {
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] bouton bouton-plein">Aller au contenu</a>
      <ScrollProgress />
      <GlobalNav />
      <main id="contenu">
        <HeroAccomplish />
        <IntentToTeam />
        <NoJargon />
        <ConversationalRecruitment />
        <ProfessionIntelligence />
        <EntrerParActivite />
        <SoftwareEcosystem />
        <AgentInAction />
        <Proactivity />
        <TaskCommander />
        <DesktopCommanderReveal />
        <IAgentBox />
        <TrustInfrastructure />
        <Tarifs />
        <CreateYourCompany />
        <HumanAgentManifesto />
        <FinalAccomplishCTA />
      </main>
      <Footer />
    </>
  );
}
