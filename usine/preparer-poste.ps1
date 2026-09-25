<#
.SYNOPSIS
  Prepare un poste LocalAgent en usine : l'application iAgent et les logiciels
  de usine/logiciels.json, telecharges chez leurs editeurs.

.DESCRIPTION
  Le script lit logiciels.json et rien d'autre : ajouter un logiciel, c'est
  ajouter une ligne dans ce fichier. Il peut etre relance autant de fois qu'on
  veut : ce qui est deja installe est saute. Tout est ecrit dans
  C:\ProgramData\iAgent\usine\journal-<date>.txt, et le bilan final dit, logiciel
  par logiciel, ce qui est installe, saute ou en echec.

  Le fichier reste en ASCII, sans accents : Windows PowerShell 5.1 lit un .ps1
  sans BOM comme de l'ANSI et casserait chaque lettre accentuee.

.PARAMETER Essai
  N'installe rien. Verifie que winget connait chaque identifiant et dit ce qui
  serait fait. C'est le premier geste sur une machine neuve.

.PARAMETER Developpeur
  Ajoute les outils pour construire iAgent depuis le depot (Git, Node, Rust,
  outils C++ de Microsoft, VSCodium).

.PARAMETER Modeles
  Tire aussi dans Ollama les modeles listes dans logiciels.json.

.PARAMETER Avec
  Identifiants du groupe "option" a installer en plus, par exemple
  -Avec <id d'Outlook dans logiciels.json>.

.PARAMETER Agents
  Identifiants des agents embauches sur ce poste (AG-0123,AG-0456). Le script
  lit leur fiche et installe les logiciels de leur metier, ecrits dans la fiche
  sous acces.logicielsPoste (GIMP pour un graphiste, OmegaT pour un traducteur).

.PARAMETER TousMetiers
  Installe tous les logiciels par metier, quel que soit l'agent.

.PARAMETER Fiches
  Dossier des fiches d'agents, si elles ne sont ni a cote du dossier usine
  (depot iAgent) ni dans l'application installee.

.PARAMETER SansIAgent
  N'installe pas l'application iAgent.

.PARAMETER EmpreinteIAgent
  Empreinte SHA-256 attendue de l'installeur iAgent. Si elle est donnee et ne
  correspond pas, l'installeur n'est pas lance.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\preparer-poste.ps1 -Essai
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\preparer-poste.ps1 -Modeles
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\preparer-poste.ps1 -Developpeur
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\preparer-poste.ps1 -Agents AG-0123,AG-0456
#>
[CmdletBinding()]
param(
  [switch]$Essai,
  [switch]$Developpeur,
  [switch]$Modeles,
  [string[]]$Avec = @(),
  [string[]]$Agents = @(),
  [switch]$TousMetiers,
  [string]$Fiches,
  [switch]$SansIAgent,
  [string]$EmpreinteIAgent
)

$ErrorActionPreference = 'Stop'
$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$liste = Get-Content -Raw -Encoding UTF8 -Path (Join-Path $ici 'logiciels.json') | ConvertFrom-Json

# --- Journal -----------------------------------------------------------------

$dossierJournal = Join-Path $env:ProgramData 'iAgent\usine'
New-Item -ItemType Directory -Force -Path $dossierJournal | Out-Null
$journal = Join-Path $dossierJournal ('journal-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')

function Ecrire([string]$texte) {
  $ligne = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $texte
  Write-Host $ligne
  Add-Content -Path $journal -Value $ligne -Encoding UTF8
}

$bilan = New-Object System.Collections.Generic.List[object]
function Noter([string]$nom, [string]$groupe, [string]$etat, [string]$detail) {
  $bilan.Add([pscustomobject]@{ Logiciel = $nom; Groupe = $groupe; Etat = $etat; Detail = $detail })
  Ecrire ("{0} : {1} {2}" -f $nom, $etat, $detail)
}

# Lance un programme externe, verse sa sortie dans le journal et rend son code.
# L'erreur locale en Continue est voulue : sous Windows PowerShell 5.1, avec
# Stop, la moindre ligne qu'un programme ecrit sur sa sortie d'erreur arrete le
# script, meme quand le programme reussit.
function Lancer([string]$programme, [string[]]$arguments) {
  $ErrorActionPreference = 'Continue'
  & $programme @arguments 2>&1 | ForEach-Object { Add-Content -Path $journal -Value "    $_" -Encoding UTF8 }
  return $LASTEXITCODE
}

