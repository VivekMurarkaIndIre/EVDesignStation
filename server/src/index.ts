import { createApp } from "./app.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

createApp().listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
