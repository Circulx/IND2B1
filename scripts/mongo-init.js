// Runs once when the MongoDB container is first created (docker-compose.yml).
// Creates the application user with access to the "ind2b" database only.
const appPassword = process.env.MONGO_APP_PASSWORD;
if (!appPassword) throw new Error("MONGO_APP_PASSWORD is not set");
db = db.getSiblingDB("ind2b");
db.createUser({ user: "ind2b_app", pwd: appPassword, roles: [{ role: "readWrite", db: "ind2b" }] });
