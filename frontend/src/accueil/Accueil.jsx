import { ScrollProgress } from './composants.jsx';
import GlobalNav from './scenes/GlobalNav.jsx';
import HeroAccomplish from './scenes/HeroAccomplish.jsx';
import IntentToTeam from './scenes/IntentToTeam.jsx';
import NoAIExpertiseRequired from './scenes/NoAIExpertiseRequired.jsx';
import NoJargon from './scenes/NoJargon.jsx';
import ConversationalRecruitment from './scenes/ConversationalRecruitment.jsx';
import ProfessionIntelligence from './scenes/ProfessionIntelligence.jsx';
import SoftwareEcosystem from './scenes/SoftwareEcosystem.jsx';
import AgentInAction from './scenes/AgentInAction.jsx';
import Proactivity from './scenes/Proactivity.jsx';
import TaskCommander from './scenes/TaskCommander.jsx';
import DesktopCommanderReveal from './scenes/DesktopCommanderReveal.jsx';
import IAgentBox from './scenes/IAgentBox.jsx';
import TrustInfrastructure from './scenes/TrustInfrastructure.jsx';
import CreateYourCompany from './scenes/CreateYourCompany.jsx';
import HumanAgentManifesto from './scenes/HumanAgentManifesto.jsx';
import FinalAccomplishCTA from './scenes/FinalAccomplishCTA.jsx';
import Footer from './scenes/Footer.jsx';

/**
 * The home page: one film, sixteen scenes animated on scroll, in the brief's
 * order. max wants this one (08/10), not the static mockup layout that had
 * replaced it on 06/10.
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
        <NoAIExpertiseRequired />
        <NoJargon />
        <ConversationalRecruitment />
        <ProfessionIntelligence />
        <SoftwareEcosystem />
        <AgentInAction />
        <Proactivity />
        <TaskCommander />
        <DesktopCommanderReveal />
        <IAgentBox />
        <TrustInfrastructure />
        <CreateYourCompany />
        <HumanAgentManifesto />
        <FinalAccomplishCTA />
      </main>
      <Footer />
    </>
  );
}
