/**
 * Cloud Run v2 verification & registration adapter for Floci GCP emulator.
 * Registers/queries the service metadata on Floci while the Express process
 * serves requests locally on PORT (and packages via src/backend/Dockerfile).
 */
export class CloudRunAdapter {
  constructor({ projectId, flociEndpoint, servicePort }) {
    this.projectId = projectId;
    this.flociEndpoint = flociEndpoint;
    this.servicePort = Number(servicePort);
    this.region = 'us-central1';
    this.serviceId = 'campusserve-api';
    this.mode = 'emulator';
    this.status = 'verified-emulator';
    this.lastError = null;
    this.serviceResource = null;
  }

  get _baseUrl() {
    return `${this.flociEndpoint}/v2/projects/${this.projectId}/locations/${this.region}/services`;
  }

  async verifyAndRegister() {
    try {
      const listRes = await fetch(this._baseUrl);
      if (!listRes.ok) {
        throw new Error(`Cloud Run v2 list returned HTTP ${listRes.status}`);
      }
      const listData = await listRes.json();
      const services = Array.isArray(listData.services) ? listData.services : [];
      const targetName = `projects/${this.projectId}/locations/${this.region}/services/${this.serviceId}`;
      const existing = services.find((s) => s.name === targetName);

      if (existing) {
        this.serviceResource = existing;
      } else {
        const createRes = await fetch(`${this._baseUrl}?serviceId=${this.serviceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: {
              containers: [
                {
                  image: 'campusserve-backend:local',
                  ports: [{ containerPort: this.servicePort }],
                  env: [
                    { name: 'GOOGLE_CLOUD_PROJECT', value: this.projectId },
                    { name: 'FIRESTORE_EMULATOR_HOST', value: this.flociEndpoint.replace(/^https?:\/\//, '') },
                  ],
                },
              ],
            },
          }),
        });
        if (!createRes.ok) {
          throw new Error(`Cloud Run v2 create returned HTTP ${createRes.status}`);
        }
        const created = await createRes.json();
        this.serviceResource = created.metadata || created;
      }

      this.mode = 'emulator';
      this.status = 'verified-emulator';
      this.lastError = null;
    } catch (err) {
      this.mode = 'adapter';
      this.status = 'labeled-local-adapter';
      this.lastError = err?.message || String(err);
    }

    return this.getHealth();
  }

  getHealth() {
    return {
      mode: this.mode,
      status: this.status,
      sdk: 'Cloud Run v2 REST + Dockerfile',
      target: this._baseUrl,
      serviceId: this.serviceId,
      runtime: `Node.js Express on port ${this.servicePort} (Dockerfile ready)`,
      ...(this.serviceResource?.uri ? { serviceUri: this.serviceResource.uri } : {}),
      ...(this.lastError ? { fallbackReason: this.lastError } : {}),
    };
  }
}
