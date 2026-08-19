import apm from "elastic-apm-node";

const serverUrl = process.env.ELASTIC_APM_SERVER_URL;

if (serverUrl) {
  apm.start({
    serviceName: process.env.ELASTIC_APM_SERVICE_NAME ?? "home-rhythm",
    serverUrl,
    secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
    environment: process.env.ELASTIC_APM_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    active: true,
  });
}

export default apm;