# Apres une installation, le PATH de cette session ne voit pas les nouveaux
# programmes : on le relit dans le registre.
function Rafraichir-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $utilisateur = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$utilisateur"
}

Ecrire ("Preparation du poste {0}, journal : {1}" -f $env:COMPUTERNAME, $journal)
if ($Essai) { Ecrire 'Mode essai : rien ne sera installe.' }

# --- Conditions --------------------------------------------------------------

# Hors de Windows (banc), la question n'a pas de sens : on repond non.
$estAdmin = $false
try {
  $estAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
} catch {}
if (-not $estAdmin -and -not $Essai) {
  Ecrire "Ce script doit etre lance en administrateur (clic droit sur preparer-poste.cmd, 'Executer en tant qu'administrateur'). Il doit l'etre depuis le compte qui sera livre au client : iAgent s'installe dans ce compte."
  exit 2
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Ecrire "winget est absent. Mettre a jour 'Programme d'installation d'application' (App Installer) depuis le Microsoft Store, puis relancer."
  exit 2
}

# --- Ce qu'on installe --------------------------------------------------------

$groupes = @('poste')
if ($Developpeur) { $groupes += 'developpeur' }

# Lance par -File (le .cmd), "-Avec a,b" arrive en une seule chaine.
$Avec = @($Avec | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

# --- Les logiciels du metier des agents ---------------------------------------
# Chaque fiche porte sous acces.logicielsPoste ce que son metier demande au poste,
# derive de ses taches par le depot. On le lit, on ne le recalcule pas ici.

$Agents = @($Agents | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$metier = @()
if ($TousMetiers) {
  $metier = @($liste.logiciels | Where-Object { $_.groupe -eq 'metier' } | ForEach-Object { $_.id })
} elseif ($Agents.Count -gt 0) {
  $candidats = @($Fiches, (Join-Path $ici '..\agents'), (Join-Path $ici '..\socle'))
  if ($env:LOCALAPPDATA) {
    $candidats += @((Join-Path $env:LOCALAPPDATA 'iAgent Desktop\agents'), (Join-Path $env:LOCALAPPDATA 'iAgent Desktop\socle'))
  }
  $dossiers = @($candidats | Where-Object { $_ -and (Test-Path $_) })
  foreach ($a in $Agents) {
    $fiche = $dossiers | ForEach-Object { Get-ChildItem -Path $_ -Filter "$a-*.json" -ErrorAction SilentlyContinue } | Select-Object -First 1
    if (-not $fiche) {
      Noter $a 'metier' 'echec' '(fiche introuvable : donner -Fiches <dossier des fiches>)'
      continue
    }
    $paquet = Get-Content -Raw -Encoding UTF8 -Path $fiche.FullName | ConvertFrom-Json
    $propres = @($paquet.acces.logicielsPoste)
    Ecrire ("{0} ({1}) demande : {2}" -f $a, $paquet.nom, $(if ($propres.Count) { $propres -join ', ' } else { 'rien de plus' }))
    $metier += $propres
  }
}

$aInstaller = @($liste.logiciels | Where-Object { $groupes -contains $_.groupe -or $Avec -contains $_.id -or $metier -contains $_.id })
foreach ($id in $Avec) {
  if (-not ($liste.logiciels | Where-Object { $_.id -eq $id })) {
    Noter $id 'option' 'echec' "(absent de logiciels.json)"
  }
}

# Codes de sortie de winget acceptes : 0 (installe), 3010 (installe, redemarrage
# demande) et 0x8A15002B (deja a jour).
$codesAcceptes = @(0, 3010, -1978335189)

foreach ($l in $aInstaller) {
  $base = @('--id', $l.id, '-e', '--source', $l.source, '--accept-source-agreements')

  if ((Lancer 'winget' (@('list') + $base)) -eq 0) {
    Noter $l.nom $l.groupe 'deja la' ''
    continue
  }

  # On ne devine jamais un identifiant : s'il ne repond plus, on le dit.
  if ((Lancer 'winget' (@('show') + $base)) -ne 0) {
    Noter $l.nom $l.groupe 'echec' ("(winget ne connait pas {0} sur la source {1})" -f $l.id, $l.source)
    continue
  }

  if ($Essai) {
    Noter $l.nom $l.groupe 'a installer' ("({0})" -f $l.id)
    continue
  }

  $arguments = @('install') + $base + @('--silent', '--accept-package-agreements', '--disable-interactivity')
  if ($l.argumentsInstalleur) { $arguments += @('--override', $l.argumentsInstalleur) }

  Ecrire ("Installation de {0} ({1})..." -f $l.nom, $l.id)
  $code = Lancer 'winget' $arguments
  if ($codesAcceptes -contains $code) {
    Noter $l.nom $l.groupe 'installe' ''
  } else {
    Noter $l.nom $l.groupe 'echec' ("(winget a rendu {0})" -f $code)
  }
}

Rafraichir-Path

# --- iAgent ------------------------------------------------------------------

if ($SansIAgent) {
  Noter 'iAgent' 'poste' 'saute' '(-SansIAgent)'
} elseif ($Essai) {
  Noter 'iAgent' 'poste' 'a installer' ("(depuis {0})" -f $liste.iagent.adresse)
} else {
  try {
    # Windows PowerShell 5.1 ne parle pas TLS 1.2 par defaut ; GitHub l'exige.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $installeur = Join-Path $env:TEMP 'iAgent-Windows-setup.exe'
    Ecrire ("Telechargement de iAgent depuis {0}" -f $liste.iagent.adresse)
    Invoke-WebRequest -UseBasicParsing -Uri $liste.iagent.adresse -OutFile $installeur

    $empreinte = (Get-FileHash -Algorithm SHA256 -Path $installeur).Hash
    Ecrire ("Empreinte SHA-256 de l'installeur : {0}" -f $empreinte)
    # Tant qu'iAgent n'est pas signe, on lit NotSigned ici : c'est attendu.
    if (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue) {
      Ecrire ("Signature de l'installeur : {0}" -f (Get-AuthenticodeSignature -FilePath $installeur).Status)
    }

    if ($EmpreinteIAgent -and ($empreinte -ne $EmpreinteIAgent.ToUpper())) {
      Noter 'iAgent' 'poste' 'echec' ("(empreinte {0}, attendue {1} : installeur non lance)" -f $empreinte, $EmpreinteIAgent)
    } else {
      # /S : installation silencieuse de NSIS, dans le compte courant.
      $p = Start-Process -FilePath $installeur -ArgumentList '/S' -Wait -PassThru
      if ($p.ExitCode -eq 0) {
        Noter 'iAgent' 'poste' 'installe' ("(SHA-256 {0})" -f $empreinte)
      } else {
        Noter 'iAgent' 'poste' 'echec' ("(l'installeur a rendu {0})" -f $p.ExitCode)
      }
    }
  } catch {
    Noter 'iAgent' 'poste' 'echec' ("({0})" -f $_.Exception.Message)
  }
}

# --- Modeles du moteur local -------------------------------------------------

if ($Modeles) {
  $ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
  if (-not $ollama) {
    $candidat = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
    if (Test-Path $candidat) { $ollama = $candidat }
  }

  if (-not $ollama) {
    foreach ($m in $liste.modeles.noms) { Noter $m 'modele' 'echec' '(Ollama introuvable)' }
  } elseif ($Essai) {
    foreach ($m in $liste.modeles.noms) { Noter $m 'modele' 'a tirer' '' }
  } else {
    # ollama pull parle au serveur local : on le demarre s'il ne repond pas.
    $repond = $false
    try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null; $repond = $true } catch {}
    if (-not $repond) {
      Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
      for ($i = 0; $i -lt 30 -and -not $repond; $i++) {
        Start-Sleep -Seconds 1
        try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null; $repond = $true } catch {}
      }
    }
    foreach ($m in $liste.modeles.noms) {
      if (-not $repond) { Noter $m 'modele' 'echec' '(le moteur local ne repond pas)'; continue }
      Ecrire ("Telechargement du modele {0}..." -f $m)
      $code = Lancer $ollama @('pull', $m)
      if ($code -eq 0) { Noter $m 'modele' 'installe' '' } else { Noter $m 'modele' 'echec' ("(ollama a rendu {0})" -f $code) }
    }
  }
}

# --- Bilan -------------------------------------------------------------------

$table = $bilan | Format-Table -AutoSize | Out-String -Width 200
Write-Host $table
Add-Content -Path $journal -Value $table -Encoding UTF8

$echecs = @($bilan | Where-Object { $_.Etat -eq 'echec' })
if ($echecs.Count -gt 0) {
  Ecrire ("{0} echec(s). Le poste n'est pas pret ; le detail est dans le journal." -f $echecs.Count)
  exit 1
}
Ecrire 'Poste pret.'
exit 0
