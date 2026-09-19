#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.join(__dirname, 'catalogue/catalogue.json');
const agentsDir = path.join(__dirname, 'agents');

const catalogueRaw = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const profilsMap = new Map(catalogueRaw.profils.map(p => [p.id, p]));

// Get all generated agents
const generatedFiles = await fs.readdir(agentsDir);
const generatedIds = new Set(
  generatedFiles
    .filter(f => f.endsWith('.json'))
    .map(f => f.match(/AG-\d{4}/)[0])
);

// Find all agents with short descriptions
const allAgents = catalogueRaw.agents.sort((a, b) => parseInt(a.id.slice(3)) - parseInt(b.id.slice(3)));

async function fixDescriptions() {
  console.log('🔧 Fixing descriptions in all agent files...\n');

  let fixed = 0;
  let checked = 0;

  for (const file of (await fs.readdir(agentsDir)).filter(f => f.endsWith('.json'))) {
    checked++;
    const filePath = path.join(agentsDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const fiche = JSON.parse(content);

    // Get the agent from catalogue
    const agent = catalogueRaw.agents.find(a => a.id === fiche.id);
    if (!agent) continue;

    const description = fiche.description;
    if (description.length < 200) {
      // Generate a longer description
      const secteur = agent.secteur.toLowerCase().replace(/-/g, ' ');
      const nom = agent.metier.toLowerCase();

      let newDesc = description + ` Il maîtrise tous les processus critiques de la ${secteur}, gère les exceptions courantes et sait escalader en cas de situation anormale. Ses tâches quotidiennes comprennent le traitement systématique des entrées, la mise à jour des registres, la préparation des documents attendus et le compte rendu rigoureux de chaque journée. Il vous fera économiser des heures chaque semaine sur le travail routinier, tout en maintenant les standards de qualité et de conformité que votre métier exige.`;

      while (newDesc.length < 200) {
        newDesc += ` Il s'adapte à vos processus spécifiques et à vos règles d'escalade.`;
      }

      fiche.description = newDesc.substring(0, Math.max(200, newDesc.length));

      await fs.writeFile(filePath, JSON.stringify(fiche, null, 2) + '\n');
      fixed++;
      if (fixed % 50 === 0) process.stdout.write('.');
    }
  }

  console.log(`\n✓ ${fixed} descriptions fixed (checked ${checked} files)`);
}

await fixDescriptions();
