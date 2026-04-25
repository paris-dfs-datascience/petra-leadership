# Petra Leadership Dashboard — Azure Deployment Runbook

## Infrastructure Summary

| Resource | Name |
|---|---|
| Resource Group | `PET-RG-03` |
| Subscription | `56dff2f4-6710-41f1-bce1-b98e6bff985f` |
| Container Registry | `petraaitools-aebca3bgcnavanh8.azurecr.io` |
| ACR Admin User | `petraaitools` |
| Container App | `petra-leadership` |
| Container Apps Environment | `managedEnvironment-PETRG03-ab42` |
| Image | `petraaitools-aebca3bgcnavanh8.azurecr.io/petra-leadership:latest` |
| Public URL | `https://petra-leadership.politewave-0a5575ae.eastus.azurecontainerapps.io` |
| GitHub Repo | `https://github.com/paris-dfs-datascience/petra-leadership.git` |

The dashboard is a single static SPA (React + Nginx). There is no backend service, no API keys at runtime, and no auth — everything ships in the image.

---

## Prerequisites

- Azure Cloud Shell at https://shell.azure.com (local `az` CLI is blocked by tenant policy)
- Logged in as `mparis@petrafundsgroup.com` with `Contributor` on `PET-RG-03`
- The current `weekly_report.json` saved locally on your laptop (it is **not** stored in git — `.gitignore` excludes it because it contains client communication data)

Always verify subscription before running commands:

```powershell
az account set --subscription 56dff2f4-6710-41f1-bce1-b98e6bff985f
az account show --query "id" --output tsv
```

---

## Deploy Code Changes (no data update)

Use this when only React/TS source, the Dockerfile, or `nginx.conf` changed.

```powershell
git clone https://github.com/paris-dfs-datascience/petra-leadership.git
cd petra-leadership

az acr build --registry petraaitools --image petra-leadership:latest --file Dockerfile .

az containerapp update --name petra-leadership --resource-group PET-RG-03 --image petraaitools-aebca3bgcnavanh8.azurecr.io/petra-leadership:latest
```

Note the build will fail at `Step 13 (COPY data/weekly_report.json …)` if the data file is missing — see next section.

---

## Deploy a New `weekly_report.json`

Use this when `analyze.py` produces a fresh report and you want it live.

1. Generate or obtain the new `weekly_report.json` locally.
2. In Cloud Shell, `cd` to a clean clone (re-clone if your previous session expired):

   ```powershell
   git clone https://github.com/paris-dfs-datascience/petra-leadership.git
   cd petra-leadership
   mkdir data
   ```

3. Upload the file via Cloud Shell's **Manage files → Upload** (lands in `~/`), then move it into the build context:

   ```powershell
   mv $HOME/weekly_report.json $HOME/petra-leadership/data/weekly_report.json
   ls data/weekly_report.json
   ```

4. Build and update:

   ```powershell
   az acr build --registry petraaitools --image petra-leadership:latest --file Dockerfile .
   az containerapp update --name petra-leadership --resource-group PET-RG-03 --image petraaitools-aebca3bgcnavanh8.azurecr.io/petra-leadership:latest
   ```

The data file is baked into the image during build — it never enters git or any public surface.

---

## First-Time Provisioning (already done — for reference)

```powershell
$ACR_PWD = az acr credential show --name petraaitools --query "passwords[0].value" -o tsv

az containerapp create --name petra-leadership --resource-group PET-RG-03 --environment managedEnvironment-PETRG03-ab42 --image petraaitools-aebca3bgcnavanh8.azurecr.io/petra-leadership:latest --target-port 8080 --ingress external --registry-server petraaitools-aebca3bgcnavanh8.azurecr.io --registry-username petraaitools --registry-password $ACR_PWD --min-replicas 0 --max-replicas 2 --cpu 0.25 --memory 0.5Gi
```

---

## Temporary Access Lockdown

The dashboard ingress is `external`, so anyone with the URL can load it. Until Microsoft Entra (Azure AD) authentication is in place, use these to flip public access off between demos.

The FQDN is preserved across off/on cycles — same URL works after re-enabling.

### Lock down (no public access)
```powershell
az containerapp ingress disable --name petra-leadership --resource-group PET-RG-03
```
After this, the public URL returns 404 / unreachable. The revision keeps running but nothing on the internet can hit it.

### Re-open for a demo
```powershell
az containerapp ingress enable --name petra-leadership --resource-group PET-RG-03 --type external --target-port 8080 --transport auto
```
Allow ~30 seconds after running before refreshing the browser (cold start from `min-replicas=0`).

### Verify state
```powershell
az containerapp show --name petra-leadership --resource-group PET-RG-03 --query "properties.configuration.ingress" -o json
```
- Locked: returns `null`
- Open: returns `{ "external": true, "fqdn": "petra-leadership.politewave-...", ... }`

This is a stopgap. The durable fix is Microsoft Entra auth (see Notes below).

---

## ACR Authentication

The Container App pulls from ACR using admin credentials (managed identity is blocked by tenant permissions, same as Petra Vision).

To rotate / re-set credentials:

```powershell
$ACR_PWD = az acr credential show --name petraaitools --query "passwords[0].value" -o tsv
az containerapp registry set --name petra-leadership --resource-group PET-RG-03 --server petraaitools-aebca3bgcnavanh8.azurecr.io --username petraaitools --password $ACR_PWD
```

---

## Check Deployment Status

```powershell
# Latest revisions
az containerapp revision list --name petra-leadership --resource-group PET-RG-03 --output table

# Provisioning state
az containerapp show --name petra-leadership --resource-group PET-RG-03 --query "properties.provisioningState" --output tsv

# Public FQDN
az containerapp show --name petra-leadership --resource-group PET-RG-03 --query "properties.configuration.ingress.fqdn" --output tsv

# Tail logs
az containerapp logs show --name petra-leadership --resource-group PET-RG-03 --tail 50
```

Browser sanity check:
- `https://petra-leadership.politewave-0a5575ae.eastus.azurecontainerapps.io/` should render the dashboard with real client rows.
- `https://.../weekly_report.json` should return the JSON (200, not 404).
- `https://.../healthz` should return `ok`.

---

## Notes & Gotchas

- **Cloud Shell sessions don't persist cloned repos** — re-clone each session and re-upload the data file.
- **`weekly_report.json` is not in git.** `.gitignore` excludes both `weekly_report.json` and `data/weekly_report.json`. `.dockerignore` excludes the rest of `data/` but explicitly re-includes `data/weekly_report.json` via negation so the build can copy it.
- **Linux case-sensitivity.** ACR builds on Linux; local Windows is case-insensitive. Imports must match filenames on disk exactly (`./app` not `./App`, `./clientrow` not `./ClientRow`).
- **Min-replicas is 0** — the app scales to zero when idle. First request after a quiet period will see a cold start of a few seconds.
- **No auth.** Anyone with the URL can view the dashboard. Don't share the FQDN with anyone outside Petra. Future: front with Entra/Azure AD using the same pattern as Petra Vision.
- **Build context excludes `data/` other than the report.** If `analyze.py` later writes intermediate files into `data/` they won't bloat the image.
