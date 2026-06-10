// Import the pre-built Express app bundle produced by the build command.
// This avoids TypeScript workspace resolution issues in Vercel's serverless compiler.
const { default: app } = await import("../artifacts/api-server/dist/app.mjs");
export default app;
