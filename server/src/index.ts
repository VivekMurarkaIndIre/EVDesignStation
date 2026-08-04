import type { AppLocals } from "./app.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { createSessionMonitor } from "./services/sessionMonitor.js";

const app = createApp();
const { sessionRepository, stationRepository, walletRepository, sessionService, rateSchedule, now } =
  app.locals.deps as AppLocals;

createSessionMonitor({ sessionRepository, stationRepository, walletRepository, sessionService, rateSchedule, now }).start();

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});
