#!/bin/bash

# Function to commit a batch
commit_batch() {
  local batch_num=$1
  local start_id=$2
  local end_id=$3
  local sectors=$4

  # Add files for this batch
  git add agents/AG-*${start_id:3:4}*.json 2>/dev/null
  git add agents/AG-*${end_id:3:4}*.json 2>/dev/null
  
  # Add intermediate files
  start_num=$(printf "%d" 0x${start_id:3})
  end_num=$(printf "%d" 0x${end_id:3})
  
  for file in agents/AG-*.json; do
    if [[ $file =~ AG-([0-9]{4}) ]]; then
      num=$(printf "%d" 0x${BASH_REMATCH[1]})
      if (( num >= start_num && num <= end_num )); then
        git add "$file" 2>/dev/null
      fi
    fi
  done

  git commit -m "Phase 1: Batch $batch_num — $sectors ($((end_num - start_num + 1)) fiches)

$start_id–$end_id

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016Ro5RiBPMKry1pe7pLaZTm" 2>&1 | tail -3
}

# Commit each batch
commit_batch 5 "0126" "0236" "ressources-humaines, recrutement, commercial, marketing, publicité"
commit_batch 6 "0237" "0347" "publicité, communication, design, photo-vidéo, traduction"
commit_batch 7 "0348" "0457" "traduction, informatique, data, cybersécurité, juridique, immobilier"
commit_batch 8 "0458" "0568" "immobilier, e-commerce, achats, logistique, transport"
commit_batch 9 "0569" "0678" "transport, tourisme, hôtellerie-restauration, formation, conseil, santé-administratif"
commit_batch 10 "0679" "0788" "santé-administratif, BTP, artisans, jardinage, nettoyage"
commit_batch 11 "0789" "0899" "nettoyage, réparation-automobile, services-juridiques, support-client, productivité"

echo "✓ All batches committed"
