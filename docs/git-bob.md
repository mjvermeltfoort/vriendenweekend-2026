# git-bob

[git-bob](https://github.com/haesleinhuepf/git-bob) helpt via GitHub-issues en pull requests met codevragen, reviews en wijzigingen. De workflow gebruikt versie `0.28.0` en start alleen wanneer een eigenaar, organisatielid of repositorymedewerker `git-bob` noemt in een nieuw issue of een nieuwe reactie. Reacties op pull requests werken via dezelfde `issue_comment`-workflow.

## Eenmalig instellen

1. Voeg onder [Settings → Secrets and variables → Actions](https://github.com/mjvermeltfoort/vriendenweekend-2026/settings/secrets/actions) het secret `GIT_BOB_LLM_NAME` toe met de provider en modelnaam.
2. Voeg de API-sleutel voor die provider als repositorysecret toe. Je hoeft alleen de gekozen provider in te stellen:

| Provider | Voorbeeld voor GIT_BOB_LLM_NAME | Secret voor API-sleutel |
| --- | --- | --- |
| OpenAI | `openai:gpt-4o-2024-08-06` | `OPENAI_API_KEY` |
| Anthropic | `anthropic:claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| Google | `google:gemini-1.5-pro-002` | `GOOGLE_API_KEY` |
| GitHub Models | `github_models:gpt-4o` | `GH_MODELS_API_KEY` |
| Mistral | `mistral:mistral-large-2411` | `MISTRAL_API_KEY` |
| DeepSeek | `deepseek:deepseek-chat` | `DEEPSEEK_API_KEY` |

Deze modelnamen komen uit de git-bob-documentatie. Controleer bij je provider welke modellen voor jouw account beschikbaar zijn; je kunt een ondersteunde andere modelnaam gebruiken.

3. Schakel onder [Settings → Actions → General](https://github.com/mjvermeltfoort/vriendenweekend-2026/settings/actions) **Allow GitHub Actions to create and approve pull requests** in. De workflow vraagt zelf schrijfpermissies voor repository-inhoud, issues en pull requests. `GITHUB_TOKEN` wordt automatisch door GitHub geleverd.
4. Maak een issue met een concrete vraag en plaats een nieuwe reactie: `git-bob comment`. Controleer de run onder **Actions → git-bob** en de reactie op het issue.

Er wordt geen standaardmodel gekozen: zonder `GIT_BOB_LLM_NAME` stopt de workflow met een configuratiemelding.

## Gebruiken

- `git-bob comment`: laat git-bob meedenken over een issue.
- `git-bob solve`: laat git-bob een oplossing en pull request maken.
- `git-bob review this PR. Check code quality and security.`: vraag een review in een reactie op een pull request.
- Plaats vervolgopdrachten als nieuwe reactie; bewerkte reacties starten de workflow niet.

Beschrijf eerst het probleem en beoordeel het voorstel voordat je om implementatie vraagt. Controleer wijzigingen en testresultaten voordat je een gemaakte pull request samenvoegt. De bot krijgt projectspecifieke instructies over AGENTS.md, Nederlandse teksten, Supabase-RPC's, migraties en PWA-versies.

## Kosten en gegevens

Je gekozen AI-provider kan API-kosten rekenen. Issue- en pull-requestinhoud en relevante broncode worden naar die provider verstuurd. Voeg geen spelersgegevens, database-exporten of geheime sleutels aan opdrachten toe. Bewaar API-sleutels uitsluitend als GitHub Actions-secrets.

## Problemen oplossen

- **Ontbrekend model:** stel `GIT_BOB_LLM_NAME` in.
- **Authenticatie of onbekend model:** controleer de providerprefix, modelnaam en bijbehorende API-sleutel.
- **Pull request aanmaken lukt niet:** controleer de Actions-instelling voor het maken van pull requests en eventuele organisatieregels.
- **Workflow overgeslagen:** de opdracht moet `git-bob` bevatten en van een eigenaar, lid of medewerker komen.
- **Wijziging niet gepubliceerd:** commits/pull requests van `GITHUB_TOKEN` starten standaard geen andere workflows. Voeg de door git-bob gemaakte pull request zelf via GitHub samen om de bestaande Pages-workflow te starten.

De bot start vanaf de standaardbranch en installeert geen projectcode of pull-requestafhankelijkheden. Er worden geen opdrachten automatisch uitgevoerd bij iedere push.

Zie ook de [officiële installatiehandleiding](https://github.com/haesleinhuepf/git-bob/blob/main/docs/installation-tutorial.md).
